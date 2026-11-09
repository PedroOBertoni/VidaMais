import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { colors } from "../src/constants/theme";
import { MedicationCard } from "../src/components/MedicationCard";
import { useMedicamentos } from "../src/hooks/useMedicamentos";
import { getStatusValidade } from "../src/types/medicamento";
import { sincronizar } from "../src/services/sync";

export default function Home() {
  const { medicamentos, loading, erro, recarregar } = useMedicamentos();
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState("");
  const travaSync = useRef(false);
  async function enviarPendentes() {
    if (travaSync.current) return;
    travaSync.current = true;
    setSincronizando(true);
    try {
      const resultado = await sincronizar();
      setResultadoSync(resultado.ok ? resultado.message : `Dados locais preservados. ${resultado.message}`);
      await recarregar();
    } finally { setSincronizando(false); travaSync.current = false; }
  }

  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  useEffect(() => { void enviarPendentes(); }, []);

  const vencidos = medicamentos.filter(x => getStatusValidade(x.validade) === "vencido").length;
  const proximos = medicamentos.filter(x => getStatusValidade(x.validade) === "proximo").length;
  const proximosItens = medicamentos.filter(x => getStatusValidade(x.validade) === "proximo").slice(0, 3);
  const abrirListaMedicamentos = () => router.push("/medicamentos");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={recarregar} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Olá!</Text>
          <Text style={styles.title}>Vida+</Text>
          <Text style={styles.subtitle}>Cuide dos seus medicamentos.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Adicionar medicamento" style={styles.logo} onPress={() => router.push("/medicamentos/novo")}><Text style={styles.logoText}>+</Text></Pressable>
      </View>

      <View style={styles.stats}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${medicamentos.length} medicamentos cadastrados`} accessibilityHint="Abre a lista de medicamentos" android_ripple={{ color: colors.primaryLight }} style={({ pressed }) => [styles.stat, pressed && styles.statPressed]} onPress={abrirListaMedicamentos}><Text style={styles.number}>{medicamentos.length}</Text><Text style={styles.label}>Medicamentos</Text></Pressable>
        <View style={styles.stat}><Text style={[styles.number, { color: colors.warning }]}>{proximos}</Text><Text style={styles.label}>Vencendo</Text></View>
        <View style={styles.stat}><Text style={[styles.number, { color: colors.danger }]}>{vencidos}</Text><Text style={styles.label}>Vencidos</Text></View>
      </View>

      {!!erro && <Pressable accessibilityRole="button" onPress={recarregar} style={styles.errorBox}>
        <Text style={styles.errorText}>{erro} Toque para tentar novamente.</Text>
      </Pressable>}

      <Pressable accessibilityRole="button" accessibilityLabel="Cadastrar medicamento" style={styles.add} onPress={() => router.push("/medicamentos/novo")}>
        <Text style={styles.addPlus}>＋</Text>
        <View><Text style={styles.addTitle}>Cadastrar medicamento</Text><Text style={styles.addSub}>Adicione um novo remédio ao Vida+</Text></View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximos do vencimento</Text>
        <Pressable accessibilityRole="button" onPress={abrirListaMedicamentos}><Text style={styles.see}>Ver todos</Text></Pressable>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>Cópia online</Text>
        <Text style={styles.infoText}>{medicamentos.filter(m => !m.sincronizado).length} medicamento(s) aguardando envio. Seus dados ficam salvos neste aparelho.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Sincronizar" disabled={sincronizando} onPress={enviarPendentes} style={{ paddingVertical: 14 }}>
          <Text style={styles.see}>{sincronizando ? "Sincronizando..." : "Sincronizar"}</Text>
        </Pressable>
        {!!resultadoSync && <Text accessibilityLiveRegion="polite" style={styles.infoText}>{resultadoSync}</Text>}
      </View>

      {proximosItens.length ? proximosItens.map(item =>
        <MedicationCard key={item.id} item={item} onPress={() => router.push(`/medicamentos/${item.id}`)} />
      ) : (
        <View style={styles.ok}><Text style={styles.okIcon}>✓</Text><View><Text style={styles.okTitle}>Tudo em dia!</Text><Text style={styles.okText}>Nenhum medicamento vence nos próximos 30 dias.</Text></View></View>
      )}

      <View style={styles.info}>
        <Text style={styles.infoTitle}>Dica do Vida+</Text>
        <Text style={styles.infoText}>Confira regularmente a validade dos medicamentos e consulte um profissional de saúde em caso de dúvidas.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 55, paddingBottom: 35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  hello: { color: colors.muted, fontSize: 14 },
  title: { color: colors.primary, fontSize: 30, fontWeight: "900", marginTop: 2 },
  subtitle: { color: colors.muted, marginTop: 2 },
  logo: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  logoText: { color: "white", fontSize: 30, fontWeight: "800" },
  stats: { flexDirection: "row", gap: 10, marginBottom: 18 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
  statPressed: { opacity: 0.78 },
  number: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  label: { color: colors.muted, fontSize: 11, marginTop: 4 },
  add: { backgroundColor: colors.primary, borderRadius: 18, padding: 17, flexDirection: "row", alignItems: "center", marginBottom: 28 },
  addPlus: { color: "white", fontSize: 28, marginRight: 10 },
  addTitle: { color: "white", fontSize: 15, fontWeight: "800" },
  addSub: { color: "#D8F5E9", fontSize: 12, marginTop: 3 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  see: { color: colors.primary, fontWeight: "700" },
  ok: { backgroundColor: colors.successBg, borderRadius: 18, padding: 17, flexDirection: "row", alignItems: "center", marginBottom: 20 },
  okIcon: { backgroundColor: colors.primary, color: "white", width: 36, height: 36, borderRadius: 18, textAlign: "center", paddingTop: 7, fontWeight: "900", marginRight: 12 },
  okTitle: { color: colors.text, fontWeight: "800" },
  okText: { color: colors.muted, fontSize: 12, marginTop: 3, maxWidth: 260 },
  info: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  infoTitle: { color: colors.text, fontWeight: "800" },
  infoText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: colors.danger, textAlign: "center", fontWeight: "700" },
});
