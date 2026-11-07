// Modelo do RIPv2 (RFC 2453): vetores de distância, rodadas de Response (Bellman-Ford), split horizon com poison reverse e
// falha com contagem ao infinito. Funções puras. O RIP usa só o número de saltos: o custo dos enlaces é ignorado.
// Simplificações: rodadas síncronas (em vez de temporizadores de 30 s por roteador), um destino por roteador (o Router ID)
// e nenhuma temporização de timeout e de garbage collection.
import { buildGraph, type LiveLink, type Topo } from '../roteamento-base/topologia';

/** Métrica 16 significa inalcançável (RFC 2453, seção 3.1). */
export const INF = 16;

export interface Entry {
  metric: number;
  next: string | null;
}
export type Tables = Record<string, Map<string, Entry>>;

export const initTables = (t: Topo): Tables => {
  const out: Tables = {};
  t.routers.forEach((r) => (out[r.id] = new Map([[r.id, { metric: 0, next: null }]])));
  return out;
};

export const cloneTables = (tb: Tables): Tables => {
  const out: Tables = {};
  Object.keys(tb).forEach((k) => (out[k] = new Map(Array.from(tb[k].entries()).map(([d, e]) => [d, { ...e }]))));
  return out;
};

/** Vetor que o roteador anuncia a um vizinho. Com split horizon (poison reverse), rotas aprendidas desse vizinho vão com métrica 16. */
export function advertise(table: Map<string, Entry>, toward: string, sh: boolean): Map<string, number> {
  const vec = new Map<string, number>();
  table.forEach((e, dest) => vec.set(dest, sh && e.next === toward ? INF : e.metric));
  return vec;
}

export interface Round {
  next: Tables;
  changed: boolean;
  touched: string[];
}

/** Uma rodada: todos recebem, ao mesmo tempo, o vetor de cada vizinho (calculado sobre a tabela do início da rodada). */
export function ripRound(t: Topo, links: LiveLink[], tables: Tables, sh: boolean): Round {
  const g = buildGraph(t, links);
  const next = cloneTables(tables);
  const touched = new Set<string>();
  t.routers.forEach((r) => {
    (g[r.id] || []).forEach((edge) => {
      const nb = edge.to;
      advertise(tables[nb], r.id, sh).forEach((m, dest) => {
        const cand = Math.min(INF, m + 1);
        const cur = next[r.id].get(dest);
        if (!cur || cand < cur.metric || cur.next === nb) {
          const novo: Entry = cand >= INF ? { metric: INF, next: null } : { metric: cand, next: nb };
          if (!cur || cur.metric !== novo.metric || cur.next !== novo.next) {
            next[r.id].set(dest, novo);
            touched.add(r.id);
          }
        }
      });
    });
  });
  return { next, changed: touched.size > 0, touched: Array.from(touched) };
}

/** Roda rodadas, sem registro, até estabilizar (ou até o limite). */
export function converge(t: Topo, links: LiveLink[], tables: Tables, sh: boolean, cap = 25): { tables: Tables; rounds: number } {
  let cur = tables;
  let n = 0;
  while (n < cap) {
    const r = ripRound(t, links, cur, sh);
    if (!r.changed) break;
    cur = r.next;
    n++;
  }
  return { tables: cur, rounds: n };
}

/** Na queda de um enlace, cada ponta marca com métrica 16 as rotas que usavam o vizinho do outro lado. */
export function poisonLink(tables: Tables, l: { a: string; b: string }): void {
  [[l.a, l.b], [l.b, l.a]].forEach(([me, other]) => tables[me].forEach((e, d) => {
    if (e.next === other) tables[me].set(d, { metric: INF, next: null });
  }));
}

export function ripPath(tables: Tables, src: string, dst: string): { path: string[]; reached: boolean; metric: number | null } {
  const path = [src];
  let cur = src;
  const seen = new Set([src]);
  while (cur !== dst) {
    const e = tables[cur].get(dst);
    if (!e || e.metric >= INF || !e.next) return { path, reached: false, metric: null };
    cur = e.next;
    if (seen.has(cur) || path.length > 20) return { path, reached: false, metric: null };
    seen.add(cur);
    path.push(cur);
  }
  return { path, reached: true, metric: tables[src].get(dst)!.metric };
}

export type Plain = Record<string, Record<string, Entry>>;
export const plain = (tb: Tables): Plain => {
  const out: Plain = {};
  Object.keys(tb).forEach((k) => {
    out[k] = {};
    Array.from(tb[k].keys()).sort().forEach((d) => (out[k][d] = { ...tb[k].get(d)! }));
  });
  return out;
};
