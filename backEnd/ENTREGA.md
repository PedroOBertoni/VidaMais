# Entrega do backend Vida+

Este repositório não depende de um projeto Supabase já criado. Para uma instalação nova, siga [`CONFIGURACAO_SUPABASE.md`](../CONFIGURACAO_SUPABASE.md) e execute [`schema.sql`](schema.sql) no SQL Editor. O script prepara `public.medicamentos`, índices, trigger de timestamp, permissões e RLS por `user_id`.

O aplicativo usa autenticação anônima persistida no `AsyncStorage`. O papel PostgreSQL da sessão é `authenticated`, e as políticas limitam cada sessão aos próprios registros. Se o armazenamento local da sessão for apagado, o usuário anônimo não tem recuperação de conta automática.

O teste real da API ainda depende de URL, chave Publishable pública e projeto Supabase configurado. Configure `SUPABASE_URL` e `SUPABASE_PUBLIC_KEY` em `backEnd/.env` e execute `npm run test:integracao`. Não use chave secreta, `service_role` nem senha do banco nesse teste.

O frontend mantém SQLite como fonte de leitura e escrita. Registros novos, alterações e exclusões ficam pendentes localmente até a API confirmar; falhas de rede mantêm essas pendências. Durante o download, mudanças locais pendentes vencem; registros já sincronizados recebem a versão remota. OCR fica nos campos `texto_ocr` e `leitura_em` da mesma linha do medicamento.
