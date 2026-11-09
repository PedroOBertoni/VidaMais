import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve(__dirname, "../../../../supabase/functions/analisar-validade/core.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const edgeModule = { exports: {} };
new Function("exports", "require", "module", compiled)(edgeModule.exports, require, edgeModule);
const { createHandler, createRateLimiter, getAuthenticatedUserId, MAX_IMAGE_BYTES, validateModelData } = edgeModule.exports;
let consoleInfo;
beforeAll(() => { consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {}); });
afterAll(() => { consoleInfo.mockRestore(); });

const validModel = {
  transcricao_linhas: ["L 967605", "F 02/2025", "V 02/2027"],
  lote: "967605",
  fabricacao: "02/2025",
  validade: "02/2027",
  campos_incerto: [],
  avisos: [],
};

function imageBytes(mime = "image/png", size = 16) {
  const header = mime === "image/png"
    ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    : mime === "image/jpeg"
      ? [0xff, 0xd8, 0xff, 0xe0]
      : [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
  return Uint8Array.from({ length: size }, (_, index) => header[index] ?? 1);
}

function requestFor(bytes = imageBytes(), mimeType = "image/png", options = {}) {
  return new Request("https://project.supabase.co/functions/v1/analisar-validade", {
    method: "POST",
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    body: options.raw ?? JSON.stringify({ mimeType, imageBase64: Buffer.from(bytes).toString("base64") }),
  });
}

function geminiResponse(data = validModel, init = {}) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: typeof data === "string" ? data : JSON.stringify(data) }] } }],
  }), { status: 200, ...init });
}

describe("Edge Function analisar-validade", () => {
  test("reads normalized user identity from Supabase userClaims.id or raw JWT jwtClaims.sub", () => {
    expect(getAuthenticatedUserId({ userClaims: { id: "anonymous-id" }, jwtClaims: { sub: "raw-id" } })).toBe("anonymous-id");
    expect(getAuthenticatedUserId({ userClaims: null, jwtClaims: { sub: "raw-id" } })).toBe("raw-id");
    expect(getAuthenticatedUserId({ userClaims: null, jwtClaims: null })).toBeNull();
  });

  test("accepts an authenticated anonymous session and returns structured Gemini fields", async () => {
    const fetchImpl = jest.fn(async () => geminiResponse());
    const handle = createHandler({ getUserId: () => "anonymous-auth-user-id", geminiApiKey: "test-secret", fetchImpl });
    const response = await handle(requestFor());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      data: { lote: "967605", fabricacao: "02/2025", validade: "28/02/2027" },
      diagnostic: { stage: "json_parsed", model: "gemini-3.5-flash-lite" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    const upstream = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    expect(upstream.generationConfig.thinkingConfig.thinkingLevel).toBe("low");
    expect(upstream.generationConfig.responseMimeType).toBe("application/json");
    expect(upstream.generationConfig.responseSchema.properties.validade.type).toBe("STRING");
    expect(upstream.contents[0].parts[0].text).toContain("Nao deduza validade a partir da fabricacao");
    expect(upstream.contents[0].parts[1].inline_data.mime_type).toBe("image/png");
  });

  test("rejects a request without a verified Supabase user", async () => {
    const fetchImpl = jest.fn();
    const handle = createHandler({ getUserId: () => null, geminiApiKey: "test-secret", fetchImpl });
    const response = await handle(requestFor());
    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("allows only a valid image and rejects unsupported or mismatched MIME", async () => {
    const handle = createHandler({ getUserId: () => "user", geminiApiKey: "test-secret", fetchImpl: jest.fn() });
    expect((await handle(requestFor(imageBytes("image/png"), "image/jpeg"))).status).toBe(400);
    expect((await handle(requestFor(imageBytes("image/png"), "image/gif"))).status).toBe(400);
  });

  test("enforces image-size limit", async () => {
    const handle = createHandler({ getUserId: () => "user", geminiApiKey: "test-secret", fetchImpl: jest.fn() });
    const bytes = new Uint8Array(MAX_IMAGE_BYTES + 1);
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
    const response = await handle(requestFor(bytes));
    expect(response.status).toBe(400);
  });

  test("returns an actionable server response when GEMINI_API_KEY is absent", async () => {
    const handle = createHandler({ getUserId: () => "user", geminiApiKey: undefined, fetchImpl: jest.fn() });
    expect(await (await handle(requestFor())).json()).toMatchObject({ ok: false, error: { code: "ai_unconfigured" } });
  });

  test("rejects malformed JSON from the client and malformed JSON from Gemini", async () => {
    const handle = createHandler({ getUserId: () => "user", geminiApiKey: "test-secret", fetchImpl: jest.fn(async () => geminiResponse("not-json")) });
    expect((await handle(requestFor(undefined, undefined, { raw: "{" }))).status).toBe(400);
    expect((await handle(requestFor())).status).toBe(502);
  });

  test("rejects incomplete structured model output", async () => {
    const handle = createHandler({ getUserId: () => "user", geminiApiKey: "test-secret", fetchImpl: jest.fn(async () => geminiResponse({ validade: "02/2027" })) });
    expect((await handle(requestFor())).status).toBe(502);
  });

  test("does not infer expiry from fabrication and flags impossible dates", () => {
    const noExpiry = validateModelData({ ...validModel, validade: null });
    expect(noExpiry.validade).toBeNull();
    const invalid = validateModelData({ ...validModel, validade: "31/02/2027" });
    expect(invalid.validade).toBeNull();
    expect(invalid.campos_incerto).toContain("validade");
  });

  test("flags a fabrication date that is not before expiry", () => {
    const result = validateModelData({ ...validModel, fabricacao: "03/2027", validade: "02/2027" });
    expect(result.validade).toBeNull();
    expect(result.campos_incerto).toEqual(expect.arrayContaining(["fabricacao", "validade"]));
  });

  test("handles Gemini upstream errors with safe diagnostics but without returning its body or secret", async () => {
    const handle = createHandler({ getUserId: () => "user", geminiApiKey: "do-not-return", fetchImpl: jest.fn(async () => new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "secret upstream detail" } }), { status: 429 })) });
    const response = await handle(requestFor());
    const body = await response.text();
    expect(response.status).toBe(429);
    expect(body).toContain('"provider_http_status":429');
    expect(body).toContain('"provider_status":"RESOURCE_EXHAUSTED"');
    expect(body).not.toContain("secret upstream detail");
    expect(body).not.toContain("do-not-return");
  });

  test("maps network failures and timeouts to safe JSON errors", async () => {
    const network = createHandler({ getUserId: () => "user", geminiApiKey: "test-secret", fetchImpl: jest.fn(async () => { throw new Error("network secret"); }) });
    expect(await (await network(requestFor())).json()).toMatchObject({ error: { code: "gemini_network_error", diagnostic: { stage: "network_error", correlation_id: expect.any(String) } } });
    const timeout = createHandler({
      getUserId: () => "user",
      geminiApiKey: "test-secret",
      timeoutMs: 2,
      fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    });
    const timedOut = await timeout(requestFor());
    expect(timedOut.status).toBe(504);
    expect(await timedOut.json()).toMatchObject({ error: { code: "gemini_timeout", diagnostic: { stage: "gemini_timeout", duration_ms: expect.any(Number) } } });
  });

  test("limits repeated requests per verified user", async () => {
    let now = 1_000;
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 10_000, now: () => now });
    const handle = createHandler({ getUserId: () => "same-anonymous-user", geminiApiKey: "test-secret", limiter, fetchImpl: jest.fn(async () => geminiResponse()) });
    expect((await handle(requestFor())).status).toBe(200);
    const limited = await handle(requestFor());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("10");
    now += 11_000;
    expect((await handle(requestFor())).status).toBe(200);
  });

  test("supports the documented WebP image signature", async () => {
    const fetchImpl = jest.fn(async () => geminiResponse());
    const handle = createHandler({ getUserId: () => "user", geminiApiKey: "test-secret", fetchImpl });
    expect((await handle(requestFor(imageBytes("image/webp"), "image/webp"))).status).toBe(200);
  });
});
