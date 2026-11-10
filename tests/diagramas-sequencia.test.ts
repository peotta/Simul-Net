// Todo diagrama de sequência deve numerar as interações em ordem (`autonumber`), nas fontes e nos documentos gerados.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

/** Arquivos .ts de conteúdo (src/sims/<id>/content) e .md gerados (docs/simuladores). */
function arquivos(): string[] {
  const out: string[] = [];
  const sims = path.join(root, 'src', 'sims');
  for (const id of fs.readdirSync(sims)) {
    const dir = path.join(sims, id, 'content');
    if (fs.existsSync(dir)) out.push(...fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => path.join(dir, f)));
  }
  const docs = path.join(root, 'docs', 'simuladores');
  out.push(...fs.readdirSync(docs).filter((f) => f.endsWith('.md')).map((f) => path.join(docs, f)));
  return out;
}

/** Linhas `sequenceDiagram` cuja linha seguinte não é `autonumber` (blocos Mermaid em Markdown ou em template string). */
function semNumeracao(texto: string): number[] {
  const linhas = texto.split(/\r?\n/);
  const falhas: number[] = [];
  linhas.forEach((l, i) => {
    if (l.trim() === 'sequenceDiagram' && (linhas[i + 1] ?? '').trim() !== 'autonumber') falhas.push(i + 1);
  });
  return falhas;
}

describe('diagramas de sequência', () => {
  it.each(arquivos().map((f) => [path.relative(root, f).split(path.sep).join('/'), f]))('%s: toda sequência usa autonumber', (_n, f) => {
    expect(semNumeracao(fs.readFileSync(f, 'utf8'))).toEqual([]);
  });
});
