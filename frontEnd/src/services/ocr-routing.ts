import type { DestinoOCR } from "./fluxo-imagens";

export type TecnologiaOCR = "mlkit" | "gemini";

export function tecnologiaOCR(destino: DestinoOCR): TecnologiaOCR {
  return destino === "validade" ? "gemini" : "mlkit";
}
