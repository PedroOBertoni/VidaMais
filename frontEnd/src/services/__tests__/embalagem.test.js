import { extrairEmbalagem } from "../embalagem";

describe("extração dos textos reconhecidos nas embalagens", () => {
  test("reconhece V: como validade sem confundir F: e L: na embalagem fotografada", () => {
    const texto = "Otosporin\nhidrocortisona 10 mg/ml\nsulfato de neomicina 5 mg/mL\nsulfato de polimixina B 10.000 UVmL\nUSO OTOLÓGICO\nSuspensão\nUSO ADULTO E PEDIÁTRIco\nACIMA DE 1 ANO\nContém 1 frasco\ngotejador com 10 mL\nVENDA SOB PRESCRIÇÃO-\nCOM RETENÇÃO DA RECEITA\nFOM\n\nL:261114\nF: 06/26\nV: 06/28";
    expect(extrairEmbalagem(texto)).toEqual({ nome: "Otosporin", laboratorio: "", validade: "30/06/2028", validadeMensal: true });
  });
  test.each(["V: 06/28", "v : 06/2028", "L: 12345\nF: 06/26\nV: 06/28"])("aceita o rótulo de validade abreviado %s", texto => {
    expect(extrairEmbalagem(texto).validade).toBe("30/06/2028");
  });
  test.each(["F: 06/26\nL: 261114", "Vitamina V 06/28", "Versão: 06/28"])("não interpreta outros rótulos como validade: %s", texto => {
    expect(extrairEmbalagem(texto).validade).toBe("");
  });
  test("extrai medicamento com dose, fabricante e validade", () => {
    expect(extrairEmbalagem("EMS\nDIPIRONA 500 mg\n10 comprimidos\nVAL.: 30/11/2027")).toEqual({
      nome: "DIPIRONA", laboratorio: "EMS", validade: "30/11/2027", validadeMensal: false,
    });
  });
  test.each([ ["VAL 02/28", "29/02/2028"], ["Validade: 02/2027", "28/02/2027"], ["VENC.\n12/2030", "31/12/2030"] ])("sugere fim do mês para %s e sinaliza revisão", (texto, esperado) => {
    expect(extrairEmbalagem(texto)).toMatchObject({ validade: esperado, validadeMensal: true });
  });
  test("não confunde data de fabricação ou lote com validade", () => {
    expect(extrairEmbalagem("FAB: 01/02/2026\nLOTE 10/27").validade).toBe("");
  });
  test.each(["VAL: 31/02/2027", "VAL: 13/2027", "Validade não legível", ""]) ("não inventa datas para %s", texto => {
    expect(extrairEmbalagem(texto).validade).toBe("");
  });
  test("usa rótulos explícitos", () => {
    expect(extrairEmbalagem("Nome: Paracetamol\nLaboratório: Exemplo\nVencimento: 10-12-27")).toMatchObject({
      nome: "Paracetamol", laboratorio: "Exemplo", validade: "10/12/2027",
    });
  });
});
