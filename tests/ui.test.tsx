// @vitest-environment jsdom
import axe from 'axe-core';
import { cleanup, render, screen } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App';
import { SIMS } from '../src/sims/registry';

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

// color-contrast depende de layout real e não é avaliável no jsdom; as cores foram escolhidas com contraste AA.
async function violations(container: HTMLElement) {
  // O conteúdo do iframe (simulador legado) é outro documento e é verificado à parte.
  const result = await axe.run({ include: [container], exclude: [['iframe']] }, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

describe('página inicial e categorias', () => {
  it('mostra título, subtítulo e um link para cada simulador disponível', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Simul-Net' })).toBeTruthy();
    expect(screen.getByText('Simuladores visuais de redes e protocolos seguros')).toBeTruthy();
    SIMS.filter((s) => s.status === 'available').forEach((s) => {
      expect(screen.getAllByRole('link', { name: new RegExp(`Abrir simulador\\s*: ${s.title.replace(/[()]/g, '\\$&')}$`) }).length).toBe(1);
    });
    expect(screen.getByText('Simuladores futuros')).toBeTruthy();
  });

  it('cada cartão de simulador disponível tem o link Documentação para a página interna; os futuros não', () => {
    renderAt('/');
    const available = SIMS.filter((s) => s.status === 'available');
    const links = screen.getAllByRole('link', { name: /^Documentação\s*:/ });
    expect(links.length).toBe(available.length);
    available.forEach((s) => {
      const link = links.find((l) => l.getAttribute('href') === `/sim/${s.id}/documentacao`);
      expect(link, s.id).toBeDefined();
      expect(link!.textContent).toContain(s.title);
    });
  });

  it('a página inicial não tem violações de acessibilidade', async () => {
    const { container } = renderAt('/');
    expect(await violations(container)).toEqual([]);
  });

  it('lista os simuladores de uma categoria', () => {
    renderAt('/categoria/protocolos-seguros');
    expect(screen.getByRole('heading', { level: 1, name: 'Protocolos de rede seguros' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'SSH' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'HTTPS e TLS' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'DNS e DNSSEC' })).toBeTruthy();
  });

  it('categoria inexistente mostra a página de erro', () => {
    renderAt('/categoria/nao-existe');
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeTruthy();
  });
});

describe('página de um simulador', () => {
  it('simulador em preparação não incorpora nada', () => {
    renderAt('/sim/vpn');
    expect(screen.getByText(/em preparação/)).toBeTruthy();
    expect(screen.queryByTitle(/Simulador:/)).toBeNull();
  });

  it('simulador inexistente mostra a página de erro', () => {
    renderAt('/sim/xyz');
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeTruthy();
  });
});
