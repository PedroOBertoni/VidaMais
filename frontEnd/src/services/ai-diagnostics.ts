import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "vidamais.ai-diagnostics.v1";
const MAX_ATTEMPTS = 20;

export type AiAttempt = {
  httpStatus: number | null;
  errorCode: string | null;
  durationMs: number;
  stage: string;
  correlationId: string | null;
  timestamp: string;
  model: string;
};

export async function listarTentativasIA(): Promise<AiAttempt[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.slice(0, MAX_ATTEMPTS).filter(item => item && typeof item === "object") as AiAttempt[];
  } catch {
    return [];
  }
}

export async function registrarTentativaIA(attempt: AiAttempt): Promise<void> {
  const previous = await listarTentativasIA();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([attempt, ...previous].slice(0, MAX_ATTEMPTS)));
  } catch {
    // Diagnosis must never prevent OCR or medication editing.
  }
}

export function formatarRelatorioIA(attempts: AiAttempt[]): string {
  return JSON.stringify({
    app: "Vida+",
    generated_at: new Date().toISOString(),
    attempts: attempts.slice(0, MAX_ATTEMPTS).map(({ httpStatus, errorCode, durationMs, stage, correlationId, timestamp, model }) => ({
      http_status: httpStatus,
      error_code: errorCode,
      duration_ms: durationMs,
      stage,
      correlation_id: correlationId,
      timestamp,
      model,
    })),
  }, null, 2);
}
