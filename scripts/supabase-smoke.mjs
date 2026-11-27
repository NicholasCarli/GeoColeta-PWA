import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SIMULATION_URL || 'http://127.0.0.1:4173';
const email = process.env.TEST_USER_EMAIL || 'teste@geocoleta.com.br';
const password = process.env.TEST_USER_PASSWORD;
const permissionLabel = process.env.TEST_PERMISSION_LABEL || 'Coletor';
if (!password) throw new Error('Informe TEST_USER_PASSWORD para executar o teste de integração.');

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(base);
  await page.getByPlaceholder('Digite o e-mail').fill(email);
  await page.getByPlaceholder('Digite a senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('heading', { name: 'Lotes disponíveis' }).waitFor();

  await page.getByLabel('Bairro', { exact: true }).selectOption('');
  assert.equal(await page.locator('.lot-card').count(), 240);
  await page.locator('.bottom-nav button').nth(1).click();
  await page.getByRole('heading', { name: 'Pendências de sincronização' }).waitFor();
  assert.ok(await page.locator('.queue-card').count() > 0, 'Coletas sincronizadas não foram recuperadas do servidor.');
  await page.getByText('Sincronização: Sincronizado', { exact: false }).first().waitFor();
  await page.locator('.bottom-nav button').nth(2).click();
  await page.getByText(permissionLabel, { exact: false }).waitFor();
  await page.locator('.bottom-nav button').nth(0).click();
  const firstBairro = await page.getByLabel('Bairro', { exact: true }).locator('option').nth(1).getAttribute('value');
  await page.getByLabel('Bairro', { exact: true }).selectOption(firstBairro);
  await page.getByRole('button', { name: 'Baixar dados para uso offline' }).click();
  await page.getByRole('button', { name: 'Baixar dados para uso offline' }).click();
  await page.getByRole('heading', { name: 'Lotes disponíveis' }).waitFor();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Lotes disponíveis' }).waitFor();
  assert.ok(await page.locator('.lot-card').count() > 0);
  await page.locator('.connection-bar.offline').waitFor();
  assert.deepEqual(errors, []);
  console.log('OK — autenticação real, perfil, 240 lotes, recuperação remota e reabertura offline');
} finally {
  await browser.close();
}
