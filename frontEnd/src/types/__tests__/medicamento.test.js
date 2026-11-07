import {
  converterDataParaISO,
  diasRestantes,
  formatarData,
  getStatusValidade,
} from "../medicamento";

describe("datas de validade", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-13T12:00:00"));
  });

  afterEach(() => jest.useRealTimers());

  test("converte uma data válida para ISO", () => {
    expect(converterDataParaISO("30/09/2026")).toBe("2026-09-30");
  });

  test.each(["31/02/2026", "00/10/2026", "1/10/2026", "texto"])(
    "rejeita a data inválida %s",
    data => expect(converterDataParaISO(data)).toBeNull()
  );

  test("formata uma data ISO", () => {
    expect(formatarData("2026-09-30")).toBe("30/09/2026");
  });

  test("classifica datas vencidas, próximas e válidas", () => {
    expect(getStatusValidade("2026-09-12")).toBe("vencido");
    expect(getStatusValidade("2026-10-13")).toBe("proximo");
    expect(getStatusValidade("2026-10-14")).toBe("valido");
    expect(diasRestantes("2026-10-13")).toBe(30);
  });
});
