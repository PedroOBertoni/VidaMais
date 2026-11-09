import type { GeminiValidade } from "./gemini-validade";

export type ResultadoGeminiImagem = {
  id: string;
  status: "sucesso" | "falha";
  dados: GeminiValidade | null;
  erro?: string;
};

export async function analisarGeminiEmLote<TImagem extends { id: string }, TPayload>(
  imagens: TImagem[],
  anteriores: ResultadoGeminiImagem[],
  preparar: (imagem: TImagem) => Promise<TPayload>,
  enviar: (payload: TPayload) => Promise<{ data: GeminiValidade }>,
  aoProgredir?: (concluidas: number, total: number) => void,
) {
  const anterioresPorId = new Map(anteriores.map(resultado => [resultado.id, resultado]));
  const resultados: ResultadoGeminiImagem[] = [];
  aoProgredir?.(0, imagens.length);
  for (const [indice, imagem] of imagens.entries()) {
    const anterior = anterioresPorId.get(imagem.id);
    try {
      const dados = (await enviar(await preparar(imagem))).data;
      resultados.push({ id: imagem.id, status: "sucesso", dados });
    } catch (error) {
      resultados.push({
        id: imagem.id,
        status: "falha",
        dados: anterior?.dados ?? null,
        erro: error instanceof Error ? error.message : "Falha nesta imagem; tente novamente.",
      });
    }
    aoProgredir?.(indice + 1, imagens.length);
  }
  const porId = new Map(anteriores.map(resultado => [resultado.id, resultado]));
  for (const resultado of resultados) porId.set(resultado.id, resultado);
  const todas = imagens.flatMap(imagem => porId.has(imagem.id) ? [porId.get(imagem.id)!] : []);
  return { resultados: todas, novos: resultados };
}

export function combinarResultadosGemini(resultados: ResultadoGeminiImagem[]): GeminiValidade | null {
  const dados = resultados.flatMap(resultado => resultado.dados ? [resultado.dados] : []);
  if (!dados.length) return null;
  const linhas = [...new Set(dados.flatMap(item => item.transcricao_linhas))];
  const incertos = new Set(dados.flatMap(item => item.campos_incerto));
  const avisos = [...new Set(dados.flatMap(item => item.avisos))];
  const combine = (field: "lote" | "fabricacao" | "validade") => {
    const values = [...new Set(dados.map(item => item[field]).filter((value): value is string => Boolean(value)))];
    if (values.length > 1) {
      incertos.add(field);
      avisos.push(`As imagens têm valores diferentes para ${field}; confira antes de confirmar.`);
      return null;
    }
    return values[0] ?? null;
  };
  const lote = combine("lote");
  const fabricacao = combine("fabricacao");
  const validade = combine("validade");
  return { transcricao_linhas: linhas, lote, fabricacao, validade, campos_incerto: [...incertos], avisos: [...new Set(avisos)] };
}
