import { aplicarResultadoGemini, executarComConsentimento, validarRespostaGemini } from "../gemini-validade";

const suggestion = {
  transcricao_linhas: ["L 967605", "F 02/2025", "V 02/2027"],
  lote: "967605",
  fabricacao: "02/2025",
  validade: "28/02/2027",
  campos_incerto: [],
  avisos: [],
};

describe("Gemini Vision consent and result application", () => {
  test("cancelled consent does not prepare or send the image", async () => {
    const prepare = jest.fn();
    const send = jest.fn();
    await expect(executarComConsentimento(async () => false, prepare, send)).resolves.toEqual({ status: "cancelada" });
    expect(prepare).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("only prepares and sends after consent", async () => {
    const prepare = jest.fn(async () => ({ imageBase64: "image" }));
    const send = jest.fn(async () => "result");
    await expect(executarComConsentimento(async () => true, prepare, send)).resolves.toEqual({ status: "concluida", resultado: "result" });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ imageBase64: "image" });
  });

  test("keeps an existing manual or trusted local validity and preserves prior OCR", () => {
    const form = { validade: "01/03/2027", texto_ocr: "Texto local anterior", leitura_em: "old" };
    const applied = aplicarResultadoGemini(form, suggestion, true);
    expect(applied.form.validade).toBe("01/03/2027");
    expect(applied.form.texto_ocr).toContain("Texto local anterior");
    expect(applied.form.texto_ocr).toContain("L 967605");
    expect(applied.form.leitura_em).not.toBe("old");
  });

  test("fills an empty validity and replaces only an unprotected existing value", () => {
    expect(aplicarResultadoGemini({ validade: "", texto_ocr: "", leitura_em: "" }, suggestion, false).form.validade)
      .toBe("28/02/2027");
    expect(aplicarResultadoGemini({ validade: "31/01/2027", texto_ocr: "", leitura_em: "" }, suggestion, false).form.validade)
      .toBe("28/02/2027");
  });

  test("rejects impossible dates and preserves uncertainty metadata", () => {
    expect(() => validarRespostaGemini({ ok: true, data: { ...suggestion, validade: "31/02/2027" } })).toThrow(/inválida/);
    expect(validarRespostaGemini({ ok: true, data: { ...suggestion, validade: null, campos_incerto: ["validade"] } }).data.campos_incerto)
      .toContain("validade");
  });
});
