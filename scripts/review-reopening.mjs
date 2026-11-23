import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.SIMULATION_URL || 'http://127.0.0.1:4173';
const reason = 'Revisar o número da matrícula do imóvel.';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

async function openFixture(permission, status) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'usuario@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  const project = { id: '22222222-2222-4222-8222-222222222222', nome: 'Projeto de teste', categoria: 'reurb', cidade: 'Cidade de teste' };
  const lot = { id: 'TESTE-001', bairro: 'Bairro de teste', quadra: '1', endereco: 'Logradouro de teste', numero: '10', inscricao: 'TESTE-001', situacao_cadastral: 'Ativo' };
  const projectLot = { id: '33333333-3333-4333-8333-333333333333', projeto_id: project.id, status: status === 'Validada' ? 'Validado' : 'Correcao', lote: lot };
  const row = { id: '44444444-4444-4444-8444-444444444444', projeto_lote_id: projectLot.id, coletor_id: user.id, dados: { nome: 'Pessoa de teste', estadoCivil: 'solteiro' }, status, created_at: '2026-11-23T12:00:00Z', updated_at: '2026-11-23T13:00:00Z', synced_at: '2026-11-23T12:30:00Z', validado_em: status === 'Validada' ? '2026-11-23T13:00:00Z' : null, devolvido_em: status === 'Devolvida' ? '2026-11-23T13:00:00Z' : null, motivo_devolucao: status === 'Devolvida' ? reason : null, projeto_lote: projectLot };
  let calls = 0;
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'assinatura-de-teste'].join('.');

  await page.route('**/auth/v1/**', route => route.fulfill({ json: { access_token: token, refresh_token: 'refresh-de-teste', token_type: 'bearer', expires_in: 3600, user } }));
  await page.route('**/rest/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/rpc/devolver_coleta')) {
      assert.deepEqual(route.request().postDataJSON(), { p_coleta_id: row.id, p_motivo: reason });
      calls += 1;
      row.status = 'Devolvida'; row.motivo_devolucao = reason; row.devolvido_em = new Date().toISOString(); row.validado_em = null;
      projectLot.status = 'Correcao';
      return route.fulfill({ json: row.id });
    }
    if (path.endsWith('/perfis')) return route.fulfill({ json: { nome_exibicao: 'Usuário de teste', permissao: permission, projeto: project } });
    if (path.endsWith('/projeto_lotes')) return route.fulfill({ json: [projectLot] });
    if (path.endsWith('/coletas')) return route.fulfill({ json: [row] });
    throw new Error(`Consulta inesperada no teste: ${path}`);
  });
  await page.goto(base);
  await page.getByPlaceholder('Digite o e-mail').fill(user.email);
  await page.getByPlaceholder('Digite a senha').fill('senha-ficticia');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('heading', { name: 'Lotes disponíveis' }).waitFor();
  return { context, page, errors, calls: () => calls };
}

try {
  for (const permission of ['WCOGEO_ADMIN', 'WCOGEO_ANALISTA', 'PREFEITURA_ADMIN']) {
    const { context, page, errors, calls } = await openFixture(permission, 'Validada');
    await page.getByRole('button', { name: 'Validação', exact: true }).click();
    await page.getByLabel('Status da coleta', { exact: true }).selectOption('Validada');
    await page.getByLabel('Bairro da coleta', { exact: true }).selectOption('Bairro de teste');
    await page.getByRole('button', { name: 'Abrir coleta' }).click();
    await page.getByRole('heading', { name: 'Coleta — Lote TESTE-001' }).waitFor();
    await page.locator('.app-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert.ok(await page.locator('.app-content').evaluate(element => element.scrollTop) > 0);
    await page.getByRole('button', { name: 'Validação', exact: true }).click();
    await page.getByRole('heading', { name: 'Validação das coletas' }).waitFor();
    assert.equal(await page.getByLabel('Status da coleta', { exact: true }).inputValue(), 'Validada');
    assert.equal(await page.getByLabel('Bairro da coleta', { exact: true }).inputValue(), 'Bairro de teste');
    assert.equal(await page.locator('.app-content').evaluate(element => element.scrollTop), 0);
    await page.getByRole('button', { name: 'Abrir coleta' }).click();
    await page.getByRole('button', { name: 'Voltar para validações', exact: true }).click();
    await page.getByRole('heading', { name: 'Validação das coletas' }).waitFor();
    assert.equal(await page.locator('.app-content').evaluate(element => element.scrollTop), 0);
    await page.getByRole('button', { name: 'Abrir coleta' }).click();
    assert.equal(await page.getByRole('button', { name: 'Validar coleta', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Reabrir para correção', exact: true }).click();
    await page.getByRole('heading', { name: 'Reabrir coleta validada?' }).waitFor();
    const confirm = page.getByRole('button', { name: 'Confirmar reabertura', exact: true });
    assert.equal(await confirm.isDisabled(), true);
    await page.getByLabel('MOTIVO DA CORREÇÃO').fill('1234');
    assert.equal(await confirm.isDisabled(), true);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(calls(), 0);
    await page.getByRole('button', { name: 'Reabrir para correção', exact: true }).click();
    await page.getByLabel('MOTIVO DA CORREÇÃO').fill(reason);
    await page.getByRole('button', { name: 'Confirmar reabertura', exact: true }).click();
    await page.getByText(`Devolvida para correção: ${reason}`, { exact: true }).waitFor();
    assert.equal(calls(), 1);
    assert.equal(await page.getByRole('button', { name: 'Reabrir para correção', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  const { context, page, errors } = await openFixture('PREFEITURA_USUARIO', 'Devolvida');
  assert.equal(await page.getByRole('button', { name: 'Validação', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Pendências', exact: true }).click();
  await page.locator('.queue-card .banner').getByText(reason, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Retomar coleta' }).click();
  await page.getByRole('heading', { name: 'Coleta — Lote TESTE-001' }).waitFor();
  await page.locator('.app-content > .banner').getByText(reason, { exact: true }).waitFor();
  assert.equal(await page.locator('#nome').isDisabled(), false);
  assert.equal(await page.locator('#nome').inputValue(), 'Pessoa de teste');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('OK — três perfis revisores reabrem com motivo; cancelar preserva o status.');
  console.log('OK — aba Validação e botão de voltar retornam à lista no topo, mantendo os filtros.');
  console.log('OK — coletor vê o motivo nas pendências e no formulário, com os dados preservados.');
} finally {
  await browser.close();
}
