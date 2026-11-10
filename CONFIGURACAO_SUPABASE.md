# Configuração do Supabase

Este roteiro configura uma instalação nova do Vida+. O aplicativo continua funcionando offline antes e depois da configuração.

## Obrigatório para sincronizar

### 1. Criar o projeto gratuito

1. Acesse [supabase.com](https://supabase.com/) e crie uma conta ou entre na sua conta.
2. Crie uma organização, se necessário, e selecione **New project**.
3. Informe nome, senha forte do banco e região. Guarde a senha do banco em um gerenciador de senhas; ela não é usada no aplicativo.
4. Aguarde o projeto ficar disponível.

### 2. Copiar URL e chave pública

No Dashboard do projeto, abra **Connect** para copiar a Project URL e a chave **Publishable** (`sb_publishable_...`). Alternativamente, as chaves ficam em **Project Settings → API Keys**. Use apenas a chave publicável no aplicativo. Não use uma chave `sb_secret_...` ou `service_role`.

O aplicativo aceita também a chave legada `anon`, mas projetos novos devem usar a chave Publishable.

### 3. Habilitar autenticação anônima

No Dashboard, abra **Authentication → Sign In / Providers** (a seção pode aparecer como configuração de provedores) e habilite **Anonymous Sign-Ins**. Usuários anônimos recebem uma sessão e são tratados pelo PostgreSQL como `authenticated`.

Uma sessão anônima fica vinculada ao armazenamento local do aplicativo. Se os dados do app forem apagados, a sessão for removida ou o aplicativo for instalado em outro aparelho, não há recuperação automática dessa conta e os dados remotos daquele usuário não passam para a nova sessão.

### 4. Criar as tabelas e políticas

No Dashboard, abra **SQL Editor → New query**. No repositório, abra e execute integralmente `backEnd/schema.sql`. O script é repetível, preserva registros existentes e prepara tabela, índices, trigger, permissões e políticas RLS.

Depois, execute `backEnd/verificar.sql` para conferir a tabela e as políticas. A migração adicional `backEnd/migracao-ocr.sql` é somente para um banco que já tinha a tabela antiga e ainda não possui `texto_ocr` e `leitura_em`; em uma instalação nova, `schema.sql` já inclui esses campos.

### 5. Configurar o frontend

No PowerShell, a partir da pasta do frontend:

```powershell
Copy-Item .env.example .env
```

Edite `frontEnd/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

`frontEnd/.env` é ignorado pelo Git. Não envie credenciais pelo chat nem adicione chaves secretas ao aplicativo. Se as variáveis ficarem vazias, o cadastro SQLite continua disponível e a sincronização informa que o Supabase não está configurado.

## Iniciar e conferir o aplicativo

Na pasta `frontEnd`:

```powershell
npm install
npm start
```

Para OCR, instale o APK nativo em Android; Expo Go e navegador não incluem o módulo nativo do ML Kit. Com JDK 17 e Android SDK configurados, gere uma build de demonstração com:

```powershell
npm run build:apk
```

O build do APK não exige Supabase: as variáveis só habilitam a cópia online.

Para confirmar o SQLite, cadastre um medicamento, feche completamente e reabra o aplicativo. O item deve continuar na lista. Também é possível desligar a internet antes de cadastrá-lo; ele deve permanecer no aparelho e aparecer como pendente de sincronização.

Para confirmar a cópia remota, toque em **Sincronizar** na tela inicial e aguarde a mensagem de sucesso. No Dashboard, abra **Table Editor → medicamentos**. O registro pertence ao UUID da sessão anônima criada naquele aparelho. A política RLS impede que outro usuário autenticado veja esse registro.

## Verificação SQL dos registros

No SQL Editor, consultas administrativas podem listar os registros:

```sql
select sync_id, user_id, nome, laboratorio, validade, updated_at
from public.medicamentos
order by updated_at desc;
```

Para registros que possuem OCR:

```sql
select nome, validade, texto_ocr, leitura_em, sync_id
from public.medicamentos
where texto_ocr <> ''
order by updated_at desc;
```

O SQL Editor tem privilégios administrativos. Para testar o isolamento, use duas sessões do aplicativo ou o teste de integração abaixo; uma consulta administrativa não representa uma sessão RLS comum.

## Testar sincronização e OCR

1. Com o Supabase configurado, abra o app e toque em **Sincronizar** para criar a sessão anônima.
2. Desative a internet, cadastre um medicamento manualmente ou por OCR e salve.
3. Feche e reabra o app para comprovar a persistência local.
4. Reative a internet e toque em **Sincronizar**.
5. Confira o registro na tabela e os campos `texto_ocr` e `leitura_em` na consulta acima.
6. Edite o registro e sincronize; confirme que a mesma linha mudou. Exclua e sincronize; confirme que ela foi removida.

O teste da API cria duas sessões anônimas e registros temporários. `npm run test:integracao` em `backEnd` carrega automaticamente as variáveis públicas de `frontEnd/.env`; também aceita `SUPABASE_URL` e `SUPABASE_PUBLIC_KEY` em `backEnd/.env`. O teste apaga somente os IDs aleatórios criados naquela execução. As contas anônimas de teste permanecem em Authentication → Users.

## Gemini Vision (opcional)

O ML Kit de embalagem e bula funciona no aparelho e não exige configuração de IA. Para habilitar **Ler validade e lote**, configure `GEMINI_API_KEY` exclusivamente em **Supabase Dashboard → Edge Functions → Secrets** e publique `analisar-validade` conforme [GEMINI_VISION_SETUP.md](frontEnd/GEMINI_VISION_SETUP.md). A função exige JWT da sessão do app; mantenha a verificação habilitada. Não coloque a chave Gemini em `frontEnd/.env`, no APK ou no repositório. O app solicita consentimento antes do envio da imagem/recorte ao Supabase e Google.

## Opções e segurança

- O OCR local com ML Kit e o SQLite não precisam de credenciais ou conexão; a análise Gemini de validade/lote exige conexão, consentimento e a Edge Function configurada.
- Chave Publishable e URL são configurações públicas do cliente; RLS e autenticação limitam os dados.
- Não coloque `sb_secret_...`, `service_role`, senha do PostgreSQL ou token de usuário no frontend, Git ou chat.
- Supabase recomenda controles contra abuso para cadastros anônimos em aplicações abertas à internet. Para a demonstração acadêmica, habilite CAPTCHA se o projeto oferecer essa opção e houver exposição pública.

Consulte a documentação oficial atual sobre [chaves de API](https://supabase.com/docs/guides/getting-started/api-keys) e [autenticação anônima](https://supabase.com/docs/guides/auth/auth-anonymous), pois os nomes de menus podem mudar.
