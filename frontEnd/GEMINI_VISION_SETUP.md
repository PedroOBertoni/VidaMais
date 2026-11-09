# Gemini Vision do Vida+

## Fluxos e consentimento

A interface usa o mesmo botão **Analisar imagens** nos três fluxos. Embalagem e bula usam exclusivamente Google ML Kit. Validade e lote usam diretamente a Edge Function `analisar-validade` e Gemini Vision, sem executar ML Kit primeiro.

Antes do primeiro envio, um diálogo personalizado informa que as imagens selecionadas ou recortes serão enviados pela internet ao Supabase e Google Gemini. A autorização pode valer apenas durante a sessão ou ser lembrada neste aparelho. A pessoa pode consultar e revogar a preferência na tela de cadastro. Sem autorização, nenhuma imagem é preparada ou enviada.

O texto OCR original continua em `texto_ocr` e `leitura_em`; a interface principal mostra apenas resumos. **Ver texto original** abre um modal com rolagem própria. Os resultados Gemini ficam em revisão antes de aplicar ao formulário; campos editados manualmente são preservados.

## Arquitetura publicada

Modelo: `gemini-3.5-flash-lite`; endpoint: `v1beta/models/gemini-3.5-flash-lite:generateContent`. A Edge Function exige uma sessão Supabase autenticada, inclusive anônima, com JWT verificado. A chave Gemini existe exclusivamente em `GEMINI_API_KEY` nos secrets do Supabase. As fotografias não são salvas no Supabase Storage.

Para publicar alterações futuras da função, preserve `[functions.analisar-validade] verify_jwt = true` e execute `npx --yes supabase functions deploy analisar-validade --use-api --yes`.

## Diagnóstico

A função interrompe a chamada ao Gemini após 12 segundos e retorna JSON com `gemini_timeout`, etapa, duração, modelo e `correlation_id`. Erros do Gemini são classificados separadamente (modelo, autenticação, quota, requisição inválida ou indisponibilidade). Logs estruturados aparecem em **Supabase Dashboard → Edge Functions → analisar-validade → Logs**; pesquise pelo `correlation_id` mostrado em **Novo medicamento → Diagnóstico de IA**.

O app mantém localmente as últimas 20 tentativas e permite copiar o relatório técnico. Ele inclui status HTTP, código, duração, etapa, identificador, horário e modelo, sem imagens, texto OCR, tokens ou chaves.

## Validação do provedor

Em 08/11/2026, `gemini-3.8-flash` expirou numa chamada de texto com a chave configurada. A comparação autenticada mostrou a mesma chave executando `gemini-3.5-flash-lite` com imagem sintética pequena e saída JSON estruturada. A função de produção respondeu HTTP 200 com lote, fabricação e validade. O endpoint temporário de diagnóstico foi removido.