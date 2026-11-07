// Executa as consultas reais da aplicação sobre SQLite em memória (Node 22+).
jest.mock("expo-sqlite", () => {
  const { DatabaseSync } = require("node:sqlite");
  const banco = new DatabaseSync(":memory:");
  // Banco legado para também verificar a migração sem perder os registros.
  banco.exec(`CREATE TABLE medicamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, laboratorio TEXT,
    validade TEXT NOT NULL, indicacao TEXT, contraindicacoes TEXT, posologia TEXT,
    efeitos_adversos TEXT, precaucoes TEXT, observacoes TEXT,
    sincronizado INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
  ); INSERT INTO medicamentos (nome, validade) VALUES ('Legado', '2030-12-31');`);
  return { openDatabaseAsync: async () => ({
    execAsync: async sql => banco.exec(sql),
    runAsync: async (sql, ...args) => {
      const resultado = banco.prepare(sql).run(...args);
      return { changes: resultado.changes, lastInsertRowId: resultado.lastInsertRowid };
    },
    getAllAsync: async (sql, ...args) => banco.prepare(sql).all(...args),
    getFirstAsync: async (sql, ...args) => banco.prepare(sql).get(...args) ?? null,
    withTransactionAsync: async fn => {
      banco.exec("BEGIN");
      try { await fn(); banco.exec("COMMIT"); }
      catch (erro) { banco.exec("ROLLBACK"); throw erro; }
    },
  }) };
});

import { initDatabase, inserirMedicamento, buscarMedicamento, atualizarMedicamento,
  marcarSincronizado, salvarMedicamentoRemoto, excluirMedicamento, listarExclusoesPendentes } from "../database";

test("migra banco legado e persiste OCR no cadastro, edição, download e exclusão", async () => {
  await initDatabase();
  await initDatabase(); // Migração pode ser repetida.
  expect(await buscarMedicamento(1)).toMatchObject({ nome: "Legado", texto_ocr: "", leitura_em: "" });
  const dados = { nome: "Teste OCR", laboratorio: "", validade: "2030-12-31", indicacao: "",
    contraindicacoes: "", posologia: "", efeitos_adversos: "", precaucoes: "", observacoes: "",
    texto_ocr: "Teste OCR\nVAL 12/2030", leitura_em: "2026-11-03T12:00:00.000Z" };
  const id = await inserirMedicamento(dados);
  const salvo = await buscarMedicamento(id);
  expect(salvo).toMatchObject({ ...dados, sincronizado: 0 });
  await atualizarMedicamento(id, { ...dados, nome: "Revisado" });
  expect(await buscarMedicamento(id)).toMatchObject({ nome: "Revisado", texto_ocr: dados.texto_ocr });
  await salvarMedicamentoRemoto({ ...salvo, nome: "Remoto antigo" });
  expect((await buscarMedicamento(id)).nome).toBe("Revisado");
  await marcarSincronizado(id, (await buscarMedicamento(id)).updated_at);
  await salvarMedicamentoRemoto({ ...salvo, nome: "Remoto atualizado", texto_ocr: "Nova leitura" });
  expect(await buscarMedicamento(id)).toMatchObject({ nome: "Remoto atualizado", texto_ocr: "Nova leitura", sincronizado: 1 });
  await excluirMedicamento(id);
  expect(await buscarMedicamento(id)).toBeNull();
  expect(await listarExclusoesPendentes()).toEqual([{ sync_id: salvo.sync_id }]);
  await salvarMedicamentoRemoto(salvo);
  expect(await buscarMedicamento(id)).toBeNull(); // Download atrasado não ressuscita exclusão.
});

test("resposta de um envio antigo não marca uma edição nova como sincronizada", async () => {
  const id = await inserirMedicamento({ nome: "Original", laboratorio: "", validade: "2030-12-31", indicacao: "",
    contraindicacoes: "", posologia: "", efeitos_adversos: "", precaucoes: "", observacoes: "" });
  await marcarSincronizado(id, "2000-01-01T00:00:00.000Z");
  expect((await buscarMedicamento(id)).sincronizado).toBe(0);
});
