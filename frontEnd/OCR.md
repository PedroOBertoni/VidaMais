# OCR de embalagem, validade e bula

O cadastro usa o mesmo fluxo de imagens e o botão **Analisar imagens** para embalagem, validade/lote e bula. Para combinar frente, lateral e validade, adicione imagens da câmera e da galeria na mesma sessão. O seletor permite pré-visualizar e remover fotos; no fluxo de validade também é possível recortar a região relevante.

## Como usar

1. Abra **Cadastrar medicamento** ou **Editar medicamento**.
2. Escolha **Ler embalagem**, **Ler validade e lote** ou **Ler bula**.
3. Toque **Tirar outra foto** para capturar pela câmera ou **Adicionar da galeria** para selecionar imagens. Você pode misturar as duas origens e acrescentar imagens antes da análise.
4. Confira as miniaturas e, se necessário, remova uma imagem ou abra **Recortar data** no fluxo de validade e lote.
5. Toque uma vez em **Analisar imagens**. A análise não começa enquanto não houver imagens e o botão fica bloqueado durante o processamento.
6. Quando ao menos uma imagem conclui a análise, os campos/textos reconhecidos são aplicados e o seletor fecha automaticamente. Se não houver dados reconhecidos, o cadastro retorna com um aviso; revise os campos e salve o medicamento.

Se todas as imagens falharem, o seletor permanece aberto para tentar novamente. Resultados bem-sucedidos são preservados quando há falha parcial. Para uma imagem nova, volte ao mesmo fluxo, acrescente a foto ou repita a análise; campos manuais não são substituídos.

## Mecanismo usado por fluxo

| Fluxo | Processamento | Campos e resultado |
| --- | --- | --- |
| **Ler embalagem** | Google ML Kit local no APK | Sugere nome, laboratório e validade a partir do texto reconhecido. Preenche campos vazios e não substitui valores já digitados. |
| **Ler validade e lote** | Supabase Edge Function `analisar-validade` → Gemini Vision | Lê caracteres industriais, lote, fabricação e validade. A validade sugerida é aplicada automaticamente se o campo não estiver protegido por edição manual ou leitura local confiável. Lote, fabricação e transcrição são preservados no texto OCR, pois não há colunas separadas para esses dados. |
| **Ler bula** | Google ML Kit local no APK | Usa títulos reconhecidos para sugerir indicação, contraindicações, posologia, efeitos adversos e precauções. Não transfere a bula inteira automaticamente para Observações. |

O texto original reconhecido, inclusive as linhas retornadas pelo Gemini, é guardado em `texto_ocr`; `leitura_em` registra o horário da leitura. Ambos são persistidos no SQLite e sincronizados na linha do medicamento no Supabase. **Ver texto original** abre o conteúdo integral para conferência, sem ocupar a tela principal do cadastro.

## Consentimento e privacidade do fluxo Gemini

O fluxo de validade e lote precisa de internet. Antes do primeiro envio, o aplicativo explica que a imagem selecionada ou o recorte será enviado ao Supabase e ao Google Gemini e pede autorização. A pessoa pode autorizar somente durante a sessão ou salvar a preferência no aparelho; essa preferência pode ser consultada ou revogada no cadastro. Cancelar não envia a imagem.

As fotos e os recortes são processados em memória e não são gravados no Supabase Storage. A chave `GEMINI_API_KEY` fica somente nos secrets da Edge Function; nunca deve estar no `.env` do frontend, no APK ou no repositório. Consulte [GEMINI_VISION_SETUP.md](GEMINI_VISION_SETUP.md) para arquitetura, deployment e diagnóstico.

Em embalagem e bula, o ML Kit reconhece texto no próprio aparelho e não envia as imagens para OCR remoto. As imagens selecionadas permanecem temporárias; o app persiste os resultados textuais, não as fotografias.

## Interpretação e revisão

- O OCR transcreve o que está visível; sugestões de nome e laboratório são heurísticas, não identificação clínica nem consulta a catálogo farmacêutico.
- No fluxo de validade, o Gemini considera abreviações como `L`, `F`, `V`, `FAB`, `VAL` e `EXP`, mas pode falhar em impressões pontilhadas. Confira a validade e os dados originais na embalagem.
- A validade digitada manualmente é preservada. Campos de embalagem/bula já preenchidos também não são sobrescritos automaticamente.
- Se imagens apresentarem valores conflitantes ou incertos, confira o aviso no cadastro e abra o texto original antes de salvar.
- A extração da bula depende de títulos visíveis e pode não reconhecer todas as seções. Revise as sugestões; o aplicativo não gera conteúdo farmacológico ausente das fotos.
- Datas de mês/ano são normalizadas segundo as regras do app e devem ser conferidas na embalagem.

## Dependências e limitações de execução

O OCR local do ML Kit exige uma compilação nativa e não funciona no Expo Go nem no navegador. No Android, instale [o APK release](APK.md). Expo Go e web continuam disponíveis para cadastro manual e outras funções suportadas. A análise remota Gemini requer o app atualizado, imagem selecionada, consentimento, conexão e Edge Function publicada/autenticada; a validação documentada é pela build Android.

O acesso à galeria usa o seletor de imagens do sistema e não pede permissão ampla de biblioteca. A câmera solicita sua permissão quando escolhida. Cancelar qualquer seletor preserva o formulário.

## Persistência Supabase

Para uma tabela existente, aplique [a migração OCR](../backEnd/migracao-ocr.sql); uma instalação nova usa [schema.sql](../backEnd/schema.sql). As colunas são:

| Coluna | Conteúdo |
| --- | --- |
| `texto_ocr` | Texto reconhecido e transcrições das imagens |
| `leitura_em` | Data/hora ISO da última análise |

As colunas são migradas automaticamente no SQLite e acompanham inserção, edição, download e sincronização remota. Não é necessário criar tabela adicional para Gemini.

## Verificação física

| Cenário | Resultado esperado |
| --- | --- |
| Adicionar imagens da câmera e da galeria | Miniaturas de ambas as origens ficam juntas na sessão |
| Cancelar câmera ou galeria | Nenhuma foto nova é adicionada e o formulário continua disponível |
| Remover e pré-visualizar foto | Somente a imagem escolhida é afetada |
| Analisar embalagem ou bula | ML Kit aplica os resultados e retorna automaticamente ao cadastro |
| Analisar validade/lote com consentimento | Gemini aplica os resultados e retorna ao cadastro; validade manual é preservada |
| Uma imagem falha e outra é reconhecida | O resultado válido permanece no cadastro; a falha é indicada para nova tentativa |
| Conferir texto original e salvar offline | `texto_ocr` e `leitura_em` persistem no SQLite |
| Reconectar e sincronizar | Os mesmos campos chegam à linha do medicamento no Supabase |

O checklist para a validação em aparelho está em [`../TESTES_FINAIS.md`](../TESTES_FINAIS.md). Testes automatizados e typecheck não comprovam foco de câmera, qualidade de OCR nem o comportamento real do seletor do sistema.

Referências: [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [React Native ML Kit Text Recognition](https://github.com/a7medev/react-native-ml-kit/tree/main/text-recognition).
