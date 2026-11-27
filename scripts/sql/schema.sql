-- Estrutura inicial para um projeto Supabase NOVO (schema public sem as tabelas GeoColeta).
-- Nao executar no banco atual: CREATE TABLE falha se os objetos ja existirem.
-- Snapshot do modelo da PWA; nao inclui contas, senhas ou dados cadastrados.
begin;
set local search_path = public;

create table public.projetos (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  categoria text not null,
  cidade text not null,
  situacao text default 'Ativo'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint projetos_categoria_not_blank CHECK ((btrim(categoria) <> ''::text)),
  constraint projetos_cidade_not_blank CHECK ((btrim(cidade) <> ''::text)),
  constraint projetos_nome_cidade_unique UNIQUE (nome, cidade),
  constraint projetos_nome_not_blank CHECK ((btrim(nome) <> ''::text)),
  constraint projetos_pkey PRIMARY KEY (id),
  constraint projetos_situacao_check CHECK ((situacao = ANY (ARRAY['Ativo'::text, 'Inativo'::text])))
);
alter table public.projetos enable row level security;

create table public.perfis (
  usuario_id uuid not null,
  permissao text not null,
  projeto_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  nome_exibicao text,
  constraint perfis_permissao_check CHECK ((permissao = ANY (ARRAY['ADMIN'::text, 'COLETOR'::text]))),
  constraint perfis_pkey PRIMARY KEY (usuario_id),
  constraint perfis_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE RESTRICT,
  constraint perfis_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.perfis enable row level security;

create table public.lotes (
  id text not null,
  bairro text not null,
  quadra text not null,
  endereco text not null,
  numero text not null,
  inscricao text not null,
  situacao_cadastral text not null,
  created_at timestamp with time zone default now() not null,
  constraint lotes_bairro_check CHECK ((btrim(bairro) <> ''::text)),
  constraint lotes_endereco_check CHECK ((btrim(endereco) <> ''::text)),
  constraint lotes_inscricao_key UNIQUE (inscricao),
  constraint lotes_numero_check CHECK ((btrim(numero) <> ''::text)),
  constraint lotes_pkey PRIMARY KEY (id),
  constraint lotes_quadra_check CHECK ((btrim(quadra) <> ''::text)),
  constraint lotes_situacao_cadastral_check CHECK ((btrim(situacao_cadastral) <> ''::text))
);
alter table public.lotes enable row level security;

create table public.projeto_lotes (
  id uuid default gen_random_uuid() not null,
  projeto_id uuid not null,
  lote_id text not null,
  status text default 'Aguardando'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint projeto_lotes_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES lotes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  constraint projeto_lotes_pkey PRIMARY KEY (id),
  constraint projeto_lotes_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE RESTRICT,
  constraint projeto_lotes_projeto_lote_unique UNIQUE (projeto_id, lote_id),
  constraint projeto_lotes_status_check CHECK ((status = ANY (ARRAY['Aguardando'::text, 'Ativo'::text, 'Pausado'::text, 'Finalizado'::text, 'Validado'::text, 'Correcao'::text])))
);
alter table public.projeto_lotes enable row level security;

create table public.coletas (
  id uuid default gen_random_uuid() not null,
  projeto_lote_id uuid not null,
  coletor_id uuid not null,
  dados jsonb not null,
  status text default 'Finalizada'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  synced_at timestamp with time zone default now() not null,
  validado_por uuid,
  validado_em timestamp with time zone,
  devolvido_por uuid,
  devolvido_em timestamp with time zone,
  motivo_devolucao text,
  constraint coletas_coletor_id_fkey FOREIGN KEY (coletor_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  constraint coletas_dados_object_check CHECK ((jsonb_typeof(dados) = 'object'::text)),
  constraint coletas_devolvido_por_fkey FOREIGN KEY (devolvido_por) REFERENCES auth.users(id) ON DELETE RESTRICT,
  constraint coletas_pkey PRIMARY KEY (id),
  constraint coletas_projeto_lote_id_fkey FOREIGN KEY (projeto_lote_id) REFERENCES projeto_lotes(id) ON DELETE RESTRICT,
  constraint coletas_projeto_lote_id_key UNIQUE (projeto_lote_id),
  constraint coletas_revisao_coerente_check CHECK ((((status = 'Finalizada'::text) AND (validado_por IS NULL) AND (validado_em IS NULL) AND (devolvido_por IS NULL) AND (devolvido_em IS NULL) AND (motivo_devolucao IS NULL)) OR ((status = 'Validada'::text) AND (validado_por IS NOT NULL) AND (validado_em IS NOT NULL) AND (devolvido_por IS NULL) AND (devolvido_em IS NULL) AND (motivo_devolucao IS NULL)) OR ((status = 'Devolvida'::text) AND (validado_por IS NULL) AND (validado_em IS NULL) AND (devolvido_por IS NOT NULL) AND (devolvido_em IS NOT NULL) AND (btrim(motivo_devolucao) <> ''::text)))),
  constraint coletas_status_check CHECK ((status = ANY (ARRAY['Finalizada'::text, 'Validada'::text, 'Devolvida'::text]))),
  constraint coletas_validado_por_fkey FOREIGN KEY (validado_por) REFERENCES auth.users(id) ON DELETE RESTRICT
);
alter table public.coletas enable row level security;

-- Indices de consulta e das chaves estrangeiras; PK e UNIQUE ja criam seus indices.
CREATE INDEX coletas_coletor_id_idx ON public.coletas USING btree (coletor_id);
CREATE INDEX coletas_devolvido_por_idx ON public.coletas USING btree (devolvido_por);
CREATE INDEX coletas_status_idx ON public.coletas USING btree (status);
CREATE INDEX coletas_validado_por_idx ON public.coletas USING btree (validado_por) WHERE (validado_por IS NOT NULL);
CREATE INDEX lotes_bairro_quadra_idx ON public.lotes USING btree (bairro, quadra);
CREATE INDEX perfis_projeto_id_idx ON public.perfis USING btree (projeto_id);
CREATE INDEX projeto_lotes_lote_id_idx ON public.projeto_lotes USING btree (lote_id);
CREATE INDEX projeto_lotes_projeto_status_idx ON public.projeto_lotes USING btree (projeto_id, status);

-- Retira os grants padrao do Supabase antes de liberar somente o necessario.
revoke all on table public.projetos, public.perfis, public.lotes, public.projeto_lotes, public.coletas from public, anon, authenticated;
grant select on table public.projetos, public.perfis, public.lotes, public.projeto_lotes, public.coletas to authenticated;
grant insert, update on public.coletas to authenticated;
grant update on public.projeto_lotes to authenticated;
grant all on table public.projetos, public.perfis, public.lotes, public.projeto_lotes, public.coletas to service_role;

create policy coletas_insert_own on public.coletas
  as permissive for insert to authenticated
  with check ((coletor_id = ( SELECT auth.uid() AS uid)) AND (status = 'Finalizada'::text) AND (validado_por IS NULL) AND (validado_em IS NULL) AND (EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.id = coletas.projeto_lote_id) AND (p.usuario_id = ( SELECT auth.uid() AS uid))))))
;

create policy coletas_select_assigned on public.coletas
  as permissive for select to authenticated
  using (EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.id = coletas.projeto_lote_id) AND (p.usuario_id = ( SELECT auth.uid() AS uid)) AND ((coletas.coletor_id = ( SELECT auth.uid() AS uid)) OR (p.permissao = 'ADMIN'::text)))))
;

create policy coletas_update_assigned on public.coletas
  as permissive for update to authenticated
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

create policy lotes_select_assigned on public.lotes
  as permissive for select to authenticated
  using (EXISTS ( SELECT 1
   FROM (projeto_lotes pl
     JOIN perfis p ON ((p.projeto_id = pl.projeto_id)))
  WHERE ((pl.lote_id = lotes.id) AND (p.usuario_id = ( SELECT auth.uid() AS uid)))))
;

create policy perfis_select_own on public.perfis
  as permissive for select to authenticated
  using (usuario_id = ( SELECT auth.uid() AS uid))
;

create policy projeto_lotes_select_assigned on public.projeto_lotes
  as permissive for select to authenticated
  using (EXISTS ( SELECT 1
   FROM perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.projeto_id = projeto_lotes.projeto_id))))
;

create policy projeto_lotes_update_assigned on public.projeto_lotes
  as permissive for update to authenticated
  using (EXISTS ( SELECT 1
   FROM perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.projeto_id = projeto_lotes.projeto_id))))
  with check (EXISTS ( SELECT 1
   FROM perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.projeto_id = projeto_lotes.projeto_id) AND ((projeto_lotes.status <> 'Validado'::text) OR (p.permissao = 'ADMIN'::text)))))
;

create policy projetos_select_assigned on public.projetos
  as permissive for select to authenticated
  using (EXISTS ( SELECT 1
   FROM perfis p
  WHERE ((p.usuario_id = ( SELECT auth.uid() AS uid)) AND (p.projeto_id = projetos.id))))
;

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

CREATE OR REPLACE FUNCTION public.sincronizar_coleta(p_projeto_lote_id uuid, p_coleta_id uuid, p_dados jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  v_coleta_id uuid;
begin
  if jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Os dados da coleta devem ser um objeto.';
  end if;

  insert into public.coletas (
    id, projeto_lote_id, coletor_id, dados
  )
  values (
    p_coleta_id, p_projeto_lote_id, (select auth.uid()), p_dados
  )
  on conflict (projeto_lote_id) do update
    set dados = excluded.dados,
        status = 'Finalizada',
        validado_por = null,
        validado_em = null,
        devolvido_por = null,
        devolvido_em = null,
        motivo_devolucao = null,
        synced_at = now(),
        updated_at = now()
  returning id into v_coleta_id;

  update public.projeto_lotes
     set status = 'Finalizado',
         updated_at = now()
   where id = p_projeto_lote_id;

  return v_coleta_id;
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

CREATE TRIGGER projeto_lotes_proteger_validacao_trigger BEFORE UPDATE OF status ON public.projeto_lotes FOR EACH ROW EXECUTE FUNCTION projeto_lotes_proteger_validacao();

revoke all on function public.projeto_lotes_proteger_validacao() from public, anon, authenticated;
revoke all on function public.sincronizar_coleta(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sincronizar_coleta(uuid, uuid, jsonb) to authenticated;
revoke all on function public.validar_coleta(uuid) from public, anon, authenticated;
grant execute on function public.validar_coleta(uuid) to authenticated;
revoke all on function public.devolver_coleta(uuid, text) from public, anon, authenticated;
grant execute on function public.devolver_coleta(uuid, text) to authenticated;

commit;
