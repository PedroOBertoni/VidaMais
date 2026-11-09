import { reconhecerValidadeComAlternativas } from "../pipeline-validade";

describe("pipeline OCR direcionado para validade", () => {
  test("preserves the original result and skips transforms when it already has a labeled expiry", async () => {
    const reconhecer = jest.fn(async () => "EUROFARMA\nVAL: 06/2028");
    const transformar = jest.fn();
    await expect(reconhecerValidadeComAlternativas({ uri: "file://original.jpg" }, reconhecer, transformar))
      .resolves.toContain("VAL: 06/2028");
    expect(reconhecer).toHaveBeenCalledTimes(1);
    expect(transformar).not.toHaveBeenCalled();
  });

  test("tries rotations only after original text lacks an expiry, and stops on a successful orientation", async () => {
    const reconhecer = jest.fn(async uri => uri.includes("rot90") ? "VAL: 06/2028" : "DOMPERIDONA 10 mg");
    const transformar = jest.fn(async (_uri, degrees) => `file://rot${degrees}.png`);
    const texto = await reconhecerValidadeComAlternativas({ uri: "file://original.jpg" }, reconhecer, transformar);
    expect(texto).toContain("Imagem original");
    expect(texto).toContain("Rotação 90°");
    expect(texto).toContain("DOMPERIDONA 10 mg");
    expect(texto).toContain("VAL: 06/2028");
    expect(transformar).toHaveBeenCalledTimes(1);
  });

  test("tries the user crop while preserving the uncropped original", async () => {
    const reconhecer = jest.fn(async uri => uri.includes("crop") ? "EXP 10/2028" : "EUROFARMA");
    const transformar = jest.fn();
    const texto = await reconhecerValidadeComAlternativas({ uri: "file://original.jpg", recorteUri: "file://crop.png" }, reconhecer, transformar);
    expect(reconhecer).toHaveBeenNthCalledWith(1, "file://original.jpg");
    expect(reconhecer).toHaveBeenNthCalledWith(2, "file://crop.png");
    expect(texto).toContain("Imagem original");
    expect(texto).toContain("Região recortada");
    expect(transformar).not.toHaveBeenCalled();
  });

  test("does not discard original text when pre-processing or rotation fails", async () => {
    const reconhecer = jest.fn(async () => "Texto original reconhecido");
    const transformar = jest.fn(async () => { throw new Error("Falha de pre-processamento"); });
    const texto = await reconhecerValidadeComAlternativas({ uri: "file://original.jpg" }, reconhecer, transformar);
    expect(texto).toContain("Texto original reconhecido");
  });

  test("reports technical failure only when no original or transformed OCR result exists", async () => {
    const reconhecer = jest.fn(async () => { throw new Error("arquivo ilegível"); });
    const transformar = jest.fn(async () => { throw new Error("rotação indisponível"); });
    await expect(reconhecerValidadeComAlternativas({ uri: "file://original.jpg" }, reconhecer, transformar))
      .rejects.toThrow("Falha técnica no OCR/pre-processamento");
  });
});
