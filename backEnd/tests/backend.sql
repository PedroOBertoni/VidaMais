-- Execute TODO o arquivo no SQL Editor de um projeto de desenvolvimento,
-- após schema.sql. Os usuários e medicamentos de teste são revertidos.
-- Em caso de erro, execute ROLLBACK antes de tentar novamente.
begin;

select set_config('vida_test.user_a', gen_random_uuid()::text, true);
select set_config('vida_test.user_b', gen_random_uuid()::text, true);
select set_config('vida_test.sync_id', gen_random_uuid()::text, true);
insert into auth.users (id)
values (current_setting('vida_test.user_a')::uuid),
       (current_setting('vida_test.user_b')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('vida_test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('vida_test.user_a'), 'role', 'authenticated')::text, true);

do $$
declare
  registro public.medicamentos%rowtype;
  identificador text := current_setting('vida_test.sync_id');
begin
  insert into public.medicamentos (sync_id, nome, validade, updated_at)
  values (identificador, 'Medicamento de teste', '2020-01-01', '2000-01-01')
  returning * into registro;
  if registro.user_id is distinct from auth.uid() or registro.updated_at <= '2000-01-01'::timestamptz then
    raise exception 'Falha: proprietário ou timestamp automático.';
  end if;

  -- Mesmo comportamento do upsert usado pelo aplicativo.
  insert into public.medicamentos (sync_id, nome, validade)
  values (identificador, 'Nome editado', '2020-01-01')
  on conflict (sync_id) do update set nome = excluded.nome;
  if (select count(*) from public.medicamentos where sync_id = identificador) <> 1
     or not exists (select 1 from public.medicamentos where sync_id = identificador and nome = 'Nome editado') then
    raise exception 'Falha: upsert duplicou ou não atualizou o registro.';
  end if;

  update public.medicamentos set created_at = '1999-01-01', updated_at = '2000-01-01'
  where sync_id = identificador;
  if not exists (
    select 1 from public.medicamentos
    where sync_id = identificador and created_at = registro.created_at
      and updated_at > '2000-01-01'::timestamptz
  ) then
    raise exception 'Falha: timestamps na edição.';
  end if;

  begin
    update public.medicamentos set nome = '   ' where sync_id = identificador;
    raise exception 'Falha: nome vazio foi aceito.';
  exception when check_violation then null;
  end;
  begin
    update public.medicamentos set sync_id = 'outro-id' where sync_id = identificador;
    raise exception 'Falha: alteração de identidade foi aceita.';
  exception when check_violation then null;
  end;
  begin
    insert into public.medicamentos (sync_id, nome, validade)
    values (gen_random_uuid()::text, 'Teste inválido', 'infinity');
    raise exception 'Falha: data infinita foi aceita.';
  exception when check_violation then null;
  end;
  begin
    insert into public.medicamentos (sync_id, user_id, nome, validade)
    values (gen_random_uuid()::text, current_setting('vida_test.user_b')::uuid, 'Teste', '2030-01-01');
    raise exception 'Falha: inserção para outro usuário foi aceita.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Outra sessão não pode consultar, editar nem excluir o medicamento de A.
select set_config('request.jwt.claim.sub', current_setting('vida_test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('vida_test.user_b'), 'role', 'authenticated')::text, true);
do $$
declare
  quantidade integer;
begin
  if exists (select 1 from public.medicamentos where sync_id = current_setting('vida_test.sync_id')) then
    raise exception 'Falha: leitura de dados de outro usuário.';
  end if;
  update public.medicamentos set nome = 'Indevido' where sync_id = current_setting('vida_test.sync_id');
  get diagnostics quantidade = row_count;
  if quantidade <> 0 then raise exception 'Falha: edição de dados de outro usuário.'; end if;
  delete from public.medicamentos where sync_id = current_setting('vida_test.sync_id');
  get diagnostics quantidade = row_count;
  if quantidade <> 0 then raise exception 'Falha: exclusão de dados de outro usuário.'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('vida_test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('vida_test.user_a'), 'role', 'authenticated')::text, true);
do $$
declare quantidade integer;
begin
  delete from public.medicamentos where sync_id = current_setting('vida_test.sync_id');
  get diagnostics quantidade = row_count;
  if quantidade <> 1 then raise exception 'Falha: exclusão pelo proprietário.'; end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.medicamentos limit 1;
    raise exception 'Falha: acesso sem autenticação permitido.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
select 'Testes concluídos; dados de teste revertidos.' as resultado;
