import assert from 'node:assert/strict';
import { initialState, demoSession, lots, validatedForms, restoreState } from '../src/storage.js';
import { collectionStatus, canSynchronize, isReadOnly, startCollection, saveDraft, finishCollection, migrateCollectionState } from '../src/collectionWorkflow.js';

const lot = lots[0];
const form = { ...validatedForms['012'], lote: lot.id, nome: 'Pessoa de Teste' };
const original = { ...initialState(), session: demoSession, prepared: { [lot.id]: lot, '012': lots[11] } };
let state = startCollection(original, lot.id, { nome: '' });
assert.equal(collectionStatus(original, lot.id), 'waiting');
assert.equal(collectionStatus(state, lot.id), 'active');
assert.throws(() => finishCollection(state, lot.id, { nome: '' }), /Revise/);
assert.equal(state.records.length, 0);
state = saveDraft(state, lot.id, form, true);
assert.equal(collectionStatus(state, lot.id), 'paused');
assert.equal(state.drafts[lot.id].nome, form.nome);
assert.throws(() => finishCollection(state, lot.id, form), /retome/);
state = startCollection(state, lot.id, {});
assert.equal(state.drafts[lot.id].nome, form.nome);
state = finishCollection(state, lot.id, state.drafts[lot.id]);
assert.equal(collectionStatus(state, lot.id), 'finished');
assert.equal(state.drafts[lot.id], undefined);
assert.equal(state.records.length, 1);
assert.equal(canSynchronize(state, state.records[0]), true);
const recordId = state.records[0].id;
assert.throws(() => startCollection(state, lot.id, {}), /Reabra/);
assert.throws(() => saveDraft(state, lot.id, form), /edição/);

state = { ...state, records: state.records.map(record => ({ ...record, status: 'synced', attempts: 2 })) };
assert.equal(collectionStatus(state, lot.id), 'finished');
assert.equal(canSynchronize(state, state.records[0]), false);
state = startCollection(state, lot.id, {}, true);
assert.equal(state.drafts[lot.id].nome, form.nome);
assert.equal(canSynchronize(state, { ...state.records[0], status: 'pending' }), false);
state = saveDraft(state, lot.id, { ...form, nome: 'Pessoa Revisada' }, true);
assert.equal(canSynchronize(state, { ...state.records[0], status: 'error' }), false);
state = startCollection(state, lot.id, {});
state = finishCollection(state, lot.id, state.drafts[lot.id]);
assert.equal(state.records.length, 1);
assert.equal(state.records[0].id, recordId);
assert.equal(state.records[0].form.nome, 'Pessoa Revisada');
assert.equal(state.records[0].status, 'pending');
assert.equal(state.records[0].attempts, 2);
assert.equal(state.records[0].sentAt, null);
assert.equal(canSynchronize(state, state.records[0]), true);

assert.throws(() => startCollection(original, '012', {}, true), /somente para consulta/);
assert.throws(() => saveDraft(original, '012', form), /edição/);
assert.throws(() => finishCollection(original, '012', form), /Inicie/);

const legacy = { ...original, records: [{ ...state.records[0], status: 'sent' }], drafts: { '002': { nome: 'Rascunho legado' } } };
delete legacy.collectionStates;
const before = structuredClone(legacy);
const migrated = migrateCollectionState(legacy);
assert.deepEqual(legacy, before);
assert.equal(migrated.records[0].status, 'synced');
assert.equal(migrated.records[0].id, recordId);
assert.deepEqual(migrated.records[0].form, legacy.records[0].form);
assert.equal(collectionStatus(migrated, lot.id), 'finished');
assert.equal(collectionStatus(migrated, '002'), 'paused');
assert.deepEqual(migrated.drafts, legacy.drafts);
assert.deepEqual(migrateCollectionState(migrated), migrated);
const legacyExample = { ...legacy, records: [{ ...legacy.records[0], lotId: '012', status: 'pending' }] };
assert.equal(collectionStatus(restoreState(legacyExample), '012'), 'finished');
assert.equal(collectionStatus(restoreState({}), '012'), 'validated');
assert.equal(collectionStatus(restoreState({ ...legacyExample, collectionStates: { '012': 'validated' } }), '012'), 'validated');
const interrupted = migrateCollectionState({ ...state, collectionStates: { [lot.id]: 'active' }, records: [{ ...state.records[0], status: 'sending' }] });
assert.equal(collectionStatus(interrupted, lot.id), 'paused');
assert.equal(interrupted.records[0].status, 'error');
assert.match(interrupted.records[0].error, /interrompido/);
assert.equal(canSynchronize(interrupted, interrupted.records[0]), false);

const returned = { ...state, collectionStates: { ...state.collectionStates, [lot.id]: 'returned' }, prepared: { ...state.prepared, [lot.id]: lot } };
assert.equal(collectionStatus(returned, lot.id), 'returned');
assert.equal(isReadOnly(returned.collectionStates[lot.id]), false);
assert.equal(collectionStatus(startCollection(returned, lot.id, {}), lot.id), 'active');

console.log('OK — iniciar, pausar, retomar, finalizar e reabrir sem duplicar registros');
console.log('OK — somente finalizados entram no envio; validados permanecem bloqueados');
console.log('OK — migração preserva dados e recupera edição/envio interrompidos');
console.log('OK — coleta devolvida pode ser corrigida e finalizada novamente');

for (const [permission, expected] of Object.entries({
  WCOGEO_ADMIN: 'ADMIN', WCOGEO_ANALISTA: 'ADMIN', PREFEITURA_ADMIN: 'ADMIN',
  WCOGEO_USUARIO: 'COLETOR', PREFEITURA_USUARIO: 'COLETOR', ADMIN: 'ADMIN', COLETOR: 'COLETOR',
})) {
  const cached = { ...state, session: { ...demoSession, permission }, drafts: { '002': { nome: 'Rascunho preservado' } } };
  const before = structuredClone(cached);
  const restored = restoreState(cached);
  assert.equal(restored.session.permission, expected);
  assert.equal(restored.session.userId, cached.session.userId);
  assert.equal(restored.session.projectId, cached.session.projectId);
  assert.deepEqual(restored.records, cached.records);
  assert.deepEqual(restored.drafts, cached.drafts);
  assert.deepEqual(cached, before);
  assert.deepEqual(restoreState(restored), restored);
}
assert.equal(restoreState({ session: { ...demoSession, permission: 'DESCONHECIDO' } }).session.permission, 'DESCONHECIDO');
assert.equal(restoreState({ session: { ...demoSession, permission: '__proto__' } }).session.permission, '__proto__');
assert.equal(restoreState({ session: { ...demoSession, permission: 'constructor' } }).session.permission, 'constructor');
console.log('OK — sessões antigas migram para dois cargos sem elevar permissões ou perder dados');
