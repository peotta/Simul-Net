// Abas próprias do simulador de RIP: tabela de roteamento e vetores anunciados, ambos acompanhando o relógio.
import { esc, type Trace } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import type { LiveLink } from '../../roteamento-base/topologia';
import { INF, type Entry } from '../model';
import type { Snap } from '../modes';

const td = (cells: string[]): string => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
const m = (t: string): string => '<span class="meaning">' + t + '</span>';
const mt = (n: number): string => (n >= INF ? '16 (∞)' : String(n));

/** A última foto das tabelas cujo instante já passou. */
function snapAt(tr: Trace, now: number): { snap: Snap; index: number } {
  const snaps = tr.raw.snaps as Snap[];
  let index = 0;
  snaps.forEach((s, i) => {
    if (s.t <= now + 1e-9) index = i;
  });
  return { snap: snaps[index], index };
}

const tabela: TabDef = {
  id: 'tabela',
  label: 'Tabela de roteamento',
  render: (tr, ctx) => {
    const root = String(ctx.P.root || 'R1');
    const { snap } = snapAt(tr, ctx.timeAt(ctx.c));
    const rows = Object.keys(snap.tables[root] || {}).map((d) => [d, snap.tables[root][d]] as [string, Entry]);
    let h = '<h3>Tabela de roteamento de ' + esc(root) + '</h3><p>Instante: ' + esc(snap.label) + '.</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Destino</th><th>Métrica (saltos)</th><th>Próximo salto</th></tr></thead><tbody>';
    rows.forEach(([d, e]) => {
      h += td([esc(d + ' (10.0.0.' + d.slice(1) + ')'), m(d === root ? '0' : mt(e.metric)), m(d === root ? 'Local' : e.next || (e.metric >= INF ? 'inalcançável' : '-'))]);
    });
    h += '</tbody></table><p>Uma rota com métrica 16 é inalcançável: o roteador a mantém na tabela e a anuncia como tal por um tempo, para que os vizinhos também a descartem.</p>';
    return h;
  },
};

const vetores: TabDef = {
  id: 'vetores',
  label: 'Vetores',
  render: (tr, ctx) => {
    const root = String(ctx.P.root || 'R1');
    const { snap, index } = snapAt(tr, ctx.timeAt(ctx.c));
    const sh = Boolean(tr.raw.sh);
    const links = ((index === 0 && tr.raw.linksBefore) || tr.raw.links) as LiveLink[];
    const tb = snap.tables[root] || {};
    const neighbors = links.filter((l) => l.up && (l.a === root || l.b === root)).map((l) => (l.a === root ? l.b : l.a));
    let h = '<h3>Vetor que ' + esc(root) + ' anuncia a cada vizinho' + (sh ? ' (split horizon com poison reverse)' : ' (sem split horizon)') + '</h3><p>Instante: ' + esc(snap.label) + '.</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Vizinho</th><th>Rotas</th><th>Destino: métrica</th></tr></thead><tbody>';
    if (!neighbors.length) h += '<tr><td colspan="3" class="meaning">O roteador não tem nenhum vizinho ativo: não anuncia nada.</td></tr>';
    neighbors.forEach((n) => {
      const parts = Object.keys(tb).map((d) => d + ': ' + (sh && tb[d].next === n ? 16 : tb[d].metric)).map((x) => (x.endsWith(': 16') ? '<b>' + x + '</b>' : x));
      h += td([esc(n), String(parts.length), m(parts.join(', '))]);
    });
    h += '</tbody></table><p>' + (sh ? 'Em negrito, as rotas devolvidas com 16 ao vizinho de quem foram aprendidas (poison reverse).' : 'Sem split horizon, o vetor é o mesmo para todos os vizinhos.') + ' O vizinho soma 1 a cada métrica recebida.</p>';
    return h;
  },
};

export const tabs: TabDef[] = [tabela, vetores];
