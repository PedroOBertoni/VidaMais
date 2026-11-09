import { converterDataParaISO } from "../types/medicamento";

export type GeminiValidade = {
  transcricao_linhas: string[];
  lote: string | null;
  fabricacao: string | null;
  validade: string | null;
  campos_incerto: ("lote" | "fabricacao" | "validade")[];
  avisos: string[];
};

export type RespostaGemini = { ok: true; data: GeminiValidade };

export async function executarComConsentimento<TImagem, TResultado>(
  confirmar: () => Promise<boolean>,
  prepararImagem: () => Promise<TImagem>,
  enviar: (imagem: TImagem) => Promise<TResultado>,
): Promise<{ status: "cancelada" } | { status: "concluida"; resultado: TResultado }> {
  if (!await confirmar()) return { status: "cancelada" };
  const imagem = await prepararImagem();
  return { status: "concluida", resultado: await enviar(imagem) };
}

export function validarRespostaGemini(value: unknown): RespostaGemini {
  if (!value || typeof value !== "object" || (value as Record<string, unknown>).ok !== true) {
    throw new Error("A análise por IA retornou uma resposta inválida.");
  }
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") throw new Error("A análise por IA não retornou dados estruturados.");
  const result = data as Record<string, unknown>;
  const nullableString = (candidate: unknown) => candidate === null || typeof candidate === "string";
  if (!Array.isArray(result.transcricao_linhas) || result.transcricao_linhas.some(line => typeof line !== "string") ||
      !nullableString(result.lote) || !nullableString(result.fabricacao) || !nullableString(result.validade) ||
      !Array.isArray(result.campos_incerto) || !Array.isArray(result.avisos)) {
    throw new Error("A análise por IA retornou campos fora do formato esperado.");
  }
  const allowed = new Set(["lote", "fabricacao", "validade"]);
  if (result.campos_incerto.some(field => !allowed.has(String(field))) || result.avisos.some(warning => typeof warning !== "string")) {
    throw new Error("A análise por IA retornou campos fora do formato esperado.");
  }
  const expiry = result.validade;
  if (expiry && !converterDataParaISO(expiry)) throw new Error("A IA sugeriu uma validade inválida. Confira a imagem e corrija manualmente.");
  return value as RespostaGemini;
}

export function aplicarGeminiConfirmado<T extends { validade: string; texto_ocr: string; leitura_em: string }>(
  form: T,
  suggestion: GeminiValidade,
  validadeProtegida: boolean,
) {
  const date = suggestion.validade;
  if (date && !converterDataParaISO(date)) throw new Error("Corrija a validade sugerida antes de confirmar.");
  const atual = form.validade.trim();
  const preencherValidade = Boolean(date) && (!atual || !validadeProtegida);
  const linhas: string[] = ["[Gemini Vision — confirmado pelo usuário]", ...suggestion.transcricao_linhas];
  if (suggestion.lote) linhas.push(`Lote: ${suggestion.lote}`);
  if (suggestion.fabricacao) linhas.push(`Fabricação: ${suggestion.fabricacao}`);
  if (date) linhas.push(`Validade: ${date}`);
  const anotacao = linhas.join("\n").trim();
  const textoAtual = form.texto_ocr.trim();
  const textoOCR = textoAtual.includes(anotacao) ? form.texto_ocr : [textoAtual, anotacao].filter(Boolean).join("\n\n");
  return {
    form: {
      ...form,
      validade: preencherValidade ? date! : form.validade,
      texto_ocr: textoOCR,
      leitura_em: new Date().toISOString(),
    },
    validadeAplicada: preencherValidade,
    anotacao,
  };
}
