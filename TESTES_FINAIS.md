# Validação final do Vida+ — apresentação em 11/11/2026

Atualizado em 09/11/2026. Marque os itens do aparelho apenas durante o ensaio real; testes automatizados não comprovam o comportamento em smartphone.

## Testes automatizados aprovados

- [x] `frontEnd`: `npm run typecheck` — aprovado em 09/11/2026 após os ajustes de análise automática e diálogo de exclusão.
- [x] `frontEnd`: a execução completa anterior de `npm test -- --watch=false` aprovou 84 testes em 14 suítes. Essa execução foi anterior às últimas mudanças de retorno automático do OCR e apresentação do diálogo; repetir `npm test` antes de registrar uma nova aprovação final.
- [x] `frontEnd`: `npm run build:web:test` — exportação web concluída em 08/11/2026.
- [x] `frontEnd`: `npx expo-doctor` — 16/18 verificações aprovadas (2 ressalvas conhecidas), em 08/11/2026.
- [x] `frontEnd`: `npm run build:apk` — release ARM64 gerada em 09/11/2026; ABI `arm64-v8a`, assinatura validada e keystore preservado. Tamanho 41,346,827 bytes; fingerprint SHA-256 `ed15cbdc048ed924c90d4d9d8ed0d80fc0636b4dc9ae29b185045f7e47630a85`.

O Expo Doctor apontou que o projeto mantém pastas nativas Android/iOS junto com campos nativos no `app.json`; não execute prebuild automático. Também classificou `@react-native-ml-kit/text-recognition` como não testado na New Architecture. A New Architecture está desativada no app Android.

O APK inclui o bundle Supabase público, ML Kit, ImagePicker, ImageManipulator e a interface atual de OCR/Gemini. Assinatura validada; permissões INTERNET e CAMERA presentes, sem acesso amplo de leitura da galeria. Cópia imediatamente anterior: `frontEnd/artifacts/VidaMais-antes-dialog-exclusao-20261109.apk`.

## Supabase real — backend aprovado

- [x] A API Supabase respondeu na URL raiz corrigida; a URL configurada antes incluía `/rest/v1`, que foi removido sem alterar a chave publishable.
- [x] Uma consulta sem sessão foi negada com HTTP 401 / `42501`, comportamento esperado para RLS e permissões da tabela.
- [x] A rota `medicamentos` e as colunas usadas pelo app são reconhecidas pelo cache da API; uma coluna propositalmente inválida retornou erro de coluna inexistente.
- [x] Duas sessões anônimas foram criadas. CRUD real passou: INSERT, SELECT, upsert sem duplicação, PATCH e DELETE.
- [x] Todos os campos do medicamento, `texto_ocr` e `leitura_em` persistiram no cadastro e na consulta.
- [x] Constraints de nome, validade finita, `sync_id` imutável e proprietário automático passaram; `created_at` foi preservado e `updated_at` atualizado pelo trigger.
- [x] RLS isolou as sessões: a segunda não leu, atualizou nem excluiu o registro da primeira; proprietário forjado também foi recusado.
- [x] A limpeza removeu os registros de teste. As duas contas anônimas de teste permanecem em Authentication > Users; tokens não foram salvos.
- [x] `npm run test:integracao` usa o `.env` público do frontend e concluiu sem alterar dados preexistentes.

Não foi aplicado SQL ao banco remoto. O endpoint reconhece a tabela e todos os campos; upsert, unicidade, triggers, constraints e políticas foram validados por comportamento real. O teste da API não valida o app SQLite e Supabase em conjunto no aparelho.

## Smartphone Android — pendente

A análise de causa confirmada/hipóteses, os formatos de data e os limites do pré-processamento estão em [OCR_VALIDADE_INVESTIGACAO.md](frontEnd/OCR_VALIDADE_INVESTIGACAO.md).

O `adb` não conseguiu iniciar o daemon e nenhum aparelho foi detectado nesta revisão. A acurácia visual das datas e as coordenadas do recorte continuam sem comprovação física. Executar no dispositivo antes da apresentação:

- [ ] Instalar `frontEnd/artifacts/VidaMais.apk` (release ARM64 atual) e abrir o app.
- [ ] Cadastrar medicamento manualmente com nome e validade; fechar/reabrir o app e conferir que continua salvo.
- [ ] Na Home, tocar no indicador **Medicamentos** e confirmar que abre a mesma lista de **Ver todos**; usar Voltar para retornar.
- [ ] Na lista **Meus medicamentos**, conferir que o botão verde `+` tem o mesmo formato do botão da Home e abre o cadastro.
- [ ] Abrir o cadastro pela câmera, conceder permissão e adicionar múltiplas fotos; misturar câmera/galeria, pré-visualizar, remover e verificar prevenção de duplicatas identificáveis.
- [ ] Cancelar o seletor da galeria e negar a permissão da câmera; confirmar que o formulário segue utilizável.
- [ ] Analisar embalagem e confirmar que ML Kit preenche sugestões e retorna automaticamente ao cadastro; alterar um campo manualmente e verificar que a nova leitura não o substitui.
- [ ] Selecionar imagens de bula e confirmar retorno automático, sugestões estruturadas para indicação, contraindicações, posologia, efeitos adversos e precauções, sem colocar a bula inteira em Observações.
- [ ] No modo **Ler validade e lote**, autorizar o envio, fotografar a área inferior de uma embalagem real (incluindo domperidona 10 mg Eurofarma, se disponível), recortar se necessário e confirmar que o Gemini preenche a validade e retorna ao cadastro.
- [ ] Cancelar o consentimento Gemini e confirmar que a imagem não é enviada; testar a opção lembrar e revogar consentimento.
- [ ] Conferir que a validade digitada manualmente é preservada pelo Gemini; comparar lote, fabricação e validade com a impressão e abrir **Ver texto original**.
- [ ] Induzir uma falha em uma das imagens e confirmar que os resultados das demais continuam aplicados e a análise pode ser repetida.
- [ ] Salvar cadastro e edição; verificar Snackbar curta sem botão, desaparecimento automático e texto sem cortes.
- [ ] Excluir um medicamento; conferir título verde, cartão branco arredondado, botão **Cancelar** verde e **Excluir** vermelho. Cancelar deve manter o registro; confirmar deve excluí-lo.
- [ ] Conferir no detalhe `texto_ocr` e horário `leitura_em` após salvar.
- [ ] Com internet desligada, cadastrar e editar localmente; confirmar status pendente e persistência após reabrir.
- [ ] Restaurar internet; sincronizar e conferir o mesmo `sync_id` no Supabase, sem duplicação.
- [ ] Excluir localmente, sincronizar e confirmar exclusão remota.
- [ ] Testar duas instalações/sessões; confirmar que cada uma só consulta os próprios registros.
- [ ] Interromper a rede durante sincronização; confirmar que registros pendentes permanecem no SQLite e são enviados novamente depois.

## Configuração manual pendente

- [ ] Fazer todos os testes físicos acima. Não marcar OCR, consentimento Gemini ou apresentação visual como aprovados antes dessas verificações.
