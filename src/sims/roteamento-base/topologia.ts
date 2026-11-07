// Topologias e algoritmos de grafo compartilhados pelos simuladores de OSPF e de RIP.
// Rede de seis roteadores (área única) e rede de nove roteadores em três áreas (multiárea), cada uma com dois PCs.

export interface Router {
  id: string;
  /** Áreas OSPF do roteador (o ABR tem mais de uma). */
  areas: string[];
}

export interface RLink {
  id: string;
  a: string;
  b: string;
  cost: number;
  /** Área OSPF do enlace. */
  area: string;
}

export interface HostDef {
  id: string;
  attach: string;
}

export interface Topo {
  kind: 'single' | 'multi';
  routers: Router[];
  links: RLink[];
  hosts: HostDef[];
  /** Posição de cada nó no desenho (unidades do viewBox). */
  pos: Record<string, [number, number]>;
}

const r1 = (id: string, areas: string[] = ['0']): Router => ({ id, areas });
const l = (id: string, a: string, b: string, cost: number, area = '0'): RLink => ({ id, a, b, cost, area });

export const SINGLE: Topo = {
  kind: 'single',
  routers: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((id) => r1(id)),
  links: [l('L1', 'R1', 'R2', 10), l('L2', 'R1', 'R4', 20), l('L3', 'R2', 'R3', 10), l('L4', 'R2', 'R5', 15), l('L5', 'R3', 'R6', 10), l('L6', 'R4', 'R5', 10), l('L7', 'R5', 'R6', 20)],
  hosts: [{ id: 'PC-A', attach: 'R1' }, { id: 'PC-B', attach: 'R6' }],
  pos: { R1: [200, 120], R2: [450, 60], R3: [700, 120], R4: [250, 330], R5: [480, 380], R6: [720, 320], 'PC-A': [70, 120], 'PC-B': [840, 380] },
};

export const MULTI: Topo = {
  kind: 'multi',
  routers: [r1('R1', ['1']), r1('R2', ['1', '0']), r1('R3', ['1', '0']), r1('R4'), r1('R5'), r1('R6'), r1('R7', ['2']), r1('R8', ['2', '0']), r1('R9', ['2', '0'])],
  links: [
    l('MA1', 'R1', 'R2', 10, '1'), l('MA2', 'R1', 'R3', 15, '1'), l('MA3', 'R2', 'R3', 10, '1'),
    l('MA4', 'R4', 'R5', 10), l('MA5', 'R5', 'R6', 15), l('MA6', 'R4', 'R6', 20),
    l('MA7', 'R7', 'R8', 10, '2'), l('MA8', 'R7', 'R9', 15, '2'), l('MA9', 'R8', 'R9', 10, '2'),
    l('MA10', 'R2', 'R4', 25), l('MA11', 'R3', 'R6', 30), l('MA12', 'R4', 'R8', 20), l('MA13', 'R6', 'R9', 25),
  ],
  hosts: [{ id: 'PC-A', attach: 'R1' }, { id: 'PC-B', attach: 'R7' }],
  pos: { R1: [180, 230], R2: [340, 130], R3: [340, 330], R4: [520, 110], R5: [470, 230], R6: [520, 350], R7: [830, 230], R8: [690, 130], R9: [690, 330], 'PC-A': [60, 230], 'PC-B': [850, 380] },
};

/** Enlace com estado: cai e muda de custo sem alterar a topologia-base. */
export interface LiveLink extends RLink {
  up: boolean;
}

export function liveLinks(t: Topo, down: string[] = [], costs: Record<string, number> = {}): LiveLink[] {
  return t.links.map((x) => ({ ...x, cost: costs[x.id] ?? x.cost, up: down.indexOf(x.id) < 0 }));
}

export type Graph = Record<string, { to: string; cost: number }[]>;

/** Grafo dos enlaces ativos, opcionalmente restrito a uma área. */
export function buildGraph(t: Topo, links: LiveLink[], area?: string): Graph {
  const g: Graph = {};
  t.routers.forEach((r) => (g[r.id] = []));
  links.filter((x) => x.up && (area === undefined || x.area === area)).forEach((x) => {
    g[x.a].push({ to: x.b, cost: x.cost });
    g[x.b].push({ to: x.a, cost: x.cost });
  });
  return g;
}

export interface Spf {
  dist: Record<string, number>;
  prev: Record<string, string | null>;
  order: string[];
}

/** Dijkstra sobre um grafo. Desempata pela ordem dos roteadores, o que torna o resultado determinístico. */
export function dijkstra(ids: string[], graph: Graph, root: string): Spf {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const done = new Set<string>();
  const order: string[] = [];
  ids.forEach((id) => {
    dist[id] = Infinity;
    prev[id] = null;
  });
  dist[root] = 0;
  while (done.size < ids.length) {
    let u: string | null = null;
    let best = Infinity;
    ids.forEach((id) => {
      if (!done.has(id) && dist[id] < best) {
        best = dist[id];
        u = id;
      }
    });
    if (u === null) break;
    const cur: string = u;
    done.add(cur);
    order.push(cur);
    (graph[cur] || []).forEach((e) => {
      if (dist[cur] + e.cost < dist[e.to]) {
        dist[e.to] = dist[cur] + e.cost;
        prev[e.to] = cur;
      }
    });
  }
  return { dist, prev, order };
}

export function pathTo(prev: Record<string, string | null>, root: string, dest: string): string[] {
  const path: string[] = [];
  let cur: string | null | undefined = dest;
  while (cur !== null && cur !== undefined) {
    path.unshift(cur);
    if (cur === root) break;
    cur = prev[cur];
  }
  return path[0] === root ? path : [];
}

/** Menor número de saltos entre dois roteadores, ou null se não houver caminho. */
export function minHops(t: Topo, links: LiveLink[], a: string, b: string): number | null {
  const g = buildGraph(t, links);
  const seen = new Set([a]);
  let fr = [a];
  for (let d = 0; fr.length; d++) {
    if (fr.indexOf(b) >= 0) return d;
    const nx: string[] = [];
    fr.forEach((n) => g[n].forEach((e) => {
      if (!seen.has(e.to)) {
        seen.add(e.to);
        nx.push(e.to);
      }
    }));
    fr = nx;
  }
  return null;
}

export const routerIdOf = (id: string): string => '10.0.0.' + id.slice(1);

export const hostOf = (t: Topo, id: string): HostDef => t.hosts.find((h) => h.id === id)!;
export const otherHostOf = (t: Topo, id: string): HostDef => t.hosts.find((h) => h.id !== id)!;
export const linkOf = (links: LiveLink[], a: string, b: string): LiveLink | undefined => links.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
