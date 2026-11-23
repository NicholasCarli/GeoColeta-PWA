import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.');

export const supabase = createClient(url, key);

const mapLot = row => ({
  id: row.lote.id,
  projectLotId: row.id,
  bairro: row.lote.bairro,
  quadra: row.lote.quadra,
  address: row.lote.endereco,
  number: row.lote.numero,
  inscription: row.lote.inscricao,
  status: row.status,
  cadastralStatus: row.lote.situacao_cadastral,
});

const mapCollection = row => ({
  id: row.id,
  lotId: row.projeto_lote.lote.id,
  projectLotId: row.projeto_lote_id,
  collectorId: row.coletor_id,
  form: row.dados,
  remoteStatus: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sentAt: row.synced_at,
  validatedAt: row.validado_em,
  returnedAt: row.devolvido_em,
  returnReason: row.motivo_devolucao,
  lot: mapLot(row.projeto_lote),
});

export async function loadRemoteCollections(projectId) {
  const { data, error } = await supabase
    .from('coletas')
    .select('id, projeto_lote_id, coletor_id, dados, status, created_at, updated_at, synced_at, validado_em, devolvido_em, motivo_devolucao, projeto_lote:projeto_lotes!inner(id, projeto_id, status, lote:lotes(id, bairro, quadra, endereco, numero, inscricao, situacao_cadastral))')
    .eq('projeto_lote.projeto_id', projectId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('Não foi possível recuperar as coletas sincronizadas.');
  return data.map(mapCollection);
}

export async function loadRemoteContext(user) {
  const { data: profile, error: profileError } = await supabase
    .from('perfis')
    .select('nome_exibicao, permissao, projeto:projetos(id, nome, categoria, cidade)')
    .eq('usuario_id', user.id)
    .single();
  if (profileError) throw new Error('Seu usuário ainda não possui projeto e permissão configurados.');

  const { data: projectLots, error: lotsError } = await supabase
    .from('projeto_lotes')
    .select('id, status, lote:lotes(id, bairro, quadra, endereco, numero, inscricao, situacao_cadastral)')
    .eq('projeto_id', profile.projeto.id)
    .order('bairro', { referencedTable: 'lotes' })
    .order('quadra', { referencedTable: 'lotes' })
    .order('id', { referencedTable: 'lotes' });
  if (lotsError) throw new Error('Não foi possível carregar os lotes deste projeto.');

  const collections = await loadRemoteCollections(profile.projeto.id);

  return {
    session: {
      userId: user.id,
      userName: profile.nome_exibicao || user.email.split('@')[0],
      email: user.email,
      permission: profile.permissao,
      projectId: profile.projeto.id,
      projectName: profile.projeto.nome,
    },
    lots: projectLots.map(mapLot),
    collections,
  };
}

export async function authenticate(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('E-mail ou senha inválidos.');
  return loadRemoteContext(data.user);
}

export async function restoreAuthentication() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

export async function synchronizeCollection(record, lot) {
  if (!lot?.projectLotId) throw new Error('O vínculo deste lote com o projeto não está disponível.');
  const { error } = await supabase.rpc('sincronizar_coleta', {
    p_projeto_lote_id: lot.projectLotId,
    p_coleta_id: record.id,
    p_dados: record.form,
  });
  if (error) throw new Error('O servidor não confirmou a coleta. Tente novamente.');
}

export async function validateRemoteCollection(collectionId) {
  const { error } = await supabase.rpc('validar_coleta', { p_coleta_id: collectionId });
  if (error) throw new Error('Não foi possível validar esta coleta. Confira sua permissão e tente novamente.');
}

export async function returnRemoteCollection(collectionId, reason) {
  const { error } = await supabase.rpc('devolver_coleta', { p_coleta_id: collectionId, p_motivo: reason.trim() });
  if (error) throw new Error('Não foi possível devolver esta coleta para correção.');
}

export const endAuthentication = () => supabase.auth.signOut({ scope: 'local' });
