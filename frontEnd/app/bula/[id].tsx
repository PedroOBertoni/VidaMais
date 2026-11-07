import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "../../src/constants/theme";
import { buscarMedicamento } from "../../src/database/database";
import { Medicamento } from "../../src/types/medicamento";
import { alerta } from "../../src/services/alerta";

export default function Bula() {
  const { id } = useLocalSearchParams<{id:string}>();
  const [item,setItem]=useState<Medicamento|null|undefined>(undefined);
  const [erro,setErro]=useState(false);
  useEffect(()=>{
    setErro(false);
    buscarMedicamento(Number(id)).then(setItem).catch(()=>setErro(true));
  },[id]);
  if(erro)return <View style={styles.center}><Text>Não foi possível carregar a bula.</Text></View>;
  if(item===undefined)return <View style={styles.center}><Text>Carregando...</Text></View>;
  if(item===null)return <View style={styles.center}><Text>Medicamento não encontrado.</Text></View>;
  const secoes=[["Indicação",item.indicacao],["Contraindicações",item.contraindicacoes],["Posologia",item.posologia],["Efeitos adversos",item.efeitos_adversos],["Precauções",item.precaucoes],["Observações",item.observacoes]];
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><Text style={styles.icon}>📖</Text><Text style={styles.title}>Bula — {item.nome}</Text><Text style={styles.note}>Informações cadastradas no Vida+</Text></View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Consultar a bula oficial</Text>
      <Text style={styles.body}>No Bulário da Anvisa, busque por {item.nome} e confira o fabricante e a apresentação da sua embalagem. Requer internet.</Text>
      <Pressable accessibilityRole="link" accessibilityLabel="Abrir Bulário da Anvisa" style={{ paddingVertical: 14 }} onPress={() => {
        Linking.openURL("https://consultas.anvisa.gov.br/#/bulario/").catch(() => alerta("Bula oficial", "Não foi possível abrir o navegador. Tente novamente com internet."));
      }}><Text style={{ color: colors.primary, fontWeight: "800" }}>Abrir Bulário da Anvisa ↗</Text></Pressable>
    </View>
    {secoes.map(([title,text])=><View key={title} style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{text || "Não informado."}</Text></View>)}
    <View style={styles.warning}><Text style={styles.warningTitle}>⚠️ Importante</Text><Text style={styles.warningText}>As informações exibidas são para organização e consulta. A bula oficial do fabricante e a orientação de um profissional de saúde devem prevalecer.</Text></View>
  </ScrollView>
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{padding:20,paddingBottom:40},center:{flex:1,alignItems:"center",justifyContent:"center"},header:{backgroundColor:colors.primaryLight,borderRadius:20,padding:20,marginBottom:4},icon:{fontSize:30},title:{fontSize:22,fontWeight:"900",color:colors.text,marginTop:7},note:{color:colors.muted,marginTop:3},section:{backgroundColor:colors.card,borderRadius:16,padding:17,marginTop:12,borderWidth:1,borderColor:colors.border},sectionTitle:{fontSize:15,fontWeight:"900",color:colors.text,marginBottom:8},body:{color:colors.muted,lineHeight:21},warning:{backgroundColor:colors.warningBg,borderRadius:16,padding:16,marginTop:14},warningTitle:{color:colors.warning,fontWeight:"900"},warningText:{color:colors.text,lineHeight:19,marginTop:5,fontSize:12}});
