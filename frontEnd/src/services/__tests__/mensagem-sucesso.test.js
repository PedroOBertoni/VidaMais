const { mensagemSucessoMedicamento } = require("../mensagem-sucesso");

test("usa mensagens curtas e padronizadas após cada operação confirmada", () => {
  expect(mensagemSucessoMedicamento("cadastro")).toBe("Medicamento cadastrado com sucesso!");
  expect(mensagemSucessoMedicamento("edicao")).toBe("Medicamento atualizado com sucesso!");
  expect(mensagemSucessoMedicamento("exclusao")).toBe("Medicamento excluído com sucesso!");
});
