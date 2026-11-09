jest.mock("../supabase", () => ({
  garantirUsuarioAutenticado: jest.fn(async () => ({ id: "usuario-teste" })),
  supabase: { from: jest.fn() },
}));
jest.mock("../../database/database", () => ({
  listarExclusoesPendentes: jest.fn(async () => []),
  listarNaoSincronizados: jest.fn(),
  marcarSincronizado: jest.fn(),
  removerExclusaoPendente: jest.fn(),
  salvarMedicamentoRemoto: jest.fn(),
}));

import { supabase } from "../supabase";
import * as banco from "../../database/database";
import { sincronizar } from "../sync";

beforeEach(() => jest.clearAllMocks());

test("envia OCR associado ao medicamento e recupera o mesmo resultado da nuvem", async () => {
  const item = { id: 4, sync_id: "mesmo-registro", nome: "Teste", validade: "2030-12-31",
    texto_ocr: "Teste VAL 12/2030", leitura_em: "2026-11-03T12:00:00.000Z" };
  banco.listarNaoSincronizados.mockResolvedValue([item]);
  const upsert = jest.fn(async () => ({ error: null }));
  const range = jest.fn(async () => ({ error: null, data: [item] }));
  const order = jest.fn(() => ({ range }));
  const select = jest.fn(() => ({ order }));
  supabase.from.mockReturnValue({ upsert, select });
  expect((await sincronizar()).ok).toBe(true);
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    sync_id: item.sync_id, texto_ocr: item.texto_ocr, leitura_em: item.leitura_em, user_id: "usuario-teste",
  }), { onConflict: "sync_id" });
  expect(banco.marcarSincronizado).toHaveBeenCalledWith(item.id, null);
  expect(select.mock.calls[0][0]).toContain("texto_ocr,leitura_em");
  expect(range).toHaveBeenCalledWith(0, 499);
  expect(banco.salvarMedicamentoRemoto).toHaveBeenCalledWith({ ...item, sincronizado: 1 });
});

test("preserva pendências locais se uma página remota falhar", async () => {
  banco.listarNaoSincronizados.mockResolvedValue([]);
  const range = jest.fn(async () => ({ error: { message: "Falha ao baixar" }, data: null }));
  supabase.from.mockReturnValue({ select: () => ({ order: () => ({ range }) }) });
  expect(await sincronizar()).toEqual({ ok: false, message: "Falha ao baixar" });
  expect(banco.salvarMedicamentoRemoto).not.toHaveBeenCalled();
});

test("falha remota mantém o medicamento e o OCR pendentes no SQLite", async () => {
  banco.listarNaoSincronizados.mockResolvedValue([{ id: 4, sync_id: "pendente", texto_ocr: "Texto local" }]);
  supabase.from.mockReturnValue({ upsert: async () => ({ error: { message: "Sem conexão" } }) });
  expect(await sincronizar()).toEqual({ ok: false, message: "Sem conexão" });
  expect(banco.marcarSincronizado).not.toHaveBeenCalled();
  expect(banco.salvarMedicamentoRemoto).not.toHaveBeenCalled();
});

test("propaga exclusões pendentes pelo sync_id e remove a fila após sucesso", async () => {
  banco.listarExclusoesPendentes.mockResolvedValue([{ sync_id: "exclusao-pendente" }]);
  banco.listarNaoSincronizados.mockResolvedValue([]);
  const filtroExclusao = jest.fn(async () => ({ error: null }));
  const excluirRemoto = jest.fn(() => ({ eq: filtroExclusao }));
  const range = jest.fn(async () => ({ error: null, data: [] }));
  const order = jest.fn(() => ({ range }));
  const select = jest.fn(() => ({ order }));
  supabase.from.mockReturnValue({ delete: excluirRemoto, select });

  expect((await sincronizar()).ok).toBe(true);
  expect(supabase.from).toHaveBeenCalledWith("medicamentos");
  expect(excluirRemoto).toHaveBeenCalledTimes(1);
  expect(filtroExclusao).toHaveBeenCalledWith("sync_id", "exclusao-pendente");
  expect(banco.removerExclusaoPendente).toHaveBeenCalledWith("exclusao-pendente");
});
