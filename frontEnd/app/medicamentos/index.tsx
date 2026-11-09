import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { colors } from "../../src/constants/theme";
import { MedicationCard } from "../../src/components/MedicationCard";
import { EmptyState } from "../../src/components/EmptyState";
import { useMedicamentos } from "../../src/hooks/useMedicamentos";
import { getStatusValidade } from "../../src/types/medicamento";

export default function Medicamentos() {
  const { medicamentos, erro, recarregar } = useMedicamentos();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "validos" | "proximos" | "vencidos">("todos");

  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));

  const filtrados = useMemo(() => medicamentos.filter(item => {
    const texto = `${item.nome} ${item.laboratorio}`.toLowerCase().includes(busca.toLowerCase());
    const status = getStatusValidade(item.validade);
    const okFiltro = filtro === "todos" ||
      (filtro === "validos" && status === "valido") ||
      (filtro === "proximos" && status === "proximo") ||
      (filtro === "vencidos" && status === "vencido");
    return texto && okFiltro;
  }), [medicamentos, busca, filtro]);

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <TextInput accessibilityLabel="Buscar medicamento" value={busca} onChangeText={setBusca} placeholder="Buscar medicamento..." placeholderTextColor={colors.muted} style={styles.search} />
        <Pressable accessibilityRole="button" accessibilityLabel="Adicionar medicamento" style={styles.new} onPress={() => router.push("/medicamentos/novo")}><Text style={styles.newText}>+</Text></Pressable>
      </View>
      {!!erro && <Pressable accessibilityRole="button" onPress={recarregar} style={styles.errorBox}><Text style={styles.errorText}>{erro} Toque para tentar novamente.</Text></Pressable>}
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {[
          ["todos", "Todos"], ["validos", "Válidos"], ["proximos", "Vencendo"], ["vencidos", "Vencidos"]
        ].map(([value, label]) => <Pressable key={value} onPress={() => setFiltro(value as typeof filtro)} style={[styles.chip, filtro === value && styles.chipActive]}><Text style={[styles.chipText, filtro === value && styles.chipTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.list}>
        {filtrados.length ? filtrados.map(item => <MedicationCard key={item.id} item={item} onPress={() => router.push(`/medicamentos/${item.id}`)} />) : <EmptyState search={!!busca || filtro !== "todos"} />}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  search: { flex: 1, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 15, height: 48, color: colors.text, borderWidth: 1, borderColor: colors.border },
  new: { width: 52, height: 52, backgroundColor: colors.primary, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  newText: { color: "white", fontSize: 30, fontWeight: "800" },
  filters: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "white" },
  list: { padding: 16, paddingTop: 4, paddingBottom: 30 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 10 },
  errorText: { color: colors.danger, textAlign: "center", fontWeight: "700" },
});
