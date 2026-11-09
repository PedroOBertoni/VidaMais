import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "../../../app/medicamentos/novo.tsx"), "utf8");

describe("OCR interface safeguards", () => {
  test("shows one analysis action and removes the per-image Gemini action", () => {
    expect(source).not.toContain("Analisar com IA");
    expect(source.match(/: "Analisar imagens"/g)).toHaveLength(1);
  });

  test("keeps the full OCR text only in its closed-by-default original-text modal", () => {
    expect(source).not.toContain("<Text selectable style={styles.resultText}>{resultado.texto}</Text>");
    expect(source).toContain("<Modal visible={textoOriginalVisivel}");
    expect(source).toContain("<Text selectable style={styles.ocrText}>{form.texto_ocr}</Text>");
  });

  test("does not use a native alert for Gemini consent and blocks duplicate taps", () => {
    const start = source.indexOf("<Modal visible={consentimentoModal}");
    const end = source.indexOf("<Modal visible={textoOriginalVisivel}", start);
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, end)).not.toContain("alerta(");
    expect(source).toContain("if (travaAnalise.current || !imagens.length) return;");
  });
});
