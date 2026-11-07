-- Execute no SQL Editor depois de schema.sql.
-- Estas consultas inspecionam a configuração; não substituem o teste no app.

-- Esperado: texto_ocr e leitura_em do tipo text, não nulos.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'medicamentos'
  and column_name in ('texto_ocr', 'leitura_em');

-- Esperado: uma linha com rls_ativo = true.
select relname as tabela, relrowsecurity as rls_ativo
from pg_class
where oid = 'public.medicamentos'::regclass;

-- Esperado: quatro políticas para authenticated (SELECT, INSERT, UPDATE, DELETE).
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'medicamentos'
order by policyname;

-- Esperado: todos true, exceto acesso_sem_sessao e pode_truncar.
select
  has_table_privilege('authenticated', 'public.medicamentos', 'SELECT') as pode_consultar,
  has_table_privilege('authenticated', 'public.medicamentos', 'INSERT') as pode_inserir,
  has_table_privilege('authenticated', 'public.medicamentos', 'UPDATE') as pode_editar,
  has_table_privilege('authenticated', 'public.medicamentos', 'DELETE') as pode_excluir,
  has_sequence_privilege('authenticated', 'public.medicamentos_id_seq', 'USAGE') as pode_gerar_id,
  has_table_privilege('anon', 'public.medicamentos', 'SELECT') as acesso_sem_sessao,
  has_table_privilege('authenticated', 'public.medicamentos', 'TRUNCATE') as pode_truncar;

-- Contagem administrativa para comparar antes e depois da demonstração.
-- O SQL Editor tem privilégios administrativos: não comprova isolamento por usuário.
select count(*) as total_medicamentos from public.medicamentos;

-- Esperado: trigger preparar_medicamento habilitado (O = execução normal).
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.medicamentos'::regclass and not tgisinternal;

-- Em uma instalação nova, esperado: zero registros inválidos.
select count(*) as registros_legados_invalidos
from public.medicamentos
where user_id is null
   or sync_id is null or sync_id !~ '[^[:space:]]'
   or nome is null or nome !~ '[^[:space:]]'
   or validade is null or not isfinite(validade);
