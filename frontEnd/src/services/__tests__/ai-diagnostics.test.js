import { formatarRelatorioIA } from "../ai-diagnostics";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));

describe("AI diagnostics privacy and report", () => {
  test("copies only technical fields and omits OCR, image, and credentials", () => {
    const report = formatarRelatorioIA([{
      httpStatus: 504,
      errorCode: "gemini_timeout",
      durationMs: 12002,
      stage: "gemini_timeout",
      correlationId: "correlation-test",
      timestamp: "2026-11-08T12:00:00.000Z",
      model: "gemini-3.5-flash-lite",
      textoOCR: "private OCR",
      imageBase64: "private image",
      token: "private token",
    }]);
    expect(report).toContain("gemini_timeout");
    expect(report).toContain("correlation-test");
    expect(report).not.toContain("private");
    expect(JSON.parse(report).attempts).toHaveLength(1);
  });

  test("keeps the twenty most recent attempts in local storage", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ timestamp: `${i}` }))));
    const { registrarTentativaIA } = require("../ai-diagnostics");
    const next = { httpStatus: 200, errorCode: null, durationMs: 25, stage: "completed", correlationId: null, timestamp: "new", model: "gemini-3.5-flash-lite" };
    await registrarTentativaIA(next);
    const stored = JSON.parse(AsyncStorage.setItem.mock.calls.at(-1)[1]);
    expect(stored).toHaveLength(20);
    expect(stored[0]).toEqual(next);
    expect(stored[19].timestamp).toBe("18");
  });
});
