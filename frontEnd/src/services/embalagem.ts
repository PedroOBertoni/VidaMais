import { converterDataParaISO } from "../types/medicamento";

const ROTULOS = /\b(?:VALIDADE|VENCIMENTO|VENC\.?|VAL\.?|EXP(?:IRY|IRACAO)?\.?|FABRICACAO|FABR\.?|FAB\.?|MFG\.?|LOTE|LOT\.?|L)\b|(?:^|\s)[VF]\s*[:=]/gi;
const CARACTERES_DATA = "0-9OQDIL|SB";

type DataValidade = { valor: string; mensal: boolean; incerta: boolean };

function normalizarRotulo(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
}

function normalizarCandidato(texto: string) {
  const normalizado = texto.toUpperCase().replace(/[OQD]/g, "0").replace(/[IL|]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
  return { texto: normalizado, incerta: normalizado !== texto.toUpperCase() };
}

function anoCompleto(texto: string) {
  if (texto.length === 4) return Number(texto);
  if (texto.length === 2) return 2000 + Number(texto);
  return NaN;
}

function validarData(dia: number, mes: number, ano: number): string | null {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2199 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const data = `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
  return converterDataParaISO(data) ? data : null;
}

function validarMesAno(mes: number, ano: number): string | null {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2199 || mes < 1 || mes > 12) return null;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${String(ultimoDia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

function lerDatasRotuladas(fragmento: string): DataValidade[] {
  const datas: DataValidade[] = [];
  const padraoSeparado = new RegExp(`(?<![A-Z0-9])([${CARACTERES_DATA}]{1,2})\\s*([/.\\-])\\s*([${CARACTERES_DATA}]{1,4})(?:\\s*([/.\\-])\\s*([${CARACTERES_DATA}]{2,4}))?(?![A-Z0-9])`, "gi");
  for (const match of fragmento.matchAll(padraoSeparado)) {
    const raw = [match[1], match[3], match[5]].filter(Boolean).join("/");
    const partes = raw.split("/").map(normalizarCandidato);
    const incerta = partes.some(parte => parte.incerta);
    const numeros = partes.map(parte => Number(parte.texto));
    if (partes.length === 3) {
      const data = validarData(numeros[0], numeros[1], anoCompleto(partes[2].texto));
      if (data) datas.push({ valor: data, mensal: false, incerta });
    } else if (partes.length === 2) {
      const ano = anoCompleto(partes[1].texto);
      const data = validarMesAno(numeros[0], ano);
      if (data) datas.push({ valor: data, mensal: true, incerta });
    }
  }

  // Datas compactas só são aceitas dentro de um trecho explicitamente rotulado como validade.
  const compacta = new RegExp(`(?<![A-Z0-9])([${CARACTERES_DATA}]{4}|[${CARACTERES_DATA}]{6}|[${CARACTERES_DATA}]{8})(?![A-Z0-9])`, "gi");
  for (const match of fragmento.matchAll(compacta)) {
    const parte = normalizarCandidato(match[1]);
    const digitos = parte.texto;
    if (digitos.length === 8) {
      const data = validarData(Number(digitos.slice(0, 2)), Number(digitos.slice(2, 4)), Number(digitos.slice(4)));
      if (data) datas.push({ valor: data, mensal: false, incerta: parte.incerta });
    } else if (digitos.length === 6) {
      const data = validarMesAno(Number(digitos.slice(0, 2)), Number(digitos.slice(2)));
      if (data) datas.push({ valor: data, mensal: true, incerta: parte.incerta });
    } else if (digitos.length === 4) {
      const data = validarMesAno(Number(digitos.slice(0, 2)), anoCompleto(digitos.slice(2)));
      if (data) datas.push({ valor: data, mensal: true, incerta: parte.incerta });
    }
  }
  return datas;
}

function extrairCandidatasValidade(texto: string) {
  const linhas = normalizarRotulo(texto).split(/\r?\n/);
  const resultado: DataValidade[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    ROTULOS.lastIndex = 0;
    const rotulos = [...linha.matchAll(ROTULOS)];
    for (let j = 0; j < rotulos.length; j++) {
      const rotulo = rotulos[j];
      const label = (rotulo[0] ?? "").trim().replace(/[:=]$/, "").replace(/\.$/, "").trim();
      const validade = /^(?:VALIDADE|VENCIMENTO|VENC|VAL|EXP|EXPIRY|EXPIRACAO|V)$/.test(label);
      if (!validade) continue;
      const inicio = (rotulo.index ?? 0) + rotulo[0].length;
      const fim = rotulos[j + 1]?.index ?? linha.length;
      let candidatas = lerDatasRotuladas(linha.slice(inicio, fim));
      if (!candidatas.length) {
        for (let proxima = i + 1; proxima < Math.min(i + 3, linhas.length); proxima++) {
          ROTULOS.lastIndex = 0;
          if (ROTULOS.test(linhas[proxima])) break;
          candidatas = lerDatasRotuladas(linhas[proxima]);
          if (candidatas.length) break;
        }
      }
      resultado.push(...candidatas);
    }
  }
  const unicas = new Map<string, DataValidade>();
  for (const data of resultado) {
    const anterior = unicas.get(data.valor);
    unicas.set(data.valor, { ...data, incerta: data.incerta || Boolean(anterior?.incerta), mensal: data.mensal || Boolean(anterior?.mensal) });
  }
  return [...unicas.values()];
}

// A fabricação é reconhecida como rótulo para delimitar trechos, mas nunca é uma origem de validade.
export function extrairEmbalagem(texto: string) {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const datas = extrairCandidatasValidade(texto);
  const validade = datas.length === 1 ? datas[0].valor : "";
  const marcas = /\b(?:EMS|Medley|Eurofarma|Neo\s*Qu[ií]mica|Germed|Prati(?:[ -]Donaduzzi)?|Cimed|Sanofi|Bayer|Aché|Teuto|Sandoz|Geolab|Hypera|Biolab)\b/i;
  const lab = linhas.map(l => /^(?:laboratório|fabricante|fabricado por)\s*[:\-]?\s*(.+)$/i.exec(l)?.[1]).find(Boolean)
    ?? linhas.map(l => marcas.exec(l)?.[0]).find(Boolean) ?? "";
  const nomeRotulado = linhas.map(l => /^(?:nome|medicamento)\s*:\s*(.+)$/i.exec(l)?.[1]).find(Boolean);
  const candidatos = linhas.filter(l => /[a-zá-ú]{3}/i.test(l) && l.length <= 100 &&
    !/(validade|venc|^val\b|lote|fabric|mfg|laborat|cnpj|registro|anvisa|conserv|uso\b|via\b|comprimido|cápsula|conteúdo|venda|manter|genérico|medicamento\b|indústria)/i.test(l) && !marcas.test(l));
  return {
    nome: (nomeRotulado ?? candidatos[0] ?? "").replace(/\s+\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml)\b.*$/i, "").slice(0, 150),
    laboratorio: lab.slice(0, 150),
    validade,
    validadeMensal: datas.length === 1 && datas[0].mensal,
    validadeIncerta: datas.some(data => data.incerta),
    candidatasValidade: datas.map(data => data.valor),
  };
}
