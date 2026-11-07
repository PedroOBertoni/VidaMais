import * as SQLite from "expo-sqlite";
import { Medicamento, MedicamentoInput } from "../types/medicamento";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

function criarSyncId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync("vida_mais.db").catch(error => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export async function initDatabase() {
  if (!initPromise) initPromise = (async () => {
    const db = await getDb();
    await db.execAsync("PRAGMA journal_mode = WAL");
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS medicamentos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sync_id TEXT,
          nome TEXT NOT NULL,
          laboratorio TEXT DEFAULT '',
          validade TEXT NOT NULL,
          indicacao TEXT DEFAULT '',
          contraindicacoes TEXT DEFAULT '',
          posologia TEXT DEFAULT '',
          efeitos_adversos TEXT DEFAULT '',
          precaucoes TEXT DEFAULT '',
          observacoes TEXT DEFAULT '',
          texto_ocr TEXT NOT NULL DEFAULT '',
          leitura_em TEXT NOT NULL DEFAULT '',
          sincronizado INTEGER NOT NULL DEFAULT 0,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS exclusoes_pendentes (sync_id TEXT PRIMARY KEY);
      `);

      const colunas = await db.getAllAsync<{ name: string }>("PRAGMA table_info(medicamentos)");
      const existentes = new Set(colunas.map(coluna => coluna.name));
      const migracoes: Record<string, string> = {
        sync_id: "TEXT",
        laboratorio: "TEXT DEFAULT ''",
        indicacao: "TEXT DEFAULT ''",
        contraindicacoes: "TEXT DEFAULT ''",
        posologia: "TEXT DEFAULT ''",
        efeitos_adversos: "TEXT DEFAULT ''",
        precaucoes: "TEXT DEFAULT ''",
        observacoes: "TEXT DEFAULT ''",
        texto_ocr: "TEXT NOT NULL DEFAULT ''",
        leitura_em: "TEXT NOT NULL DEFAULT ''",
        sincronizado: "INTEGER NOT NULL DEFAULT 0",
        created_at: "TEXT",
        updated_at: "TEXT",
      };
      for (const [coluna, definicao] of Object.entries(migracoes)) {
        if (!existentes.has(coluna)) await db.execAsync(`ALTER TABLE medicamentos ADD COLUMN ${coluna} ${definicao}`);
      }
      const semSyncId = await db.getAllAsync<{ id: number }>("SELECT id FROM medicamentos WHERE sync_id IS NULL OR sync_id = ''");
      for (const item of semSyncId) {
        await db.runAsync("UPDATE medicamentos SET sync_id = ? WHERE id = ?", criarSyncId(), item.id);
      }
      await db.execAsync("CREATE UNIQUE INDEX IF NOT EXISTS medicamentos_sync_id_idx ON medicamentos(sync_id)");
    });
  })().catch(error => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

export async function listarMedicamentos(): Promise<Medicamento[]> {
  const db = await getDb();
  return db.getAllAsync<Medicamento>(
    "SELECT * FROM medicamentos ORDER BY validade ASC"
  );
}

export async function buscarMedicamento(id: number) {
  const db = await getDb();
  return db.getFirstAsync<Medicamento>(
    "SELECT * FROM medicamentos WHERE id = ?",
    id
  );
}

export async function inserirMedicamento(data: MedicamentoInput) {
  const db = await getDb();
  const agora = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO medicamentos
    (sync_id, nome, laboratorio, validade, indicacao, contraindicacoes, posologia, efeitos_adversos, precaucoes, observacoes, texto_ocr, leitura_em, sincronizado, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    criarSyncId(),
    data.nome, data.laboratorio, data.validade, data.indicacao,
    data.contraindicacoes, data.posologia, data.efeitos_adversos,
    data.precaucoes, data.observacoes, data.texto_ocr ?? "", data.leitura_em ?? "", agora, agora
  );
  return Number(result.lastInsertRowId);
}

export async function atualizarMedicamento(id: number, data: MedicamentoInput) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE medicamentos SET nome=?, laboratorio=?, validade=?, indicacao=?,
    contraindicacoes=?, posologia=?, efeitos_adversos=?, precaucoes=?,
    observacoes=?, texto_ocr=?, leitura_em=?, sincronizado=0, updated_at=? WHERE id=?`,
    data.nome, data.laboratorio, data.validade, data.indicacao,
    data.contraindicacoes, data.posologia, data.efeitos_adversos,
    data.precaucoes, data.observacoes, data.texto_ocr ?? "", data.leitura_em ?? "", new Date().toISOString(), id
  );
}

export async function excluirMedicamento(id: number) {
  const db = await getDb();
  const item = await buscarMedicamento(id);
  if (!item) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT OR IGNORE INTO exclusoes_pendentes (sync_id) VALUES (?)", item.sync_id);
    await db.runAsync("DELETE FROM medicamentos WHERE id = ?", id);
  });
}

export async function marcarSincronizado(id: number, atualizadoEm: string | null) {
  const db = await getDb();
  await db.runAsync("UPDATE medicamentos SET sincronizado=1 WHERE id=? AND updated_at IS ?", id, atualizadoEm);
}

export async function listarNaoSincronizados() {
  const db = await getDb();
  return db.getAllAsync<Medicamento>(
    "SELECT * FROM medicamentos WHERE sincronizado=0"
  );
}

export async function listarExclusoesPendentes() {
  const db = await getDb();
  return db.getAllAsync<{ sync_id: string }>("SELECT sync_id FROM exclusoes_pendentes");
}

export async function removerExclusaoPendente(syncId: string) {
  const db = await getDb();
  await db.runAsync("DELETE FROM exclusoes_pendentes WHERE sync_id = ?", syncId);
}

export async function salvarMedicamentoRemoto(item: Omit<Medicamento, "id">) {
  const db = await getDb();
  const exclusao = await db.getFirstAsync("SELECT sync_id FROM exclusoes_pendentes WHERE sync_id = ?", item.sync_id);
  if (exclusao) return;
  const local = await db.getFirstAsync<{ sincronizado: number }>(
    "SELECT sincronizado FROM medicamentos WHERE sync_id = ?",
    item.sync_id
  );
  if (local?.sincronizado === 0) return;

  const textos = ["laboratorio", "indicacao", "contraindicacoes", "posologia", "efeitos_adversos", "precaucoes", "observacoes"] as const;
  const normalizado = { ...item };
  for (const campo of textos) normalizado[campo] = normalizado[campo] ?? "";

  await db.runAsync(
    `INSERT INTO medicamentos
      (sync_id, nome, laboratorio, validade, indicacao, contraindicacoes, posologia, efeitos_adversos, precaucoes, observacoes, texto_ocr, leitura_em, sincronizado, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(sync_id) DO UPDATE SET nome=excluded.nome, laboratorio=excluded.laboratorio,
      validade=excluded.validade, indicacao=excluded.indicacao, contraindicacoes=excluded.contraindicacoes,
      posologia=excluded.posologia, efeitos_adversos=excluded.efeitos_adversos, precaucoes=excluded.precaucoes,
      observacoes=excluded.observacoes, texto_ocr=excluded.texto_ocr, leitura_em=excluded.leitura_em, sincronizado=1, created_at=excluded.created_at, updated_at=excluded.updated_at`,
    normalizado.sync_id, normalizado.nome, normalizado.laboratorio, normalizado.validade,
    normalizado.indicacao, normalizado.contraindicacoes, normalizado.posologia,
    normalizado.efeitos_adversos, normalizado.precaucoes, normalizado.observacoes,
    normalizado.texto_ocr ?? "", normalizado.leitura_em ?? "", normalizado.created_at ?? null, normalizado.updated_at ?? null
  );
}
