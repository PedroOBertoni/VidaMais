import { Pressable, Text, View, StyleSheet } from "react-native";
import { colors } from "../constants/theme";
import { diasRestantes, formatarData, getStatusValidade, Medicamento } from "../types/medicamento";
import { StatusBadge } from "./StatusBadge";

export function MedicationCard({ item, onPress }: { item: Medicamento; onPress: () => void }) {
  const status = getStatusValidade(item.validade);
  const dias = diasRestantes(item.validade);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${item.nome}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.row}>
        <View style={styles.icon}><Text style={styles.iconText}>💊</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.nome}</Text>
          {!!item.laboratorio && <Text style={styles.lab}>{item.laboratorio}</Text>}
          <Text style={styles.date}>Validade: {formatarData(item.validade)}</Text>
          <StatusBadge status={status} />
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
      <Text style={[styles.days, status === "vencido" && { color: colors.danger }]}>
        {status === "vencido" ? `Vencido há ${Math.abs(dias)} dia(s)` : `${dias} dia(s) restantes`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 22 },
  name: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 3 },
  lab: { color: colors.muted, fontSize: 13, marginBottom: 5 },
  date: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  arrow: { fontSize: 28, color: colors.muted },
  days: { color: colors.warning, fontSize: 12, fontWeight: "700", marginTop: 10, marginLeft: 58 },
});
