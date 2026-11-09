import * as ImageManipulator from "expo-image-manipulator";
import { garantirUsuarioAutenticado, supabase } from "./supabase";
import { validarRespostaGemini, type RespostaGemini } from "./gemini-validade";
import { registrarTentativaIA } from "./ai-diagnostics";

const MAX_BASE64_CHARS = 4_194_304;

export type GeminiImagePayload = { mimeType: string; imageBase64: string };

export async function prepararImagemParaGemini(uri: string) {
  if (!uri) throw new Error("Selecione uma imagem antes de solicitar a análise.");
  for (const compress of [0.94, 0.86, 0.78]) {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (result.base64 && result.base64.length <= MAX_BASE64_CHARS) {
      return { mimeType: "image/jpeg", imageBase64: result.base64 };
    }
  }
  throw new Error("A imagem ainda é grande demais. Recorte somente a região da validade e tente novamente.");
}

export async function invocarGemini(payload: GeminiImagePayload): Promise<RespostaGemini> {
  if (!supabase) throw new Error("A conexão com Supabase não está configurada neste app.");
  const started = Date.now();
  const timestamp = new Date().toISOString();
  let httpStatus: number | null = null;
  let errorCode: string | null = null;
  let stage = "authentication";
  let correlationId: string | null = null;
  try {
    await garantirUsuarioAutenticado();
    stage = "edge_request";
    const { data, error } = await supabase.functions.invoke("analisar-validade", { body: payload });
    if (error) {
      const context = error.context;
      if (context instanceof Response) {
        httpStatus = context.status;
        correlationId = context.headers.get("x-correlation-id");
        try {
          const body = await context.clone().json() as { error?: { code?: unknown; diagnostic?: { correlation_id?: unknown; stage?: unknown } } };
          if (typeof body.error?.code === "string") errorCode = body.error.code;
          if (typeof body.error?.diagnostic?.correlation_id === "string") correlationId = body.error.diagnostic.correlation_id;
          if (typeof body.error?.diagnostic?.stage === "string") stage = body.error.diagnostic.stage;
        } catch { /* A gateway timeout may not include JSON. */ }
      }
      errorCode ??= httpStatus === 504 ? "platform_timeout" : "edge_invoke_error";
      if (errorCode === "gemini_timeout") throw new Error("A chamada ao Gemini excedeu o limite interno de tempo. Consulte Diagnóstico de IA.");
      if (errorCode === "gemini_auth_error") throw new Error("O Gemini recusou a credencial configurada no servidor.");
      if (errorCode === "gemini_quota_exceeded") throw new Error("A quota do Gemini foi excedida. Tente novamente mais tarde.");
      if (errorCode === "gemini_model_invalid") throw new Error("O modelo Gemini configurado não está disponível.");
      if (errorCode === "platform_timeout") stage = "platform_timeout";
      throw new Error("O serviço de IA está indisponível. Consulte Diagnóstico de IA para ver o status e a etapa.");
    }
    httpStatus = 200;
    stage = "response_validation";
    const validated = validarRespostaGemini(data);
    stage = "completed";
    const remote = data && typeof data === "object" ? (data as { diagnostic?: { correlation_id?: string; model?: string } }).diagnostic : undefined;
    await registrarTentativaIA({ httpStatus, errorCode: null, durationMs: Date.now() - started, stage, correlationId: remote?.correlation_id ?? null, timestamp, model: remote?.model ?? "gemini-3.5-flash-lite" });
    return validated;
  } catch (error) {
    if (error instanceof Error) {
      if (!errorCode) errorCode = stage === "response_validation" ? "invalid_model_response" : "network_error";
      if (httpStatus === 504 && !correlationId) { errorCode = "platform_timeout"; stage = "platform_timeout"; }
      await registrarTentativaIA({ httpStatus, errorCode, durationMs: Date.now() - started, stage, correlationId, timestamp, model: "gemini-3.5-flash-lite" });
      if (/resposta inválida|validade inválida|fora do formato|Diagnóstico de IA|Gemini recusou|quota do Gemini|modelo Gemini/.test(error.message)) throw error;
    }
    throw new Error("Não foi possível conectar à análise por IA. Consulte Diagnóstico de IA.");
  }
}