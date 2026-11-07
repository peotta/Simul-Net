import { expect, test, type Page } from '@playwright/test';
import { SIMS } from '../src/sims/registry';

// Para cada simulador nativo do registro: percorre todos os modos e cenários prontos, executa a animação até o fim,
// abre todas as abas e falha se houver erro de JavaScript. Confere também o comportamento de layout da página.

const natives = SIMS.filter((s) => s.status === 'available' && s.engine === 'nativo');

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|ERR_|fonts\.(googleapis|gstatic)/.test(t)) return;
    errors.push(`console.error: ${t}`);
  });
  return errors;
}

async function open(page: Page, id: string) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`#/sim/${id}`);
  await page.waitForSelector('.simnet .scen-row button.chip');
}

/** Roda a animação na velocidade máxima até o botão voltar a "Simular", e abre todas as abas. */
async function exercise(page: Page) {
  await page.getByLabel('Velocidade').selectOption({ label: 'Muito rápida' });
  await page.getByRole('button', { name: 'Voltar ao início' }).click();
  await page.getByRole('button', { name: /^(Simular|Continuar)$/ }).click();
  await expect(page.getByRole('button', { name: 'Simular', exact: true })).toBeVisible({ timeout: 30_000 });
  const tabs = page.getByRole('tab');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) await tabs.nth(i).click();
}

// Os cenários são divididos em partes que rodam em paralelo (o de número i vai para a parte i % SHARDS).
const SHARDS = 3;

for (const sim of natives) {
  test.describe(sim.id, () => {
    for (let shard = 0; shard < SHARDS; shard++) {
      test(`todos os cenários rodam sem erro de JavaScript (parte ${shard + 1} de ${SHARDS})`, async ({ page }) => {
        test.setTimeout(240_000);
        const errors = watchErrors(page);
        await open(page, sim.id);
        const modes = page.locator('.simnet .topbar [aria-label="Modo de simulação"] button');
        const modeCount = (await modes.count()) || 1;
        let seen = 0;
        let ran = 0;
        for (let m = 0; m < modeCount; m++) {
          if ((await modes.count()) > 1) await modes.nth(m).click();
          const chips = page.locator('.simnet .scen-row button.chip');
          const n = await chips.count();
          for (let i = 0; i < n; i++) {
            if (seen++ % SHARDS !== shard) continue;
            await chips.nth(i).click();
            await exercise(page);
            ran++;
          }
        }
        if (shard === 0) expect(ran, 'o simulador precisa ter cenários prontos').toBeGreaterThan(0);
        expect(errors).toEqual([]);
      });
    }

    test('a página não rola e o diagrama rola por dentro', async ({ page }) => {
      const errors = watchErrors(page);
      for (const size of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
        await page.setViewportSize(size);
        await open(page, sim.id);
        const overflow = await page.evaluate(() => ({
          h: document.documentElement.scrollHeight - window.innerHeight,
          w: document.documentElement.scrollWidth - window.innerWidth,
        }));
        expect(overflow.h, `rolagem vertical da página em ${size.width}x${size.height}`).toBeLessThanOrEqual(1);
        expect(overflow.w, `rolagem horizontal da página em ${size.width}x${size.height}`).toBeLessThanOrEqual(1);
      }
      expect(errors).toEqual([]);
    });

    test('a topologia (quando existe) cabe no painel, anima e não gera erro', async ({ page }) => {
      const errors = watchErrors(page);
      for (const size of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
        await page.setViewportSize(size);
        await open(page, sim.id);
        const toggle = page.getByRole('button', { name: 'Topologia' });
        if (!(await toggle.count())) return;
        await toggle.click();
        const svg = page.locator('.simnet svg.topo');
        await expect(svg).toBeVisible();
        for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Passo' }).click();
        // a topologia inteira cabe no painel: nada de rolagem e o desenho dentro da área visível
        const fit = await page.evaluate(() => {
          const wrap = document.querySelector('.simnet .topo-wrap') as HTMLElement;
          const s = document.querySelector('.simnet svg.topo') as SVGElement;
          const a = wrap.getBoundingClientRect();
          const b = s.getBoundingClientRect();
          return { dx: wrap.scrollWidth - wrap.clientWidth, dy: wrap.scrollHeight - wrap.clientHeight, inside: b.top >= a.top - 1 && b.bottom <= a.bottom + 1 && b.left >= a.left - 1 && b.right <= a.right + 1 };
        });
        expect(fit.dx, `rolagem horizontal da topologia em ${size.width}x${size.height}`).toBeLessThanOrEqual(1);
        expect(fit.dy, `rolagem vertical da topologia em ${size.width}x${size.height}`).toBeLessThanOrEqual(1);
        expect(fit.inside).toBe(true);
        await page.getByRole('button', { name: 'Diagrama de sequência' }).click();
        await expect(page.locator('.simnet svg.ladder')).toBeVisible();
      }
      expect(errors).toEqual([]);
    });

    test('os painéis destacam e encaixam na posição de origem, e Esc encaixa', async ({ page }) => {
      const errors = watchErrors(page);
      await page.setViewportSize({ width: 1600, height: 900 });
      await open(page, sim.id);
      // o painel de estados começa dentro do palco: o botão o devolve ao painel lateral
      await page.getByRole('button', { name: 'Estados no diagrama' }).click();
      await expect(page.locator('.side-col > .fpanel')).toBeVisible();
      for (const sel of ['.stage-panel', '.tabs-panel', '.side-col > .fpanel', '.simnet .cfg']) {
        const el = page.locator(sel).first();
        const before = await el.boundingBox();
        // os outros painéis não se movem quando um é destacado
        const others = ['.stage-panel', '.tabs-panel', '.side-col > .fpanel', '.simnet .cfg'].filter((o) => o !== sel);
        const othersBefore = await Promise.all(others.map((o) => page.locator(o).first().boundingBox()));
        const toggle = el.getByRole('button', { name: /Destacar|Encaixar/ }).first();
        await toggle.click();
        await expect(el).toHaveClass(/is-floating/);
        const othersAfter = await Promise.all(others.map((o) => page.locator(o).first().boundingBox()));
        expect(othersAfter, `os outros painéis se moveram ao destacar ${sel}`).toEqual(othersBefore);
        await toggle.click();
        await expect(el).not.toHaveClass(/is-floating/);
        expect(await el.boundingBox(), `posição de ${sel} depois de encaixar`).toEqual(before);
      }
      // Esc encaixa o painel flutuante
      const stage = page.locator('.stage-panel');
      await stage.getByRole('button', { name: 'Destacar' }).click();
      await expect(stage).toHaveClass(/is-floating/);
      await page.keyboard.press('Escape');
      await expect(stage).not.toHaveClass(/is-floating/);
      expect(errors).toEqual([]);
    });
  });
}
