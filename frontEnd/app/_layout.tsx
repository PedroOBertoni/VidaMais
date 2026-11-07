import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../src/constants/theme";
import { initDatabase } from "../src/database/database";

export default function Layout() {
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");

  const iniciar = async () => {
    setEstado("carregando");
    try {
      await initDatabase();
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  };

  useEffect(() => { iniciar(); }, []);

  if (estado === "carregando") {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (estado === "erro") {
    return <View style={styles.center}>
      <Text style={styles.error}>Não foi possível preparar o banco de dados.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Tentar novamente" style={styles.retry} onPress={iniciar}>
        <Text style={styles.retryText}>Tentar novamente</Text>
      </Pressable>
    </View>;
  }

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: "800" },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.background }
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="medicamentos/index" options={{ title: "Meus medicamentos" }} />
      <Stack.Screen name="medicamentos/novo" options={{ title: "Novo medicamento" }} />
      <Stack.Screen name="medicamentos/[id]" options={{ title: "Detalhes" }} />
      <Stack.Screen name="bula/[id]" options={{ title: "Bula" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
  error: { color: colors.danger, textAlign: "center", marginBottom: 16 },
  retry: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  retryText: { color: "white", fontWeight: "800" },
});
