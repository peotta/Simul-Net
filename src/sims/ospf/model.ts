// Modelo do OSPFv2 (RFC 2328): Router-LSAs por área, inundação em rodadas, Summary LSAs (tipo 3) dos ABRs e tabela de rotas
// com rotas intra-área e inter-área. Tudo é função pura: o mesmo parâmetro produz o mesmo resultado.
// Simplificações: enlaces ponto a ponto (sem DR e BDR), um destino por roteador (o Router ID), custo fixo por enlace,
// Summary LSAs calculados sobre a topologia verdadeira (idêntica à que a LSDB teria depois de convergir) e sem LSAck na inundação.
import { buildGraph, dijkstra, linkOf, pathTo, type LiveLink, type Topo } from '../roteamento-base/topologia';

export interface Item {
  key: string;
  kind: 'router' | 'summary';
  /** Roteador que originou o LSA. */
  owner: string;
  area: string;
  seq: number;
  /** Router-LSA: enlaces anunciados. */
  links?: { to: string; cost: number }[];
  /** Summary LSA: destino e custo anunciado pelo ABR. */
  dest?: string;
  cost?: number;
}

export type Lsdb = Record<string, Map<string, Item>>;

export interface Send {
  from: string;
  to: string;
  area: string;
  keys: string[];
}

export const newLsdb = (t: Topo): Lsdb => {
  const db: Lsdb = {};
  t.routers.forEach((r) => (db[r.id] = new Map()));
  return db;
};

export const isAbr = (t: Topo, id: string): boolean => t.routers.find((r) => r.id === id)!.areas.length > 1;
export const areasOf = (t: Topo, id: string): string[] => t.routers.find((r) => r.id === id)!.areas;
export const allAreas = (t: Topo): string[] => Array.from(new Set(t.routers.flatMap((r) => r.areas))).sort();
export const inArea = (t: Topo, area: string): string[] => t.routers.filter((r) => r.areas.indexOf(area) >= 0).map((r) => r.id);

/** Um Router-LSA por roteador e por área, com os enlaces ativos daquela área. */
export function routerItems(t: Topo, links: LiveLink[], seqs: Record<string, number> = {}): Item[] {
  const out: Item[] = [];
  t.routers.forEach((r) => r.areas.forEach((a) => {
    const key = r.id + '@' + a;
    const mine = links.filter((x) => x.up && x.area === a && (x.a === r.id || x.b === r.id)).map((x) => ({ to: x.a === r.id ? x.b : x.a, cost: x.cost }));
    out.push({ key, kind: 'router', owner: r.id, area: a, seq: seqs[key] ?? 1, links: mine });
  }));
  return out;
}

/**
 * Inunda os itens de uma área em rodadas síncronas: a cada rodada, cada roteador envia ao vizinho (por enlace ativo da área) os LSAs
 * que ele tem e o vizinho não tem (ou tem com número de sequência menor). Um envio leva todos esses LSAs num único LSU.
 * Altera a LSDB e devolve as rodadas.
 */
export function floodRounds(_t: Topo, links: LiveLink[], lsdb: Lsdb, area: string): Send[][] {
  const rounds: Send[][] = [];
  const ups = links.filter((x) => x.up && x.area === area);
  for (let k = 0; k < 30; k++) {
    const sends: Send[] = [];
    const apply: { to: string; item: Item }[] = [];
    ups.forEach((x) => {
      [[x.a, x.b], [x.b, x.a]].forEach(([u, v]) => {
        const keys: string[] = [];
        lsdb[u].forEach((it, key) => {
          if (it.area !== area) return;
          const cur = lsdb[v].get(key);
          if (!cur || cur.seq < it.seq) {
            keys.push(key);
            apply.push({ to: v, item: it });
          }
        });
        if (keys.length) sends.push({ from: u, to: v, area, keys });
      });
    });
    if (!sends.length) break;
    apply.forEach((a) => lsdb[a.to].set(a.item.key, a.item));
    rounds.push(sends);
  }
  return rounds;
}

/** LSDB de todos os roteadores depois da inundação completa (usada como ponto de partida dos eventos). */
export function convergedLsdb(t: Topo, links: LiveLink[]): Lsdb {
  const db = newLsdb(t);
  routerItems(t, links).forEach((it) => db[it.owner].set(it.key, it));
  allAreas(t).forEach((a) => floodRounds(t, links, db, a));
  return db;
}

// ---- SPF e tabela de rotas ----

const areaSpf = (t: Topo, links: LiveLink[], area: string, from: string) => dijkstra(inArea(t, area), buildGraph(t, links, area), from);

export interface Row {
  dest: string;
  cost: number | null;
  next: string | null;
  kind: 'local' | 'intra' | 'inter' | 'none';
  /** Inter-área: o ABR pelo qual a rota é aprendida. */
  via?: string;
}

/** Custo e roteador de saída (ABR de destino) de b até d, por rota intra-área ou pelo backbone. */
function costFromAbr(t: Topo, links: LiveLink[], b: string, d: string): { cost: number; exit: string | null } {
  const common = areasOf(t, b).filter((a) => areasOf(t, d).indexOf(a) >= 0);
  if (common.length) {
    let best = Infinity;
    common.forEach((a) => (best = Math.min(best, areaSpf(t, links, a, b).dist[d])));
    return { cost: best, exit: null };
  }
  let best = Infinity;
  let exit: string | null = null;
  if (areasOf(t, b).indexOf('0') >= 0) {
    t.routers.forEach((c) => {
      if (c.id === b || c.areas.indexOf('0') < 0) return;
      const ca = c.areas.filter((a) => a !== '0' && areasOf(t, d).indexOf(a) >= 0);
      ca.forEach((a) => {
        const v = areaSpf(t, links, '0', b).dist[c.id] + areaSpf(t, links, a, c.id).dist[d];
        if (v < best) {
          best = v;
          exit = c.id;
        }
      });
    });
  }
  return { cost: best, exit };
}

/** Primeiro salto do caminho de menor custo de from até to dentro de uma área. */
function firstHop(t: Topo, links: LiveLink[], area: string, from: string, to: string): string | null {
  const s = areaSpf(t, links, area, from);
  const p = pathTo(s.prev, from, to);
  return p.length > 1 ? p[1] : null;
}

export function routeTable(t: Topo, links: LiveLink[], root: string): Row[] {
  const rows: Row[] = [];
  const myAreas = areasOf(t, root);
  t.routers.forEach((rt) => {
    const d = rt.id;
    if (d === root) {
      rows.push({ dest: d, cost: 0, next: 'Local', kind: 'local' });
      return;
    }
    const common = myAreas.filter((a) => rt.areas.indexOf(a) >= 0);
    let best = Infinity;
    let next: string | null = null;
    let via: string | undefined;
    if (common.length) {
      common.forEach((a) => {
        const s = areaSpf(t, links, a, root);
        if (s.dist[d] < best) {
          best = s.dist[d];
          next = firstHop(t, links, a, root, d);
        }
      });
      rows.push(best === Infinity ? { dest: d, cost: null, next: null, kind: 'none' } : { dest: d, cost: best, next, kind: 'intra' });
      return;
    }
    if (isAbr(t, root)) {
      const c = costFromAbr(t, links, root, d);
      if (c.exit) {
        best = c.cost;
        via = c.exit;
        next = firstHop(t, links, '0', root, c.exit);
      }
    } else {
      const a = myAreas[0];
      t.routers.filter((b) => b.areas.indexOf(a) >= 0 && b.areas.length > 1).forEach((b) => {
        const toB = areaSpf(t, links, a, root).dist[b.id];
        const fromB = costFromAbr(t, links, b.id, d).cost;
        if (toB + fromB < best) {
          best = toB + fromB;
          via = b.id;
          next = firstHop(t, links, a, root, b.id);
        }
      });
    }
    rows.push(best === Infinity || !next ? { dest: d, cost: null, next: null, kind: 'none' } : { dest: d, cost: best, next, kind: 'inter', via });
  });
  return rows;
}

/** Caminho hop a hop seguindo a tabela de cada roteador (como o encaminhamento real). */
export function forwardPath(t: Topo, links: LiveLink[], src: string, dst: string): { path: string[]; reached: boolean; cost: number | null } {
  const path = [src];
  let cur = src;
  for (let g = 0; cur !== dst && g < 24; g++) {
    const row = routeTable(t, links, cur).find((r) => r.dest === dst);
    if (!row || !row.next || row.next === 'Local' || row.cost === null) return { path, reached: false, cost: null };
    cur = row.next;
    path.push(cur);
  }
  if (cur !== dst) return { path, reached: false, cost: null };
  const first = routeTable(t, links, src).find((r) => r.dest === dst)!;
  return { path, reached: true, cost: first.cost };
}

/** Summary LSAs (tipo 3) que cada ABR origina em cada uma das suas áreas. */
export function summaryItems(t: Topo, links: LiveLink[]): Item[] {
  const out: Item[] = [];
  t.routers.filter((b) => b.areas.length > 1).forEach((b) => b.areas.forEach((x) => {
    t.routers.forEach((d) => {
      if (d.id === b.id || d.areas.indexOf(x) >= 0) return;
      if (x === '0') {
        // no backbone, o ABR só resume as áreas comuns (não backbone) dele
        if (d.areas.indexOf('0') >= 0 || !b.areas.some((a) => a !== '0' && d.areas.indexOf(a) >= 0)) return;
      }
      const c = costFromAbr(t, links, b.id, d.id);
      if (c.cost === Infinity) return;
      out.push({ key: 'S:' + b.id + ':' + d.id, kind: 'summary', owner: b.id, area: x, seq: 1, dest: d.id, cost: c.cost });
    });
  }));
  return out;
}

export const linkName = (links: LiveLink[], a: string, b: string): string => linkOf(links, a, b)?.id || a + '-' + b;
