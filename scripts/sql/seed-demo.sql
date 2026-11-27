-- Opcional: 12 lotes ficticios da base original de src/storage.js.
-- Usar somente em um NOVO ambiente de demonstracao, apos schema.sql.
-- Nao importa nem substitui os 240 lotes do ambiente publicado.
begin;

insert into public.projetos (id, nome, categoria, cidade)
values ('00000000-0000-4000-8000-000000000001', 'Projeto Centro - Demonstracao', 'reurb', 'Cidade de demonstracao')
on conflict (id) do nothing;

insert into public.lotes (id, bairro, quadra, endereco, numero, inscricao, situacao_cadastral)
values
  ('001', 'Centro', '12', 'Rua Cel. Virgílio Ferreira de Almeida', '120', '0001.012.001', 'Registrado'),
  ('002', 'Centro', '12', 'Rua Nossa Senhora Aparecida', '84', '0001.012.002', 'Registrado'),
  ('003', 'Centro', '12', 'Rua Prof. Calixto', '36', '0001.012.003', 'Aguardando'),
  ('004', 'Centro', '13', 'Rua das Acácias', '210', '0001.013.004', 'Aguardando'),
  ('005', 'Centro', '13', 'Rua São Benedito', '57', '0001.013.005', 'Ativo'),
  ('006', 'Centro', '13', 'Rua dos Ipês', '98', '0001.013.006', 'Registrado'),
  ('007', 'Jardim das Flores', '04', 'Rua das Orquídeas', '15', '0001.004.007', 'Aguardando'),
  ('008', 'Jardim das Flores', '04', 'Rua das Margaridas', '42', '0001.004.008', 'Ativo'),
  ('009', 'Jardim das Flores', '04', 'Rua dos Girassóis', '73', '0001.004.009', 'Registrado'),
  ('010', 'Vila Nova', '08', 'Rua da Esperança', '101', '0001.008.010', 'Aguardando'),
  ('011', 'Vila Nova', '08', 'Rua da Amizade', '109', '0001.008.011', 'Registrado'),
  ('012', 'Vila Nova', '08', 'Rua do Sol', '125', '0001.008.012', 'Ativo')
on conflict (id) do nothing;

insert into public.projeto_lotes (projeto_id, lote_id)
select '00000000-0000-4000-8000-000000000001'::uuid, id
from public.lotes
where id in ('001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012')
on conflict (projeto_id, lote_id) do nothing;

commit;
