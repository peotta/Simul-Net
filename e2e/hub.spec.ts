import { expect, test } from '@playwright/test';
import { CATEGORIES, SIMS } from '../src/sims/registry';

// O hub: página inicial, categorias e a página de cada simulador (todos nativos, sem iframe).

test('a página inicial lista as categorias e os simuladores disponíveis', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Simul-Net' })).toBeVisible();
  for (const c of CATEGORIES) await expect(page.getByRole('heading', { level: 3, name: c.title })).toBeVisible();
  const available = SIMS.filter((s) => s.status === 'available');
  await expect(page.getByRole('link', { name: /Abrir simulador/ })).toHaveCount(available.length);
  await expect(page.getByRole('link', { name: /^Documentação\s*:/ })).toHaveCount(available.length);
  expect(errors).toEqual([]);
});

for (const sim of SIMS.filter((s) => s.status === 'available' && s.engine === 'legado')) {
  test(`o hub incorpora o simulador legado ${sim.id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`./#/sim/${sim.id}`);
    const frame = page.frameLocator(`iframe[title="Simulador: ${sim.title}"]`);
    await expect(frame.locator('.stage-panel')).toBeVisible();
    await expect(frame.locator('#scenRow button.chip').first()).toBeVisible();
    // dentro do hub o simulador esconde o "Voltar" e o título, que o hub já mostra
    await expect(frame.locator('.back-link')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

for (const sim of SIMS.filter((s) => s.status === 'available' && s.engine === 'nativo')) {
  test(`o hub abre o simulador nativo ${sim.id} sem iframe`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`./#/sim/${sim.id}`);
    await expect(page.getByRole('tab', { name: 'Cenário' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
