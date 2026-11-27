create or replace function public.devolver_coleta(p_coleta_id uuid, p_motivo text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_projeto_lote_id uuid;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 500 then
    raise exception 'Informe um motivo entre 5 e 500 caracteres.';
  end if;

  select c.projeto_lote_id
    into v_projeto_lote_id
    from public.coletas c
    join public.projeto_lotes pl on pl.id = c.projeto_lote_id
    join public.perfis p on p.projeto_id = pl.projeto_id
   where c.id = p_coleta_id
     and c.status in ('Finalizada', 'Validada')
     and p.usuario_id = (select auth.uid())
     and p.permissao = 'ADMIN'
   for update of c;

  if v_projeto_lote_id is null then
    raise exception 'Coleta indisponível para devolução.';
  end if;

  update public.coletas
     set status = 'Devolvida',
         validado_por = null,
         validado_em = null,
         devolvido_por = (select auth.uid()),
         devolvido_em = now(),
         motivo_devolucao = v_motivo,
         updated_at = now()
   where id = p_coleta_id;

  update public.projeto_lotes
     set status = 'Correcao',
         updated_at = now()
   where id = v_projeto_lote_id;

  return p_coleta_id;
end;
$function$;

revoke execute on function public.devolver_coleta(uuid, text) from public, anon;
grant execute on function public.devolver_coleta(uuid, text) to authenticated;

create or replace function public.projeto_lotes_proteger_validacao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  permissao_atual text;
  pode_revisar boolean;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  select p.permissao into permissao_atual
    from public.perfis p
   where p.usuario_id = (select auth.uid())
     and p.projeto_id = new.projeto_id;

  pode_revisar := coalesce(permissao_atual = 'ADMIN', false);

  if old.status = 'Validado' and new.status <> old.status then
    if not pode_revisar
       or new.status <> 'Correcao'
       or not exists (
         select 1 from public.coletas c
          where c.projeto_lote_id = old.id
            and c.status = 'Devolvida'
            and c.devolvido_por = (select auth.uid())
            and c.devolvido_em is not null
            and char_length(btrim(c.motivo_devolucao)) between 5 and 500
       ) then
      raise exception 'Uma coleta validada só pode ser reaberta para correção por um revisor, com motivo registrado.';
    end if;
  end if;

  if new.status = 'Validado' and old.status <> new.status and not pode_revisar then
    raise exception 'O usuário não possui permissão para validar a coleta.';
  end if;

  return new;
end;
$function$;
