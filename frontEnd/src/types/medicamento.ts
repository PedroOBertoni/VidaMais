export type Medicamento = {
  id: number;
  sync_id: string;
  nome: string;
  laboratorio: string;
  validade: string;
  indicacao: string;
  contraindicacoes: string;
  posologia: string;
  efeitos_adversos: string;
  precaucoes: string;
  observacoes: string;
  texto_ocr?: string;
  leitura_em?: string;
  sincronizado?: number;
  created_at?: string;
  updated_at?: string;
};

export type MedicamentoInput = Omit<Medicamento, "id" | "sync_id" | "sincronizado" | "created_at" | "updated_at">;

export type StatusValidade = "vencido" | "proximo" | "valido";

export function getStatusValidade(validade: string): StatusValidade {
  const [ano, mes, dia] = validade.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== validade) return "valido";
  const agora = new Date();
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diff = Math.floor((data.getTime() - hoje) / 86400000);

  if (diff < 0) return "vencido";
  if (diff <= 30) return "proximo";
  return "valido";
}

export function diasRestantes(validade: string) {
  const [ano, mes, dia] = validade.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== validade) return 0;
  const agora = new Date();
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.floor((data.getTime() - hoje) / 86400000);
}

export function formatarData(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function converterDataParaISO(data: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
  if (!match) return null;

  const [, dia, mes, ano] = match;
  const dataValidada = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (
    dataValidada.getUTCFullYear() !== Number(ano) ||
    dataValidada.getUTCMonth() !== Number(mes) - 1 ||
    dataValidada.getUTCDate() !== Number(dia)
  ) return null;

  return `${ano}-${mes}-${dia}`;
}
