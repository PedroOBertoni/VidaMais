import { useCallback, useState } from "react";
import { initDatabase, listarMedicamentos } from "../database/database";
import { Medicamento } from "../types/medicamento";

export function useMedicamentos() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      await initDatabase();
      setMedicamentos(await listarMedicamentos());
    } catch {
      setErro("Não foi possível carregar os medicamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { medicamentos, loading, erro, recarregar: carregar };
}
