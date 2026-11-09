import { extrairEmbalagem } from "./embalagem";

export type OrigemImagem = "camera" | "galeria";

export type AssetImagem = {
  uri: string;
  assetId?: string | null;
};

export type ImagemSelecionada = {
  id: string;
  uri: string;
  recorteUri?: string;
  assetId: string | null;
  origem: OrigemImagem;
};

export type ResultadoImagem = {
  id: string;
  status: "sucesso" | "sem-texto" | "sem-validade" | "falha";
  texto?: string;
  erro?: string;
};

export type DestinoOCR = "embalagem" | "bula" | "validade";
export type CampoOCR = "nome" | "laboratorio" | "validade" | "indicacao" | "contraindicacoes" | "posologia" | "efeitos_adversos" | "precaucoes";

export type ConflitoOCR = {
  campo: CampoOCR;
  rotulo: string;
  valores: string[];
};

export function adicionarImagens(
  atuais: ImagemSelecionada[],
  assets: AssetImagem[],
  origem: OrigemImagem,
): ImagemSelecionada[] {
  const chaves = new Set(atuais.map(imagem => imagem.assetId ? `asset:${imagem.assetId}` : `uri:${imagem.uri}`));
  const novas = [...atuais];
  for (const asset of assets) {
    if (!asset.uri) continue;
    const assetId = asset.assetId ?? null;
    const chave = assetId ? `asset:${assetId}` : `uri:${asset.uri}`;
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    novas.push({ id: chave, uri: asset.uri, assetId, origem });
  }
  return novas;
}

export function removerImagem(imagens: ImagemSelecionada[], id: string) {
  return imagens.filter(imagem => imagem.id !== id);
}

export async function analisarImagens(
  imagens: ImagemSelecionada[],
  resultadosAnteriores: ResultadoImagem[],
  reconhecer: (imagem: ImagemSelecionada) => Promise<string>,
  aoProgredir?: (concluidas: number, total: number) => void,
  destino: DestinoOCR = "embalagem",
) {
  const anteriores = new Map(resultadosAnteriores.map(resultado => [resultado.id, resultado]));
  const resultados = new Map<string, ResultadoImagem>();
  const novosSucessos: ResultadoImagem[] = [];

  aoProgredir?.(0, imagens.length);
  for (let i = 0; i < imagens.length; i++) {
    const imagem = imagens[i];
    const anterior = anteriores.get(imagem.id);
    if (anterior?.status === "sucesso") {
      resultados.set(imagem.id, anterior);
      aoProgredir?.(i + 1, imagens.length);
      continue;
    }

    try {
      const texto = (await reconhecer(imagem)).trim();
      if (!texto) {
        resultados.set(imagem.id, { id: imagem.id, status: "sem-texto", erro: "Nenhum texto detectado pelo ML Kit." });
        aoProgredir?.(i + 1, imagens.length);
        continue;
      }
      const semValidade = destino === "validade" && extrairEmbalagem(texto).candidatasValidade.length === 0;
      const resultado: ResultadoImagem = { id: imagem.id, status: semValidade ? "sem-validade" : "sucesso", texto,
        ...(semValidade ? { erro: "Texto reconhecido, mas nenhuma validade identificada." } : {}) };
      resultados.set(imagem.id, resultado);
      novosSucessos.push(resultado);
    } catch (erro) {
      resultados.set(imagem.id, {
        id: imagem.id,
        status: "falha",
        erro: erro instanceof Error ? erro.message : "Falha ao reconhecer esta imagem.",
      });
    }
    aoProgredir?.(i + 1, imagens.length);
  }

  return {
    resultados: imagens.flatMap(imagem => {
      const resultado = resultados.get(imagem.id);
      return resultado ? [resultado] : [];
    }),
    novosSucessos,
  };
}

export function combinarTextosReconhecidos(resultados: ResultadoImagem[]) {
  return resultados
    .filter((resultado): resultado is ResultadoImagem & { texto: string } => resultado.status !== "falha" && resultado.status !== "sem-texto" && Boolean(resultado.texto?.trim()))
    .map(resultado => resultado.texto.trim())
    .join("\n\n");
}

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function detectarSecao(linha: string): CampoOCR | null {
  const texto = normalizar(linha).toUpperCase();
  if (/REA(?:COES)? ADVERSAS|EFEITOS ADVERSOS|QUAIS OS MALES/.test(texto)) return "efeitos_adversos";
  if (/CONTRAINDICAC|QUANDO NAO DEVO USAR|QUANDO NAO PODE/.test(texto)) return "contraindicacoes";
  if (/POSOLOG|COMO DEVO USAR|COMO USAR/.test(texto)) return "posologia";
  if (/ADVERTENCIAS|PRECAUCOES|ANTES DE USAR/.test(texto)) return "precaucoes";
  if (/INDICAC|PARA QUE .* INDICAD|PARA QUE SERVE/.test(texto)) return "indicacao";
  return null;
}

export function extrairSecoesBula(texto: string): Partial<Record<CampoOCR, string>> {
  const secoes: Partial<Record<CampoOCR, string[]>> = {};
  let atual: CampoOCR | null = null;
  for (const linhaOriginal of texto.split(/\r?\n/)) {
    const linha = linhaOriginal.trim();
    if (!linha) continue;
    const cabecalho = detectarSecao(linha);
    if (cabecalho) {
      atual = cabecalho;
      secoes[atual] ??= [];
      continue;
    }
    if (atual) secoes[atual]?.push(linha);
  }

  const resultado: Partial<Record<CampoOCR, string>> = {};
  for (const [campo, linhas] of Object.entries(secoes) as [CampoOCR, string[]][]) {
    const valor = linhas.join(" ").replace(/\s+/g, " ").trim();
    if (valor) resultado[campo] = valor;
  }
  return resultado;
}

export function sugerirCamposReconhecidos(resultados: ResultadoImagem[], destino: DestinoOCR) {
  const sucessos = resultados
    .map((resultado, indice) => ({ resultado, indice }))
    .filter(({ resultado }) => resultado.status !== "falha" && resultado.status !== "sem-texto" && Boolean(resultado.texto?.trim()));
  const sugestoes: Partial<Record<CampoOCR, string>> = {};
  const conflitos: ConflitoOCR[] = [];
  let validadeMensal = false;
  let validadeIncerta = false;

  if (destino === "bula") {
    return { sugestoes: extrairSecoesBula(sucessos.map(({ resultado }) => resultado.texto).join("\n")), conflitos, validadeMensal, validadeIncerta };
  }

  const campos: { chave: "nome" | "laboratorio" | "validade"; rotulo: string }[] = [
    { chave: "nome", rotulo: "Nome" },
    { chave: "laboratorio", rotulo: "Laboratório" },
    { chave: "validade", rotulo: "Validade" },
  ];
  const extraidos = sucessos.map(({ resultado, indice }) => ({ imagem: indice + 1, dados: extrairEmbalagem(resultado.texto ?? "") }));
  for (const campo of campos) {
    const valores = extraidos.flatMap(({ imagem, dados }) => {
      if (campo.chave === "validade") {
        return dados.candidatasValidade.map(valor => ({ imagem, valor }));
      }
      return dados[campo.chave] ? [{ imagem, valor: dados[campo.chave] }] : [];
    });
    const distintos = new Map<string, string>();
    for (const item of valores) if (!distintos.has(normalizar(item.valor))) distintos.set(normalizar(item.valor), item.valor);
    if (distintos.size > 1) {
      conflitos.push({ campo: campo.chave, rotulo: campo.rotulo, valores: [...distintos.values()] });
    } else if (distintos.size === 1) {
      sugestoes[campo.chave] = [...distintos.values()][0];
    }
  }
  validadeMensal = extraidos.some(({ dados }) => dados.validadeMensal && Boolean(sugestoes.validade));
  validadeIncerta = extraidos.some(({ dados }) => dados.validadeIncerta && Boolean(sugestoes.validade));
  return { sugestoes, conflitos, validadeMensal, validadeIncerta };
}

export function preencherCamposVazios<T extends Record<string, unknown>>(
  formulario: T,
  sugestoes: Partial<Record<CampoOCR, string>>,
  conflitos: ConflitoOCR[] = [],
): T {
  const camposEmConflito = new Set(conflitos.map(conflito => conflito.campo));
  const proximo: Record<string, unknown> = { ...formulario };
  for (const [campo, valor] of Object.entries(sugestoes) as [CampoOCR, string][]) {
    const atual = proximo[campo];
    if (!camposEmConflito.has(campo) && typeof atual === "string" && !atual.trim() && valor.trim()) {
      proximo[campo] = valor;
    }
  }
  return proximo as T;
}
