import { extrairEmbalagem } from "./embalagem";
import type { ImagemSelecionada } from "./fluxo-imagens";

export type ReconhecerTexto = (uri: string) => Promise<string>;
export type TransformarImagem = (uri: string, graus: 90 | 180 | 270) => Promise<string>;

function chaveLinha(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function anexarUnico(destino: string[], texto: string, rotulo: string) {
  const linhas = texto.split(/\r?\n/).map(linha => linha.trim()).filter(Boolean);
  const novas = linhas.filter(linha => !destino.some(existente => chaveLinha(existente) === chaveLinha(linha)));
  if (novas.length) destino.push(`[${rotulo}]`, ...novas);
}

function encontrouValidade(textos: string[]) {
  return textos.some(texto => extrairEmbalagem(texto).candidatasValidade.length > 0);
}

/**
 * A foto original sempre é tentada primeiro. Recorte e rotações só entram no modo
 * validade, e uma variante adicional só é reconhecida se ainda não houver data.
 */
export async function reconhecerValidadeComAlternativas(
  imagem: Pick<ImagemSelecionada, "uri" | "recorteUri">,
  reconhecer: ReconhecerTexto,
  transformar: TransformarImagem,
) {
  const textos: string[] = [];
  const erros: unknown[] = [];
  const ler = async (uri: string, rotulo: string, incluirRotulo: boolean) => {
    try {
      const texto = (await reconhecer(uri)).trim();
      if (texto) {
        if (incluirRotulo) anexarUnico(textos, texto, rotulo);
        else anexarUnico(textos, texto, "Imagem original");
      }
      return texto;
    } catch (erro) {
      erros.push(erro);
      return "";
    }
  };

  const original = await ler(imagem.uri, "Imagem original", false);
  if (encontrouValidade([original])) return textos.join("\n");

  let baseUri = imagem.uri;
  if (imagem.recorteUri) {
    const textoRecorte = await ler(imagem.recorteUri, "Região recortada", true);
    if (encontrouValidade([textoRecorte])) return textos.join("\n");
    if (textoRecorte) baseUri = imagem.recorteUri;
  }

  for (const graus of [90, 180, 270] as const) {
    try {
      const uri = await transformar(baseUri, graus);
      const texto = await ler(uri, `Rotação ${graus}°`, true);
      if (encontrouValidade([texto])) break;
    } catch (erro) {
      erros.push(erro);
    }
  }

  if (!textos.length && erros.length) {
    const causa = erros.find(erro => erro instanceof Error);
    throw new Error(causa instanceof Error ? `Falha técnica no OCR/pre-processamento: ${causa.message}` : "Falha técnica no OCR/pre-processamento.");
  }
  return textos.join("\n");
}
