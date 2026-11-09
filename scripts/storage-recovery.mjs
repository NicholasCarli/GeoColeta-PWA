import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { lots, demoSession, validatedForms } from '../src/storage.js';

const base = process.env.SIMULATION_URL || 'http://127.0.0.1:4173';
const out = path.resolve('.openai/.local/qa');
await mkdir(out, { recursive: true });
const profile = await mkdtemp(path.join(out, 'recovery-profile-'));
const launch = () => chromium.launchPersistentContext(profile, {
  headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'], viewport: { width: 390, height: 844 },
});
const errors = [];
let context;
const newPage = async () => { const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); return page; };
const storedState = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('geocoleta-simulacao-v1', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const read = db.transaction('simulation').objectStore('simulation').get('state');
    read.onsuccess = () => { resolve(read.result); db.close(); };
    read.onerror = () => reject(read.error);
  };
}));

try {
  context = await launch();
  let page = await newPage();
  await page.goto(base);
  await page.getByRole('heading', { name: 'Acessar demonstração' }).waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; await document.fonts.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const document = { name: 'documento-legado.png', type: 'image/png', data: 'data:image/png;base64,' + (await readFile('public/icon-192.png')).toString('base64') };
  // Simulate an actual persisted snapshot of the previous app, without collectionStates.
  const legacy = {
    session: demoSession, prepared: Object.fromEntries(lots.filter(lot => ['001', '002', '012'].includes(lot.id)).map(lot => [lot.id, lot])),
    drafts: { '002': { nome: 'Rascunho anterior' } }, lastPrepared: '2026-11-08T12:00:00.000Z',
    records: [
      { id: 'registro-legado-001', userId: demoSession.userId, projectId: demoSession.projectId, lotId: '001', status: 'sent', attempts: 2, form: { ...validatedForms['012'], lote: '001', nome: 'Registro anterior', pendingDocument: document } },
      { id: 'registro-legado-012', userId: demoSession.userId, projectId: demoSession.projectId, lotId: '012', status: 'pending', attempts: 0, form: { ...validatedForms['012'], nome: 'Trabalho anterior no lote 012' } },
    ],
  };
  await page.evaluate(state => new Promise((resolve, reject) => {
    const request = indexedDB.open('geocoleta-simulacao-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('simulation', 'readwrite');
      tx.objectStore('simulation').put(state, 'state');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), legacy);
  await context.close();
  context = await launch();
  await context.setOffline(true);
  page = await newPage();
  await page.goto(base);
  await page.getByRole('heading', { name: 'Lotes disponíveis' }).waitFor();
  const recovered = await storedState(page);
  assert.equal(recovered.records[0].id, legacy.records[0].id);
  assert.equal(recovered.records[0].status, 'synced');
  assert.equal(recovered.records[0].attempts, 2);
  assert.deepEqual(recovered.records[0].form, legacy.records[0].form);
  assert.deepEqual(recovered.drafts, legacy.drafts);
  assert.equal(recovered.collectionStates['001'], 'finished');
  assert.equal(recovered.collectionStates['002'], 'paused');
  assert.equal(recovered.collectionStates['012'], 'finished');
  assert.equal(recovered.records[1].status, 'pending');
  assert.equal(JSON.stringify(recovered).includes('teste123'), false);
  await page.getByRole('button', { name: /Rua Cel. Virgílio/ }).click();
  await page.getByRole('button', { name: 'Ver coleta' }).click();
  assert.equal(await page.locator('#nome').inputValue(), 'Registro anterior');
  assert.ok(await page.locator('#nome').isDisabled());
  await page.getByRole('tab', { name: 'Imóvel' }).click();
  // The legacy image remains attached even when the judicial-pendency selector is false.
  assert.deepEqual((await storedState(page)).records[0].form.pendingDocument, document);
  assert.deepEqual(errors, []);
  console.log('OK — aplicação reabre sem rede após fechar e reiniciar o navegador');
  console.log('OK — migração real do IndexedDB preserva formulário, documento, tentativas e rascunho');
  console.log('OK — exemplo validado não sobrescreve trabalho anterior no lote 012');
} finally { if (context) await context.close(); }
