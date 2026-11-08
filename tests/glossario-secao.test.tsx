// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { DocView } from '../src/docs/DocView';
import { comSecaoDeSiglas } from '../src/docs/glossario';

const RODAPE = '\n\n---\n\n*Simul-Net é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo.*\n';

describe('seção de siglas do documento', () => {
  afterEach(cleanup);

  it('não altera o texto corrido e acrescenta a seção antes do rodapé', () => {
    const base = '# Doc\n\n## 1. Visão\n\nO ACK confirma o recebimento. Usa `SYN` em código.' + RODAPE;
    const out = comSecaoDeSiglas(base, 'tcp');
    expect(out.startsWith('# Doc\n\n## 1. Visão\n\nO ACK confirma o recebimento. Usa `SYN` em código.')).toBe(true);
    expect(out).toContain('## 2. Glossário');
    expect(out).toMatch(/\| \*\*ACK\*\* \| Acknowledgment, confirmação \|/);
    expect(out.endsWith(RODAPE)).toBe(true);
  });

  it('usa o sentido do simulador e não cria seção sem siglas', () => {
    expect(comSecaoDeSiglas('## 1. A\n\nO DS aponta.' + RODAPE, 'dns')).toContain('Delegation Signer');
    expect(comSecaoDeSiglas('## 1. A\n\nO DS aponta.' + RODAPE, 'wifi')).toContain('Distribution System');
    expect(comSecaoDeSiglas('## 1. A\n\nSó texto comum.' + RODAPE, 'dns')).not.toContain('Glossário');
  });

  it('a página avisa que existe a seção quando o documento a tem', () => {
    const md = comSecaoDeSiglas('## 1. A\n\nO ACK confirma.' + RODAPE, 'tcp');
    render(
      <MemoryRouter>
        <DocView markdown={md} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('note').textContent).toContain('Dúvida sobre uma sigla?');
    expect(screen.getByRole('button', { name: '2. Glossário' })).toBeTruthy();
  });

  it('a página não mostra o aviso quando não há seção', () => {
    render(
      <MemoryRouter>
        <DocView markdown={'## 1. A\n\nTexto.'} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('note')).toBeNull();
  });
});
