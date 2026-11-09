import AsyncStorage from "@react-native-async-storage/async-storage";
import { consentimentoPendente, lerConsentimentoGemini, revogarConsentimentoGemini, salvarConsentimentoGemini } from "../gemini-consent";

jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));

describe("Gemini consent preference", () => {
  beforeEach(() => jest.clearAllMocks());

  test("requires consent until granted for this session or persisted on the device", () => {
    expect(consentimentoPendente(false, false)).toBe(true);
    expect(consentimentoPendente(true, false)).toBe(false);
    expect(consentimentoPendente(false, true)).toBe(false);
  });

  test("persists, reads, and revokes the optional device preference", async () => {
    await salvarConsentimentoGemini();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("vidamais.gemini-consent.v1", "granted");
    AsyncStorage.getItem.mockResolvedValue("granted");
    await expect(lerConsentimentoGemini()).resolves.toBe(true);
    await revogarConsentimentoGemini();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("vidamais.gemini-consent.v1");
  });
});
