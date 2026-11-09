import { tecnologiaOCR } from "../ocr-routing";

describe("OCR technology selection", () => {
  test("uses only ML Kit for package and leaflet flows", () => {
    expect(tecnologiaOCR("embalagem")).toBe("mlkit");
    expect(tecnologiaOCR("bula")).toBe("mlkit");
  });

  test("routes lot and expiry directly to Gemini", () => {
    expect(tecnologiaOCR("validade")).toBe("gemini");
  });
});
