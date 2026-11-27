-- Executar em uma conexão administrativa de teste. Todas as alterações são revertidas.
begin;

do $$
declare
  v_context record;
begin
  select c.id, c.coletor_id, p.usuario_id as admin_id
    into v_context
    from public.coletas c
    join public.projeto_lotes pl on pl.id = c.projeto_lote_id
    join public.perfis p on p.projeto_id = pl.projeto_id and p.permissao = 'ADMIN'
    join public.perfis coletor on coletor.usuario_id = c.coletor_id
   where c.status in ('Finalizada', 'Validada')
     and coletor.permissao = 'COLETOR'
   order by c.updated_at
   limit 1;

  if v_context.id is null then
    raise exception 'Prepare uma coleta finalizada ou validada de um coletor comum antes deste teste.';
  end if;
  perform set_config('geocoleta.test_coleta', v_context.id::text, true);
  perform set_config('geocoleta.test_admin', v_context.admin_id::text, true);
  perform set_config('geocoleta.test_coletor', v_context.coletor_id::text, true);
  perform set_config('request.jwt.claim.sub', v_context.admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end $$;

set local role authenticated;

do $$
declare
  v_id uuid := current_setting('geocoleta.test_coleta')::uuid;
  v_admin uuid := current_setting('geocoleta.test_admin')::uuid;
  v_before public.coletas%rowtype;
  v_after public.coletas%rowtype;
  v_reason text;
  v_blocked boolean;
begin
  select * into strict v_before from public.coletas where id = v_id;
  if v_before.status = 'Finalizada' then
    perform public.validar_coleta(v_id);
  end if;

  foreach v_reason in array array['', '1234', repeat('x', 501)] loop
    v_blocked := false;
    begin
      perform public.devolver_coleta(v_id, v_reason);
    exception when raise_exception then
      if sqlerrm = 'Informe um motivo entre 5 e 500 caracteres.' then
        v_blocked := true;
      else raise;
      end if;
    end;
    if not v_blocked then raise exception 'Motivo inválido foi aceito'; end if;
  end loop;

  perform set_config('request.jwt.claim.sub', current_setting('geocoleta.test_coletor'), true);
  v_blocked := false;
  begin
    perform public.devolver_coleta(v_id, 'Revisar cadastro no teste');
  exception when raise_exception then
    if sqlerrm = 'Coleta indisponível para devolução.' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'Coletor comum conseguiu reabrir'; end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.devolver_coleta(v_id, '  Revisar cadastro no teste  ');
  select * into strict v_after from public.coletas where id = v_id;

  if v_after.status <> 'Devolvida'
     or v_after.motivo_devolucao <> 'Revisar cadastro no teste'
     or v_after.devolvido_por is distinct from v_admin
     or v_after.devolvido_em is null
     or v_after.validado_por is not null
     or v_after.validado_em is not null then
    raise exception 'Reabertura não registrou status, motivo e responsável corretamente';
  end if;

  if v_after.dados is distinct from v_before.dados
     or v_after.coletor_id is distinct from v_before.coletor_id
     or v_after.created_at is distinct from v_before.created_at
     or v_after.synced_at is distinct from v_before.synced_at then
    raise exception 'A reabertura alterou dados da coleta';
  end if;

  if not exists (select 1 from public.projeto_lotes where id = v_after.projeto_lote_id and status = 'Correcao') then
    raise exception 'O lote não foi marcado para correção';
  end if;

  v_blocked := false;
  begin
    perform public.devolver_coleta(v_id, 'Segunda reabertura indevida');
  exception when raise_exception then
    if sqlerrm = 'Coleta indisponível para devolução.' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'Coleta devolvida foi reaberta novamente'; end if;

  if has_function_privilege('anon', 'public.devolver_coleta(uuid,text)', 'EXECUTE') then
    raise exception 'A função está liberada para acesso anônimo';
  end if;
end $$;

rollback;
select 'OK: reabertura, motivo, autorização e preservação dos dados; alterações revertidas' as resultado;
