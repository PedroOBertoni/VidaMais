import { Alert, Platform } from "react-native";

// React Native Web não implementa Alert.alert; mantém os diálogos nativos no mobile.
export const alerta: typeof Alert.alert = (titulo, mensagem, botoes, opcoes) => {
  if (Platform.OS !== "web") {
    Alert.alert(titulo, mensagem, botoes, opcoes);
    return;
  }
  const texto = [titulo, mensagem].filter(Boolean).join("\n\n");
  const cancelar = botoes?.find(botao => botao.style === "cancel");
  const confirmar = botoes?.find(botao => botao.style !== "cancel");
  if (cancelar) {
    if (window.confirm(texto)) confirmar?.onPress?.();
    else cancelar.onPress?.();
  } else {
    window.alert(texto);
    confirmar?.onPress?.();
  }
};
