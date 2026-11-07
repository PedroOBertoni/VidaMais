# Leitura de embalagens e bula

O aplicativo usa `expo-image-picker` para fotografar e `@react-native-ml-kit/text-recognition` para reconhecer texto com Google ML Kit no aparelho. Não envia a foto para um serviço de OCR e não exige chave de API para a leitura. A foto é temporária; o texto reconhecido é associado ao medicamento e sincronizado com o Supabase.

## Instalação Android

```powershell
npm install
npm run typecheck
npm test -- --watch=false
npm run build:apk
```

O APK fica em `artifacts/VidaMais.apk`. Instale como atualização para preservar o banco e a sessão do aparelho. A assinatura existente é preservada pelo script de build. Não desinstale o app antes de atualizar se precisar manter dados locais e o acesso do usuário anônimo.

O OCR exige o APK atualizado ou uma compilação nativa própria. Expo Go e navegador continuam permitindo o cadastro manual, mas não executam esse OCR. Para iOS é necessária compilação nativa em macOS com instalação dos Pods; o APK é a entrega Android.

## Banco remoto

Em um projeto Supabase já existente, executar [migracao-ocr.sql](../backEnd/migracao-ocr.sql). Para um projeto novo, [schema.sql](../backEnd/schema.sql) já inclui as colunas. A chave pública do app não tem permissão para alterar o esquema.

| Coluna | Uso |
|---|---|
| `texto_ocr` | Texto das fotos feitas no cadastro, antes da revisão dos campos |
| `leitura_em` | Data/hora ISO da última leitura |

O SQLite migra essas colunas automaticamente ao iniciar, preservando os registros existentes. Os campos seguem no upload e no download da sincronização.

## Uso

1. Abrir **Cadastrar medicamento** ou **Editar**.
2. Tocar **Fotografar embalagem**, autorizar a câmera, fotografar e confirmar a imagem.
3. Revisar nome, laboratório e validade sugeridos. Campos preenchidos são preservados entre fotos.
4. Fotografar a lateral se a validade não aparecer na frente. Para substituir um campo preenchido, limpar o campo e fazer nova leitura ou editar manualmente.
5. Usar **Fotografar texto da bula** para transcrever um trecho em Observações. Revisar e distribuir nos campos de indicação, contraindicações, posologia etc. quando necessário.
6. Salvar. Sem internet, o registro fica local e pendente; com internet, o app tenta sincronizar.
7. Nos detalhes, conferir a situação de armazenamento, o texto original e a data da leitura.

## Limites da extração

- OCR reconhece texto; a extração do nome usa rótulos e heurísticas, não um catálogo de todos os medicamentos.
- Laboratório pode ser extraído de rótulo explícito ou de marcas reconhecíveis na impressão. Não há garantia para todo logotipo estilizado.
- Validade é sugerida quando acompanha `VAL`, `VALIDADE`, `VENC`, `VENCIMENTO` ou um rótulo `V:` no início da linha. Datas de fabricação (`F:`) ou lote (`L:`) não devem preencher o vencimento.
- Aceita dia/mês/ano e mês/ano, separados por barra, ponto ou hífen. Mês/ano sugere o último dia daquele mês e exibe um aviso para revisão.
- Texto borrado, curvo, baixo contraste, gravação em relevo e reflexos podem exigir outra foto ou correção manual.
- A bula completa não pode ser deduzida de uma caixa. Somente texto efetivamente fotografado ou cadastrado é apresentado.

## Validação no celular

| Cenário | Resultado esperado |
|---|---|
| Autorizar câmera e fotografar frente | Texto reconhecido visível; campos vazios recebem sugestões |
| Cancelar foto | Formulário preservado; botões voltam a funcionar |
| Negar câmera | Orientação para autorizar; formulário manual disponível |
| Foto sem texto | Aviso para melhorar enquadramento e iluminação |
| Foto só da fabricação | Validade permanece vazia |
| Segunda foto da lateral | Complementa validade sem apagar nome revisado |
| Foto de bula | Texto é acrescentado a Observações |
| Salvar offline e reiniciar | Campos e texto OCR persistem no SQLite |
| Reconectar e sincronizar | Campos e texto aparecem na mesma linha do Supabase |
| Editar e sincronizar outra vez | Atualiza a mesma linha sem duplicação |

Referências técnicas: [biblioteca OCR](https://github.com/a7medev/react-native-ml-kit/tree/main/text-recognition), [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/).

## Verificações desta revisão — 07/11/2026

- `npm run typecheck`: passou.
- `npm test -- --watch=false`: 29 testes passaram em quatro suítes, incluindo extração OCR heurística, migração SQLite legada, persistência dos campos OCR e paginação/falha de sincronização. O teste SQLite usa `node:sqlite`; Jest informa que esse recurso ainda é experimental no Node 24.
- `npm run build:apk`: compilação release ARM64 concluída. O pacote nativo ML Kit foi compilado e incluído. APK: `artifacts/VidaMais.apk`.
- `npx expo-doctor`: 16/18 verificações passaram. Restaram o aviso de configuração nativa mantida manualmente (o projeto não usa prebuild no build) e o aviso de que o ML Kit não foi validado pela React Native Directory com New Architecture; essa arquitetura está desativada no Android.
- Nenhum teste de câmera em smartphone nem de API Supabase real foi executado nesta revisão. O APK compilado não comprova leitura física da câmera; use o checklist em [`TESTES_FINAIS.md`](../TESTES_FINAIS.md).
