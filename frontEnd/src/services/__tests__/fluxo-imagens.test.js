import {
  adicionarImagens,
  analisarImagens,
  extrairSecoesBula,
  preencherCamposVazios,
  removerImagem,
  sugerirCamposReconhecidos,
} from "../fluxo-imagens";

const foto = (id, origem = "camera", assetId = id) => ({ id, uri: `file://${id}.jpg`, origem, assetId });

describe("seleção e análise de várias imagens OCR", () => {
  test("adiciona várias imagens de câmera e galeria na mesma coleção", () => {
    const camera = adicionarImagens([], [
      { uri: "file://frente.jpg", assetId: null },
      { uri: "file://lateral.jpg", assetId: null },
    ], "camera");
    const combinado = adicionarImagens(camera, [{ uri: "ph://validade", assetId: "asset-validade" }], "galeria");
    expect(combinado).toHaveLength(3);
    expect(combinado.map(imagem => imagem.origem)).toEqual(["camera", "camera", "galeria"]);
  });

  test("ignora imagens repetidas quando URI ou assetId identificam o mesmo arquivo", () => {
    const atuais = adicionarImagens([], [{ uri: "ph://1", assetId: "asset-1" }], "galeria");
    const atualizadas = adicionarImagens(atuais, [
      { uri: "ph://cache-copia", assetId: "asset-1" },
      { uri: "file://2.jpg", assetId: null },
      { uri: "file://2.jpg", assetId: null },
    ], "camera");
    expect(atualizadas).toHaveLength(2);
  });

  test("cancelar o seletor não adiciona imagens nem remove as anteriores", () => {
    const atuais = adicionarImagens([], [{ uri: "file://frente.jpg" }], "camera");
    expect(adicionarImagens(atuais, [], "galeria")).toEqual(atuais);
  });

  test("remove uma imagem individual sem afetar as outras", () => {
    const imagens = [foto("frente"), foto("validade", "galeria")];
    expect(removerImagem(imagens, "frente")).toEqual([imagens[1]]);
  });

  test("mantém resultados anteriores e permite falha parcial por imagem", async () => {
    const imagens = [foto("concluida"), foto("falha"), foto("nova")];
    const reconhecer = jest.fn(async imagem => {
      if (imagem.uri.includes("falha")) throw new Error("Imagem desfocada");
      return "Texto da nova foto";
    });
    const progresso = jest.fn();
    const lote = await analisarImagens(
      imagens,
      [{ id: "concluida", status: "sucesso", texto: "Texto preservado" }, { id: "falha", status: "falha", erro: "Erro anterior" }],
      reconhecer,
      progresso,
    );

    expect(reconhecer).toHaveBeenCalledTimes(2);
    expect(lote.resultados).toEqual([
      { id: "concluida", status: "sucesso", texto: "Texto preservado" },
      { id: "falha", status: "falha", erro: "Imagem desfocada" },
      { id: "nova", status: "sucesso", texto: "Texto da nova foto" },
    ]);
    expect(lote.novosSucessos.map(resultado => resultado.id)).toEqual(["nova"]);
    expect(progresso).toHaveBeenLastCalledWith(3, 3);
  });

  test("reaproveita imagem reconhecida ao tentar novamente apenas as falhas", async () => {
    const imagens = [foto("ok"), foto("retry")];
    const reconhecer = jest.fn(async () => "Leitura recuperada");
    const lote = await analisarImagens(
      imagens,
      [{ id: "ok", status: "sucesso", texto: "Leitura anterior" }, { id: "retry", status: "falha", erro: "Sem foco" }],
      reconhecer,
    );
    expect(reconhecer).toHaveBeenCalledTimes(1);
    expect(reconhecer).toHaveBeenCalledWith(imagens[1]);
    expect(lote.resultados[0].texto).toBe("Leitura anterior");
    expect(lote.resultados[1].texto).toBe("Leitura recuperada");
  });

  test("distingue texto detectado sem validade de uma imagem sem texto", async () => {
    const imagens = [foto("texto"), foto("vazia")];
    const lote = await analisarImagens(imagens, [], async imagem => imagem.id === "texto" ? "EUROFARMA\nDOMPERIDONA 10 mg" : "", undefined, "validade");
    expect(lote.resultados[0]).toMatchObject({ status: "sem-validade", texto: "EUROFARMA\nDOMPERIDONA 10 mg" });
    expect(lote.resultados[1]).toMatchObject({ status: "sem-texto" });
  });

  test("detecta valores conflitantes da embalagem e deixa o campo sem sugestão", () => {
    const leitura = sugerirCamposReconhecidos([
      { id: "1", status: "sucesso", texto: "DIPIRONA 500 mg\nEMS\nVAL: 30/11/2027" },
      { id: "2", status: "sucesso", texto: "PARACETAMOL 750 mg\nEMS\nVAL: 30/11/2027" },
    ], "embalagem");
    expect(leitura.conflitos).toContainEqual(expect.objectContaining({ campo: "nome" }));
    expect(leitura.sugestoes.nome).toBeUndefined();
    expect(leitura.sugestoes.laboratorio).toBe("EMS");
  });

  test("does not silently select between expiry dates found in one image", () => {
    const leitura = sugerirCamposReconhecidos([
      { id: "1", status: "sucesso", texto: "VAL: 06/2028\nEXP: 06/2029" },
    ], "validade");
    expect(leitura.sugestoes.validade).toBeUndefined();
    expect(leitura.conflitos).toContainEqual(expect.objectContaining({
      campo: "validade", valores: ["30/06/2028", "30/06/2029"],
    }));
  });

  test("carries low-confidence date correction to the review warning", () => {
    const leitura = sugerirCamposReconhecidos([
      { id: "1", status: "sucesso", texto: "VAL: O6/2O28" },
    ], "validade");
    expect(leitura.sugestoes.validade).toBe("30/06/2028");
    expect(leitura.validadeIncerta).toBe(true);
  });

  test("separa seções de bula e não sugere o texto inteiro para Observações", () => {
    const secoes = extrairSecoesBula([
      "1. INDICAÇÕES",
      "Alívio temporário da dor.",
      "2. CONTRAINDICAÇÕES",
      "Não usar em caso de alergia.",
      "3. POSOLOGIA",
      "Usar conforme orientação médica.",
      "4. ADVERTÊNCIAS E PRECAUÇÕES",
      "Manter fora do alcance de crianças.",
      "5. REAÇÕES ADVERSAS",
      "Pode causar náusea.",
    ].join("\n"));
    expect(secoes).toMatchObject({
      indicacao: "Alívio temporário da dor.",
      contraindicacoes: "Não usar em caso de alergia.",
      posologia: "Usar conforme orientação médica.",
      precaucoes: "Manter fora do alcance de crianças.",
      efeitos_adversos: "Pode causar náusea.",
    });
    expect(secoes).not.toHaveProperty("observacoes");
  });

  test("preenche somente campos vazios e preserva o que o usuário digitou", () => {
    const formulario = { nome: "Meu nome revisado", laboratorio: "", validade: "", indicacao: "Indicação manual" };
    expect(preencherCamposVazios(formulario, {
      nome: "Nome da embalagem", laboratorio: "EMS", validade: "30/11/2027", indicacao: "Sugestão OCR",
    })).toEqual({
      nome: "Meu nome revisado", laboratorio: "EMS", validade: "30/11/2027", indicacao: "Indicação manual",
    });
    expect(preencherCamposVazios({ nome: "" }, { nome: "Nome conflitante" }, [
      { campo: "nome", rotulo: "Nome", valores: ["Nome A", "Nome B"] },
    ])).toEqual({ nome: "" });
  });
});
