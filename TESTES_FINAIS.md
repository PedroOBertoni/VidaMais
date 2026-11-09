# Validação final do Vida+ — apresentação em 11/11/2026

Atualizado em 08/11/2026. Marque os itens do aparelho apenas durante o ensaio real; testes automatizados não comprovam o comportamento em smartphone.

## Testes automatizados aprovados

- [x] `frontEnd`: `npm run typecheck` — aprovado em 08/11/2026.
- [x] `frontEnd`: `npm test -- --watch=false` — 52 testes em 6 suítes aprovados em 08/11/2026; inclui parser de datas, recorte/rotações com dependências injetadas, conflitos e fluxos OCR anteriores.
- [x] `frontEnd`: `npm run build:web:test` — exportação web concluída em 08/11/2026.
- [x] `frontEnd`: `npx expo-doctor` — 16/18 verificações aprovadas (2 ressalvas conhecidas), em 08/11/2026.
- [x] `frontEnd`: `npm run build:apk` — release Android compatível com ARM64 gerado e validado em 08/11/2026; fingerprint igual ao APK anterior/keystore preservado.

O Expo Doctor apontou que o projeto mantém pastas nativas Android/iOS junto com campos nativos no `app.json`; não execute prebuild automático. Também classificou `@react-native-ml-kit/text-recognition` como não testado na New Architecture. A New Architecture está desativada no app Android.

O APK inclui o bundle Supabase público, 15 bibliotecas nativas arm64, ML Kit e ImageManipulator. Assinatura validada; permissões INTERNET e CAMERA presentes, sem acesso amplo de leitura da galeria. Cópia anterior: `frontEnd/artifacts/VidaMais-antes-correcao-validade.apk`.

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

- [ ] Instalar `frontEnd/artifacts/VidaMais.apk` (release revisado com seleção de imagens) e abrir o app.
- [ ] Cadastrar medicamento manualmente com nome e validade; fechar/reabrir o app e conferir que continua salvo.
- [ ] Editar e excluir um medicamento manualmente.
- [ ] Abrir o cadastro por câmera e aceitar a permissão.
- [ ] No modo **Ler validade e lote**, repetir o teste com domperidona 10 mg Eurofarma: fotografar a área inferior, analisar, desenhar recorte na impressão dot-matrix se faltar validade e confirmar a data e lote contra a caixa. O fluxo tenta o original antes do recorte e das rotações.
- [ ] Adicionar fotos da câmera e da galeria na mesma sessão; selecionar várias imagens, adicionar mais depois e verificar que duplicatas identificáveis são ignoradas.
- [ ] Cancelar o seletor da galeria e negar a permissão da câmera; confirmar que o cadastro segue utilizável.
- [ ] Fotografar embalagem real; revisar nome, laboratório e validade sugeridos antes de salvar; editar manualmente um campo e confirmar que nova análise não o sobrescreve.
- [ ] Selecionar imagens de bula e revisar as sugestões estruturadas para indicação, contraindicações, posologia, efeitos adversos e precauções; conferir os textos originais por imagem.
- [ ] Confirmar que uma imagem com falha não descarta os resultados das outras e que seja possível repetir apenas a imagem que falhou.
- [ ] Conferir no detalhe `texto_ocr` e horário `leitura_em` após salvar.
- [ ] Com internet desligada, cadastrar e editar localmente; confirmar status pendente e persistência após reabrir.
- [ ] Restaurar internet; sincronizar e conferir o mesmo `sync_id` no Supabase, sem duplicação.
- [ ] Excluir localmente, sincronizar e confirmar exclusão remota.
- [ ] Testar duas instalações/sessões; confirmar que cada uma só consulta os próprios registros.
- [ ] Interromper a rede durante sincronização; confirmar que registros pendentes permanecem no SQLite e são enviados novamente depois.

## Configuração manual pendente

- [ ] Fazer todos os testes físicos acima. Não marcar OCR, persistência SQLite ou sincronização real como aprovados antes dessas verificações.
