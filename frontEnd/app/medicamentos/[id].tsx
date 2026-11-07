import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { colors } from "../../src/constants/theme";
import { buscarMedicamento, excluirMedicamento } from "../../src/database/database";
import { diasRestantes, formatarData, getStatusValidade, Medicamento } from "../../src/types/medicamento";
import { StatusBadge } from "../../src/components/StatusBadge";
import { sincronizar } from "../../src/services/sync";
import { alerta } from "../../src/services/alerta";

export default function Detalhes() {
  const { id } = useLocalSearchParams<{id:string}>();
  const [item, setItem] = useState<Medicamento | null | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(async()=>{
    setErro(false);
    try { setItem(await buscarMedicamento(Number(id))); }
    catch { setErro(true); }
  },[id]);
  useFocusEffect(useCallback(()=>{carregar()},[carregar]));

  if (erro) return <View style={styles.center}><Text>Não foi possível carregar o medicamento.</Text><Pressable onPress={carregar}><Text style={styles.link}>Tentar novamente</Text></Pressable></View>;
  if (item === undefined) return <View style={styles.center}><Text>Carregando...</Text></View>;
  if (item === null) return <View style={styles.center}><Text>Medicamento não encontrado.</Text></View>;
  const status=getStatusValidade(item.validade), dias=diasRestantes(item.validade);

  const excluir=()=>alerta("Excluir medicamento", "Deseja realmente excluir este medicamento?", [
    {text:"Cancelar",style:"cancel"}, {text:"Excluir",style:"destructive",onPress:async()=>{
      try { await excluirMedicamento(item.id); void sincronizar(); router.back(); }
      catch { alerta("Erro", "Não foi possível excluir o medicamento."); }
    }}
  ]);

  const sec=[["Indicação",item.indicacao],["Contraindicações",item.contraindicacoes],["Posologia",item.posologia],["Efeitos adversos",item.efeitos_adversos],["Precauções",item.precaucoes],["Observações",item.observacoes]];

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.hero}><View style={styles.bigIcon}><Text style={{fontSize:35}}>💊</Text></View><Text style={styles.name}>{item.nome}</Text>{!!item.laboratorio&&<Text style={styles.lab}>{item.laboratorio}</Text>}<StatusBadge status={status}/></View>
    <View style={styles.validity}><Text style={styles.validityLabel}>VALIDADE</Text><Text style={styles.date}>{formatarData(item.validade)}</Text><Text style={styles.days}>{status==="vencido"?`Vencido há ${Math.abs(dias)} dia(s)`: `${dias} dia(s) restantes`}</Text></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Armazenamento e leitura</Text><Text style={styles.body}>Salvo no SQLite deste aparelho. {item.sincronizado ? "Sincronizado com Supabase." : "Envio ao Supabase pendente."}</Text>{!!item.texto_ocr && <><Text style={styles.sectionTitle}>Texto reconhecido da embalagem / bula</Text><Text selectable style={styles.body}>{item.texto_ocr}</Text><Text style={styles.body}>Leitura: {item.leitura_em ? new Date(item.leitura_em).toLocaleString("pt-BR") : "Não informada"}</Text></>}</View>
    {sec.map(([title,text])=>text?<View key={title} style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{text}</Text></View>:null)}
    <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel="Ver bula" style={styles.primary} onPress={()=>router.push(`/bula/${item.id}`)}><Text style={styles.primaryText}>📖  Ver bula</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Editar medicamento" style={styles.secondary} onPress={()=>router.push(`/medicamentos/novo?id=${item.id}`)}><Text style={styles.secondaryText}>Editar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Excluir medicamento" style={styles.delete} onPress={excluir}><Text style={styles.deleteText}>Excluir</Text></Pressable></View>
  </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:colors.background},content:{padding:20,paddingBottom:40},center:{flex:1,alignItems:"center",justifyContent:"center",padding:20},link:{color:colors.primary,fontWeight:"800",marginTop:12},
 hero:{alignItems:"center",backgroundColor:colors.card,borderRadius:20,padding:22,borderWidth:1,borderColor:colors.border},
 bigIcon:{width:72,height:72,borderRadius:22,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center",marginBottom:10},
 name:{fontSize:23,fontWeight:"900",color:colors.text,textAlign:"center"},lab:{color:colors.muted,marginTop:3,marginBottom:10},
 validity:{backgroundColor:colors.card,borderRadius:18,padding:18,marginTop:13,borderWidth:1,borderColor:colors.border},validityLabel:{fontSize:11,fontWeight:"900",color:colors.muted},date:{fontSize:22,fontWeight:"900",color:colors.text,marginTop:4},days:{color:colors.warning,fontWeight:"700",marginTop:3},
 section:{backgroundColor:colors.card,borderRadius:16,padding:16,marginTop:12,borderWidth:1,borderColor:colors.border},sectionTitle:{fontWeight:"900",color:colors.text,marginBottom:7},body:{color:colors.muted,lineHeight:20},
 actions:{gap:10,marginTop:18},primary:{height:50,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},primaryText:{color:"white",fontWeight:"900"},secondary:{height:50,borderRadius:14,borderWidth:1,borderColor:colors.primary,alignItems:"center",justifyContent:"center"},secondaryText:{color:colors.primary,fontWeight:"900"},delete:{height:50,borderRadius:14,alignItems:"center",justifyContent:"center"},deleteText:{color:colors.danger,fontWeight:"800"}
});
