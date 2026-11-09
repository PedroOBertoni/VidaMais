import { extrairEmbalagem } from "../embalagem";

describe("extracao de validade em embalagens", () => {
  test("preserves name/lab recognition and monthly V: expiry", () => {
    expect(extrairEmbalagem("Otosporin\nEurofarma\nF: 06/26\nV: 06/28")).toMatchObject({
      nome: "Otosporin", laboratorio: "Eurofarma", validade: "30/06/2028", validadeMensal: true,
    });
  });

  test.each([
    ["VALIDADE: 29/02/2028", "29/02/2028", false],
    ["VAL: 30.06.2028", "30/06/2028", false],
    ["VENC. 30-06-28", "30/06/2028", false],
    ["VAL: 06/28", "30/06/2028", true],
    ["VAL: 06/2028", "30/06/2028", true],
    ["VAL: 0628", "30/06/2028", true],
    ["VAL: 062028", "30/06/2028", true],
    ["VAL: 30062028", "30/06/2028", false],
  ])("reads supported date format in %s", (text, expected, monthly) => {
    expect(extrairEmbalagem(text)).toMatchObject({ validade: expected, validadeMensal: monthly });
  });

  test.each([
    ["FAB: 01/2024\nVAL: 10/2027", "31/10/2027"],
    ["MFG 01/2024 EXP 01/2026", "31/01/2026"],
    ["FABR.\n01/2024\nVENCIMENTO\n02/2028", "29/02/2028"],
    ["F: 01/24\nLOTE 261114\nV : 06/28", "30/06/2028"],
  ])("does not confuse manufacturing date or lot with validity: %s", (text, expected) => {
    expect(extrairEmbalagem(text).validade).toBe(expected);
  });

  test("keeps a numeric lot from being parsed as a date", () => {
    expect(extrairEmbalagem("LOTE 30062028\nFAB: 01/2024").validade).toBe("");
  });

  test("normalizes OCR confusions only inside a labeled date and marks it uncertain", () => {
    expect(extrairEmbalagem("VAL: O6/2O28")).toMatchObject({
      validade: "30/06/2028", validadeMensal: true, validadeIncerta: true,
    });
  });

  test.each(["VAL: 31/02/2027", "VAL: 13/2027", "VAL: 00/2028", "VAL: 06322028", ""]) (
    "rejects impossible or missing dates: %s", text => {
      expect(extrairEmbalagem(text).validade).toBe("");
    }
  );

  test("reports multiple validity values instead of selecting one", () => {
    expect(extrairEmbalagem("VAL: 06/2028\nEXP: 06/2029")).toMatchObject({
      validade: "", candidatasValidade: ["30/06/2028", "30/06/2029"],
    });
  });

  test("does not turn manufacturing or an unlabelled number into expiry", () => {
    expect(extrairEmbalagem("FAB: 01/02/2026\nLOTE 10/27\n30/06/2028").validade).toBe("");
  });
});
