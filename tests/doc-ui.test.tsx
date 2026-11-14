// @vitest-environment jsdom
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { withoutChartLegend } from '../src/docs/DocView';
import { headingsOf, slug } from '../src/docs/slug';
import { SIMS } from '../src/sims/registry';

// O jsdom não tem layout de SVG: o Mermaid real só roda no navegador. Aqui ele é simulado.
const render_ = vi.fn(async (id: string, code: string) => ({ svg: `<svg id="${id}" role="presentation"><text>${code.split('\n')[0]}</text></svg>` }));
const initialize = vi.fn();
vi.mock('mermaid', () => ({ default: { initialize: (...a: unknown[]) => initialize(...a), render: (id: string, code: string) => render_(id, code) } }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  render_.mockClear();
  initialize.mockClear();
});
afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MotionConfig reducedMotion="always">
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </MotionConfig>,
  );
}

const open = async (id = 'arp') => {
  renderAt(`/sim/${id}/documentacao`);
  return screen.findByRole('heading', { level: 1 }, { timeout: 15000 });
};

const mermaidBlocks = (id: string) => (readFileSync(`docs/simuladores/${id}.md`, 'utf8').match(/^```mermaid$/gm) ?? []).length;

describe('âncoras e índice (funções puras)', () => {
  it('slug segue o padrão do GitHub, igual ao do gerador', () => {
    expect(slug('3.1 Resolução')).toBe('31-resolução');
    expect(slug('Limitações do simulador')).toBe('limitações-do-simulador');
  });
  it('headingsOf ignora blocos de código', () => {
    const md = '# T\n## 1. A\n```text\n## fora\n```\n### 2.1 B';
    expect(headingsOf(md).map((h) => [h.level, h.id])).toEqual([[2, '1-a'], [3, '21-b']]);
  });
});

describe('página de documentação (Markdown e Mermaid)', () => {
  it('mostra o documento do simulador com o visual do site e os diagramas', async () => {
    const h1 = await open('arp');
    expect(h1.textContent).toBe('ARP');
    expect(screen.getByRole('link', { name: /Simul/ })).toBeTruthy(); // cabeçalho do site
    expect(screen.getByRole('link', { name: 'Abrir o simulador' }).getAttribute('href')).toBe('/sim/arp');
    const gh = screen.getByRole('link', { name: /Ver no GitHub/ });
    expect(gh.getAttribute('href')).toBe('https://github.com/peotta/Simul-Net/blob/main/docs/simuladores/arp.md');
    expect(gh.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('heading', { level: 2, name: '4. Topologia' })).toBeTruthy();
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    // todos os diagramas do documento (topologias e sequências) são desenhados
    const total = mermaidBlocks('arp');
    await waitFor(() => expect(document.querySelectorAll('figure svg')).toHaveLength(total), { timeout: 30000 });
    expect(screen.getAllByRole('img', { name: /Diagrama de topologia/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('img', { name: /Diagrama de sequência/ }).length).toBeGreaterThan(0);
    // o Mermaid usa as cores padrão (como no GitHub) e roda em modo estrito
    const cfg = initialize.mock.calls[0][0] as { securityLevel: string; theme: string };
    expect(cfg.securityLevel).toBe('strict');
    expect(['default', 'dark']).toContain(cfg.theme);
  }, 60000);

  it('o índice lateral leva ao título correspondente', async () => {
    await open('arp');
    const toc = screen.getByRole('navigation', { name: 'Nesta página' });
    fireEvent.click(within(toc).getByRole('link', { name: '5. Abas da bancada' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('5-abas-da-bancada');
  }, 40000);

  it('as âncoras do texto (lista de figuras) não trocam de página', async () => {
    await open('arp');
    fireEvent.click(screen.getByRole('link', { name: 'Figura 4.1' }));
    expect(document.activeElement?.id).toBe('41-resolução');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ARP');
  }, 40000);

  it('os links externos abrem em nova aba e nenhum link relativo aponta para .md', async () => {
    await open('https');
    for (const a of screen.getAllByRole('link')) {
      const href = a.getAttribute('href') ?? '';
      if (href.includes('rfc-editor.org')) {
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toContain('noopener');
      } else if (!/^https?:/.test(href)) {
        expect(href.endsWith('.md'), href).toBe(false);
      }
    }
    expect(screen.getAllByRole('link', { name: /RFC/ }).length).toBeGreaterThan(0);
  }, 40000);

  it('há documentação para todos os simuladores disponíveis, e um id inexistente cai na página 404', async () => {
    for (const sim of SIMS.filter((s) => s.status === 'available')) {
      renderAt(`/sim/${sim.id}/documentacao`);
      expect((await screen.findByRole('heading', { level: 1 }, { timeout: 15000 })).textContent, sim.id).toBeTruthy();
      cleanup();
    }
    renderAt('/sim/inexistente/documentacao');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeTruthy();
  }, 180000);

  it('o crédito do projeto aparece uma só vez (o do arquivo Markdown fica só no GitHub e na wiki)', async () => {
    await open('arp');
    const credits = screen.getAllByText(/é um projeto mantido pelo/);
    expect(credits).toHaveLength(1);
    expect(credits[0].closest('footer')).toBeTruthy();
  }, 40000);

  it('mostra o código quando o Mermaid falha', async () => {
    render_.mockRejectedValueOnce(new Error('falha'));
    await open('arp');
    expect((await screen.findAllByText(/Não foi possível desenhar o diagrama/, undefined, { timeout: 10000 })).length).toBe(1);
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    await open('arp');
    await waitFor(() => expect(document.querySelectorAll('figure svg')).toHaveLength(mermaidBlocks('arp')), { timeout: 30000 });
    const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  }, 90000);
});

describe('legenda dos gráficos', () => {
  const grafico = '```mermaid\n%%{init: {}}%%\n%% legenda: A | B\nxychart-beta\n```';
  it('o site oculta a legenda em texto de um gráfico com legenda própria; o Markdown a mantém', () => {
    expect(withoutChartLegend('Antes\n\n**Legenda:** 🟥 A · 🟦 B\n\n' + grafico + '\n')).toBe('Antes\n\n' + grafico + '\n');
  });
  it('não mexe em uma legenda que não antecede um gráfico com legenda própria', () => {
    const md = '**Legenda:** tracejado\n\n```mermaid\nflowchart LR\n  A --> B\n```\n';
    expect(withoutChartLegend(md)).toBe(md);
  });
});
