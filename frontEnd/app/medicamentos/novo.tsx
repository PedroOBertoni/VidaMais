import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { CropRegionModal } from "../../src/components/CropRegionModal";
import { reconhecerTexto } from "../../src/services/ocr";
import { prepararImagemParaGemini, invocarGemini } from "../../src/services/gemini-api";
import { aplicarGeminiConfirmado, type GeminiValidade } from "../../src/services/gemini-validade";
import { analisarGeminiEmLote, combinarResultadosGemini, type ResultadoGeminiImagem } from "../../src/services/gemini-batch";
import { consentimentoPendente, lerConsentimentoGemini, revogarConsentimentoGemini, salvarConsentimentoGemini } from "../../src/services/gemini-consent";
import { tecnologiaOCR } from "../../src/services/ocr-routing";
import {
  adicionarImagens,
  analisarImagens,
  preencherCamposVazios,
  removerImagem,
  sugerirCamposReconhecidos,
  type DestinoOCR,
  type ImagemSelecionada,
  type ResultadoImagem,
} from "../../src/services/fluxo-imagens";
import { colors } from "../../src/constants/theme";
import { atualizarMedicamento, buscarMedicamento, inserirMedicamento } from "../../src/database/database";
import { sincronizar } from "../../src/services/sync";
import { alerta } from "../../src/services/alerta";
import { formatarRelatorioIA, listarTentativasIA, type AiAttempt } from "../../src/services/ai-diagnostics";
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
  const [seletorVisivel, setSeletorVisivel] = useState(false);
  const [destinoOCR, setDestinoOCR] = useState<DestinoOCR>("embalagem");
  const [imagens, setImagens] = useState<ImagemSelecionada[]>([]);
  const [resultadosImagem, setResultadosImagem] = useState<ResultadoImagem[]>([]);
  const [resultadosGemini, setResultadosGemini] = useState<ResultadoGeminiImagem[]>([]);
  const [historicoOCR, setHistoricoOCR] = useState<ResultadoImagem[]>([]);
  const [textoOCRBase, setTextoOCRBase] = useState("");
  const [textoOCRGemini, setTextoOCRGemini] = useState("");
  const camposManuais = useRef(new Set<string>());
  const [validadeLocalConfiavel, setValidadeLocalConfiavel] = useState(false);
  const [iaDraft, setIaDraft] = useState<GeminiValidade | null>(null);
  const [iaErro, setIaErro] = useState("");
  const [iaResumo, setIaResumo] = useState("");
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemParaRecorte, setImagemParaRecorte] = useState<string | null>(null);
  const [progressoOCR, setProgressoOCR] = useState({ concluidas: 0, total: 0 });
  const [conflitosOCR, setConflitosOCR] = useState<ReturnType<typeof sugerirCamposReconhecidos>["conflitos"]>([]);
  const [analisando, setAnalisando] = useState(false);
  const travaAnalise = useRef(false);
  const [avisoLeitura, setAvisoLeitura] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(Boolean(id));
  const [diagnosticoVisivel, setDiagnosticoVisivel] = useState(false);
  const [tentativasIA, setTentativasIA] = useState<AiAttempt[]>([]);
  const [textoOriginalVisivel, setTextoOriginalVisivel] = useState(false);
  const [consentimentoSalvo, setConsentimentoSalvo] = useState(false);
  const [consentimentoSessao, setConsentimentoSessao] = useState(false);
  const [consentimentoModal, setConsentimentoModal] = useState(false);
  const [gerenciarConsentimento, setGerenciarConsentimento] = useState(false);
  const [lembrarConsentimento, setLembrarConsentimento] = useState(false);
  const consentimentoResolver = useRef<((permitido: boolean) => void) | null>(null);
  const set = (key: string, value: string) => {
    camposManuais.current.add(key);
    setForm(prev => ({ ...prev, [key]: value }));
  };

  async function abrirDiagnosticoIA() {
    setTentativasIA(await listarTentativasIA());
    setDiagnosticoVisivel(true);
  }

  useEffect(() => { lerConsentimentoGemini().then(setConsentimentoSalvo); }, []);

  function pedirConsentimentoGemini(): Promise<boolean> {
    if (!consentimentoPendente(consentimentoSalvo, consentimentoSessao)) return Promise.resolve(true);
    setGerenciarConsentimento(false);
    setLembrarConsentimento(false);
    setConsentimentoModal(true);
    return new Promise(resolve => { consentimentoResolver.current = resolve; });
  }

  async function aceitarConsentimentoGemini() {
    setConsentimentoSessao(true);
    if (lembrarConsentimento) {
      try { await salvarConsentimentoGemini(); setConsentimentoSalvo(true); }
      catch { setAvisoLeitura("Consentimento válido apenas nesta sessão; não foi possível salvar a preferência no aparelho."); }
    }
    consentimentoResolver.current?.(true);
    consentimentoResolver.current = null;
    setConsentimentoModal(false);
  }

  function cancelarConsentimentoGemini() {
    consentimentoResolver.current?.(false);
    consentimentoResolver.current = null;
    setConsentimentoModal(false);
  }

  async function revogarConsentimentoGeminiNoAparelho() {
    try {
      await revogarConsentimentoGemini();
      setConsentimentoSalvo(false);
      setConsentimentoSessao(false);
      setConsentimentoModal(false);
      setAvisoLeitura("Consentimento salvo removido. A próxima análise de validade pedirá autorização antes do envio.");
    } catch {
      setAvisoLeitura("Não foi possível remover a preferência neste aparelho.");
    }
  }

  function abrirGerenciadorConsentimento() {
    setGerenciarConsentimento(true);
    setConsentimentoModal(true);
  }

  async function copiarDiagnosticoIA() {
    await Clipboard.setStringAsync(formatarRelatorioIA(tentativasIA));
    alerta("Diagnóstico copiado", "O relatório não contém imagem, texto OCR, token ou chave.");
  }

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
      setTextoOCRBase(item.texto_ocr ?? "");
      for (const [key, value] of Object.entries(item)) if (typeof value === "string" && value.trim()) camposManuais.current.add(key);
    }).catch(() => alerta("Erro", "Não foi possível carregar o medicamento."))
      .finally(() => setCarregando(false));
  }, [id]);

  function abrirSeletor(destino: DestinoOCR) {
    if (destinoOCR !== destino) {
      setImagens([]);
      setResultadosImagem([]);
      setResultadosGemini([]);
      setConflitosOCR([]);
    }
    setDestinoOCR(destino);
    setImagemPreview(null);
    setAvisoLeitura("");
    setIaDraft(null);
    setIaErro("");
    setIaResumo("");
    setValidadeLocalConfiavel(false);
    setSeletorVisivel(true);
  }

  async function fotografarOutra() {
    if (travaLeitura.current) return;
    travaLeitura.current = true;
    setLendo(true);
    try {
      if (Platform.OS === "web") throw new Error("Use o APK instalado no celular para escanear a embalagem.");
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) throw new Error("Autorize a câmera nas configurações do aparelho para fotografar a embalagem.");
      const foto = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false });
      if (foto.canceled || !foto.assets.length) return;
      setImagens(atuais => adicionarImagens(atuais, foto.assets, "camera"));
      setIaDraft(null);
      setIaResumo("");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível ler a foto. Tente novamente.";
      alerta("Câmera", mensagem.includes("ActivityResultLauncher")
        ? "O Android reiniciou a tela e a câmera perdeu a conexão com o app. Feche completamente o Vida+ e abra novamente para fotografar."
        : mensagem);
    } finally { setLendo(false); travaLeitura.current = false; }
  }

  async function escolherDaGaleria() {
    if (travaLeitura.current || lendo || analisando) return;
    travaLeitura.current = true;
    setLendo(true);
    try {
      const selecao = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 0,
        quality: 1,
      });
      if (selecao.canceled || !selecao.assets?.length) return;
      setImagens(atuais => adicionarImagens(atuais, selecao.assets, "galeria"));
      setIaDraft(null);
      setIaResumo("");
    } catch (error) {
      alerta("Galeria", error instanceof Error ? error.message : "Não foi possível abrir o seletor de imagens.");
    } finally { setLendo(false); travaLeitura.current = false; }
  }

  function abrirRecorte(idImagem: string) {
    const imagem = imagens.find(item => item.id === idImagem);
    if (imagem) setImagemParaRecorte(imagem.uri);
  }

  function salvarRecorte(uri: string) {
    const imagem = imagens.find(item => item.uri === imagemParaRecorte);
    if (imagem) {
      setImagens(atuais => atuais.map(item => item.id === imagem.id ? { ...item, recorteUri: uri } : item));
      setResultadosGemini(atuais => atuais.filter(resultado => resultado.id !== imagem.id));
      setIaDraft(null);
      setIaResumo("");
      setResultadosImagem(atuais => atuais.map(resultado => resultado.id === imagem.id && resultado.status !== "falha"
        ? { ...resultado, status: "sem-validade", erro: "Recorte atualizado; a leitura precisa ser repetida." }
        : resultado));
    }
    setImagemParaRecorte(null);
  }

  function combinarHistorico(resultados: ResultadoImagem[], extraGemini = textoOCRGemini) {
    return [textoOCRBase, extraGemini, ...resultados.flatMap(resultado => resultado.status !== "falha" && resultado.status !== "sem-texto" && resultado.texto ? [resultado.texto] : [])]
      .map(texto => texto.trim()).filter(Boolean).join("\n\n");
  }

  function removerFoto(id: string) {
    const imagensRestantes = removerImagem(imagens, id);
    const resultadosRestantes = resultadosImagem.filter(resultado => resultado.id !== id);
    const historicoRestante = historicoOCR.filter(resultado => resultado.id !== id);
    setResultadosGemini(atuais => atuais.filter(resultado => resultado.id !== id));
    setIaDraft(combinarResultadosGemini(resultadosGemini.filter(resultado => resultado.id !== id)));
    setImagens(imagensRestantes);
    setResultadosImagem(resultadosRestantes);
    setHistoricoOCR(historicoRestante);
    setConflitosOCR(sugerirCamposReconhecidos(resultadosRestantes, destinoOCR).conflitos);
    setForm(prev => ({ ...prev, texto_ocr: combinarHistorico(historicoRestante) }));
  }

  async function analisarSelecionadas() {
    if (travaAnalise.current || !imagens.length) return;
    travaAnalise.current = true;
    setAnalisando(true);
    setProgressoOCR({ concluidas: 0, total: imagens.length });
    setIaErro("");
    setIaResumo("");
    try {
      if (tecnologiaOCR(destinoOCR) === "gemini") {
        const permitido = await pedirConsentimentoGemini();
        if (!permitido) {
          setIaErro("Envio cancelado. As imagens continuam selecionadas e nada foi enviado ao serviço de IA.");
          return;
        }
        const lote = await analisarGeminiEmLote(
          imagens,
          resultadosGemini,
          imagem => prepararImagemParaGemini(imagem.recorteUri ?? imagem.uri),
          invocarGemini,
          (concluidas, total) => setProgressoOCR({ concluidas, total }),
        );
        setResultadosGemini(lote.resultados);
        const sugestao = combinarResultadosGemini(lote.resultados);
        setIaDraft(sugestao);
        const falhas = lote.resultados.filter(resultado => resultado.status === "falha").length;
        const sucesso = lote.resultados.filter(resultado => resultado.status === "sucesso").length;
        const resumo = `${sucesso} de ${imagens.length} imagens analisadas.${falhas ? ` ${falhas} falha(s); tente novamente nas imagens com erro.` : ""}${sugestao ? " Revise lote, fabricação e validade antes de confirmar." : ""}`;
        setIaResumo(resumo);
        setAvisoLeitura(resumo);
        if (!sugestao && falhas) setIaErro(lote.resultados.find(resultado => resultado.status === "falha")?.erro ?? "Não foi possível analisar as imagens. Tente novamente ou preencha os campos manualmente.");
        return;
      }

      const lote = await analisarImagens(imagens, resultadosImagem, imagem => reconhecerTexto(imagem.uri), (concluidas, total) => {
        setProgressoOCR({ concluidas, total });
      }, destinoOCR);
      setResultadosImagem(lote.resultados);
      const historicoPorImagem = new Map(historicoOCR.map(resultado => [resultado.id, resultado]));
      for (const resultado of lote.novosSucessos) historicoPorImagem.set(resultado.id, resultado);
      const historicoAtualizado = [...historicoPorImagem.values()];
      setHistoricoOCR(historicoAtualizado);
      const leitura = sugerirCamposReconhecidos(lote.resultados, destinoOCR);
      setConflitosOCR(leitura.conflitos);
      setValidadeLocalConfiavel(false);
      setForm(prev => ({
        ...preencherCamposVazios(prev, leitura.sugestoes, leitura.conflitos),
        texto_ocr: combinarHistorico(historicoAtualizado),
        leitura_em: lote.novosSucessos.length ? new Date().toISOString() : prev.leitura_em,
      }));
      const falhas = lote.resultados.filter(resultado => resultado.status === "falha" || resultado.status === "sem-texto").length;
      const sucesso = lote.resultados.length - falhas;
      setAvisoLeitura(`${sucesso} de ${lote.resultados.length} imagens analisadas com ML Kit.${falhas ? ` ${falhas} imagem(ns) sem reconhecimento; tente novamente.` : " Revise os campos sugeridos antes de salvar."}${leitura.validadeMensal ? " Validade mensal convertida para o último dia do mês; confira no rótulo." : ""}`);
    } catch (error) {
      setAvisoLeitura(error instanceof Error ? error.message : "Não foi possível analisar as imagens selecionadas.");
    } finally {
      setAnalisando(false);
      travaAnalise.current = false;
    }
  }
  function confirmarResultadoIA() {
    if (!iaDraft) return;
    const validadeProtegida = camposManuais.current.has("validade") || validadeLocalConfiavel;
    try {
      const aplicacao = aplicarGeminiConfirmado(form, iaDraft, validadeProtegida);
      const novoTextoGemini = textoOCRGemini.includes(aplicacao.anotacao)
        ? textoOCRGemini
        : [textoOCRGemini, aplicacao.anotacao].filter(Boolean).join("\n\n");
      setTextoOCRGemini(novoTextoGemini);
      setForm({ ...aplicacao.form, texto_ocr: combinarHistorico(historicoOCR, novoTextoGemini) });
      if (aplicacao.validadeAplicada) camposManuais.current.add("validade");
      setIaDraft(null);
      setIaResumo("");
      setAvisoLeitura(aplicacao.validadeAplicada || !iaDraft.validade
        ? "Sugestões do Gemini confirmadas. Revise os dados e salve para persistir."
        : "Texto e dados da IA confirmados; a validade existente foi preservada. Compare as duas sugestões e corrija o cadastro manualmente se necessário.");
    } catch (error) {
      setIaErro(error instanceof Error ? error.message : "Revise a validade sugerida antes de confirmar.");
    }
  }

  function descartarResultadoIA() {
    setIaDraft(null);
    setIaErro("");
    setIaResumo("");
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
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Stack.Screen options={{ title: editando ? "Editar medicamento" : "Novo medicamento" }} />
          <Text style={styles.heading}>{editando ? "Editar medicamento" : "Cadastrar medicamento"}</Text>
          <Text style={styles.sub}>Preencha as informações para acompanhar a validade e a bula.</Text>

          <View style={styles.scanCard}>
            <Text style={styles.label}>Reconhecer embalagem ou bula</Text>
            <Text style={styles.sub}>Fotografe várias partes ou escolha imagens da galeria. Revise tudo antes de analisar.</Text>
            <Pressable accessibilityRole="button" disabled={salvando || carregando || analisando} style={styles.button} onPress={() => abrirSeletor("embalagem")}>
              <Text style={styles.buttonText}>Ler embalagem</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={salvando || carregando || analisando} style={styles.buttonSecondary} onPress={() => abrirSeletor("validade")}>
              <Text style={styles.buttonSecondaryText}>Ler validade e lote</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={salvando || carregando || analisando} style={styles.buttonSecondary} onPress={() => abrirSeletor("bula")}>
              <Text style={styles.buttonSecondaryText}>Ler bula</Text>
            </Pressable>
            {!!avisoLeitura && <Text accessibilityLiveRegion="polite" style={styles.summaryText}>{avisoLeitura}</Text>}
            {!!form.texto_ocr && <Pressable accessibilityRole="button" style={styles.inlineAction} onPress={() => setTextoOriginalVisivel(true)}><Text style={styles.inlineActionText}>Ver texto original</Text></Pressable>}
            <Pressable accessibilityRole="button" style={styles.inlineAction} onPress={abrirGerenciadorConsentimento}>
              <Text style={styles.inlineActionText}>Consentimento Gemini · gerenciar ({consentimentoSalvo ? "salvo" : consentimentoSessao ? "nesta sessão" : "não salvo"})</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" style={styles.diagnosticLink} onPress={abrirDiagnosticoIA}>
            <Text style={styles.diagnosticLinkText}>Diagnóstico de IA · testes</Text>
          </Pressable>

          <Text style={styles.label}>Nome do medicamento *</Text>
          <TextInput accessibilityLabel="Nome do medicamento" value={form.nome} onChangeText={v => set("nome", v)} placeholder="Ex.: Dipirona" style={styles.input} />
          <Text style={styles.label}>Data de validade *</Text>
          <TextInput accessibilityLabel="Data de validade" value={form.validade} onChangeText={v => set("validade", formatarDataDigitada(v))} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10} style={styles.input} />
          {campos.map(([key, label]) => <View key={key}>
            <Text style={styles.label}>{label}</Text>
            <TextInput accessibilityLabel={label} value={form[key]} onChangeText={v => set(key, v)} placeholder={`Informe ${label.toLowerCase()}`} style={[styles.input, styles.textarea]} multiline />
          </View>)}
          <Pressable accessibilityRole="button" accessibilityLabel="Salvar medicamento" disabled={salvando || lendo || analisando || carregando} style={[styles.button, (salvando || lendo || analisando || carregando) && styles.disabled]} onPress={salvar}>
            <Text style={styles.buttonText}>{salvando ? "Salvando..." : editando ? "Salvar alterações" : "Salvar medicamento"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={seletorVisivel} animationType="slide" onRequestClose={() => { if (!analisando) { setImagemPreview(null); setSeletorVisivel(false); } }}>
        <SafeAreaView style={styles.modalScreen} edges={["top", "bottom"]}>
          {imagemPreview ? <View style={styles.previewScreen}>
            <Pressable accessibilityRole="button" style={styles.buttonSecondary} onPress={() => setImagemPreview(null)}><Text style={styles.buttonSecondaryText}>Voltar às imagens</Text></Pressable>
            <Image source={{ uri: imagemPreview }} style={styles.previewImage} resizeMode="contain" />
          </View> : <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{destinoOCR === "validade" ? "Ler validade e lote" : `Preparar leitura da ${destinoOCR === "embalagem" ? "embalagem" : "bula"}`}</Text>
            <Text style={styles.modalDescription}>{destinoOCR === "validade" ? "O Gemini analisará diretamente as imagens selecionadas ou o recorte da validade. O ML Kit não será executado neste fluxo." : `${imagens.length} imagem(ns). O Google ML Kit será usado para reconhecer texto e sugerir os campos estruturados.`}</Text>
            <Pressable accessibilityRole="button" disabled={lendo || analisando} style={[styles.button, (lendo || analisando) && styles.disabled]} onPress={fotografarOutra}>
              <Text style={styles.buttonText}>{lendo ? "Abrindo câmera..." : "Tirar outra foto"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={lendo || analisando} style={[styles.buttonSecondary, (lendo || analisando) && styles.disabled]} onPress={escolherDaGaleria}>
              <Text style={styles.buttonSecondaryText}>{lendo ? "Abrindo seletor..." : "Adicionar da galeria"}</Text>
            </Pressable>
            {imagens.length > 0 ? <>
              <Text accessibilityLiveRegion="polite" style={styles.label}>{imagens.length} imagem(ns) selecionada(s)</Text>
              <ScrollView horizontal contentContainerStyle={styles.thumbnailRow} showsHorizontalScrollIndicator={false}>
                {imagens.map((imagem, indice) => {
                  const ml = resultadosImagem.find(resultado => resultado.id === imagem.id);
                  const gemini = resultadosGemini.find(resultado => resultado.id === imagem.id);
                  return <View key={imagem.id} style={styles.thumbnailCard}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Visualizar imagem ${indice + 1}`} onPress={() => setImagemPreview(imagem.uri)}>
                      <Image source={{ uri: imagem.uri }} style={styles.thumbnail} />
                    </Pressable>
                    {destinoOCR === "validade" && <Pressable accessibilityRole="button" onPress={() => abrirRecorte(imagem.id)} style={styles.cropButton}><Text style={styles.cropButtonText}>{imagem.recorteUri ? "Ajustar recorte" : "Recortar data"}</Text></Pressable>}
                    {!!imagem.recorteUri && <Text style={styles.cropReady}>Recorte selecionado</Text>}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remover imagem ${indice + 1}`} style={styles.removeBadge} onPress={() => removerFoto(imagem.id)}><Text style={styles.removeBadgeText}>×</Text></Pressable>
                    <Text style={styles.thumbnailLabel}>Imagem {indice + 1} · {imagem.origem === "camera" ? "câmera" : "galeria"}</Text>
                    {!!(destinoOCR === "validade" ? gemini : ml) && <Text style={(destinoOCR === "validade" ? gemini?.status === "falha" : ml?.status === "falha" || ml?.status === "sem-texto") ? styles.errorText : styles.guidanceText}>
                      {destinoOCR === "validade" ? (gemini?.status === "sucesso" ? "Gemini concluiu" : "Gemini falhou; tente novamente") : (ml?.status === "sucesso" ? "Texto reconhecido" : "Sem texto; tente novamente")}
                    </Text>}
                  </View>;
                })}
              </ScrollView>
            </> : <Text style={styles.emptyImages}>Adicione ao menos uma imagem para habilitar a análise.</Text>}

            {analisando && <View style={styles.progressCard}>
              <ActivityIndicator color={colors.primary} />
              <Text accessibilityLiveRegion="polite" style={styles.summaryText}>Analisando imagens... {progressoOCR.concluidas} de {progressoOCR.total}</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressoOCR.total ? (progressoOCR.concluidas / progressoOCR.total) * 100 : 0}%` }]} /></View>
            </View>}
            {!!iaErro && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{iaErro}</Text>}
            {!!iaResumo && <View style={styles.summaryCard}><Text accessibilityLiveRegion="polite" style={styles.summaryText}>{iaResumo}</Text></View>}

            {!!iaDraft && <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Análise concluída</Text>
              <Text style={styles.guidanceText}>Revise as informações sugeridas. Elas só serão aplicadas ao formulário após sua confirmação.</Text>
              <Text style={styles.label}>Lote identificado</Text>
              <TextInput accessibilityLabel="Sugestão de lote do Gemini" value={iaDraft.lote ?? ""} onChangeText={value => setIaDraft(prev => prev ? { ...prev, lote: value || null } : prev)} style={styles.input} />
              <Text style={styles.label}>Data de fabricação</Text>
              <TextInput accessibilityLabel="Sugestão de fabricação do Gemini" value={iaDraft.fabricacao ?? ""} onChangeText={value => setIaDraft(prev => prev ? { ...prev, fabricacao: value || null } : prev)} style={styles.input} />
              <Text style={styles.label}>Data de validade</Text>
              <TextInput accessibilityLabel="Sugestão de validade do Gemini" value={iaDraft.validade ?? ""} onChangeText={value => setIaDraft(prev => prev ? { ...prev, validade: value || null } : prev)} placeholder="DD/MM/AAAA" style={styles.input} />
              {!!iaDraft.campos_incerto.length && <Text style={styles.guidanceText}>Confira com atenção: {iaDraft.campos_incerto.join(", ")}.</Text>}
              {iaDraft.avisos.map((aviso, index) => <Text key={`${index}-${aviso}`} style={styles.guidanceText}>{aviso}</Text>)}
              <Pressable accessibilityRole="button" style={styles.button} onPress={confirmarResultadoIA}><Text style={styles.buttonText}>Confirmar sugestões</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.closeButton} onPress={descartarResultadoIA}><Text style={styles.closeButtonText}>Descartar sugestões</Text></Pressable>
            </View>}

            {!!resultadosImagem.length && destinoOCR !== "validade" && <View style={styles.summaryCard}>
              <Text style={styles.resultTitle}>{resultadosImagem.filter(item => item.status === "sucesso").length} de {resultadosImagem.length} imagens analisadas com ML Kit.</Text>
              <Text style={styles.resultText}>Revise os campos sugeridos. O texto original permanece armazenado no cadastro.</Text>
            </View>}
            {!!conflitosOCR.length && <View style={styles.conflictCard}>
              <Text style={styles.conflictTitle}>Confira informações diferentes entre as imagens</Text>
              {conflitosOCR.map(conflito => <Text key={conflito.campo} style={styles.conflictText}>{conflito.rotulo}: {conflito.valores.join(" / ")}. Revise o campo no cadastro.</Text>)}
            </View>}

            <Pressable accessibilityRole="button" disabled={!imagens.length || analisando || lendo} style={[styles.button, (!imagens.length || analisando || lendo) && styles.disabled]} onPress={analisarSelecionadas}>
              <Text style={styles.buttonText}>{analisando ? "Analisando imagens..." : "Analisar imagens"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={analisando} style={styles.closeButton} onPress={() => { setImagemPreview(null); setSeletorVisivel(false); }}>
              <Text style={styles.closeButtonText}>Voltar ao cadastro</Text>
            </Pressable>
          </ScrollView>}
        </SafeAreaView>
      </Modal>

      <Modal visible={consentimentoModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => gerenciarConsentimento ? setConsentimentoModal(false) : cancelarConsentimentoGemini()}>
        <View style={styles.dialogBackdrop}>
          <SafeAreaView style={styles.dialogSafe} edges={["top", "bottom"]}>
            <View style={styles.dialogCard}>
              {gerenciarConsentimento ? <>
                <Text style={styles.dialogTitle}>Consentimento Gemini</Text>
                <Text style={styles.dialogText}>{consentimentoSalvo || consentimentoSessao ? "O envio externo está autorizado neste aparelho/sessão." : "Nenhuma autorização persistente está salva."}</Text>
                {(consentimentoSalvo || consentimentoSessao) && <Pressable accessibilityRole="button" style={styles.dialogButtonSecondary} onPress={revogarConsentimentoGeminiNoAparelho}><Text style={styles.dialogButtonSecondaryText}>Revogar consentimento</Text></Pressable>}
                <Pressable accessibilityRole="button" style={styles.dialogButton} onPress={() => setConsentimentoModal(false)}><Text style={styles.dialogButtonText}>Fechar</Text></Pressable>
              </> : <>
                <Text style={styles.dialogTitle}>Enviar imagens para análise?</Text>
                <Text style={styles.dialogText}>Para ler validade e lote, as imagens selecionadas ou seus recortes serão enviados pela internet ao Supabase e ao Google Gemini. O Supabase não armazena as fotografias. Só continue se concordar com esse processamento externo.</Text>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: lembrarConsentimento }} style={styles.rememberRow} onPress={() => setLembrarConsentimento(value => !value)}>
                  <View style={[styles.checkbox, lembrarConsentimento && styles.checkboxChecked]} />
                  <Text style={styles.dialogText}>Lembrar minha autorização neste aparelho</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.dialogButton} onPress={aceitarConsentimentoGemini}><Text style={styles.dialogButtonText}>Concordar e analisar</Text></Pressable>
                <Pressable accessibilityRole="button" style={styles.dialogButtonSecondary} onPress={cancelarConsentimentoGemini}><Text style={styles.dialogButtonSecondaryText}>Cancelar</Text></Pressable>
              </>}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={textoOriginalVisivel} animationType="slide" onRequestClose={() => setTextoOriginalVisivel(false)}>
        <SafeAreaView style={styles.modalScreen} edges={["top", "bottom"]}>
          <View style={styles.originalHeader}><Text style={styles.modalTitle}>Texto original reconhecido</Text>
            <Pressable accessibilityRole="button" style={styles.buttonSecondary} onPress={() => setTextoOriginalVisivel(false)}><Text style={styles.buttonSecondaryText}>Fechar</Text></Pressable>
          </View>
          <ScrollView style={styles.originalScroll} contentContainerStyle={styles.originalContent}><Text selectable style={styles.ocrText}>{form.texto_ocr}</Text></ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={diagnosticoVisivel} animationType="slide" onRequestClose={() => setDiagnosticoVisivel(false)}>
        <SafeAreaView style={styles.modalScreen} edges={["top", "bottom"]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Diagnóstico de IA</Text>
            <Text style={styles.modalDescription}>Últimas {tentativasIA.length} tentativas neste aparelho. O relatório não inclui imagens, OCR ou credenciais.</Text>
            <Pressable accessibilityRole="button" disabled={!tentativasIA.length} style={[styles.button, !tentativasIA.length && styles.disabled]} onPress={copiarDiagnosticoIA}><Text style={styles.buttonText}>Copiar relatório técnico</Text></Pressable>
            {!tentativasIA.length && <Text style={styles.emptyImages}>Nenhuma tentativa de IA registrada neste aparelho.</Text>}
            {tentativasIA.map((attempt, index) => <View key={`${attempt.timestamp}-${index}`} style={styles.resultCard}>
              <Text style={styles.resultTitle}>{new Date(attempt.timestamp).toLocaleString()} · HTTP {attempt.httpStatus ?? "sem resposta"}</Text>
              <Text style={styles.resultText}>Código: {attempt.errorCode ?? "sucesso"} · Duração: {attempt.durationMs} ms</Text>
              <Text style={styles.resultText}>Etapa: {attempt.stage} · Modelo: {attempt.model}</Text>
              <Text selectable style={styles.resultText}>Correlação: {attempt.correlationId ?? "indisponível"}</Text>
            </View>)}
            <Pressable accessibilityRole="button" style={styles.closeButton} onPress={() => setDiagnosticoVisivel(false)}><Text style={styles.closeButtonText}>Fechar diagnóstico</Text></Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <CropRegionModal uri={imagemParaRecorte} visible={Boolean(imagemParaRecorte)} onCancel={() => setImagemParaRecorte(null)} onApply={salvarRecorte} />
    </>
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
  buttonSecondary:{backgroundColor:colors.card,borderColor:colors.primary,borderWidth:1,borderRadius:15,minHeight:50,alignItems:"center",justifyContent:"center",marginTop:12,paddingHorizontal:14},
  buttonSecondaryText:{color:colors.primaryDark,fontSize:14,fontWeight:"900"},
  ocrText:{backgroundColor:colors.card,borderRadius:12,padding:12,color:colors.text,lineHeight:20},
  inlineAction:{alignSelf:"flex-start",paddingVertical:6,marginTop:5}, inlineActionText:{color:colors.primaryDark,fontSize:12,fontWeight:"800",textDecorationLine:"underline"},
  modalScreen:{flex:1,backgroundColor:colors.background}, modalContent:{padding:20,paddingBottom:36},
  modalTitle:{fontSize:23,fontWeight:"900",color:colors.text}, modalDescription:{color:colors.muted,lineHeight:20,marginTop:8,marginBottom:8},
  thumbnailRow:{paddingVertical:16,gap:12}, thumbnailCard:{width:118,position:"relative"},
  thumbnail:{width:112,height:112,borderRadius:14,backgroundColor:colors.border},
  thumbnailLabel:{fontSize:11,color:colors.muted,marginTop:6}, cropButton:{backgroundColor:colors.card,borderWidth:1,borderColor:colors.primary,borderRadius:10,padding:7,marginTop:7,alignItems:"center"}, cropButtonText:{color:colors.primaryDark,fontWeight:"800",fontSize:11}, cropReady:{fontSize:10,color:colors.primaryDark,marginTop:4},
  removeBadge:{position:"absolute",right:1,top:1,width:28,height:28,borderRadius:14,backgroundColor:colors.danger,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:colors.card},
  removeBadgeText:{color:"white",fontSize:20,fontWeight:"900",lineHeight:22},
  emptyImages:{color:colors.muted,textAlign:"center",paddingVertical:24},
  disabled:{opacity:.45},
  progressCard:{backgroundColor:colors.card,borderRadius:14,padding:12,marginTop:14},
  summaryText:{color:colors.text,lineHeight:19,marginTop:8}, summaryCard:{backgroundColor:colors.primaryLight,borderRadius:12,padding:12,marginTop:12},
  progressTrack:{height:8,backgroundColor:colors.border,borderRadius:6,overflow:"hidden"},
  progressFill:{height:8,backgroundColor:colors.primary,borderRadius:6},
  resultCard:{backgroundColor:colors.card,borderRadius:14,padding:14,marginTop:12,borderWidth:1,borderColor:colors.border},
  resultTitle:{fontWeight:"900",color:colors.text,marginBottom:7}, resultText:{color:colors.muted,lineHeight:20}, errorText:{color:colors.danger,lineHeight:19}, guidanceText:{color:colors.warning,lineHeight:19,marginTop:8},
  conflictCard:{backgroundColor:colors.warningBg,borderRadius:14,padding:14,marginTop:12},
  conflictTitle:{fontWeight:"900",color:colors.warning,marginBottom:6}, conflictText:{color:colors.text,lineHeight:19,marginTop:4},
  closeButton:{alignItems:"center",justifyContent:"center",padding:16,marginTop:8}, closeButtonText:{color:colors.muted,fontWeight:"800"},
  diagnosticLink:{alignSelf:"flex-start",marginTop:2,paddingVertical:7}, diagnosticLinkText:{color:colors.primaryDark,fontSize:12,fontWeight:"700",textDecorationLine:"underline"},
  dialogBackdrop:{flex:1,backgroundColor:"rgba(13,38,29,0.56)",justifyContent:"center",paddingHorizontal:20}, dialogSafe:{width:"100%"},
  dialogCard:{backgroundColor:colors.card,borderRadius:24,padding:22,shadowColor:"#000",shadowOpacity:0.18,shadowRadius:18,elevation:8},
  dialogTitle:{fontSize:20,fontWeight:"900",color:colors.primaryDark,marginBottom:10}, dialogText:{color:colors.text,lineHeight:21,marginBottom:8},
  dialogButton:{minHeight:50,borderRadius:14,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",paddingHorizontal:16,marginTop:12}, dialogButtonText:{color:"white",fontSize:14,fontWeight:"900"},
  dialogButtonSecondary:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:colors.primary,alignItems:"center",justifyContent:"center",paddingHorizontal:16,marginTop:10}, dialogButtonSecondaryText:{color:colors.primaryDark,fontSize:14,fontWeight:"800"},
  rememberRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:8,marginTop:5}, checkbox:{width:21,height:21,borderRadius:5,borderWidth:1.5,borderColor:colors.primary}, checkboxChecked:{backgroundColor:colors.primary,borderWidth:5},
  originalHeader:{paddingHorizontal:20,paddingVertical:12,borderBottomWidth:1,borderColor:colors.border}, originalScroll:{flex:1}, originalContent:{padding:20,paddingBottom:32},
  previewScreen:{flex:1,padding:20}, previewImage:{flex:1,width:"100%",marginVertical:16},
});
