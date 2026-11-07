// Motores dos dois modos do simulador de RIP: convergência por rodadas de Response e falha com atualização disparada.
// Cada um monta a rede, troca mensagens e registra o resultado em um Trace; os dados brutos ficam em tr.raw.
import { COLORS, newTrace, type Column, type Field, type StateDef, type Trace } from '../../sim-core';
import { emitPacket } from '../roteamento-base/pacote';
import { buildGraph, dijkstra, hostOf, liveLinks, otherHostOf, pathTo, routerIdOf, SINGLE, type LiveLink } from '../roteamento-base/topologia';
import { advertise, cloneTables, converge, INF, initTables, plain, poisonLink, ripPath, ripRound, type Plain, type Tables } from './model';

export const C = { resp: COLORS.enc as string, trig: '#E6A23C', data: COLORS.data as string };

const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'tab', label: 'Tabelas' },
  { key: 'res', label: 'Resultado' },
];

export interface ConvParams {
  dir: string;
  /** Custo OSPF do enlace R2 / R3 (o RIP o ignora). */
  cost23: number;
  sh: boolean;
}
export interface FalhaParams {
  dir: string;
  link: string;
  link2: string;
  sh: boolean;
}

export interface Snap {
  t: number;
  label: string;
  tables: Plain;
}

const CP = 2;
const CAP = 25;

const columns = (): Column[] => [
  { key: 'PC-A', label: 'PC-A', sub: 'host', addr: '192.168.1.10' },
  ...SINGLE.routers.map((r): Column => ({ key: r.id, label: r.id, sub: 'roteador', addr: routerIdOf(r.id) })),
  { key: 'PC-B', label: 'PC-B', sub: 'host', addr: '192.168.2.10' },
];

function base(sub: string, links: LiveLink[], sh: boolean, extra: Record<string, unknown>): { tr: Trace; R: Record<string, any> } {
  const tr = newTrace(columns(), STATES, 20);
  const R = (tr.raw = { sub, t: SINGLE, links, linksBefore: null as LiveLink[] | null, sh, snaps: [] as Snap[], res: '', rounds: 0, roundsChanged: 0, capHit: false, ...extra } as Record<string, any>);
  return { tr, R };
}

function finish(tr: Trace, R: Record<string, any>, res: string, text: string, cls: string) {
  R.res = res;
  tr.phase('Resultado', 'resultado');
  tr.st(tr.t, 'phase', 'concluído', cls === 'bad' ? 'bad' : 'est');
  tr.st(tr.t, 'res', text, cls);
  tr.mile(tr.t, text.length > 28 ? text.slice(0, 26) + '...' : text, '');
}

const metricText = (m: number): string => (m >= INF ? '16 (infinito)' : String(m));

/** Uma rodada de Response: cada roteador envia o vetor aos vizinhos ativos; as tabelas novas valem a partir da chegada. */
function emitRound(tr: Trace, R: Record<string, any>, links: LiveLink[], tables: Tables, k: number, trig: boolean): { next: Tables; changed: boolean } {
  const res = ripRound(SINGLE, links, tables, R.sh);
  const t0 = tr.t;
  tr.phase((trig ? 'Atualização disparada ' : 'Rodada ') + k, 'rodada');
  links.filter((l) => l.up).forEach((l) => [[l.a, l.b], [l.b, l.a]].forEach(([a, b]) => {
    const vec = advertise(tables[a], b, R.sh);
    const fields: Field[] = [{ sec: 'RIPv2 Response (comando 2, versão 2)' }, ['Origem', routerIdOf(a)], ['Destino IP', '224.0.0.9', 'multicast RIPv2, UDP 520 (RFC 2453, seção 4.5)'], ['Entradas', String(vec.size), 'no máximo 25 por mensagem']];
    vec.forEach((m, dest) => {
      const poisoned = R.sh && tables[a].get(dest)!.next === b && tables[a].get(dest)!.metric < INF;
      fields.push(['Rota ' + dest + ' (' + routerIdOf(dest) + ')', 'métrica ' + metricText(m), poisoned ? 'poison reverse: aprendida de ' + b + ', volta com 16' : '']);
    });
    tr.add(a, b, {
      at: t0, dur: CP, par: true, color: trig ? C.trig : C.resp, proto: 'RIPv2', len: 24 + 20 * vec.size, label: 'Response (' + vec.size + ')',
      info: 'Response de ' + a + ' para ' + b + ' com ' + vec.size + (vec.size > 1 ? ' rotas' : ' rota'),
      about: trig ? 'Atualização disparada (RFC 2453, seção 3.4.4): o roteador anuncia a mudança de imediato, sem esperar os 30 s.' : 'O roteador anuncia seu vetor de distância (RFC 2453, seção 3.9.2). O vizinho soma 1 a cada métrica e adota a rota se ela for melhor ou se vier do próximo salto atual.',
      fields, phaseName: trig ? 'Atualização disparada' : 'Response',
    });
  }));
  R.snaps.push({ t: t0 + CP, label: (trig ? 'depois da atualização disparada ' : 'depois da rodada ') + k, tables: plain(res.next) });
  R.rounds++;
  if (res.changed) {
    R.roundsChanged++;
    tr.lg(t0 + CP, (trig ? 'Atualização ' : 'Rodada ') + k + ': ' + res.touched.length + ' roteador(es) atualizaram rotas (' + res.touched.join(', ') + ').', 'cc');
    res.touched.forEach((r) => tr.ev(t0 + CP, r, 'Atualiza a tabela com os vetores recebidos', 'ok'));
  } else {
    tr.lg(t0 + CP, (trig ? 'Atualização ' : 'Rodada ') + k + ': nenhuma tabela mudou, a rede estabilizou.', 'conn');
  }
  tr.t = t0 + CP + 0.6;
  return { next: res.next, changed: res.changed };
}

function runRounds(tr: Trace, R: Record<string, any>, links: LiveLink[], tables: Tables, trig: boolean): Tables {
  let cur = tables;
  let changed = true;
  for (let k = 1; changed && k <= CAP; k++) {
    const r = emitRound(tr, R, links, cur, k, trig);
    cur = r.next;
    changed = r.changed;
    if (changed && k === CAP) R.capHit = true;
  }
  return cur;
}

function startStates(tr: Trace, phase: string, tab: string, cls: string) {
  tr.st(0, 'phase', phase, 'warn');
  tr.st(0, 'tab', tab, cls);
  tr.st(0, 'res', 'em andamento', 'warn');
}

const pathCost = (links: LiveLink[], path: string[]): number => {
  let c = 0;
  for (let i = 0; i + 1 < path.length; i++) c += links.find((l) => (l.a === path[i] && l.b === path[i + 1]) || (l.b === path[i] && l.a === path[i + 1]))!.cost;
  return c;
};

function packetPhase(tr: Trace, R: Record<string, any>, tables: Tables, dir: string): boolean {
  const src = hostOf(SINGLE, dir);
  const dst = otherHostOf(SINGLE, dir);
  const fp = ripPath(tables, src.attach, dst.attach);
  R.fp = fp;
  R.src = src.id;
  R.dst = dst.id;
  return emitPacket(tr, src, dst, fp.path, fp.reached, 'RIP');
}

// ---- 1. Convergência ----

export function buildConv(P: ConvParams): Trace {
  const t = SINGLE;
  const links = liveLinks(t, [], { L3: P.cost23 });
  const { tr, R } = base('conv', links, P.sh, { dir: P.dir, cost23: P.cost23 });
  let tables = initTables(t);
  R.snaps.push({ t: 0, label: 'estado inicial', tables: plain(tables) });
  startStates(tr, 'Inicial', 'só a própria', '');
  tr.ev(0, 'R1', 'Cada roteador conhece apenas a si mesmo, com métrica 0. Nenhuma rota foi aprendida', '');
  tr.lg(0, 'Simulação iniciada em RIPv2.' + (P.sh ? '' : ' Split horizon desativado.'), 'sys');
  tr.wait(1);
  tr.st(tr.t, 'phase', 'Response', 'warn');
  tr.st(tr.t, 'tab', 'incompletas', 'warn');
  tables = runRounds(tr, R, links, tables, false);
  R.tConv = tr.t;
  tr.st(tr.t, 'phase', 'Convergido', 'est');
  tr.st(tr.t, 'tab', 'estáveis', 'est');
  tr.lg(tr.t, 'RIPv2 convergiu em ' + R.roundsChanged + ' rodadas com mudança; a rodada seguinte só confirmou que as tabelas estavam estáveis.', 'cc');
  // comparação com o caminho por menor custo (o que um protocolo de estado de enlace escolheria)
  const src = hostOf(t, P.dir);
  const dst = otherHostOf(t, P.dir);
  const sp = dijkstra(t.routers.map((r) => r.id), buildGraph(t, links), src.attach);
  R.cmp = { path: pathTo(sp.prev, src.attach, dst.attach), cost: sp.dist[dst.attach] };
  tr.wait(0.6);
  const ok = packetPhase(tr, R, tables, P.dir);
  if (ok) {
    R.ripCost = pathCost(links, R.fp.path);
    finish(tr, R, 'ok', 'entregue por menos saltos', 'est');
  } else finish(tr, R, 'drop', 'sem rota', 'bad');
  return tr;
}

// ---- 2. Falha ----

export function buildFalha(P: FalhaParams): Trace {
  const t = SINGLE;
  const before = liveLinks(t);
  const down = [P.link, ...(P.link2 !== 'none' && P.link2 !== P.link ? [P.link2] : [])];
  const after = liveLinks(t, down);
  const { tr, R } = base('falha', after, P.sh, { dir: P.dir, down, linksBefore: before, linksAfter: after });
  const src = hostOf(t, P.dir);
  const dst = otherHostOf(t, P.dir);
  let tables = converge(t, before, initTables(t), P.sh).tables;
  R.snaps.push({ t: 0, label: 'rede convergida, antes da falha', tables: plain(tables) });
  R.before = ripPath(tables, src.attach, dst.attach);
  startStates(tr, 'Convergido', 'estáveis', 'est');
  tr.ev(0, 'R1', 'Rede convergida: as tabelas estão estáveis em todos os roteadores', '');
  tr.lg(0, 'Ponto de partida: RIPv2 convergido' + (P.sh ? '' : ' (split horizon desativado)') + '. Caminho de ' + src.id + ' a ' + dst.id + ': ' + R.before.path.join(' → ') + ' (' + R.before.metric + ' saltos).', 'sys');

  tr.wait(1);
  tr.phase('Falha de enlace', 'evento');
  tr.st(tr.t, 'phase', 'falha de enlace', 'bad');
  const t0 = tr.t;
  const failed = t.links.filter((l) => down.indexOf(l.id) >= 0);
  failed.forEach((l) => {
    tr.add(l.a, l.b, { at: t0, dur: CP, par: true, lost: true, color: COLORS.bad, proto: 'RIPv2', len: 44, label: 'Response (sem resposta)', info: 'O enlace ' + l.id + ' caiu: ' + l.a + ' não recebe mais Response de ' + l.b, about: 'A falha é detectada porque a interface cai ou porque o timeout de 180 s sem Response expira (RFC 2453, seção 3.8). O simulador mostra a detecção como imediata.', fields: [{ sec: 'Evento' }, ['Enlace', l.id + ' ' + l.a + ' / ' + l.b], ['Efeito', 'as rotas que usavam o enlace recebem métrica 16']], phaseName: 'Falha' });
    tr.ev(t0, l.a, 'Perde o vizinho ' + l.b + ': as rotas por ele passam a métrica 16', 'warn');
    tr.ev(t0, l.b, 'Perde o vizinho ' + l.a + ': as rotas por ele passam a métrica 16', 'warn');
    tr.lg(t0, 'Falha no enlace ' + l.a + ' / ' + l.b + ' (' + l.id + ').', 'loss');
  });
  tr.t = t0 + CP + 0.6;
  const poisoned = cloneTables(tables);
  failed.forEach((l) => poisonLink(poisoned, l));
  tables = poisoned;
  R.snaps.push({ t: tr.t, label: 'rotas pela falha marcadas com métrica 16', tables: plain(tables) });
  tr.st(tr.t, 'tab', 'desatualizadas', 'warn');
  tr.wait(0.6);
  tables = runRounds(tr, R, after, tables, true);
  R.tConv = tr.t;
  tr.st(tr.t, 'phase', R.capHit ? 'limite de rodadas' : 'Reconvergido', R.capHit ? 'bad' : 'est');
  tr.st(tr.t, 'tab', 'estáveis', 'est');
  R.after = ripPath(tables, src.attach, dst.attach);
  tr.lg(tr.t, 'RIPv2 reconvergiu em ' + R.roundsChanged + ' rodadas com mudança.', 'cc');
  tr.wait(0.6);
  const ok = packetPhase(tr, R, tables, P.dir);
  if (!ok) finish(tr, R, 'partition', 'rede particionada', 'bad');
  else if (R.before.path.join('>') !== R.after.path.join('>')) finish(tr, R, 'rerouted', 'caminho alterado', 'est');
  else finish(tr, R, 'same', 'mesmo caminho', 'est');
  return tr;
}
