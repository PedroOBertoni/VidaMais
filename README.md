# Vida+

Aplicativo multiplataforma para cadastro, organização e acompanhamento da validade de medicamentos, com armazenamento local e sincronização em nuvem utilizando Supabase.

## Entrega do 2º bimestre

O fluxo de câmera e OCR foi integrado ao cadastro: fotografe a embalagem, revise as sugestões de nome, laboratório e validade e salve no SQLite. O texto reconhecido e a data da leitura seguem na sincronização com o Supabase. Também é possível transcrever uma foto da bula para Observações.

- [Instalação, uso e limites do OCR](frontEnd/OCR.md)
- [Migração do banco Supabase existente](backEnd/migracao-ocr.sql)
- [Configuração de um projeto Supabase novo](CONFIGURACAO_SUPABASE.md)
- [Checklist de testes finais](TESTES_FINAIS.md)
- [Roteiro e slides da apresentação](APRESENTACAO.md)

O OCR exige o APK atualizado; não funciona no Expo Go nem no navegador. Para testes, use Node 22.13+ (o teste SQLite usa `node:sqlite`).

## Contexto acadêmico

O Vida+ foi desenvolvido como trabalho acadêmico do curso de Engenharia de Software do Centro Universitário Municipal de Franca (Uni-FACEF), para a disciplina de Desenvolvimento de Software para Web II.

O projeto aplica conceitos de desenvolvimento web e mobile, persistência de dados, integração entre frontend e backend, funcionamento offline, autenticação, segurança em nível de linha e sincronização de informações.

## Objetivo

O objetivo do Vida+ é ajudar usuários a manter um registro organizado dos medicamentos que possuem e acompanhar suas respectivas datas de validade.

O aplicativo classifica automaticamente cada medicamento como:

* válido;
* próximo do vencimento;
* vencido.

Além do controle de validade, o sistema permite registrar informações semelhantes às encontradas em uma bula, como:

* laboratório;
* indicação;
* contraindicações;
* posologia;
* efeitos adversos;
* precauções;
* observações.

Esses dados são informativos e não substituem a bula oficial, orientação médica ou avaliação de profissionais de saúde.

## Funcionalidades

* Cadastro de medicamentos;
* edição e exclusão de registros;
* validação de datas no formato `DD/MM/AAAA`;
* classificação automática da validade;
* busca por nome ou laboratório;
* filtros por situação do medicamento;
* visualização detalhada dos registros;
* consulta das informações cadastradas de bula;
* armazenamento offline com SQLite;
* sincronização bidirecional com Supabase;
* sincronização de inclusões, alterações e exclusões;
* isolamento dos dados por usuário com Row Level Security (RLS);
* autenticação anônima persistente;
* suporte a Android, iOS e web;
* estados de carregamento, erro e registro não encontrado;
* recursos básicos de acessibilidade;
* testes automatizados.

## Tecnologias

### Frontend

* React 19;
* React Native;
* Expo SDK 54;
* Expo Router;
* TypeScript;
* Expo SQLite;
* AsyncStorage;
* Jest;
* Jest Expo.

### Backend

* Supabase;
* PostgreSQL;
* Supabase Auth;
* Supabase Data API;
* Row Level Security (RLS).

## Arquitetura

O aplicativo utiliza uma estratégia offline-first.

O SQLite é a fonte de dados utilizada diretamente pelas telas, permitindo que as principais operações continuem funcionando mesmo sem conexão com a internet.

Quando o Supabase está configurado, o aplicativo:

1. autentica o dispositivo anonimamente;
2. envia registros locais ainda não sincronizados;
3. envia exclusões pendentes;
4. recupera os registros pertencentes ao usuário autenticado;
5. atualiza o banco SQLite local sem sobrescrever alterações locais pendentes.

Cada medicamento possui um `sync_id`, gerado no dispositivo, que permanece estável entre o banco local e o PostgreSQL.

Esse campo é utilizado nas operações de sincronização para evitar registros duplicados.

```text
Telas e componentes Expo Router
            │
            ▼
     Camada de acesso local
            │
            ▼
      SQLite no dispositivo
            │
            ▼
     Serviço de sincronização
            │
            ▼
 Supabase Auth + API + PostgreSQL
```

## Estrutura do projeto

```text
vidaMais/
│
├── README.md
│
├── frontEnd/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── bula/
│   │   │   └── [id].tsx
│   │   └── medicamentos/
│   │       ├── index.tsx
│   │       ├── novo.tsx
│   │       └── [id].tsx
│   │
│   ├── src/
│   │   ├── components/
│   │   ├── constants/
│   │   ├── database/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── .env.example
│   ├── app.json
│   ├── metro.config.js
│   ├── package.json
│   └── tsconfig.json
│
└── backEnd/
    ├── tests/
    │   ├── backend.sql
    │   └── integracao.mjs
    ├── schema.sql
    ├── verificar.sql
    ├── API.md
    └── ENTREGA.md
```

## Requisitos

* Node.js 22.13 ou superior para executar os testes SQLite locais;
* npm;
* Expo Go, emulador Android, simulador iOS ou navegador moderno;
* projeto no Supabase, caso a sincronização em nuvem seja utilizada.

Para os testes de integração do backend, recomenda-se Node.js 22 ou superior.

## Instalação

Clone o repositório:

```bash
git clone <URL_DO_REPOSITORIO>
cd vidaMais
```

Entre na pasta do frontend:

```bash
cd frontEnd
```

Instale as dependências:

```bash
npm install
```

## Configuração do Supabase

### 1. Criar o projeto

Crie um novo projeto no Supabase.

Defina:

* nome do projeto;
* senha forte para o PostgreSQL;
* região adequada.

A senha administrativa do banco não deve ser colocada no frontend.

### 2. Habilitar autenticação anônima

No painel do Supabase:

1. abra `Authentication`;
2. acesse os provedores de login;
3. localize `Anonymous Sign-Ins`;
4. habilite a autenticação anônima;
5. salve.

O aplicativo utiliza:

```ts
signInAnonymously()
```

Cada instalação recebe uma sessão associada a um usuário anônimo.

### 3. Criar o banco de dados

No Supabase, abra o SQL Editor.

Execute o arquivo:

```text
backEnd/schema.sql
```

Esse script cria:

* tabela `medicamentos`;
* índices;
* restrições;
* triggers;
* permissões;
* políticas RLS.

Depois execute:

```text
backEnd/verificar.sql
```

para conferir se a estrutura foi criada corretamente.

## Variáveis de ambiente

Na pasta:

```text
frontEnd/
```

crie o arquivo `.env`.

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:

```bash
cp .env.example .env
```

Configure:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

Nunca utilize a chave:

```text
service_role
```

no frontend.

Variáveis com prefixo `EXPO_PUBLIC_` podem ser acessadas pelo aplicativo. A segurança dos dados deve ser garantida pelas políticas RLS.

## Execução

Dentro da pasta `frontEnd`:

```bash
npm start
```

Ou:

```bash
npx expo start --clear
```

Outros comandos:

```bash
npm run android
npm run ios
npm run web
npm run typecheck
npm test
```

O projeto também pode funcionar sem Supabase.

Nesse caso, os dados continuam armazenados somente no SQLite e permanecem pendentes de sincronização.

## Banco de dados

A principal tabela remota é:

```text
public.medicamentos
```

Principais campos:

| Campo              | Tipo          | Descrição                         |
| ------------------ | ------------- | --------------------------------- |
| `id`               | `bigint`      | Identificador interno do Supabase |
| `sync_id`          | `text`        | Identificador de sincronização    |
| `user_id`          | `uuid`        | Proprietário do registro          |
| `nome`             | `text`        | Nome do medicamento               |
| `laboratorio`      | `text`        | Laboratório                       |
| `validade`         | `date`        | Data de validade                  |
| `indicacao`        | `text`        | Indicação                         |
| `contraindicacoes` | `text`        | Contraindicações                  |
| `posologia`        | `text`        | Posologia                         |
| `efeitos_adversos` | `text`        | Efeitos adversos                  |
| `precaucoes`       | `text`        | Precauções                        |
| `observacoes`      | `text`        | Observações                       |
| `created_at`       | `timestamptz` | Data de criação                   |
| `updated_at`       | `timestamptz` | Última atualização                |

O `id` local do SQLite não deve ser usado como identificador remoto.

A correspondência entre SQLite e Supabase utiliza:

```text
sync_id
```

## Data de validade

No aplicativo, a data é informada no formato:

```text
DD/MM/AAAA
```

Exemplo:

```text
12/12/2026
```

Antes de ser gravada no PostgreSQL, a data é convertida para:

```text
AAAA-MM-DD
```

Exemplo:

```text
2026-12-12
```

Medicamentos vencidos são permitidos, pois o aplicativo precisa identificá-los e classificá-los.

## Sincronização

A sincronização está implementada principalmente nos arquivos:

```text
frontEnd/src/services/sync.ts
frontEnd/src/services/supabase.ts
frontEnd/src/database/database.ts
```

O fluxo de sincronização realiza:

1. autenticação do usuário;
2. envio de novos medicamentos;
3. envio de alterações;
4. envio de exclusões pendentes;
5. recuperação dos registros do usuário;
6. atualização do SQLite local.

O `sync_id` evita duplicações entre o banco local e o remoto.

## Exclusões offline

O SQLite mantém a tabela:

```text
exclusoes_pendentes
```

Ela armazena os `sync_id` dos registros excluídos localmente até que a exclusão seja confirmada no Supabase.

Quando a sincronização é concluída com sucesso, a pendência pode ser removida.

## Segurança

A tabela `medicamentos` utiliza Row Level Security.

Cada registro possui:

```text
user_id
```

As políticas permitem que o usuário:

* consulte apenas seus próprios registros;
* insira registros associados ao próprio usuário;
* edite somente seus registros;
* exclua somente seus registros.

As políticas utilizam:

```sql
auth.uid()
```

Não devem ser utilizadas políticas abertas como:

```sql
using (true)
```

ou:

```sql
with check (true)
```

em produção.

A chave `service_role` ignora as políticas RLS e deve permanecer somente em ambientes administrativos seguros.

## Testes do frontend

Entre na pasta:

```text
frontEnd/
```

Execute:

```bash
npm run typecheck
```

Depois:

```bash
npm test
```

Os testes atuais cobrem regras relacionadas a:

* conversão de datas;
* formatação de datas;
* validação de datas;
* classificação da validade.

## Testes do backend

Os testes estão na pasta:

```text
backEnd/tests/
```

### Teste pela API

Na pasta:

```text
backEnd/
```

crie um `.env` com:

```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_PUBLIC_KEY=SUA_CHAVE_PUBLICA
```

Execute:

```bash
npm run test:integracao
```

O teste verifica:

* criação de sessão anônima;
* cadastro;
* edição;
* validações;
* isolamento entre usuários;
* exclusão.

### Teste diretamente no PostgreSQL

No SQL Editor do Supabase, execute:

```text
backEnd/tests/backend.sql
```

O teste verifica principalmente as políticas RLS.

Ao finalizar corretamente, deve ser exibida uma mensagem semelhante a:

```text
Testes concluídos; dados de teste revertidos.
```

Caso ocorra erro, execute:

```sql
ROLLBACK;
```

corrija o problema e execute o arquivo novamente.

## Teste manual pelo aplicativo

| Ação                               | Resultado esperado                     |
| ---------------------------------- | -------------------------------------- |
| Cadastrar medicamento com internet | Registro aparece no Supabase           |
| Editar medicamento                 | A mesma linha é atualizada             |
| Sincronizar novamente              | Não cria duplicação                    |
| Fechar e abrir o aplicativo        | Dados continuam disponíveis            |
| Cadastrar sem internet             | Registro permanece no SQLite           |
| Restaurar a conexão                | Registro é enviado ao Supabase         |
| Excluir e sincronizar              | Registro é removido do Supabase        |
| Abrir outra instalação             | Dados do primeiro usuário não aparecem |

## Responsabilidades

### Frontend

O frontend é responsável por:

* validar entradas;
* gerar e preservar o `sync_id`;
* armazenar dados no SQLite;
* controlar alterações pendentes;
* controlar exclusões pendentes;
* manter a sessão;
* executar sincronização;
* apresentar erros sem perder os dados locais.

### Backend

O backend com Supabase é responsável por:

* manter a estrutura do PostgreSQL;
* autenticar usuários;
* aplicar restrições;
* aplicar políticas RLS;
* proteger os registros;
* gerenciar a API de dados;
* proteger credenciais administrativas.

## Build web

Para gerar o bundle web:

```bash
npx expo export --platform web
```

Os arquivos serão gerados em:

```text
dist/
```

## Limitações atuais

* textos de bula são cadastrados manualmente;
* não existe integração com base farmacêutica oficial;
* OCR é executado no APK nativo; não está disponível no Expo Go ou web;
* as sugestões de embalagem usam heurísticas de texto, exigem revisão e não identificam medicamentos clinicamente;
* autenticação atual é anônima;
* não existe recuperação de conta entre dispositivos;
* conflitos usam uma regra simples: alterações locais pendentes são enviadas primeiro; registros remotos só atualizam cópias locais já sincronizadas;
* notificações em segundo plano ainda não foram implementadas.

## Melhorias futuras

O projeto poderá futuramente incluir:

* leitura automática de embalagens;
* reconhecimento de medicamentos;
* notificações de vencimento;
* autenticação com e-mail;
* recuperação de conta;
* resolução avançada de conflitos;
* integração com bases farmacêuticas;
* API própria.

## Referências

* Supabase Row Level Security:
  https://supabase.com/docs/guides/database/postgres/row-level-security

* Supabase Anonymous Sign-Ins:
  https://supabase.com/docs/guides/auth/auth-anonymous

* Segurança da API do Supabase:
  https://supabase.com/docs/guides/api/securing-your-api

## Aviso de saúde

O Vida+ é uma ferramenta acadêmica de organização.

As informações armazenadas ou exibidas no aplicativo não constituem diagnóstico, prescrição ou recomendação médica.

A bula oficial do fabricante e a orientação de profissionais de saúde qualificados devem sempre prevalecer.
