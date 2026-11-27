-- Atualizacao do banco EXISTENTE; executar junto do frontend com ADMIN/COLETOR.
-- Nao cria/apaga contas, lotes ou coletas. Rodar como administrador.
begin;
lock table public.perfis in access exclusive mode;

do $$
begin
  if exists (select 1 from public.perfis where permissao not in (
    'WCOGEO_ADMIN', 'WCOGEO_ANALISTA', 'PREFEITURA_ADMIN',
    'WCOGEO_USUARIO', 'PREFEITURA_USUARIO', 'ADMIN', 'COLETOR'
  )) then
    raise exception 'Existe permissao desconhecida; revise os perfis antes de continuar.';
  end if;
end $$;

alter table public.perfis drop constraint perfis_permissao_check;

update public.perfis
set permissao = case
      when permissao in ('WCOGEO_ADMIN', 'WCOGEO_ANALISTA', 'PREFEITURA_ADMIN') then 'ADMIN'
      when permissao in ('WCOGEO_USUARIO', 'PREFEITURA_USUARIO') then 'COLETOR'
    end,
    updated_at = now()
where permissao in ('WCOGEO_ADMIN', 'WCOGEO_ANALISTA', 'PREFEITURA_ADMIN', 'WCOGEO_USUARIO', 'PREFEITURA_USUARIO');

alter table public.perfis add constraint perfis_permissao_check
  check (permissao in ('ADMIN', 'COLETOR'));

alter policy coletas_select_assigned on public.coletas
  using (EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.id = coletas.projeto_lote_id) AND (p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((coletas.coletor_id = ( SELECT auth.uid() AS uid)) OR (p.permissao = 'ADMIN'::text)))))
;

alter policy coletas_update_assigned on public.coletas
  using (((coletor_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['Finalizada'::text, 'Devolvida'::text])) AND (EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.id = coletas.projeto_lote_id) AND (p.usuario_id = ( SELECT auth.uid() AS uid)))))) OR (EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.id = coletas.projeto_lote_id) AND (p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.permissao = 'ADMIN'::text)))))
  with check (((coletor_id = ( SELECT auth.uid() AS uid)) AND (status = 'Finalizada'::text) AND (validado_por IS NULL) AND (validado_em IS NULL) AND (devolvido_por IS NULL) AND (devolvido_em IS NULL) AND (motivo_devolucao IS NULL) AND (EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.id = coletas.projeto_lote_id) AND (p.usuario_id = ( SELECT auth.uid() AS uid)))))) OR ((EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.id = coletas.projeto_lote_id) AND (p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.permissao = 'ADMIN'::text)))) AND (((status = 'Finalizada'::text) AND (validado_por IS NULL) AND (validado_em IS NULL) AND (devolvido_por IS NULL) AND (devolvido_em IS NULL) AND (motivo_devolucao IS NULL)) OR ((status = 'Validada'::text) AND (validado_por = ( SELECT auth.uid() AS uid)) AND (validado_em IS NOT NULL) AND (devolvido_por IS NULL) AND (devolvido_em IS NULL) AND (motivo_devolucao IS NULL)) OR ((status = 'Devolvida'::text) AND (validado_por IS NULL) AND (validado_em IS NULL) AND (devolvido_por = ( SELECT auth.uid() AS uid)) AND (devolvido_em IS NOT NULL) AND (btrim(motivo_devolucao) <> ''::text)))))
;

alter policy projeto_lotes_update_assigned on public.projeto_lotes
  using (EXISTS ( SELECT 1
   FROM perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.projeto_id = projeto_lotes.projeto_id))))
  with check (EXISTS ( SELECT 1
   FROM perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.projeto_id = projeto_lotes.projeto_id) AND ((projeto_lotes.status <> 'Validado'::text) OR (p.permissao = 'ADMIN'::text)))))
;

CREATE OR REPLACE FUNCTION public.devolver_coleta(p_coleta_id uuid, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.projeto_lotes_proteger_validacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.validar_coleta(p_coleta_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  v_projeto_lote_id uuid;
begin
  select c.projeto_lote_id
    into v_projeto_lote_id
    from public.coletas c
    join public.projeto_lotes pl on pl.id = c.projeto_lote_id
    join public.perfis p on p.projeto_id = pl.projeto_id
   where c.id = p_coleta_id
     and c.status = 'Finalizada'
     and p.usuario_id = (select auth.uid())
     and p.permissao = 'ADMIN';

  if v_projeto_lote_id is null then
    raise exception 'Coleta indisponível para validação.';
  end if;

  update public.coletas
     set status = 'Validada',
         validado_por = (select auth.uid()),
         validado_em = now(),
         devolvido_por = null,
         devolvido_em = null,
         motivo_devolucao = null,
         updated_at = now()
   where id = p_coleta_id;

  update public.projeto_lotes
     set status = 'Validado',
         updated_at = now()
   where id = v_projeto_lote_id;

  return p_coleta_id;
end;
$function$;

commit;
