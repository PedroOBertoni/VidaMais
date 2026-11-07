import { Text, View, StyleSheet } from "react-native";
import { colors } from "../constants/theme";

export function EmptyState({ search }: { search?: boolean }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>💊</Text>
      <Text style={styles.title}>{search ? "Nenhum resultado" : "Nenhum medicamento"}</Text>
      <Text style={styles.text}>{search ? "Tente outro nome ou termo de busca." : "Cadastre seu primeiro medicamento para começar."}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 55, paddingHorizontal: 30 },
  icon: { fontSize: 42, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  text: { color: colors.muted, textAlign: "center", marginTop: 7, lineHeight: 20 },
});
