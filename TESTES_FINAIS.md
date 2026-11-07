# Testes finais do Vida+

Este roteiro separa verificações automatizadas locais dos passos que dependem de Android físico ou projeto Supabase. Os itens dependentes estão **pendentes** até serem executados no ambiente de demonstração.

## Automatizados no projeto

- [x] `npm run typecheck` em `frontEnd` — passou em 07/11/2026.
- [x] `npm test -- --watch=false` em `frontEnd` — 29 testes passaram em quatro suítes em 07/11/2026.
- [x] `npm run build:web:test` — export web passou em 07/11/2026.
- [x] `npx expo-doctor` em `frontEnd` — 16/18 verificações passaram; as duas observações restantes estão registradas abaixo.
- [ ] Playwright offline — a asserção do cenário passou, mas o processo de teste não terminou sozinho neste ambiente e precisou ser interrompido; não contar como execução completa.
- [ ] Com projeto Supabase configurado, executar `npm run test:integracao` em `backEnd`.
- [x] `npm run build:apk` — release ARM64 gerado em 07/11/2026; assinatura verificada e Manifest conferido (câmera/rede, sem permissões de armazenamento externo). Recompilar após alterações futuras.

O Expo Doctor reportou que o projeto tem pastas nativas Android/iOS junto com campos nativos no `app.json`; os arquivos em `android/` são mantidos manualmente e não se executa prebuild automático. Também classificou `@react-native-ml-kit/text-recognition` como não validado na New Architecture; essa arquitetura está desativada no app Android.

Não trate testes mockados como prova de integração real.

## Android físico — pendente de execução no aparelho

- [ ] Instalar o APK e abrir o Vida+.
- [ ] Cadastrar manualmente medicamento com data válida; conferir mensagem de sucesso.
- [ ] Fotografar uma embalagem real e conceder permissão de câmera.
- [ ] Conferir o texto OCR reconhecido; fotografar frente e lateral se necessário.
- [ ] Confirmar que nome/laboratório/validade sugeridos precisam de revisão e corrigir um campo.
- [ ] Testar validade apenas em mês/ano: o app sugere o último dia do mês e informa que deve ser confirmado.
- [ ] Fotografar texto legível de bula e conferir que foi copiado para Observações para revisão.
- [ ] Cancelar a câmera e confirmar que a tela continua utilizável.
- [ ] Negar permissão da câmera e confirmar que há mensagem e o cadastro manual continua disponível.
- [ ] Salvar e conferir no detalhe texto OCR, horário da leitura e campos revisados.
- [ ] Fechar completamente e reabrir o app; confirmar persistência no SQLite.
- [ ] Pesquisar por nome e laboratório; filtrar válidos, próximos e vencidos.
- [ ] Editar e excluir um registro.

## SQLite offline e Supabase — pendentes de configuração e execução

- [ ] Desativar internet e cadastrar medicamento.
- [ ] Confirmar que o registro fica no SQLite e aparece como pendente.
- [ ] Fechar e reabrir sem internet; confirmar medicamento e OCR preservados.
- [ ] Reativar internet e sincronizar.
- [ ] Confirmar no Dashboard que o registro pertence à sessão do aparelho.
- [ ] Confirmar `texto_ocr` e `leitura_em` no banco remoto.
- [ ] Editar o registro, sincronizar e conferir a mesma linha atualizada.
- [ ] Excluir o registro, sincronizar e confirmar remoção remota.
- [ ] Testar duas sessões diferentes e verificar que uma não enxerga os dados da outra.
- [ ] Simular perda temporária de rede durante sincronização; confirmar que os itens locais continuam pendentes e podem ser enviados novamente.

## Evidência registrada nesta revisão

Nenhuma execução de testes, compilação ou uso de aparelho é presumida por este checklist. Preencha os itens automatizados e marque os testes físicos/remotos somente após executá-los. A integração real de OCR exige APK nativo e câmera; a sincronização real exige projeto Supabase configurado.
