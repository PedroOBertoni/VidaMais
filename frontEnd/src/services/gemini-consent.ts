import AsyncStorage from "@react-native-async-storage/async-storage";

const CONSENT_KEY = "vidamais.gemini-consent.v1";

export async function lerConsentimentoGemini(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(CONSENT_KEY)) === "granted"; }
  catch { return false; }
}

export async function salvarConsentimentoGemini(): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, "granted");
}

export async function revogarConsentimentoGemini(): Promise<void> {
  await AsyncStorage.removeItem(CONSENT_KEY);
}

export function consentimentoPendente(persistido: boolean, nestaSessao: boolean): boolean {
  return !persistido && !nestaSessao;
}
