# Gemini Vision no Vida+

## Fluxo no aplicativo

O fluxo **Ler validade e lote** usa o Gemini como complemento especializado para impressões farmacêuticas pontilhadas. Ele não executa ML Kit primeiro. **Ler embalagem** e **Ler bula** continuam usando Google ML Kit localmente.

O usuário pode adicionar várias imagens pela câmera e pela galeria, combinar as origens, pré-visualizar, remover e recortar a área da validade. Ao tocar **Analisar imagens**, o app pede consentimento antes do primeiro envio. A preferência pode valer somente na sessão, ser salva no aparelho e ser revogada depois. Cancelar interrompe o envio.

Quando uma análise Gemini conclui com resposta, o app aplica lote, fabricação e transcrição a `texto_ocr`, preenche a validade quando permitido e retorna ao formulário. A validade manual ou marcada como confiável é preservada. O formulário exibe avisos para campos incertos ou conflitantes; confira os dados antes de salvar. Se todas as imagens falharem, o seletor continua aberto para nova tentativa.

O modelo não adiciona colunas específicas para lote ou fabricação: esses valores são preservados no texto OCR junto da transcrição. O SQLite e a sincronização continuam usando `texto_ocr` e `leitura_em`. As fotografias não são persistidas nem enviadas ao Supabase Storage.

## Arquitetura da função

```text
React Native
  └─ sessão Supabase + consentimento explícito
       └─ POST /functions/v1/analisar-validade
            └─ Supabase Edge Function (Deno)
                 └─ Gemini generateContent API
```

- Função: `supabase/functions/analisar-validade`.
- Endpoint do provedor: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`.
- Modelo configurado: `gemini-3.5-flash-lite`.
- Formato: `generateContent` com imagem inline e resposta JSON estruturada.
- Autenticação: sessão do usuário obrigatória; a configuração `[functions.analisar-validade] verify_jwt = true` permanece habilitada. A Edge Function usa a identidade da sessão Supabase, inclusive para contas anônimas.
- Limite: até 5 solicitações por usuário por minuto; imagem JPEG, PNG ou WebP de no máximo 3 MiB.
- Timeout interno do provedor: 12 segundos; não são feitos retries automáticos que multipliquem duração ou quota.
- Secret: `GEMINI_API_KEY` no Supabase. Não coloque essa chave em `frontEnd/.env`, variáveis `EXPO_PUBLIC_*`, APK ou Git. O aplicativo não usa `service_role`.

O código valida a assinatura do formato da imagem, limita tamanho, autentica o usuário, aplica quota, faz parsing/validação da saída e responde com JSON padronizado. Logs não contêm a imagem, tokens, chave ou transcrição sensível.

## Configurar e publicar

1. No Supabase Dashboard, configure `GEMINI_API_KEY` em **Edge Functions → Secrets**. A chave não deve ser compartilhada no chat ou adicionada ao projeto.
2. Autentique a CLI oficial no terminal (`npx --yes supabase login`) e vincule o diretório ao projeto se ainda não estiver vinculado (`npx --yes supabase link --project-ref <PROJECT_REF>`).
3. Na raiz do repositório, publique mantendo a verificação JWT:

   ```powershell
   npx --yes supabase functions deploy analisar-validade --use-api --yes
   ```

4. Verifique **Edge Functions → analisar-validade → Invocations/Logs** no Dashboard. Não desative JWT para contornar HTTP 401.

`supabase/config.toml` já declara `verify_jwt = true`. A CLI pode solicitar autenticação no terminal; nunca cole Personal Access Tokens ou `GEMINI_API_KEY` em mensagens ou documentação versionada.

## Diagnóstico de falhas

A função emite logs estruturados com `correlation_id`, etapa, duração e modelo para requisição, autenticação, validação de imagem, chamada, resposta e parsing. Não registra dados da imagem. A Edge Function retorna diagnósticos diferentes para `gemini_timeout`, erro de rede, modelo inválido, autenticação, quota e resposta inválida.

No Dashboard, abra **Edge Functions → analisar-validade → Logs** e procure o `correlation_id`. No app, em **Novo medicamento → Diagnóstico de IA**, ficam as últimas 20 tentativas deste aparelho. O relatório copiável contém horário, status HTTP, código, duração, etapa, correlação e modelo — sem imagem, OCR, JWT ou chaves.

## Validação do provedor

Em 08/11/2026, o identificador tentado `gemini-3.8-flash` não pôde ser usado com a API testada. A chamada autenticada de validação usou `gemini-3.5-flash-lite` com uma imagem sintética pequena e saída JSON estruturada; a Edge Function publicada respondeu HTTP 200 com lote, fabricação e validade. O endpoint temporário de diagnóstico foi removido depois da validação. Essa validação não substitui o teste físico com embalagem real.

Consulte também [OCR.md](OCR.md) para o fluxo completo e [OCR_VALIDADE_INVESTIGACAO.md](OCR_VALIDADE_INVESTIGACAO.md) para a investigação da impressão pontilhada.
