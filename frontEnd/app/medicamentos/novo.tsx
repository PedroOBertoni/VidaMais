import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { reconhecerTexto } from "../../src/services/ocr";
import { extrairEmbalagem } from "../../src/services/embalagem";
import { colors } from "../../src/constants/theme";
import { atualizarMedicamento, buscarMedicamento, inserirMedicamento } from "../../src/database/database";
import { sincronizar } from "../../src/services/sync";
import { alerta } from "../../src/services/alerta";
import { converterDataParaISO, formatarData } from "../../src/types/medicamento";

const campos = [
  ["laboratorio", "Laboratório"],
  ["indicacao", "Indicação"],
  ["contraindicacoes", "Contraindicações"],
  ["posologia", "Posologia"],
  ["efeitos_adversos", "Efeitos adversos"],
  ["precaucoes", "Precauções"],
  ["observacoes", "Observações"],
] as const;

export default function NovoMedicamento() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = Boolean(id);
  const [form, setForm] = useState({ nome:"", laboratorio:"", validade:"", indicacao:"", contraindicacoes:"", posologia:"", efeitos_adversos:"", precaucoes:"", observacoes:"", texto_ocr:"", leitura_em:"" });
  const [lendo, setLendo] = useState(false);
  const travaLeitura = useRef(false);
  const [avisoLeitura, setAvisoLeitura] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(Boolean(id));
  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  function formatarDataDigitada(texto: string) {
    const numeros = texto.replace(/\D/g, "").slice(0, 8);

    if (numeros.length <= 2) {
      return numeros;
    }

    if (numeros.length <= 4) {
      return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
    }

    return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
  }

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    buscarMedicamento(Number(id)).then(item => {
      if (!item) {
        alerta("Medicamento não encontrado", "O registro solicitado não existe.", [{ text: "OK", onPress: () => router.back() }]);
        return;
      }
      setForm({
        nome: item.nome,
        laboratorio: item.laboratorio,
        validade: formatarData(item.validade),
        indicacao: item.indicacao,
        contraindicacoes: item.contraindicacoes,
        posologia: item.posologia,
        efeitos_adversos: item.efeitos_adversos,
        precaucoes: item.precaucoes,
        observacoes: item.observacoes,
        texto_ocr: item.texto_ocr ?? "",
        leitura_em: item.leitura_em ?? "",
      });
    }).catch(() => alerta("Erro", "Não foi possível carregar o medicamento."))
      .finally(() => setCarregando(false));
  }, [id]);

  async function escanear(destino: "embalagem" | "observacoes") {
    if (travaLeitura.current) return;
    travaLeitura.current = true;
    setLendo(true);
    try {
      if (Platform.OS === "web") throw new Error("Use o APK instalado no celular para escanear a embalagem.");
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) throw new Error("Autorize a câmera nas configurações do aparelho para fotografar a embalagem.");
      const foto = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false });
      if (foto.canceled || !foto.assets[0]) return;
      const texto = await reconhecerTexto(foto.assets[0].uri);
      const extraido = extrairEmbalagem(texto);
      setForm(prev => ({
        ...prev,
        nome: destino === "embalagem" && !prev.nome ? extraido.nome : prev.nome,
        laboratorio: destino === "embalagem" && !prev.laboratorio ? extraido.laboratorio : prev.laboratorio,
        validade: destino === "embalagem" && !prev.validade ? extraido.validade : prev.validade,
        observacoes: destino === "observacoes" ? [prev.observacoes, texto].filter(Boolean).join("\n\n") : prev.observacoes,
        texto_ocr: [prev.texto_ocr, texto].filter(Boolean).join("\n\n"),
        leitura_em: new Date().toISOString(),
      }));
      setAvisoLeitura(destino === "observacoes"
        ? "Texto transcrito para Observações. Revise antes de salvar; você pode organizar o conteúdo nos campos da bula."
        : `Leitura concluída. Revise nome, laboratório e validade com a embalagem. Campos já preenchidos foram preservados.${extraido.validadeMensal ? " Validade mensal: sugerido o último dia do mês; confirme na embalagem." : ""}${!extraido.validade ? " Validade não identificada: fotografe a lateral ou digite a data." : ""}`);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível ler a foto. Tente novamente.";
      alerta("Leitura da embalagem", mensagem.includes("ActivityResultLauncher")
        ? "O Android reiniciou a tela e a câmera perdeu a conexão com o app. Feche completamente o Vida+ e abra novamente para fotografar."
        : mensagem);
    } finally { setLendo(false); travaLeitura.current = false; }
  }

  async function salvar() {
    const validade = converterDataParaISO(form.validade);
    if (!form.nome.trim() || !validade) {
      alerta("Dados inválidos", "Informe o nome e uma data de validade válida no formato DD/MM/AAAA.");
      return;
    }
    setSalvando(true);
    try {
      const dados = { ...form, nome: form.nome.trim(), validade };
      if (id) await atualizarMedicamento(Number(id), dados);
      else await inserirMedicamento(dados);
      void sincronizar();
      const mensagem = `Medicamento ${editando ? "atualizado" : "cadastrado"} neste aparelho. A sincronização será tentada em segundo plano; acompanhe em Cópia online na tela inicial.`;
      alerta("Sucesso", mensagem, [{ text: "OK", onPress: () => router.back() }]);
    } catch {
      alerta("Erro", "Não foi possível salvar o medicamento.");
    } finally { setSalvando(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: editando ? "Editar medicamento" : "Novo medicamento" }} />
        <Text style={styles.heading}>{editando ? "Editar medicamento" : "Cadastrar medicamento"}</Text>
        <Text style={styles.sub}>Preencha as informações para acompanhar a validade e a bula.</Text>

        <View style={styles.scanCard}>
          <Text style={styles.label}>Ler embalagem com a câmera</Text>
          <Text style={styles.sub}>Fotografe de perto, com boa luz. Leia a frente e depois a lateral com a validade. Revise os dados sugeridos antes de salvar.</Text>
          <Pressable accessibilityRole="button" disabled={lendo || salvando || carregando} style={styles.button} onPress={() => escanear("embalagem")}>
            <Text style={styles.buttonText}>{lendo ? "Reconhecendo texto..." : "Fotografar embalagem"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={lendo || salvando || carregando} style={styles.button} onPress={() => escanear("observacoes")}>
            <Text style={styles.buttonText}>Fotografar texto da bula</Text>
          </Pressable>
          {!!avisoLeitura && <Text accessibilityLiveRegion="polite" style={styles.label}>{avisoLeitura}</Text>}
          {!!form.texto_ocr && <View><Text style={styles.label}>Texto reconhecido (OCR)</Text><Text selectable style={styles.sub}>{form.texto_ocr}</Text></View>}
        </View>
        <Text style={styles.label}>Nome do medicamento *</Text>
        <TextInput accessibilityLabel="Nome do medicamento" value={form.nome} onChangeText={v=>set("nome",v)} placeholder="Ex.: Dipirona" style={styles.input} />

        <Text style={styles.label}>Data de validade *</Text>
        <TextInput accessibilityLabel="Data de validade" value={form.validade} onChangeText={(v) => set("validade", formatarDataDigitada(v))} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10} style={styles.input} />

        {campos.map(([key, label]) => <View key={key}>
          <Text style={styles.label}>{label}</Text>
          <TextInput accessibilityLabel={label} value={form[key]} onChangeText={v=>set(key,v)} placeholder={`Informe ${label.toLowerCase()}`} style={[styles.input, styles.textarea]} multiline />
        </View>)}

        <Pressable accessibilityRole="button" accessibilityLabel="Salvar medicamento" disabled={salvando || lendo || carregando} style={[styles.button, (salvando || lendo || carregando) && { opacity:.6 }]} onPress={salvar}>
          <Text style={styles.buttonText}>{salvando ? "Salvando..." : editando ? "Salvar alterações" : "Salvar medicamento"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scanCard:{padding:16,backgroundColor:colors.primaryLight,borderRadius:16,marginBottom:12},
  screen:{flex:1,backgroundColor:colors.background}, content:{padding:20,paddingBottom:40},
  heading:{fontSize:25,fontWeight:"900",color:colors.text}, sub:{color:colors.muted,lineHeight:19,marginTop:5,marginBottom:22},
  label:{fontWeight:"800",color:colors.text,fontSize:13,marginBottom:7,marginTop:13},
  input:{backgroundColor:colors.card,borderWidth:1,borderColor:colors.border,borderRadius:13,padding:13,color:colors.text,minHeight:48},
  textarea:{minHeight:85,textAlignVertical:"top"},
  button:{backgroundColor:colors.primary,borderRadius:15,height:54,alignItems:"center",justifyContent:"center",marginTop:25},
  buttonText:{color:"white",fontSize:15,fontWeight:"900"},
});
