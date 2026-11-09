import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../constants/theme";

type SnackbarContextValue = { showSnackbar: (message: string) => void };
const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error("useSnackbar precisa estar dentro de SnackbarProvider.");
  return context;
}

function SnackbarHost({ message, opacity, translateY }: { message: string | null; opacity: Animated.Value; translateY: Animated.Value }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [message, opacity, translateY]);

  if (!message) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.position, { bottom: Math.max(insets.bottom, 8) + 12, opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.snackbar}>
        <Text accessibilityElementsHidden style={styles.icon}>✓</Text>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  </View>;
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const messageRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const opacity = useRef(new Animated.Value(0));
  const translateY = useRef(new Animated.Value(12));

  const dismiss = useCallback((currentGeneration: number) => {
    Animated.parallel([
      Animated.timing(opacity.current, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY.current, { toValue: 10, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished || generation.current !== currentGeneration) return;
      messageRef.current = null;
      setMessage(null);
    });
  }, []);

  const showSnackbar = useCallback((nextMessage: string) => {
    if (messageRef.current === nextMessage) return;
    generation.current += 1;
    const currentGeneration = generation.current;
    if (timer.current) clearTimeout(timer.current);
    opacity.current.stopAnimation();
    translateY.current.stopAnimation();
    opacity.current.setValue(0);
    translateY.current.setValue(12);
    messageRef.current = nextMessage;
    setMessage(nextMessage);
    timer.current = setTimeout(() => dismiss(currentGeneration), 3000);
  }, [dismiss]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);
  return <SafeAreaProvider>
    <SnackbarContext.Provider value={value}>
      {children}
      <SnackbarHost message={message} opacity={opacity.current} translateY={translateY.current} />
    </SnackbarContext.Provider>
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({
  position: { position: "absolute", left: 16, right: 16, alignSelf: "center", maxWidth: 600 },
  snackbar: { minHeight: 54, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.primaryDark, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 8 },
  icon: { color: "white", fontSize: 18, fontWeight: "900", marginRight: 10 },
  text: { color: "white", fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
});
