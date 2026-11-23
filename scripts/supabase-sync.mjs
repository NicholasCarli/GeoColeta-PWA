import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SIMULATION_URL || 'http://127.0.0.1:4173';
const password = process.env.TEST_USER_PASSWORD;
if (!password) throw new Error('Informe TEST_USER_PASSWORD para executar o teste de sincronização.');

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await page.goto(base);
  await page.getByPlaceholder('Digite o e-mail').fill('teste@geocoleta.com.br');
  await page.getByPlaceholder('Digite a senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('heading', { name: 'Lotes disponíveis' }).waitFor();
  await page.locator('.lot-card .lot-open').first().click();
  const lotTitle = await page.locator('.page-heading h1').textContent();
  await page.getByRole('button', { name: 'Iniciar coleta', exact: true }).click();

  const textValues = {
    cpfCnpj: '52998224725', nome: 'Coleta Acadêmica de Teste', dtNascimento: '1990-05-20',
    email: 'teste@example.com', rg: '1234567-8', orgaoExpedidor: 'SSP-MT', mae: 'Mãe de Teste',
    naturalidade: 'Cuiabá', nacionalidade: 'Brasileira', celular: '65999999999',
    profissao: 'Professora', rendaFamiliar: '3500',
  };
  for (const [id, value] of Object.entries(textValues)) await page.locator('#' + id).fill(value);
  for (const [id, value] of Object.entries({ sexo: 'feminino', escolaridade: 'medio_completo', outroImovel: 'false', possuiCnh: 'false', estadoCivil: 'solteiro' })) await page.locator('#' + id).selectOption(value);
  await page.getByRole('tab', { name: 'Imóvel' }).click();
  await page.locator('#cep').fill('78000000');
  await page.locator('#matricula').fill('TESTE-SUPABASE');
  await page.locator('#valorVenal').fill('120000');
  await page.locator('#possuiPendencia').selectOption('false');
  await page.getByRole('button', { name: 'Finalizar coleta', exact: true }).click();
  await page.getByRole('heading', { name: 'Registro salvo' }).waitFor();
  await page.getByRole('button', { name: 'Ver pendências' }).click();
  await page.getByRole('button', { name: 'Sincronizar 1 registro' }).click();
  await page.getByRole('heading', { name: 'Tudo sincronizado' }).waitFor();
  assert.ok(lotTitle?.startsWith('Lote '));
  console.log(`OK — ${lotTitle} finalizado e sincronizado com o Supabase`);
} finally {
  await browser.close();
}
