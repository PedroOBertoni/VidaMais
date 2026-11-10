# Entrega do backend Vida+

Este repositório não depende de um projeto Supabase já criado. Para uma instalação nova, siga [`CONFIGURACAO_SUPABASE.md`](../CONFIGURACAO_SUPABASE.md) e execute [`schema.sql`](schema.sql) no SQL Editor. O script prepara `public.medicamentos`, índices, trigger de timestamp, permissões e RLS por `user_id`.

O aplicativo usa autenticação anônima persistida no `AsyncStorage`. O papel PostgreSQL da sessão é `authenticated`, e as políticas limitam cada sessão aos próprios registros. Se o armazenamento local da sessão for apagado, o usuário anônimo não tem recuperação de conta automática.

O teste real da API ainda depende de URL, chave Publishable pública e projeto Supabase configurado. Configure `SUPABASE_URL` e `SUPABASE_PUBLIC_KEY` em `backEnd/.env` e execute `npm run test:integracao`. Não use chave secreta, `service_role` nem senha do banco nesse teste.

O frontend mantém SQLite como fonte de leitura e escrita. Registros novos, alterações e exclusões ficam pendentes localmente até a API confirmar; falhas de rede mantêm essas pendências. Durante o download, mudanças locais pendentes vencem; registros já sincronizados recebem a versão remota. OCR fica nos campos `texto_ocr` e `leitura_em` da mesma linha do medicamento.

## Gemini Vision

O OCR local ML Kit continua sendo usado para embalagem e bula. A leitura de validade e lote chama a Edge Function `supabase/functions/analisar-validade`, publicada no projeto Supabase com `verify_jwt = true`. A função autentica a sessão do usuário, valida e limita a imagem, chama `gemini-3.5-flash-lite` e retorna campos estruturados em JSON. `GEMINI_API_KEY` é um secret da função e nunca é enviado ao app. O cliente pede consentimento antes de transferir a imagem ou recorte; não há armazenamento das fotografias nem tabela adicional.

Configuração, implantação, autenticação, limites e diagnóstico estão documentados em [`frontEnd/GEMINI_VISION_SETUP.md`](../frontEnd/GEMINI_VISION_SETUP.md). A tabela PostgreSQL permanece `public.medicamentos`; os resultados textuais sincronizam em `texto_ocr` e `leitura_em`.
