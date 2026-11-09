export type CampoIncerto = "lote" | "fabricacao" | "validade";

export type DadosGemini = {
  transcricao_linhas: string[];
  lote: string | null;
  fabricacao: string | null;
  validade: string | null;
  campos_incerto: CampoIncerto[];
  avisos: string[];
};

type Limiter = { allow: (userId: string) => { allowed: boolean; retryAfterSeconds: number } };

export function getAuthenticatedUserId(context: unknown): string | null {
  if (!context || typeof context !== "object") return null;
  const value = context as {
    userClaims?: { id?: unknown } | null;
    jwtClaims?: { sub?: unknown } | null;
  };
  if (typeof value.userClaims?.id === "string" && value.userClaims.id) return value.userClaims.id;
  if (typeof value.jwtClaims?.sub === "string" && value.jwtClaims.sub) return value.jwtClaims.sub;
  return null;
}

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_BODY_BYTES = 4 * 1024 * 1024 + 8192;
const GEMINI_TIMEOUT_MS = 12_000;
const MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const PROMPT = "Analise exclusivamente o texto visivel nesta imagem de embalagem farmaceutica. Identifique lote, fabricacao e validade. Considere impressao industrial pontilhada, abreviacoes L, F, V, FAB, VAL, EXP e formatos brasileiros. Transcreva os caracteres efetivamente visiveis. Nao invente informacoes. Nao deduza validade a partir da fabricacao. Caso exista duvida, informe-a. Para campos ausentes, use string vazia. Retorne todas as chaves do formato solicitado.";

const MIME_MAGICS: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  "image/webp": bytes => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
};

export function createRateLimiter({ maxRequests = 5, windowMs = 60_000, now = Date.now, maxUsers = 2_000 } = {}): Limiter {
  const requests = new Map<string, number[]>();
  return {
    allow(userId) {
      const current = now();
      const active = (requests.get(userId) ?? []).filter(time => current - time < windowMs);
      if (active.length >= maxRequests) {
        requests.set(userId, active);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (current - active[0])) / 1_000)) };
      }
      active.push(current);
      requests.set(userId, active);
      if (requests.size > maxUsers) {
        for (const [id, times] of requests) {
          if (requests.size <= maxUsers) break;
          if (!times.length || current - times[times.length - 1] >= windowMs || id !== userId) requests.delete(id);
        }
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function erro(status: number, code: string, message: string, retryable = false, extraHeaders: Record<string, string> = {}) {
  return json(status, { ok: false, error: { code, message, retryable } }, extraHeaders);
}

async function readLimitedJson(request: Request) {
  const headerSize = Number(request.headers.get("content-length") ?? 0);
  if (headerSize > MAX_BODY_BYTES) throw new RangeError("body_too_large");
  if (!request.body) return JSON.parse("") as unknown;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function readImage(value: unknown): { mimeType: string; data: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.mimeType !== "string" || typeof body.imageBase64 !== "string") return null;
  if (!(body.mimeType in MIME_MAGICS)) return null;
  const encoded = body.imageBase64;
  if (!encoded || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  let binary: string;
  try { binary = atob(encoded); } catch { return null; }
  if (!binary.length || binary.length > MAX_IMAGE_BYTES) return null;
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (!MIME_MAGICS[body.mimeType](bytes)) return null;
  return { mimeType: body.mimeType, data: encoded };
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as Record<string, unknown>;
  if (typeof response.output_text === "string") return response.output_text;
  if (Array.isArray(response.candidates)) {
    const texts: string[] = [];
    for (const candidate of response.candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const content = (candidate as Record<string, unknown>).content;
      if (!content || typeof content !== "object") continue;
      const parts = (content as Record<string, unknown>).parts;
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
          texts.push((part as Record<string, unknown>).text as string);
        }
      }
    }
    if (texts.length) return texts.join("\n");
  }
  if (!Array.isArray(response.steps)) return null;
  const texts: string[] = [];
  for (const step of response.steps) {
    if (!step || typeof step !== "object") continue;
    const item = step as Record<string, unknown>;
    if (item.type !== "model_output" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" && (part as Record<string, unknown>).type === "text") {
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string") texts.push(text);
      }
    }
  }
  return texts.join("\n") || null;
}

const SAFE_GEMINI_STATUSES = new Set([
  "INVALID_ARGUMENT", "PERMISSION_DENIED", "NOT_FOUND", "RESOURCE_EXHAUSTED",
  "UNAUTHENTICATED", "FAILED_PRECONDITION", "UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED",
]);

function safeGeminiStatus(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "UNKNOWN";
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return "UNKNOWN";
  const status = (error as Record<string, unknown>).status;
  return typeof status === "string" && SAFE_GEMINI_STATUSES.has(status) ? status : "UNKNOWN";
}

function stringOrNull(value: unknown, maxLength: number) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u001f]/.test(value)) return undefined;
  return value.trim() || null;
}

function parseDate(value: string): { iso: string; display: string; monthOnly: boolean } | null {
  const dayMonthYear = /^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$/.exec(value.trim());
  if (dayMonthYear) {
    const [, d, m, y] = dayMonthYear;
    const day = Number(d), month = Number(m), year = Number(y);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 2000 || year > 2199 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return { iso: `${y}-${m}-${d}`, display: `${d}/${m}/${y}`, monthOnly: false };
  }
  const monthYear = /^(\d{2})[/.\-](\d{2}|\d{4})$/.exec(value.trim());
  if (!monthYear) return null;
  const month = Number(monthYear[1]);
  const year = Number(monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2199) return null;
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = String(day).padStart(2, "0"), m = String(month).padStart(2, "0"), y = String(year);
  return { iso: `${y}-${m}-${d}`, display: `${d}/${m}/${y}`, monthOnly: true };
}

export function validateModelData(value: unknown): DadosGemini | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (!Array.isArray(object.transcricao_linhas) || !Array.isArray(object.campos_incerto) || !Array.isArray(object.avisos)) return null;
  if (object.transcricao_linhas.length > 20 || object.campos_incerto.length > 3 || object.avisos.length > 10) return null;
  const lines = object.transcricao_linhas.map(line => stringOrNull(line, 120));
  const uncertain = object.campos_incerto;
  const warnings = object.avisos.map(warning => stringOrNull(warning, 240));
  if (lines.some(item => item === undefined) || warnings.some(item => item === undefined) || uncertain.some(item => !["lote", "fabricacao", "validade"].includes(String(item)))) return null;
  const lote = stringOrNull(object.lote, 40);
  const rawFabricacao = stringOrNull(object.fabricacao, 24);
  const rawValidade = stringOrNull(object.validade, 24);
  if (lote === undefined || rawFabricacao === undefined || rawValidade === undefined) return null;

  const avisos = warnings.filter((item): item is string => typeof item === "string");
  const camposIncerto = new Set(uncertain as CampoIncerto[]);
  let fabricacao = rawFabricacao;
  let validade = rawValidade;
  let dataFabricacao: ReturnType<typeof parseDate> = null;
  let dataValidade: ReturnType<typeof parseDate> = null;

  if (rawFabricacao) {
    dataFabricacao = parseDate(rawFabricacao);
    if (!dataFabricacao) {
      fabricacao = null;
      camposIncerto.add("fabricacao");
      avisos.push("A data de fabricação não passou na validação de calendário e exige revisão manual.");
    } else {
      fabricacao = dataFabricacao.monthOnly ? rawFabricacao : dataFabricacao.display;
      if (dataFabricacao.monthOnly) avisos.push("A fabricação foi reconhecida como mês/ano; confira a transcrição.");
    }
  }
  if (rawValidade) {
    dataValidade = parseDate(rawValidade);
    if (!dataValidade) {
      validade = null;
      camposIncerto.add("validade");
      avisos.push("A validade não passou na validação de calendário e exige revisão manual.");
    } else {
      validade = dataValidade.display;
      if (dataValidade.monthOnly) avisos.push("A validade mensal foi convertida para o último dia do mês; confirme na embalagem.");
    }
  }
  if (dataFabricacao && dataValidade && dataFabricacao.iso >= dataValidade.iso) {
    validade = null;
    camposIncerto.add("fabricacao");
    camposIncerto.add("validade");
    avisos.push("Fabricação igual ou posterior à validade: a validade foi removida da sugestão. Confira os rótulos e a imagem.");
  }
  return {
    transcricao_linhas: lines.filter((line): line is string => typeof line === "string"),
    lote,
    fabricacao,
    validade,
    campos_incerto: [...camposIncerto],
    avisos: avisos.slice(0, 10),
  };
}

export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcricao_linhas: { type: "ARRAY", items: { type: "STRING" } },
    lote: { type: "STRING" },
    fabricacao: { type: "STRING" },
    validade: { type: "STRING" },
    campos_incerto: { type: "ARRAY", items: { type: "STRING", enum: ["lote", "fabricacao", "validade"] } },
    avisos: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["transcricao_linhas", "lote", "fabricacao", "validade", "campos_incerto", "avisos"],
} as const;

export function createHandler(deps: {
  getUserId: (request: Request) => string | null | Promise<string | null>;
  geminiApiKey: string | undefined;
  fetchImpl?: typeof fetch;
  limiter?: Limiter;
  timeoutMs?: number;
  now?: () => number;
  createCorrelationId?: () => string;
  log?: (record: Record<string, unknown>) => void;
}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const limiter = deps.limiter ?? createRateLimiter();
  const timeoutMs = deps.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const now = deps.now ?? (() => performance.now());
  const correlation = deps.createCorrelationId ?? (() => crypto.randomUUID());
  const log = deps.log ?? ((record: Record<string, unknown>) => console.info(JSON.stringify({ service: "analisar-validade", ...record })));

  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    const started = now();
    const correlationId = correlation();
    let stage = "request_received";
    const duration = () => Math.max(0, Math.round(now() - started));
    const emit = (event: string, extra: Record<string, unknown> = {}) => log({ event, correlation_id: correlationId, stage, elapsed_ms: duration(), model: MODEL, ...extra });
    const respond = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) => {
      const durationMs = duration();
      emit("response_sent", { http_status: status });
      const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : null;
      const diagnostic = { correlation_id: correlationId, stage, duration_ms: durationMs, model: MODEL };
      const responseBody = error
        ? { ...body, error: { ...error, diagnostic: { ...(error.diagnostic as Record<string, unknown> | undefined), ...diagnostic } } }
        : { ...body, diagnostic };
      return json(status, responseBody, { "x-correlation-id": correlationId, "server-timing": `total;dur=${durationMs}`, ...headers });
    };

    emit("request_received", { method: request.method });
    if (request.method !== "POST") return respond(405, { ok: false, error: { code: "method_not_allowed", message: "Use POST.", retryable: false } }, { allow: "POST, OPTIONS" });
    stage = "authentication";
    let userId: string | null;
    try { userId = await deps.getUserId(request); }
    catch { emit("authentication_failed"); return respond(401, { ok: false, error: { code: "unauthorized", message: "Sessão Supabase inválida.", retryable: false } }); }
    if (!userId) { emit("authentication_failed"); return respond(401, { ok: false, error: { code: "unauthorized", message: "É necessária uma sessão Supabase válida.", retryable: false } }); }
    emit("authentication_completed");

    const quota = limiter.allow(userId);
    if (!quota.allowed) return respond(429, { ok: false, error: { code: "rate_limited", message: "Limite temporário de análises atingido. Aguarde antes de tentar novamente.", retryable: true } }, { "retry-after": String(quota.retryAfterSeconds) });
    if (!deps.geminiApiKey?.trim()) return respond(503, { ok: false, error: { code: "ai_unconfigured", message: "A análise por IA ainda não está configurada no servidor.", retryable: false } });

    stage = "image_validation";
    let body: unknown;
    try { body = await readLimitedJson(request); }
    catch (error) {
      if (error instanceof RangeError) return respond(413, { ok: false, error: { code: "image_too_large", message: "A imagem excede o limite aceito.", retryable: false } });
      return respond(400, { ok: false, error: { code: "invalid_json", message: "O corpo da solicitação deve ser JSON válido.", retryable: false } });
    }
    const image = readImage(body);
    if (!image) {
      const bodyImage = body && typeof body === "object" ? (body as Record<string, unknown>).imageBase64 : null;
      if (typeof bodyImage === "string" && bodyImage.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8) return respond(413, { ok: false, error: { code: "image_too_large", message: "A imagem excede o limite de 3 MiB.", retryable: false } });
      return respond(400, { ok: false, error: { code: "invalid_image", message: "Envie uma imagem JPEG, PNG ou WebP válida, de até 3 MiB.", retryable: false } });
    }
    stage = "image_validated";
    emit("image_validated", { mime_type: image.mimeType, image_bytes: Math.floor(image.data.length * 3 / 4) });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const providerStarted = now();
    stage = "gemini_request";
    emit("gemini_request_started", { timeout_ms: timeoutMs });
    try {
      const response = await fetchImpl(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": deps.geminiApiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: PROMPT }, { inline_data: { mime_type: image.mimeType, data: image.data } }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: GEMINI_RESPONSE_SCHEMA, maxOutputTokens: 512, thinkingConfig: { thinkingLevel: "low" } },
        }),
      });
      const providerDurationMs = Math.max(0, Math.round(now() - providerStarted));
      stage = "gemini_response";
      emit("gemini_response_received", { provider_http_status: response.status, provider_duration_ms: providerDurationMs });
      if (!response.ok) {
        let providerBody: unknown;
        try { providerBody = await response.json(); } catch { providerBody = null; }
        const providerStatus = safeGeminiStatus(providerBody);
        const code = response.status === 404 || providerStatus === "NOT_FOUND" ? "gemini_model_invalid"
          : response.status === 401 || response.status === 403 ? "gemini_auth_error"
          : response.status === 429 ? "gemini_quota_exceeded"
          : response.status === 400 ? "gemini_invalid_request"
          : response.status >= 500 ? "gemini_provider_unavailable" : "gemini_request_rejected";
        const message = code === "gemini_model_invalid" ? "O modelo configurado não está disponível para este endpoint."
          : code === "gemini_auth_error" ? "O Gemini recusou a credencial configurada no servidor."
          : code === "gemini_quota_exceeded" ? "A quota do Gemini foi excedida. Tente novamente mais tarde."
          : code === "gemini_invalid_request" ? "O Gemini rejeitou o formato da solicitação."
          : "O serviço Gemini está indisponível. Tente novamente mais tarde.";
        return respond(response.status === 429 ? 429 : 502, { ok: false, error: { code, message, retryable: !["gemini_model_invalid", "gemini_auth_error", "gemini_invalid_request"].includes(code), diagnostic: { provider_http_status: response.status, provider_status: providerStatus, provider_duration_ms: providerDurationMs } } });
      }
      let payload: unknown;
      try { payload = await response.json(); }
      catch { stage = "response_parsing"; return respond(502, { ok: false, error: { code: "invalid_model_response", message: "O serviço de IA retornou uma resposta inválida.", retryable: true } }); }
      const raw = outputText(payload);
      if (!raw) { stage = "response_parsing"; return respond(502, { ok: false, error: { code: "invalid_model_response", message: "O serviço de IA não retornou os campos esperados.", retryable: true } }); }
      let decoded: unknown;
      try { decoded = JSON.parse(raw); }
      catch { stage = "response_parsing"; return respond(502, { ok: false, error: { code: "invalid_model_response", message: "O serviço de IA retornou JSON inválido.", retryable: true } }); }
      const data = validateModelData(decoded);
      if (!data) { stage = "response_validation"; return respond(502, { ok: false, error: { code: "invalid_model_response", message: "O serviço de IA retornou dados fora do formato esperado.", retryable: true } }); }
      stage = "json_parsed";
      emit("json_parsed", { field_count: 6 });
      return respond(200, { ok: true, data });
    } catch (error) {
      const providerElapsed = Math.max(0, Math.round(now() - providerStarted));
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        stage = "gemini_timeout";
        emit("gemini_timeout", { provider_elapsed_ms: providerElapsed, timeout_ms: timeoutMs });
        return respond(504, { ok: false, error: { code: "gemini_timeout", message: "A chamada ao Gemini excedeu 12 segundos e foi interrompida com segurança.", retryable: true } });
      }
      stage = "network_error";
      const errorName = error && typeof error === "object" && "name" in error && typeof error.name === "string" ? error.name : "UnknownError";
      emit("gemini_network_error", { error_name: errorName, provider_elapsed_ms: providerElapsed });
      return respond(502, { ok: false, error: { code: "gemini_network_error", message: "Não foi possível conectar ao serviço Gemini. Verifique a rede do backend.", retryable: true } });
    } finally { clearTimeout(timer); }
  };
}
