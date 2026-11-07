const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
process.loadEnvFile('.env');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

test('cadastro, bula, edição, SQLite persistente, sincronização e exclusão', async ({ page, context, request }) => {
  const nome = `E2E ${randomUUID()}`;
  const editado = `${nome} editado`;
  const offline = `${nome} offline`;
  const erros = [];
  const avisos = [];
  let token;
  page.on('pageerror', erro => erros.push(erro.message));
  page.on('dialog', dialog => { avisos.push(dialog.message()); return dialog.accept(); });
  const lerToken = () => page.evaluate(() => {
    const chave = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return chave ? JSON.parse(localStorage.getItem(chave)).access_token : null;
  });
  const remoto = async (name) => {
    const resposta = await request.get(`${url}/rest/v1/medicamentos`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      params: { nome: `eq.${name}`, select: 'sync_id,nome,indicacao' },
    });
    expect(resposta.ok()).toBeTruthy();
    return resposta.json();
  };
  async function cadastrar(name) {
    await page.getByRole('button', { name: 'Cadastrar medicamento', exact: true }).click();
    await page.getByLabel('Nome do medicamento', { exact: true }).fill(name);
    await page.getByLabel('Data de validade', { exact: true }).fill('30/12/2030');
    await page.getByLabel('Indicação', { exact: true }).fill('Anotação fictícia para teste de persistência.');
    await page.getByRole('button', { name: 'Salvar medicamento', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  }
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Cadastrar medicamento', exact: true })).toBeVisible({ timeout: 30000 });
    await expect.poll(lerToken, { timeout: 15000 }).toBeTruthy();
    token = await lerToken();
    expect(token).toBeTruthy();
    await page.getByRole('button', { name: 'Cadastrar medicamento', exact: true }).click();
    await page.getByLabel('Nome do medicamento', { exact: true }).fill(nome);
    await page.getByLabel('Data de validade', { exact: true }).fill('31/02/2030');
    await page.getByRole('button', { name: 'Salvar medicamento', exact: true }).click();
    await expect.poll(() => avisos.some(texto => texto.includes('Dados inválidos'))).toBe(true);
    expect((await remoto(nome)).length).toBe(0);
    await page.goBack();
    await cadastrar(nome);
    await expect.poll(async () => (await remoto(nome)).length).toBe(1);
    await page.getByText('Ver todos', { exact: true }).click();
    const filtro = page.getByText('Todos', { exact: true });
    const caixaFiltro = await filtro.locator('..').boundingBox();
    expect(caixaFiltro.height).toBeLessThan(60);
    await page.getByLabel('Buscar medicamento', { exact: true }).fill('inexistente');
    await expect(page.getByRole('button', { name: `Abrir ${nome}`, exact: true })).toHaveCount(0);
    await page.getByLabel('Buscar medicamento', { exact: true }).fill('');
    await page.getByText('Vencidos', { exact: true }).last().click();
    await expect(page.getByRole('button', { name: `Abrir ${nome}`, exact: true })).toHaveCount(0);
    await filtro.click();
    await page.getByRole('button', { name: `Abrir ${nome}`, exact: true }).click();
    await page.getByRole('button', { name: 'Ver bula', exact: true }).click();
    await expect(page).toHaveURL(/\/bula\/\d+$/);
    await expect(page.getByText('Anotação fictícia para teste de persistência.', { exact: true }).last()).toBeVisible();
    await page.goBack();
    await page.getByRole('button', { name: 'Editar medicamento', exact: true }).click();
    await expect(page.getByLabel('Nome do medicamento', { exact: true })).toHaveValue(nome);
    await page.getByLabel('Nome do medicamento', { exact: true }).fill(editado);
    await page.getByRole('button', { name: 'Salvar medicamento', exact: true }).click();
    await expect(page.getByText(editado, { exact: true }).last()).toBeVisible();
    await expect.poll(async () => (await remoto(editado)).length).toBe(1);
    expect((await remoto(nome)).length).toBe(0);

    // Bloqueia somente a nuvem; o servidor local continua entregando o app.
    await context.route(`${url}/**`, route => route.abort('internetdisconnected'));
    await page.goto('/');
    await cadastrar(offline);
    await page.reload();
    await page.getByText('Ver todos', { exact: true }).click();
    await expect(page.getByRole('button', { name: `Abrir ${offline}`, exact: true })).toBeVisible();
    expect((await remoto(offline)).length).toBe(0);
    await context.unroute(`${url}/**`);
    await page.reload();
    await expect.poll(async () => (await remoto(offline)).length, { timeout: 15000 }).toBe(1);
    expect(await lerToken()).toBe(token);
    await expect(page.getByRole('button', { name: `Abrir ${offline}`, exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/lista-validada.png', fullPage: true });

    for (const name of [editado, offline]) {
      await page.getByRole('button', { name: `Abrir ${name}`, exact: true }).click();
      await page.getByRole('button', { name: 'Excluir medicamento', exact: true }).click();
      await expect(page.getByRole('button', { name: `Abrir ${name}`, exact: true })).toHaveCount(0);
      await expect.poll(async () => (await remoto(name)).length).toBe(0);
    }
    expect(erros).toEqual([]);
  } finally {
    await context.unroute(`${url}/**`);
    if (!token) token = await lerToken().catch(() => null);
    if (token) {
      for (const name of [nome, editado, offline]) {
        const resposta = await request.delete(`${url}/rest/v1/medicamentos`, {
          headers: { apikey: key, Authorization: `Bearer ${token}` }, params: { nome: `eq.${name}` },
        });
        expect(resposta.ok(), 'Limpeza dos registros temporários').toBeTruthy();
      }
    }
  }
});
