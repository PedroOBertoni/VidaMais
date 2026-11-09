import { NativeModules } from "react-native";

export async function reconhecerTexto(uri: string): Promise<string> {
  if (!NativeModules.TextRecognition) {
    throw new Error("O leitor OCR precisa do APK atualizado do Vida+. Instale a nova versão; o Expo Go não inclui esse leitor.");
  }
  const { default: TextRecognition } = await import("@react-native-ml-kit/text-recognition");
  const resultado = await TextRecognition.recognize(uri);
  return resultado.text;
}
