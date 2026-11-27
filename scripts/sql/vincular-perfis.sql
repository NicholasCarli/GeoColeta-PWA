-- Depois de criar DUAS contas no Supabase Dashboard > Authentication > Users.
-- Substitua somente os dois UUIDs abaixo pelos IDs das contas criadas.
-- Falha sem gravar nada se os placeholders nao forem preenchidos ou os perfis existirem.
begin;
do $$
declare
  v_coletor uuid := 'SUBSTITUA_PELO_UUID_DO_COLETOR';
  v_admin uuid := 'SUBSTITUA_PELO_UUID_DO_ADMIN';
  v_projeto constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if v_coletor = v_admin then
    raise exception 'Use contas diferentes para coletor e administrador.';
  end if;
  if not exists (select 1 from auth.users where id = v_coletor)
     or not exists (select 1 from auth.users where id = v_admin) then
    raise exception 'Crie as duas contas no Supabase Auth antes de vincular os perfis.';
  end if;

  insert into public.perfis (usuario_id, nome_exibicao, permissao, projeto_id)
  values (v_coletor, 'Coletor de demonstracao', 'COLETOR', v_projeto),
         (v_admin, 'Administrador de demonstracao', 'ADMIN', v_projeto);
end $$;
commit;
