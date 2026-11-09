export type OperacaoMedicamentoConcluida = "cadastro" | "edicao" | "exclusao";

export function mensagemSucessoMedicamento(operacao: OperacaoMedicamentoConcluida) {
  switch (operacao) {
    case "cadastro": return "Medicamento cadastrado com sucesso!";
    case "edicao": return "Medicamento atualizado com sucesso!";
    case "exclusao": return "Medicamento excluído com sucesso!";
  }
}
