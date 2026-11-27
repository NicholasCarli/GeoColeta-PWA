-- Executar como postgres, apos schema.sql, seed-demo.sql e vincular-perfis.sql.
-- Todas as fixtures e operacoes desta verificacao sao revertidas.
begin;

do $$
declare
  v_coletor uuid;
  v_admin uuid;
  v_projeto constant uuid := '00000000-0000-4000-8000-000000000001';
  v_outro_projeto uuid := gen_random_uuid();
  v_lote uuid;
  v_fora uuid;
  v_bloqueado boolean := false;
begin
  select usuario_id into v_coletor from public.perfis
   where projeto_id = v_projeto and permissao = 'COLETOR' limit 1;
  select usuario_id into v_admin from public.perfis
   where projeto_id = v_projeto and permissao = 'ADMIN' limit 1;
  if v_coletor is null or v_admin is null then
    raise exception 'Configure coletor e admin com vincular-perfis.sql antes do teste.';
  end if;
  if (select count(*) from public.projeto_lotes where projeto_id = v_projeto) <> 12 then
    raise exception 'A carga de demonstracao precisa conter os 12 lotes.';
  end if;
  if (select count(*) from pg_class where oid in (
      'public.projetos'::regclass, 'public.perfis'::regclass, 'public.lotes'::regclass,
      'public.projeto_lotes'::regclass, 'public.coletas'::regclass) and relrowsecurity) <> 5 then
    raise exception 'RLS precisa estar habilitada nas cinco tabelas.';
  end if;
  if has_table_privilege('anon', 'public.lotes', 'SELECT')
     or has_table_privilege('authenticated', 'public.perfis', 'UPDATE')
     or has_function_privilege('anon', 'public.sincronizar_coleta(uuid,uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.validar_coleta(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.devolver_coleta(uuid,text)', 'EXECUTE') then
    raise exception 'Grants indevidos no schema.';
  end if;

  begin
    update public.perfis set permissao = 'OUTRO' where usuario_id = v_coletor;
  exception when check_violation then v_bloqueado := true;
  end;
  if not v_bloqueado then raise exception 'A constraint aceitou um terceiro cargo.'; end if;

  -- Mesmo lote em dois projetos, sem expor o vinculo do outro projeto.
  insert into public.projetos (id, nome, categoria, cidade)
  values (v_outro_projeto, 'Isolamento temporario', 'reurb', 'Cidade do teste');
  insert into public.projeto_lotes (projeto_id, lote_id)
  values (v_outro_projeto, '001') returning id into v_fora;
  select pl.id into v_lote from public.projeto_lotes pl
   where pl.projeto_id = v_projeto
     and not exists (select 1 from public.coletas c where c.projeto_lote_id = pl.id)
   order by pl.lote_id limit 1;
  if v_lote is null then raise exception 'Reserve ao menos um lote sem coleta para este teste.'; end if;

  perform set_config('geocoleta.test_coletor', v_coletor::text, true);
  perform set_config('geocoleta.test_admin', v_admin::text, true);
  perform set_config('geocoleta.test_lote', v_lote::text, true);
  perform set_config('geocoleta.test_fora', v_fora::text, true);
  perform set_config('request.jwt.claim.sub', v_coletor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end $$;

set local role authenticated;

do $$
declare
  v_lote uuid := current_setting('geocoleta.test_lote')::uuid;
  v_fora uuid := current_setting('geocoleta.test_fora')::uuid;
  v_id uuid := gen_random_uuid();
  v_resultado uuid;
  v_admin_coleta uuid := gen_random_uuid();
  v_admin_lote uuid;
  v_motivo text;
  v_bloqueado boolean;
begin
  if (select count(*) from public.projetos) <> 1
     or (select count(*) from public.projeto_lotes) <> 12
     or (select count(*) from public.perfis) <> 1
     or exists (select 1 from public.projeto_lotes where id = v_fora) then
    raise exception 'Isolamento de projeto/perfil falhou.';
  end if;

  v_bloqueado := false;
  begin
    update public.perfis set permissao = 'ADMIN' where usuario_id = (select auth.uid());
  exception when insufficient_privilege then v_bloqueado := true;
  end;
  if not v_bloqueado then raise exception 'Coletor alterou a propria permissao.'; end if;

  v_bloqueado := false;
  begin
    perform public.sincronizar_coleta(v_fora, gen_random_uuid(), '{"teste":true}'::jsonb);
  exception when insufficient_privilege then v_bloqueado := true;
  end;
  if not v_bloqueado then raise exception 'Sincronizacao fora do projeto foi aceita.'; end if;

  foreach v_motivo in array array['null', '[]', '"texto"'] loop
    v_bloqueado := false;
    begin
      perform public.sincronizar_coleta(v_lote, v_id, v_motivo::jsonb);
    exception when raise_exception then v_bloqueado := true;
    end;
    if not v_bloqueado then raise exception 'Dados que nao sao objeto foram aceitos.'; end if;
  end loop;
  if exists (select 1 from public.coletas where id = v_id) then
    raise exception 'Entrada invalida deixou dados parciais.';
  end if;

  v_resultado := public.sincronizar_coleta(v_lote, v_id, '{"teste":"inicial"}'::jsonb);
  if v_resultado <> v_id or not exists (
      select 1 from public.projeto_lotes where id = v_lote and status = 'Finalizado') then
    raise exception 'Sincronizacao nao atualizou coleta e lote.';
  end if;
  if public.sincronizar_coleta(v_lote, gen_random_uuid(), '{"teste":"reenvio"}'::jsonb) <> v_id
     or (select count(*) from public.coletas where projeto_lote_id = v_lote) <> 1 then
    raise exception 'Reenvio gerou duplicidade.';
  end if;

  v_bloqueado := false;
  begin
    perform public.validar_coleta(v_id);
  exception when raise_exception then v_bloqueado := true;
  end;
  if not v_bloqueado then raise exception 'Coletor validou a propria coleta.'; end if;

  perform set_config('request.jwt.claim.sub', current_setting('geocoleta.test_admin'), true);
  perform public.validar_coleta(v_id);
  if not exists (select 1 from public.coletas where id = v_id and status = 'Validada')
     or not exists (select 1 from public.projeto_lotes where id = v_lote and status = 'Validado') then
    raise exception 'Validacao nao atualizou coleta e lote.';
  end if;

  perform set_config('request.jwt.claim.sub', current_setting('geocoleta.test_coletor'), true);
  v_bloqueado := false;
  begin
    perform public.sincronizar_coleta(v_lote, v_id, '{"teste":"indevido"}'::jsonb);
  exception when insufficient_privilege then v_bloqueado := true;
             when raise_exception then v_bloqueado := true;
  end;
  if not v_bloqueado then raise exception 'Coletor sobrescreveu uma coleta validada.'; end if;

  perform set_config('request.jwt.claim.sub', current_setting('geocoleta.test_admin'), true);
  foreach v_motivo in array array['', '1234', repeat('x', 501)] loop
    v_bloqueado := false;
    begin
      perform public.devolver_coleta(v_id, v_motivo);
    exception when raise_exception then v_bloqueado := true;
    end;
    if not v_bloqueado then raise exception 'Motivo invalido foi aceito.'; end if;
  end loop;
  perform public.devolver_coleta(v_id, '  Revisar dados de teste  ');
  if not exists (select 1 from public.coletas where id = v_id and status = 'Devolvida'
        and motivo_devolucao = 'Revisar dados de teste'
        and dados = '{"teste":"reenvio"}'::jsonb
        and validado_por is null and validado_em is null
        and devolvido_por = (select auth.uid()) and devolvido_em is not null)
     or not exists (select 1 from public.projeto_lotes where id = v_lote and status = 'Correcao') then
    raise exception 'Reabertura perdeu dados ou metadados.';
  end if;

  perform set_config('request.jwt.claim.sub', current_setting('geocoleta.test_coletor'), true);
  perform public.sincronizar_coleta(v_lote, v_id, '{"teste":"corrigido"}'::jsonb);
  if not exists (select 1 from public.coletas where id = v_id and status = 'Finalizada'
        and motivo_devolucao is null and devolvido_por is null and devolvido_em is null) then
    raise exception 'Reenvio da correcao nao limpou a revisao anterior.';
  end if;

  -- ADMIN continua podendo coletar; COLETOR nao le a coleta de outra conta.
  perform set_config('request.jwt.claim.sub', current_setting('geocoleta.test_admin'), true);
  select pl.id into v_admin_lote from public.projeto_lotes pl
   where pl.id <> v_lote
     and not exists (select 1 from public.coletas c where c.projeto_lote_id = pl.id)
   order by pl.lote_id limit 1;
  if v_admin_lote is null then raise exception 'Reserve dois lotes sem coleta para este teste.'; end if;
  perform public.sincronizar_coleta(v_admin_lote, v_admin_coleta, '{"teste":"coleta-do-admin"}'::jsonb);
  if not exists (select 1 from public.coletas where id = v_admin_coleta and coletor_id = (select auth.uid()))
     or not exists (select 1 from public.coletas where id = v_id) then
    raise exception 'ADMIN nao conseguiu coletar e consultar as coletas do projeto.';
  end if;
  perform set_config('request.jwt.claim.sub', current_setting('geocoleta.test_coletor'), true);
  if exists (select 1 from public.coletas where id = v_admin_coleta) then
    raise exception 'COLETOR acessou coleta de outro usuario.';
  end if;

  -- Usuario autenticado sem perfil nao deve ver o projeto.
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  if exists (select 1 from public.projetos)
     or exists (select 1 from public.lotes)
     or exists (select 1 from public.coletas) then
    raise exception 'Usuario sem perfil recebeu dados.';
  end if;
end $$;

rollback;
select 'OK: carga, RLS, sincronizacao, reenvio e revisao; alteracoes revertidas' as resultado;
