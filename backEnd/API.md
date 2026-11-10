# Contrato do backend

O Supabase fornece a API da tabela `public.medicamentos`. O aplicativo usa `@supabase/supabase-js` em `frontEnd/src/services`. Todas as operações abaixo precisam de uma sessão válida. A chave pública sozinha não dá acesso aos medicamentos.

## Dados

| Campo | Regra |
| --- | --- |
| `id` | Número gerado pelo PostgreSQL; não enviar o ID local do SQLite |
| `sync_id` | Texto único e estável gerado no aplicativo; obrigatório |
| `user_id` | UUID do usuário autenticado; padrão `auth.uid()` |
| `nome` | Texto obrigatório, com ao menos um caractere que não seja espaço |
| `validade` | Data finita no formato `AAAA-MM-DD`; datas passadas são aceitas |
| `laboratorio`, `indicacao`, `contraindicacoes`, `posologia`, `efeitos_adversos`, `precaucoes`, `observacoes` | Texto; padrão string vazia; não enviar `null` |
| `created_at` | Data de criação; padrão horário do servidor, preservada nas edições |
| `updated_at` | Horário da última gravação, definido pelo servidor |
| `texto_ocr` | Texto reconhecido em embalagem/bula e transcrição de validade/lote via Gemini; padrão string vazia |
| `leitura_em` | Data/hora ISO da última análise OCR/IA; string vazia se cadastro manual |

`sync_id`, `user_id` e `id` não podem ser alterados depois da inclusão. O `sync_id` permanece globalmente único para manter compatibilidade com o frontend.

## Operações com o cliente Supabase

Os exemplos pressupõem `supabase` configurado e uma sessão autenticada. Sempre confira `error` antes de marcar um registro local como sincronizado.

```ts
// Cria ou atualiza o mesmo medicamento sem duplicar na sincronização.
const { error } = await supabase.from('medicamentos').upsert({
  sync_id: medicamento.sync_id,
  nome: medicamento.nome,
  validade: medicamento.validade,
  laboratorio: medicamento.laboratorio ?? '',
  texto_ocr: medicamento.texto_ocr ?? '',
  leitura_em: medicamento.leitura_em ?? '',
}, { onConflict: 'sync_id' });
if (error) throw error;
```

```ts
// As políticas retornam apenas os registros da sessão atual.
const { data, error } = await supabase.from('medicamentos')
  .select('*')
  .order('validade')
  .order('sync_id')
  .range(0, 99);
if (error) throw error;
```

Para listar mais registros, consulte as próximas faixas. O serviço de sincronização atual do frontend ainda usa uma consulta sem paginação explícita e está sujeito ao limite configurado na API.

```ts
const { error } = await supabase.from('medicamentos')
  .delete()
  .eq('sync_id', medicamento.sync_id);
if (error) throw error;
```

Excluir novamente um registro ausente é permitido. Registros de outro usuário não são retornados nem alterados por essa sessão.

## Erros comuns

| Código ou mensagem | Verificar |
| --- | --- |
| `23514` | Nome/sync_id vazio, data infinita ou tentativa de alterar identificadores |
| `23502` | Campo obrigatório enviado como `null` |
| `22007` / `22008` | Formato de data ou data inexistente |
| `23505` | Identificador duplicado em inserção sem upsert |
| `42501` / `permission denied` | Sessão, permissões do schema e proprietário do registro |
| Autenticação anônima desabilitada | Habilitar Anonymous Sign-Ins no Supabase |

Referências: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [testes de banco](https://supabase.com/docs/guides/local-development/testing/overview).
