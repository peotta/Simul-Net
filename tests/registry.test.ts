import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, DOCS_BASE, SIMS, docUrl } from '../src/sims/registry';

const root = join(__dirname, '..');
// Travessão longo e meia-risca (escritos por código para o próprio arquivo não conter os caracteres).
const FORBIDDEN_DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

describe('registro de simuladores', () => {
  it('tem identificadores únicos em kebab-case', () => {
    const ids = SIMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it('todo simulador disponível tem o documento em docs/simuladores, apontado por docUrl', () => {
    SIMS.filter((s) => s.status === 'available').forEach((s) => {
      expect(existsSync(join(root, 'docs', 'simuladores', s.id + '.md')), s.id + ': documento ausente (npm run docs:simuladores)').toBe(true);
      expect(docUrl(s)).toBe(DOCS_BASE + s.id + '.md');
    });
  });

  it('nos documentos de docs/simuladores, toda RFC e todo BCP citados são links', () => {
    const dir = join(root, 'docs', 'simuladores');
    readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .forEach((f) => {
        // Fora de blocos de código, código em linha e links já formados, não pode sobrar citação sem link.
        const text = readFileSync(join(dir, f), 'utf8')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/`[^`\n]*`/g, '')
          .replace(/\[[^\]\n]*\]\([^)\n]*\)/g, '');
        const bare = text.match(/\b(RFC|BCP) \d+\b/g) ?? [];
        expect(bare, `${f}: citações sem link (rode npm run docs:simuladores)`).toEqual([]);
      });
  });

  it('todo simulador disponível cita pelo menos uma RFC ou padrão', () => {
    SIMS.filter((s) => s.status === 'available').forEach((s) => {
      expect(s.rfcs.length, `${s.id}: sem RFC ou padrão em rfcs`).toBeGreaterThan(0);
    });
  });

  it('usa somente categorias existentes', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    SIMS.forEach((s) => expect(cats.has(s.category)).toBe(true));
    CATEGORIES.forEach((c) => expect(SIMS.some((s) => s.category === c.id)).toBe(true));
  });

  it('simuladores disponíveis têm arquivo, motor e não repetem arquivos', () => {
    const files: string[] = [];
    SIMS.filter((s) => s.status === 'available').forEach((s) => {
      expect(s.engine, s.id).toBeDefined();
      if (s.engine === 'legado') {
        expect(s.file, s.id).toMatch(/^[a-z0-9-]+\.html$/);
        expect(existsSync(join(root, 'public', 'sims', s.file!)), `${s.id}: arquivo ausente`).toBe(true);
        files.push(s.file!);
      }
    });
    expect(new Set(files).size).toBe(files.length);
  });

  it('simuladores em preparação não apontam para arquivos', () => {
    SIMS.filter((s) => s.status === 'planned').forEach((s) => {
      expect(s.file).toBeUndefined();
      expect(s.engine).toBeUndefined();
    });
  });

  it('marca "novo" em no máximo 3 simuladores, todos disponíveis', () => {
    const novos = SIMS.filter((s) => s.novo);
    expect(novos.length).toBeLessThanOrEqual(3);
    novos.forEach((s) => expect(s.status, s.id).toBe('available'));
  });

  it('não usa travessão longo nem meia-risca nos textos', () => {
    expect(FORBIDDEN_DASHES.test(JSON.stringify({ CATEGORIES, SIMS }))).toBe(false);
  });
});

describe('simuladores legados em public/sims', () => {
  const files = SIMS.filter((s) => s.file).map((s) => s.file!);
  it.each(files)('%s tem título, descrição, canônica, rodapé de crédito e volta ao Simul-Net', (file) => {
    const html = readFileSync(join(root, 'public', 'sims', file), 'utf-8');
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{40,}/);
    expect(html).toContain(`https://peotta.github.io/Simul-Net/sims/${file}`);
    expect(html).toContain('Prof. Dr. Laerte Peotta de Melo');
    expect(html).toContain('Uso exclusivo para fins de ensino e pesquisa.');
    expect(html).toContain('href="../#/" target="_top"');
    expect(FORBIDDEN_DASHES.test(html)).toBe(false);
  });

  it.each(files.filter((f) => f !== 'tcp-udp-simulator.html'))('%s usa a bancada de trabalho compartilhada', (file) => {
    const html = readFileSync(join(root, 'public', 'sims', file), 'utf-8');
    expect(html).toContain('href="bench/bench.css"');
    expect(html).toContain('src="bench/bench.js"');
  });

  it.each(['bench/bench.css', 'bench/bench.js'])('%s existe e não tem travessões', (name) => {
    const path = join(root, 'public', 'sims', name);
    expect(existsSync(path)).toBe(true);
    expect(FORBIDDEN_DASHES.test(readFileSync(path, 'utf-8'))).toBe(false);
  });
});
