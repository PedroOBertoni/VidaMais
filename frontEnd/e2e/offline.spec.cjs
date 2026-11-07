const { test, expect } = require('@playwright/test');

test('cadastro offline, validação, edição, bula e persistência SQLite após reabrir', async ({ page, context }) => {
  const erros = [];
  page.on('pageerror', erro => erros.push(erro.message));
  const avisos = [];
  page.on('dialog', dialog => { avisos.push(dialog.message()); return dialog.accept(); });
  // Indisponibilidade remota simulada. Este teste não comprova integração online.
  await context.route('https://**.supabase.co/**', route => route.fulfill({
    status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Sem conexão para este teste', error_code: 'offline_test' }),
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Cadastrar medicamento', exact: true }).click();
  await page.getByLabel('Nome do medicamento', { exact: true }).fill('Medicamento de teste');
  await page.getByLabel('Data de validade', { exact: true }).fill('31/02/2030');
  await page.getByRole('button', { name: 'Salvar medicamento', exact: true }).click();
  await expect.poll(() => avisos.some(a => a.includes('Dados inválidos'))).toBe(true);
  await page.getByLabel('Data de validade', { exact: true }).fill('31/12/2030');
  await page.getByLabel('Observações', { exact: true }).fill('Trecho cadastrado para verificar a consulta de bula.');
  await page.getByRole('button', { name: 'Salvar medicamento', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await page.getByText('Ver todos', { exact: true }).click();
  await page.getByRole('button', { name: 'Abrir Medicamento de teste', exact: true }).click();
  await expect(page.getByText(/Envio ao Supabase pendente/)).toBeVisible();
  await page.getByRole('button', { name: 'Ver bula', exact: true }).click();
  await expect(page.getByText('Trecho cadastrado para verificar a consulta de bula.', { exact: true }).last()).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'Editar medicamento', exact: true }).click();
  await expect(page.getByLabel('Nome do medicamento', { exact: true })).toHaveValue('Medicamento de teste');
  await page.getByLabel('Nome do medicamento', { exact: true }).fill('Nome revisado');
  await page.getByRole('button', { name: 'Salvar medicamento', exact: true }).click();
  await expect(page.getByText('Nome revisado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir medicamento', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Nome revisado', exact: true })).toHaveCount(0);
  expect(erros).toEqual([]);
});
