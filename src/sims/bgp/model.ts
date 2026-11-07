// Modelo do BGP: seis sistemas autônomos, sessões, RIB de entrada, processo de decisão, exportação valley-free
// e as defesas de importação. Funções puras sobre um objeto de estado (Net), sem tocar na tela.

export interface As {
  id: string;
  asn: number;
  name: string;
  rid: string;
  x: number;
  y: number;
  prefix: string | null;
  host?: string;
}

export type Rel = 'cp' | 'peer';
export type Attack = 'none' | 'hijack' | 'route-leak' | 'route-flap';

export interface Link {
  id: string;
  a: string;
  b: string;
  /** 'cp': a é provedor de b; 'peer': peering. */
  rel: Rel;
  ipA: string;
  ipB: string;
  up: boolean;
  silent: boolean;
  state: string;
  sent: Record<string, number>;
  upSince: number;
}

export interface Route {
  path: number[];
  nh: string;
  damped?: boolean;
}

export interface Policy {
  lpA: number;
  prependB: number;
  announce: boolean;
}

export interface Defense {
  rov: string;
  cust: string;
  peer: string;
  damp: boolean;
  relLP: boolean;
}

export interface Reject {
  by: 'rov' | 'cust' | 'peer' | 'damp';
  why: string;
}

export interface Cand {
  local: boolean;
  path: number[];
  nh: string;
  lp: number;
  from: string | null;
  damped?: boolean;
  rej?: Reject | null;
  best?: boolean;
  reason?: string;
}

export interface Net {
  links: Link[];
  ribIn: Record<string, Record<string, Record<string, Route>>>;
  advOut: Record<string, Record<string, Record<string, string>>>;
  flaps: Record<string, number>;
  suppressed: Record<string, boolean>;
  policy: Policy;
  attack: Attack;
  defense: Defense;
  /** Relógio simulado, em segundos (hold timer, tempo de sessão). */
  clock: number;
}

export const HOLD = 180;
export const KEEPALIVE = 60;

export const ASES: Record<string, As> = {
  T: { id: 'T', asn: 64496, name: 'Trânsito', rid: '10.0.0.1', x: 400, y: 55, prefix: null },
  A: { id: 'A', asn: 64500, name: 'ISP A', rid: '10.0.0.2', x: 105, y: 175, prefix: null },
  B: { id: 'B', asn: 64501, name: 'ISP B', rid: '10.0.0.3', x: 655, y: 175, prefix: null },
  C: { id: 'C', asn: 64510, name: 'Cliente', rid: '10.0.0.10', x: 385, y: 295, prefix: '203.0.113.0/24', host: '203.0.113.10' },
  D: { id: 'D', asn: 64511, name: 'Conteúdo', rid: '10.0.0.11', x: 880, y: 55, prefix: '198.51.100.0/24', host: '198.51.100.10' },
  M: { id: 'M', asn: 64666, name: 'Atacante', rid: '10.0.0.4', x: 880, y: 295, prefix: null },
};
export const AS_ORDER = ['T', 'A', 'B', 'C', 'D', 'M'];
/** Ordem das colunas do diagrama: a vizinhança dos AS fica próxima. */
export const COL_ORDER = ['C', 'A', 'T', 'B', 'D', 'M'];
export const PREFIX_HOLDER: Record<string, number> = { '198.51.100.0/24': 64511, '203.0.113.0/24': 64510 };
export const PREFIXES = ['198.51.100.0/24', '203.0.113.0/24'];
export const VICTIM = '203.0.113.0/24';
export const LEAKED = '198.51.100.0/24';
// [id, a, b, relação]
export const LINKS_INIT: [string, string, string, Rel][] = [
  ['L1', 'T', 'A', 'cp'], ['L2', 'T', 'B', 'cp'], ['L3', 'A', 'B', 'peer'], ['L4', 'A', 'C', 'cp'],
  ['L5', 'B', 'C', 'cp'], ['L6', 'T', 'D', 'cp'], ['L7', 'B', 'D', 'peer'], ['L8', 'B', 'M', 'cp'],
];

export const ROV_SCOPE: Record<string, string[]> = { off: [], B: ['B'], A: ['A'], ABT: ['A', 'B', 'T'], ALL: ['A', 'B', 'T', 'D'] };
export const CUST_SCOPE: Record<string, string[]> = { off: [], B: ['B'], T: ['T'], ALL: ['A', 'B', 'T'] };
export const PEER_SCOPE: Record<string, string[]> = { off: [], A: ['A'], ALL: ['A', 'B', 'D'] };
export const DAMP_SCOPE = ['T', 'A', 'B', 'D'];
export const DEF_NAMES: Record<string, Record<string, string>> = {
  rov: { off: 'desligado', B: 'só no ISP B', A: 'só no ISP A', ABT: 'ISP A, ISP B e Trânsito', ALL: 'todos os AS' },
  cust: { off: 'desligado', B: 'no ISP B', T: 'no Trânsito', ALL: 'ISP A, ISP B e Trânsito' },
  peer: { off: 'desligado', A: 'no ISP A', ALL: 'ISP A, ISP B e Conteúdo' },
};
export const DEF_BY: Record<string, string> = { rov: 'RPKI / ROV', cust: 'filtro de prefixos de clientes', peer: 'filtro de rotas de peers', damp: 'flap damping' };
export const REL_TXT: Record<string, string> = { customer: 'cliente', provider: 'provedor', peer: 'peer' };
export const WIN_TXT: Record<string, string> = {
  LOCAL_PREF: 'LOCAL_PREF maior', 'origem local': 'originada localmente', AS_PATH: 'AS_PATH mais curto', 'router ID': 'menor router ID do vizinho', único: 'único caminho',
};
export const LOSE_TXT: Record<string, string> = {
  rejeitada: 'rejeitada pela política de importação', LOCAL_PREF: 'LOCAL_PREF menor', 'origem local': 'a rota local tem prioridade', AS_PATH: 'AS_PATH mais longo', 'router ID': 'router ID do vizinho maior',
};

export function newNet(policy: Policy, attack: Attack, defense: Defense): Net {
  const ribIn: Net['ribIn'] = {};
  const advOut: Net['advOut'] = {};
  AS_ORDER.forEach((x) => {
    ribIn[x] = {};
    advOut[x] = {};
    AS_ORDER.forEach((y) => {
      ribIn[x][y] = {};
      advOut[x][y] = {};
    });
  });
  return {
    links: LINKS_INIT.map((d, i) => ({ id: d[0], a: d[1], b: d[2], rel: d[3], ipA: '172.16.' + (i + 1) + '.1', ipB: '172.16.' + (i + 1) + '.2', up: true, silent: false, state: 'Idle', sent: {}, upSince: 0 })),
    ribIn,
    advOut,
    flaps: {},
    suppressed: {},
    policy: { ...policy },
    attack,
    defense: { ...defense },
    clock: 0,
  };
}

export const asName = (id: string): string => ASES[id].name + ' (AS' + ASES[id].asn + ')';
export const linkBetween = (n: Net, x: string, y: string): Link => n.links.find((l) => (l.a === x && l.b === y) || (l.a === y && l.b === x))!;
export const other = (l: Link, x: string): string => (l.a === x ? l.b : l.a);
export const ipOn = (l: Link, x: string): string => (l.a === x ? l.ipA : l.ipB);
export function relOf(n: Net, x: string, y: string): 'customer' | 'provider' | 'peer' {
  const l = linkBetween(n, x, y);
  if (l.rel === 'peer') return 'peer';
  return l.a === x ? 'customer' : 'provider';
}
export const established = (l: Link): boolean => l.up && !l.silent && l.state === 'Established';
export const neighbors = (n: Net, x: string): { id: string; link: Link }[] => n.links.filter((l) => l.a === x || l.b === x).map((l) => ({ id: other(l, x), link: l }));
export const prefixOf = (ip: string): string | undefined => PREFIXES.find((p) => ip.split('.').slice(0, 3).join('.') === p.split('.').slice(0, 3).join('.'));
export const ipNum = (ip: string): number => ip.split('.').reduce((a, o) => a * 256 + +o, 0);
export const ownsPrefix = (x: string, p: string | undefined): boolean => ASES[x].prefix === p;
export const falseOrigin = (n: Net, x: string, p: string | undefined): boolean => n.attack === 'hijack' && x === 'M' && p === VICTIM;
export const originates = (n: Net, x: string, p: string): boolean => (ownsPrefix(x, p) && (x !== 'C' || n.policy.announce)) || falseOrigin(n, x, p);

/** Cone de clientes: o AS e todos os AS abaixo dele na hierarquia cliente-provedor. */
export function cone(n: Net, x: string, seen: Set<string> = new Set()): number[] {
  if (seen.has(x)) return [];
  seen.add(x);
  let r = [ASES[x].asn];
  neighbors(n, x).forEach((v) => {
    if (relOf(n, x, v.id) === 'customer') r = r.concat(cone(n, v.id, seen));
  });
  return r;
}

/** Política de importação: devolve null (aceita) ou o motivo da rejeição. */
export function rejectOf(n: Net, x: string, from: string, p: string, r: { path: number[]; damped?: boolean }): Reject | null {
  const d = n.defense;
  const origin = r.path[r.path.length - 1];
  const holder = PREFIX_HOLDER[p];
  const rel = relOf(n, x, from);
  if (ROV_SCOPE[d.rov].includes(x) && origin !== holder) return { by: 'rov', why: 'RPKI inválido: origem AS' + origin + ', mas o ROA de ' + p + ' autoriza só AS' + holder };
  if (rel === 'customer' && CUST_SCOPE[d.cust].includes(x) && !cone(n, from).includes(holder)) return { by: 'cust', why: 'filtro de prefixos de clientes: ' + p + ' pertence ao AS' + holder + ', fora do cone de ' + ASES[from].name };
  if (rel === 'peer' && PEER_SCOPE[d.peer].includes(x) && !cone(n, from).includes(holder)) return { by: 'peer', why: 'filtro de rotas de peer: ' + p + ' pertence ao AS' + holder + ', fora do cone de clientes de ' + ASES[from].name };
  if (r.damped && d.damp) return { by: 'damp', why: 'flap damping: rota suprimida por instabilidade' };
  return null;
}

// ---- Processo de decisão ----

export function candidates(n: Net, x: string, p: string): Cand[] {
  const list: Cand[] = [];
  if (originates(n, x, p)) list.push({ local: true, path: [], nh: '0.0.0.0', lp: 100, from: null });
  neighbors(n, x).forEach((v) => {
    if (!established(v.link)) return;
    const r = n.ribIn[x][v.id] && n.ribIn[x][v.id][p];
    if (!r) return;
    const base = n.defense.relLP ? { customer: 200, peer: 150, provider: 100 }[relOf(n, x, v.id)] : 100;
    const c: Cand = { local: false, path: r.path, nh: r.nh, lp: x === 'C' && v.id === 'A' ? n.policy.lpA : base, from: v.id, damped: r.damped };
    c.rej = rejectOf(n, x, v.id, p, c);
    list.push(c);
  });
  return list;
}

/** Diferença negativa significa que r1 é melhor; o segundo item é o critério que decidiu. */
export function compare(r1: Cand, r2: Cand): [number, string] {
  if (r1.lp !== r2.lp) return [r2.lp - r1.lp, 'LOCAL_PREF'];
  if (r1.local !== r2.local) return [r1.local ? -1 : 1, 'origem local'];
  if (r1.path.length !== r2.path.length) return [r1.path.length - r2.path.length, 'AS_PATH'];
  return [ipNum(ASES[r1.from as string].rid) - ipNum(ASES[r2.from as string].rid), 'router ID'];
}

export function bestOf(n: Net, x: string, p: string): { best: Cand | null; cands: Cand[]; valid: Cand[] } {
  const all = candidates(n, x, p);
  const c = all.filter((r) => !r.rej);
  const rej = all.filter((r) => r.rej);
  c.sort((a, b) => compare(a, b)[0]);
  c.forEach((r, i) => {
    r.best = i === 0;
    r.reason = i === 0 ? (c.length > 1 ? compare(c[0], c[1])[1] : 'único') : compare(c[0], r)[1];
  });
  rej.forEach((r) => {
    r.best = false;
    r.reason = 'rejeitada';
  });
  return { best: c.length ? c[0] : null, cands: c.concat(rej), valid: c };
}

// ---- Exportação (valley-free) ----

export function exportRoute(n: Net, x: string, y: string, p: string): Route | null {
  const best = bestOf(n, x, p).best;
  if (!best || best.from === y) return null;
  const learned = best.local ? 'local' : relOf(n, x, best.from as string);
  const leaked = n.attack === 'route-leak' && x === 'B' && y === 'A' && p === LEAKED && best.from === 'D';
  if (!leaked && (learned === 'peer' || learned === 'provider') && relOf(n, x, y) !== 'customer') return null;
  const k = x === 'C' && y === 'B' ? n.policy.prependB : 0;
  return { path: Array(k + 1).fill(ASES[x].asn).concat(best.path), nh: ipOn(linkBetween(n, x, y), x) };
}

export interface Upd {
  from: string;
  to: string;
  prefix: string;
  route: Route | null;
  loop?: boolean;
}

export function computeRound(n: Net): Upd[] {
  const msgs: Upd[] = [];
  n.links.filter(established).forEach((l) => {
    ([[l.a, l.b], [l.b, l.a]] as [string, string][]).forEach(([x, y]) => {
      PREFIXES.forEach((p) => {
        const want = exportRoute(n, x, y, p);
        const key = want ? want.path.join(' ') + '|' + want.nh : null;
        const cur = n.advOut[x][y][p] || null;
        if (key === cur) return;
        if (!want && cur === null) return;
        msgs.push({ from: x, to: y, prefix: p, route: want });
        if (want) n.advOut[x][y][p] = key as string;
        else delete n.advOut[x][y][p];
      });
    });
  });
  return msgs;
}

export function deliver(n: Net, m: Upd): void {
  const me = ASES[m.to].asn;
  if (m.route && m.route.path.includes(me)) {
    delete n.ribIn[m.to][m.from][m.prefix];
    m.loop = true;
    return;
  }
  const key = m.to + '|' + m.from + '|' + m.prefix;
  const store = n.ribIn[m.to][m.from];
  if (m.route) store[m.prefix] = { path: m.route.path.slice(), nh: m.route.nh, damped: !!n.suppressed[key] };
  else {
    if (store[m.prefix]) {
      n.flaps[key] = (n.flaps[key] || 0) + 1;
      if (DAMP_SCOPE.includes(m.to) && n.flaps[key] >= 2) n.suppressed[key] = true;
    }
    delete store[m.prefix];
  }
}

export function clearRibs(n: Net, l: Link): void {
  n.ribIn[l.a][l.b] = {};
  n.ribIn[l.b][l.a] = {};
  n.advOut[l.a][l.b] = {};
  n.advOut[l.b][l.a] = {};
}

// ---- Encaminhamento e resumos ----

export interface Fwd {
  ok: boolean;
  path: string[];
  at?: string;
  attack?: 'blackhole';
}

export function forward(n: Net, src: string, dstIp: string): Fwd {
  let cur = src;
  const path = [src];
  const p = prefixOf(dstIp);
  for (let g = 0; g < 10; g++) {
    if (ownsPrefix(cur, p)) return { ok: true, path };
    if (falseOrigin(n, cur, p)) return { ok: false, path, at: cur, attack: 'blackhole' };
    const b = bestOf(n, cur, p as string).best;
    if (!b) return { ok: false, path, at: cur };
    cur = b.from as string;
    path.push(cur);
  }
  return { ok: false, path, at: cur };
}

export function chainText(n: Net, src: string, p: string): string {
  let cur = src;
  const names = [ASES[src].name];
  for (let g = 0; g < 10; g++) {
    if (ownsPrefix(cur, p)) return names.join(' → ');
    if (falseOrigin(n, cur, p)) return names.join(' → ') + ' (descartado)';
    const b = bestOf(n, cur, p).best;
    if (!b) return 'sem rota em ' + ASES[cur].name;
    cur = b.from as string;
    names.push(ASES[cur].name);
  }
  return names.join(' → ');
}

/** O AS (que não é o atacante) escolheu como melhor a rota do atacante para o prefixo da vítima. */
export function usesFalse(n: Net, x: string): boolean {
  if (n.attack !== 'hijack' || x === 'M') return false;
  const b = bestOf(n, x, VICTIM).best;
  return !!(b && b.path.length && b.path[b.path.length - 1] === ASES.M.asn);
}

export function rejectionList(n: Net): { at: string; from: string | null; prefix: string; by: string; why: string }[] {
  const out: { at: string; from: string | null; prefix: string; by: string; why: string }[] = [];
  AS_ORDER.forEach((x) => PREFIXES.forEach((p) => bestOf(n, x, p).cands.forEach((r) => {
    if (r.rej) out.push({ at: x, from: r.from, prefix: p, by: r.rej.by, why: r.rej.why });
  })));
  return out;
}

export const defenseText = (d: Partial<Defense>): string => {
  const p: string[] = [];
  if (d.relLP) p.push('LOCAL_PREF por relação comercial');
  if (d.rov && d.rov !== 'off') p.push('RPKI / ROV ' + DEF_NAMES.rov[d.rov]);
  if (d.cust && d.cust !== 'off') p.push('filtro de prefixos de clientes ' + DEF_NAMES.cust[d.cust]);
  if (d.peer && d.peer !== 'off') p.push('filtro de rotas de peers ' + DEF_NAMES.peer[d.peer]);
  if (d.damp) p.push('flap damping');
  return p.join('; ');
};

// ---- Fotos do estado, para as abas acompanharem o relógio ----

export interface SessRow {
  id: string;
  state: string;
  up: boolean;
  silent: boolean;
  est: boolean;
  ra: number;
  rb: number;
  sa: number;
  sb: number;
  upSince: number;
}

export interface Snap {
  t: number;
  label: string;
  clock: number;
  sessions: SessRow[];
  tables: Record<string, Record<string, Cand[]>>;
  /** Número de versão da tabela: UPDATEs enviados até o momento. */
  updates: number;
  falseUsers: string[];
  converged: boolean;
}

export function snapshot(n: Net, t: number, label: string, updates: number, converged: boolean): Snap {
  const tables: Snap['tables'] = {};
  AS_ORDER.forEach((x) => {
    tables[x] = {};
    PREFIXES.forEach((p) => {
      tables[x][p] = bestOf(n, x, p).cands.map((c) => ({ ...c, path: c.path.slice() }));
    });
  });
  return {
    t,
    label,
    clock: n.clock,
    updates,
    converged,
    falseUsers: converged ? AS_ORDER.filter((x) => usesFalse(n, x)) : [],
    sessions: n.links.map((l) => ({
      id: l.id,
      state: l.state,
      up: l.up,
      silent: l.silent,
      est: established(l),
      ra: Object.keys(n.ribIn[l.a][l.b] || {}).length,
      rb: Object.keys(n.ribIn[l.b][l.a] || {}).length,
      sa: l.sent[l.a] || 0,
      sb: l.sent[l.b] || 0,
      upSince: l.upSince,
    })),
    tables,
  };
}
