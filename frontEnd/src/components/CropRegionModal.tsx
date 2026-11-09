import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

type Ponto = { x: number; y: number };
type Retangulo = { left: number; top: number; width: number; height: number };

export function CropRegionModal({ uri, visible, onCancel, onApply }: {
  uri: string | null;
  visible: boolean;
  onCancel: () => void;
  onApply: (uri: string) => void;
}) {
  const { width } = useWindowDimensions();
  const [dimensoes, setDimensoes] = useState<{ width: number; height: number } | null>(null);
  const [caixa, setCaixa] = useState<Retangulo | null>(null);
  const [pontoInicial, setPontoInicial] = useState<Ponto | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const medidas = useRef({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    setDimensoes(null);
    setCaixa(null);
    setErro("");
    if (!visible || !uri) return;
    Image.getSize(uri, (imageWidth, imageHeight) => setDimensoes({ width: imageWidth, height: imageHeight }), () => setErro("Não foi possível abrir esta imagem para recorte."));
  }, [uri, visible]);

  const viewportWidth = Math.max(280, width - 40);
  const viewportHeight = 330;
  const escala = dimensoes ? Math.min(viewportWidth / dimensoes.width, viewportHeight / dimensoes.height) : 1;
  const imageWidth = dimensoes ? dimensoes.width * escala : 0;
  const imageHeight = dimensoes ? dimensoes.height * escala : 0;
  const imageLeft = (viewportWidth - imageWidth) / 2;
  const imageTop = (viewportHeight - imageHeight) / 2;

  useEffect(() => {
    medidas.current = { left: imageLeft, top: imageTop, width: imageWidth, height: imageHeight };
  }, [imageLeft, imageTop, imageWidth, imageHeight]);

  const limitarPonto = (x: number, y: number): Ponto => {
    const m = medidas.current;
    return { x: Math.max(m.left, Math.min(m.left + m.width, x)), y: Math.max(m.top, Math.min(m.top + m.height, y)) };
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => true,
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      const ponto = limitarPonto(event.nativeEvent.locationX, event.nativeEvent.locationY);
      setPontoInicial(ponto);
      setCaixa({ left: ponto.x, top: ponto.y, width: 0, height: 0 });
    },
    onPanResponderMove: event => {
      if (!pontoInicial) return;
      const final = limitarPonto(event.nativeEvent.locationX, event.nativeEvent.locationY);
      setCaixa({ left: Math.min(pontoInicial.x, final.x), top: Math.min(pontoInicial.y, final.y), width: Math.abs(final.x - pontoInicial.x), height: Math.abs(final.y - pontoInicial.y) });
    },
    onPanResponderRelease: event => {
      if (!pontoInicial) return;
      const final = limitarPonto(event.nativeEvent.locationX, event.nativeEvent.locationY);
      setCaixa({ left: Math.min(pontoInicial.x, final.x), top: Math.min(pontoInicial.y, final.y), width: Math.abs(final.x - pontoInicial.x), height: Math.abs(final.y - pontoInicial.y) });
      setPontoInicial(null);
    },
    onPanResponderTerminate: () => setPontoInicial(null),
  }), [pontoInicial]);

  async function aplicarRecorte() {
    if (!uri || !dimensoes || !caixa || caixa.width < 24 || caixa.height < 16) {
      setErro("Desenhe uma área maior ao redor da fabricação, validade e lote.");
      return;
    }
    const m = medidas.current;
    const x = Math.max(0, Math.floor((caixa.left - m.left) / escala));
    const y = Math.max(0, Math.floor((caixa.top - m.top) / escala));
    const cropWidth = Math.min(dimensoes.width - x, Math.max(1, Math.ceil(caixa.width / escala)));
    const cropHeight = Math.min(dimensoes.height - y, Math.max(1, Math.ceil(caixa.height / escala)));
    setProcessando(true);
    setErro("");
    try {
      const resultado = await ImageManipulator.manipulateAsync(uri, [{ crop: { originX: x, originY: y, width: cropWidth, height: cropHeight } }], {
        compress: 1,
        format: ImageManipulator.SaveFormat.PNG,
      });
      onApply(resultado.uri);
    } catch (cause) {
      setErro(cause instanceof Error ? `Falha ao recortar a imagem: ${cause.message}` : "Falha ao recortar a imagem. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>Recortar validade e lote</Text>
        <Text style={styles.help}>Arraste sobre a imagem para marcar a área impressa. O arquivo original será mantido e lido também.</Text>
        <View style={[styles.viewport, { width: viewportWidth, height: viewportHeight }]} {...responder.panHandlers}>
          {!!uri && dimensoes && <Image source={{ uri }} resizeMode="stretch" style={{ position: "absolute", left: imageLeft, top: imageTop, width: imageWidth, height: imageHeight }} />}
          {caixa && <View pointerEvents="none" style={[styles.cropBox, { left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height }]} />}
        </View>
        {!dimensoes && !erro && <Text style={styles.help}>Abrindo imagem…</Text>}
        {!!erro && <Text accessibilityRole="alert" style={styles.error}>{erro}</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={processando} onPress={onCancel} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={processando || !caixa} onPress={aplicarRecorte} style={[styles.primary, (processando || !caixa) && styles.disabled]}><Text style={styles.primaryText}>{processando ? "Salvando recorte…" : "Usar recorte"}</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,24,37,0.72)", justifyContent: "center", padding: 12 },
  panel: { backgroundColor: "#fff", borderRadius: 20, padding: 16, alignItems: "center", gap: 12 },
  title: { color: "#142536", fontSize: 20, fontWeight: "700", alignSelf: "flex-start" },
  help: { color: "#526477", fontSize: 14, lineHeight: 20, alignSelf: "flex-start" },
  viewport: { backgroundColor: "#111b24", overflow: "hidden", alignSelf: "center", position: "relative" },
  cropBox: { position: "absolute", borderWidth: 2, borderColor: "#35d0a0", backgroundColor: "rgba(53,208,160,0.12)" },
  error: { color: "#ac2525", fontSize: 14, alignSelf: "flex-start" },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  primary: { flex: 1, borderRadius: 12, backgroundColor: "#16785f", padding: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { flex: 1, borderRadius: 12, backgroundColor: "#e9eff3", padding: 14, alignItems: "center" },
  secondaryText: { color: "#25394c", fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
