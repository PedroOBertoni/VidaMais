import { converterDataParaISO } from "../types/medicamento";

// Somente sugestões de texto impresso; não é uma identificação farmacológica.
export function extrairEmbalagem(texto: string) {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rotulo = /(?:\b(?:validade|vencimento|venc\.?|val\.?)|(?:^|\n)[ \t]*v[ \t]*:)\s*[:.\-]?\s*(\d{2})\s*[\/.\-]\s*(\d{4}|\d{2})(?:\s*[\/.\-]\s*(\d{4}|\d{2}))?(?!\d)/gi;
  let validade = "";
  let validadeMensal = false;
  for (const match of texto.matchAll(rotulo)) {
    if (match[3]) {
      const ano = match[3].length === 2 ? `20${match[3]}` : match[3];
      const data = `${match[1]}/${match[2]}/${ano}`;
      if (converterDataParaISO(data)) { validade = data; break; }
    } else {
      // MM/AA: o formulário exige confirmação explícita do último dia do mês.
      const mes = Number(match[1]);
      const ano = Number(match[2].length === 2 ? `20${match[2]}` : match[2]);
      if (mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2199) {
        validade = `${new Date(ano, mes, 0).getDate()}/${match[1]}/${ano}`;
        validadeMensal = true;
        break;
      }
    }
  }
  const marcas = /\b(?:EMS|Medley|Eurofarma|Neo\s*Qu[ií]mica|Germed|Prati(?:[ -]Donaduzzi)?|Cimed|Sanofi|Bayer|Ach[eé]|Teuto|Sandoz|Geolab|Hypera|Biolab)\b/i;
  const lab = linhas.map(l => /^(?:laborat[oó]rio|fabricante|fabricado por)\s*[:\-]?\s*(.+)$/i.exec(l)?.[1]).find(Boolean)
    ?? linhas.map(l => marcas.exec(l)?.[0]).find(Boolean) ?? "";
  const nomeRotulado = linhas.map(l => /^(?:nome|medicamento)\s*:\s*(.+)$/i.exec(l)?.[1]).find(Boolean);
  const candidatos = linhas.filter(l => /[a-zá-ú]{3}/i.test(l) && l.length <= 100 &&
    !/(validade|venc|^val\b|lote|fabr|laborat|cnpj|registro|anvisa|conserv|uso\b|via\b|comprimido|cápsula|conteúdo|venda|manter|genérico|medicamento\b|indústria)/i.test(l) && !marcas.test(l));
  return {
    nome: (nomeRotulado ?? candidatos[0] ?? "").replace(/\s+\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml)\b.*$/i, "").slice(0, 150),
    laboratorio: lab.slice(0, 150),
    validade,
    validadeMensal,
  };
}
