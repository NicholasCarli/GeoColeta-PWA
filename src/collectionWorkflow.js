import { validateCollectionForm } from './formValidation.js';

export const collectionLabels = Object.freeze({
  waiting: 'Aguardando consulta', active: 'Ativo', paused: 'Pausado',
  finished: 'Finalizado', validated: 'Validado',
});
export const syncLabels = Object.freeze({ pending: 'Pendente', sending: 'Enviando', synced: 'Sincronizado', error: 'Erro' });

export function recordForLot(state, lotId) {
  return [...state.records].reverse().find(record => record.lotId === lotId && (!state.session || (
    record.userId === state.session.userId && record.projectId === state.session.projectId
  )));
}

export function collectionStatus(state, lotId) {
  return state.collectionStates?.[lotId] || (state.drafts[lotId] ? 'paused' : recordForLot(state, lotId) ? 'finished' : 'waiting');
}

export const isReadOnly = status => status === 'finished' || status === 'validated';
export const canSynchronize = (state, record) => collectionStatus(state, record.lotId) === 'finished' && ['pending', 'error'].includes(record.status);

// Upgrade the existing value in the same object store; never reset the user's data.
export function migrateCollectionState(state) {
  const next = { ...state, collectionStates: { ...state.collectionStates }, records: state.records.map(record => ({
    ...record,
    status: record.status === 'sent' ? 'synced' : record.status === 'sending' ? 'error' : record.status,
    ...(record.status === 'sending' ? { error: 'O envio foi interrompido. Tente novamente.' } : {}),
  })) };
  const ids = new Set([...Object.keys(next.collectionStates), ...Object.keys(next.drafts), ...next.records.map(record => record.lotId)]);
  for (const id of ids) {
    const status = collectionStatus(next, id);
    next.collectionStates[id] = status === 'active' ? 'paused' : status;
  }
  return next;
}

export function startCollection(state, lotId, initialForm, reopen = false) {
  const status = collectionStatus(state, lotId);
  const record = recordForLot(state, lotId);
  if (!state.prepared[lotId]) throw new Error('Baixe os dados deste lote antes de iniciar a coleta.');
  if (status === 'validated') throw new Error('Coletas validadas estão disponíveis somente para consulta.');
  if (status === 'finished' && !reopen) throw new Error('Reabra a coleta explicitamente antes de editar.');
  if (record?.status === 'sending') throw new Error('Aguarde o término da sincronização.');
  return {
    ...state, collectionStates: { ...state.collectionStates, [lotId]: 'active' },
    drafts: { ...state.drafts, [lotId]: state.drafts[lotId] || record?.form || initialForm },
  };
}

export function saveDraft(state, lotId, form, paused = false) {
  if (collectionStatus(state, lotId) !== 'active') throw new Error('Esta coleta não está aberta para edição.');
  return { ...state, collectionStates: { ...state.collectionStates, [lotId]: paused ? 'paused' : 'active' }, drafts: { ...state.drafts, [lotId]: form } };
}

export function finishCollection(state, lotId, form, now = new Date().toISOString()) {
  if (collectionStatus(state, lotId) !== 'active') throw new Error('Inicie ou retome a coleta antes de finalizar.');
  if (Object.keys(validateCollectionForm(form).errors).length) throw new Error('Revise os campos destacados antes de finalizar.');
  const previous = recordForLot(state, lotId);
  const record = {
    id: previous?.id || crypto.randomUUID(), userId: state.session.userId, projectId: state.session.projectId,
    lotId, form, status: 'pending', createdAt: previous?.createdAt || now, updatedAt: now,
    attempts: previous?.attempts || 0, error: '', sentAt: null,
  };
  const drafts = { ...state.drafts };
  delete drafts[lotId];
  return {
    ...state, drafts, collectionStates: { ...state.collectionStates, [lotId]: 'finished' },
    records: previous ? state.records.map(item => item.id === previous.id ? record : item) : [...state.records, record],
  };
}
