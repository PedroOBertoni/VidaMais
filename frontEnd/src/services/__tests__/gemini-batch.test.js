import { analisarGeminiEmLote, combinarResultadosGemini } from "../gemini-batch";

const sample = (fields = {}) => ({
  transcricao_linhas: ["L 967605", "F 02/2025", "V 02/2027"],
  lote: "967605", fabricacao: "02/2025", validade: "28/02/2027", campos_incerto: [], avisos: [], ...fields,
});

describe("multi-image Gemini analysis", () => {
  test("sends every selected camera/gallery image once and reports progress", async () => {
    const images = [{ id: "camera" }, { id: "gallery" }];
    const prepare = jest.fn(async image => `payload:${image.id}`);
    const send = jest.fn(async payload => ({ data: sample({ lote: payload }) }));
    const progress = jest.fn();
    const result = await analisarGeminiEmLote(images, [], prepare, send, progress);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.resultados.map(item => item.status)).toEqual(["sucesso", "sucesso"]);
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });

  test("keeps a previous successful image when a later attempt partially fails", async () => {
    const prior = [{ id: "camera", status: "sucesso", dados: sample() }];
    const result = await analisarGeminiEmLote([{ id: "camera" }, { id: "gallery" }], prior, async () => ({}), async () => {
      throw new Error("timeout");
    });
    expect(result.resultados[0]).toMatchObject({ status: "falha", dados: sample() });
    expect(result.resultados[1]).toMatchObject({ status: "falha", dados: null, erro: "timeout" });
    expect(combinarResultadosGemini(result.resultados)).toMatchObject({ lote: "967605", validade: "28/02/2027" });
  });

  test("marks conflicting values for review instead of choosing one", () => {
    const merged = combinarResultadosGemini([
      { id: "a", status: "sucesso", dados: sample({ validade: "28/02/2027" }) },
      { id: "b", status: "sucesso", dados: sample({ validade: "30/04/2027", lote: "OUTRO" }) },
    ]);
    expect(merged.validade).toBeNull();
    expect(merged.lote).toBeNull();
    expect(merged.campos_incerto).toEqual(expect.arrayContaining(["validade", "lote"]));
  });
});
