import { Text, View, StyleSheet } from "react-native";
import { colors } from "../constants/theme";
import { StatusValidade } from "../types/medicamento";

export function StatusBadge({ status }: { status: StatusValidade }) {
  const config = {
    valido: { label: "Válido", bg: colors.successBg, text: colors.success },
    proximo: { label: "Próximo do vencimento", bg: colors.warningBg, text: colors.warning },
    vencido: { label: "Vencido", bg: colors.dangerBg, text: colors.danger },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});
