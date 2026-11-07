// Motores dos três modos do simulador de OSPF: convergência em área única, evento (custo ou falha) e multiárea.
// Cada um monta a rede, troca mensagens (Hello, DBD, LSU...) e registra o resultado em um Trace; os dados brutos ficam em tr.raw.
import { COLORS, newTrace, type Column, type Field, type StateDef, type Trace } from '../../sim-core';
import { emitPacket } from '../roteamento-base/pacote';
import { hostOf, liveLinks, MULTI, otherHostOf, routerIdOf, SINGLE, type LiveLink, type Topo } from '../roteamento-base/topologia';
import { allAreas, areasOf, convergedLsdb, floodRounds, forwardPath, isAbr, newLsdb, routerItems, summaryItems, type Item, type Lsdb, type Send } from './model';

export const C = { hello: COLORS.plain as string, adj: COLORS.enc as string, lsa: '#B48EF0', sum: COLORS.data as string };

const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'lsdb', label: 'LSDBs' },
  { key: 'res', label: 'Resultado' },
];

export interface ConvParams {
  dir: string;
}
export interface EventoParams {
  dir: string;
  ev: 'custo' | 'queda';
  link: string;
  custo: number;
  link2: string;
}
export interface MultiParams {
  dir: string;
  mlink: string;
}

export interface LsdbLog {
  t: number;
  at: string;
  item: Item;
}

const CP = 2; // atraso fixo dos enlaces nas mensagens do plano de controle (ms)
const G = CP + 0.3;

function columns(t: Topo): Column[] {
  const cols: Column[] = [{ key: 'PC-A', label: 'PC-A', sub: 'host', addr: '192.168.1.10' }];
  t.routers.forEach((r) => cols.push({ key: r.id, label: r.id, sub: t.kind === 'single' ? 'roteador' : isAbr(t, r.id) ? 'ABR (áreas ' + r.areas.join(' e ') + ')' : 'área ' + r.areas[0], addr: routerIdOf(r.id) }));
  cols.push({ key: 'PC-B', label: 'PC-B', sub: 'host', addr: '192.168.2.10' });
  return cols;
}

function base(sub: string, t: Topo, links: LiveLink[], extra: Record<string, unknown> = {}): { tr: Trace; R: Record<string, any> } {
  const tr = newTrace(columns(t), STATES, 20);
  const R = (tr.raw = { sub, t, links, linksBefore: null as LiveLink[] | null, lsdbLog: [] as LsdbLog[], tSpf: 0, res: '', tEnd: 0, ...extra } as Record<string, any>);
  return { tr, R };
}

function finish(tr: Trace, R: Record<string, any>, res: string, text: string, cls: string) {
  R.res = res;
  tr.phase('Resultado', 'resultado');
  tr.st(tr.t, 'phase', 'concluído', cls === 'bad' ? 'bad' : 'est');
  tr.st(tr.t, 'res', text, cls);
  tr.mile(tr.t, text.length > 28 ? text.slice(0, 26) + '...' : text, '');
  R.tEnd = tr.t;
}

const seqText = (n: number): string => '0x8000000' + n;
const linksText = (it: Item): string => (it.links || []).map((l) => l.to + '(' + l.cost + ')').join(', ') || '-';

function lsuFields(from: string, items: Item[]): Field[] {
  const f: Field[] = [{ sec: 'OSPF Link State Update (tipo 4)' }];
  f.push(['Router ID', routerIdOf(from), 'identifica o emissor']);
  f.push(['Área', items[0].area === '0' ? '0.0.0.0 (backbone)' : '0.0.0.' + items[0].area, 'a inundação fica dentro da área do LSA']);
  f.push(['Destino IP', '224.0.0.5', 'AllSPFRouters; em enlace ponto a ponto, o LSU vai ao vizinho']);
  f.push(['Número de LSAs', String(items.length)]);
  items.forEach((it) => {
    if (it.kind === 'router') f.push(['Router-LSA (tipo 1)', it.owner, 'seq ' + seqText(it.seq) + '; enlaces: ' + linksText(it)]);
    else f.push(['Summary-LSA (tipo 3)', it.dest + ' via ' + it.owner, 'custo ' + it.cost + ' anunciado pelo ABR ' + it.owner]);
  });
  return f;
}

/** Registra as rodadas de inundação (um LSU por enlace e sentido, em cada rodada) e a chegada dos LSAs à LSDB. */
function emitRounds(tr: Trace, R: Record<string, any>, lsdb: Lsdb, rounds: Send[][], color: string, phaseName: string): number {
  rounds.forEach((sends, k) => {
    const t0 = tr.t;
    sends.forEach((s) => {
      const items = s.keys.map((key) => lsdb[s.to].get(key) || lsdb[s.from].get(key)!);
      tr.add(s.from, s.to, {
        at: t0,
        dur: CP,
        par: true,
        color,
        proto: 'OSPF',
        len: 64 + 28 * items.length,
        label: 'LSU (' + items.length + ' LSA' + (items.length > 1 ? 's' : '') + ')',
        info: 'LSU de ' + s.from + ' para ' + s.to + ' com ' + items.length + (items.length > 1 ? ' LSAs' : ' LSA'),
        about: 'Inundação (RFC 2328, seção 13): o roteador reenvia ao vizinho os LSAs que ele ainda não tem, ou que são mais novos que os dele.',
        fields: lsuFields(s.from, items),
        phaseName,
      });
      items.forEach((it) => R.lsdbLog.push({ t: t0 + CP, at: s.to, item: it }));
    });
    tr.lg(t0 + CP, 'Rodada ' + (k + 1) + ' da inundação: ' + sends.length + ' LSU(s) em ' + Array.from(new Set(sends.map((s) => 'área ' + s.area))).join(', ') + '.', 'conn');
    tr.t = t0 + CP + 0.6;
  });
  return rounds.length;
}

/** Coloca cada Router-LSA na LSDB do próprio roteador e registra o instante. */
function originate(R: Record<string, any>, lsdb: Lsdb, items: Item[], at: number) {
  items.forEach((it) => {
    lsdb[it.owner].set(it.key, it);
    R.lsdbLog.push({ t: at, at: it.owner, item: it });
  });
}

function zip(per: Send[][][]): Send[][] {
  const out: Send[][] = [];
  const n = Math.max(0, ...per.map((r) => r.length));
  for (let k = 0; k < n; k++) out.push(per.flatMap((r) => r[k] || []));
  return out;
}

function spfPhase(tr: Trace, R: Record<string, any>, t: Topo, links: LiveLink[], label: string) {
  tr.phase('SPF', 'spf');
  tr.st(tr.t, 'phase', 'SPF', 'warn');
  t.routers.forEach((r) => tr.ev(tr.t, r.id, 'Executa o SPF (Dijkstra) sobre a própria LSDB, com raiz em ' + r.id + ', e instala a tabela de rotas', 'ok'));
  tr.lg(tr.t, label, 'cc');
  tr.t += 0.8;
  R.tSpf = tr.t;
  R.links = links;
}

function packetPhase(tr: Trace, R: Record<string, any>, t: Topo, links: LiveLink[], dir: string): boolean {
  const src = hostOf(t, dir);
  const dst = otherHostOf(t, dir);
  const fp = forwardPath(t, links, src.attach, dst.attach);
  R.fp = fp;
  R.src = src.id;
  R.dst = dst.id;
  return emitPacket(tr, src, dst, fp.path, fp.reached, 'OSPF');
}

const startStates = (tr: Trace, phase: string) => {
  tr.st(0, 'phase', phase, 'warn');
  tr.st(0, 'lsdb', 'vazias', '');
  tr.st(0, 'res', 'em andamento', 'warn');
};

// ---- 1. Convergência em área única ----

export function buildConv(P: ConvParams): Trace {
  const t = SINGLE;
  const links = liveLinks(t);
  const { tr, R } = base('conv', t, links, { dir: P.dir });
  const lsdb = newLsdb(t);
  startStates(tr, 'Down');
  tr.ev(0, 'R1', 'Todos os roteadores estão ativos, com os enlaces configurados e nenhuma rota aprendida', '');
  tr.lg(0, 'Simulação iniciada em OSPF, área única. Todos os enlaces estão ativos.', 'sys');

  // Fase 1: Hello
  tr.wait(1);
  tr.phase('1. Hello', 'hello');
  tr.st(tr.t, 'phase', 'Hello / 2-Way', 'warn');
  let t0 = tr.t;
  tr.ev(t0, 'R1', 'Envia Hello (a cada 10 s) em todas as interfaces ativas, para 224.0.0.5', '');
  links.forEach((l) => [[l.a, l.b], [l.b, l.a]].forEach(([a, b]) => tr.add(a, b, {
    at: t0, dur: CP, par: true, color: C.hello, proto: 'OSPF', len: 78, label: 'Hello', info: 'Hello de ' + a + ' para ' + b,
    about: 'Descobre vizinhos (RFC 2328, seção 10.5). Quando um roteador vê o próprio Router ID na lista de vizinhos do Hello recebido, o vizinho passa a 2-Way.',
    fields: [{ sec: 'OSPF Hello (tipo 1)' }, ['Router ID', routerIdOf(a)], ['HelloInterval', '10 s', 'valor padrão em redes ponto a ponto e broadcast'], ['RouterDeadInterval', '40 s', 'sem Hello nesse prazo, o vizinho é declarado inativo'], ['Vizinho visto', routerIdOf(b), 'o próprio Router ID do vizinho já aparece nos Hellos de volta: 2-Way'], ['Destino IP', '224.0.0.5', 'AllSPFRouters'], ['Custo da interface', String(l.cost), 'parâmetro configurado no enlace ' + l.id]],
    phaseName: 'Hello',
  })));
  tr.t = t0 + CP + 0.6;
  t.routers.forEach((r) => tr.ev(t0 + CP, r.id, '2-Way com ' + links.filter((l) => l.a === r.id || l.b === r.id).map((l) => (l.a === r.id ? l.b : l.a)).join(', '), 'ok'));
  tr.lg(t0 + CP, 'Fase HELLO: ' + links.length + ' enlaces em 2-Way nos dois sentidos.', 'conn');

  // Fase 2: adjacência (DBD, LSR, LSU, LSAck)
  tr.wait(0.6);
  tr.phase('2. Adjacência', 'adj');
  tr.st(tr.t, 'phase', 'Adjacência Full', 'warn');
  t0 = tr.t;
  const stages: [string, string, boolean][] = [['DBD', 'descrição da LSDB (só os cabeçalhos dos LSAs)', true], ['LSR', 'pede os LSAs que faltam', false], ['LSU', 'entrega os LSAs pedidos', false], ['LSAck', 'confirma o recebimento', false]];
  stages.forEach(([nm, why, both], k) => links.forEach((l) => {
    const pairs = both ? [[l.a, l.b], [l.b, l.a]] : nm === 'LSU' ? [[l.b, l.a]] : [[l.a, l.b]];
    pairs.forEach(([a, b]) => tr.add(a, b, {
      at: t0 + k * G, dur: CP, par: true, color: C.adj, proto: 'OSPF', len: 70, label: nm, info: nm + ' de ' + a + ' para ' + b,
      about: 'Sincronização da LSDB entre vizinhos (RFC 2328, seção 7.2): ' + why + '. O simulador mostra DBD nos dois sentidos e LSR, LSU e LSAck em um sentido só.',
      fields: [{ sec: 'OSPF ' + nm }, ['Router ID', routerIdOf(a)], ['Função', why], ['Enlace', l.id + ' ' + l.a + ' / ' + l.b]], phaseName: 'Adjacência',
    }));
  }));
  tr.t = t0 + 3 * G + CP + 0.6;
  t.routers.forEach((r) => tr.ev(t0 + 3 * G + CP, r.id, 'Adjacência Full com ' + links.filter((l) => l.a === r.id || l.b === r.id).map((l) => (l.a === r.id ? l.b : l.a)).join(', '), 'ok'));
  tr.lg(t0 + 3 * G + CP, 'Fase ADJACÊNCIA: ' + links.length + ' adjacências Full (DBD, LSR, LSU e LSAck).', 'conn');

  // Fase 3: inundação
  tr.wait(0.6);
  tr.phase('3. Inundação de LSAs', 'flood');
  tr.st(tr.t, 'phase', 'Inundação de LSA', 'warn');
  tr.st(tr.t, 'lsdb', 'incompletas', 'warn');
  originate(R, lsdb, routerItems(t, links), tr.t);
  tr.ev(tr.t, 'R1', 'Cada roteador origina o próprio Router-LSA (seq 0x80000001) com os enlaces ativos e os custos', '');
  const rounds = floodRounds(t, links, lsdb, '0');
  R.rounds = emitRounds(tr, R, lsdb, rounds, C.lsa, 'Inundação');
  tr.st(tr.t, 'lsdb', 'idênticas', 'est');
  tr.lg(tr.t, 'Todas as LSAs foram inundadas em ' + rounds.length + ' rodadas: as LSDBs convergiram para uma visão idêntica da topologia.', 'cc');

  // Fase 4: SPF
  tr.wait(0.6);
  spfPhase(tr, R, t, links, 'Fase SPF: cada roteador calculou a árvore de menor custo sobre a mesma LSDB.');
  tr.st(tr.t, 'phase', 'Convergido', 'est');

  tr.wait(0.6);
  const ok = packetPhase(tr, R, t, links, P.dir);
  if (ok) finish(tr, R, 'ok', 'entregue por menor custo', 'est');
  else finish(tr, R, 'drop', 'sem rota', 'bad');
  return tr;
}

// ---- 2. Evento: mudança de custo ou falha de enlace ----

export function buildEvento(P: EventoParams): Trace {
  const t = SINGLE;
  const before = liveLinks(t);
  const down = P.ev === 'queda' ? [P.link, ...(P.link2 !== 'none' && P.link2 !== P.link ? [P.link2] : [])] : [];
  const after = P.ev === 'custo' ? liveLinks(t, [], { [P.link]: P.custo }) : liveLinks(t, down);
  const changed = t.links.filter((l) => (P.ev === 'custo' ? l.id === P.link && P.custo !== l.cost : down.indexOf(l.id) >= 0));
  const { tr, R } = base('evento', t, before, { dir: P.dir, ev: P.ev, linksBefore: before, linksAfter: after, changed: changed.map((l) => l.id), down });
  const lsdb = convergedLsdb(t, before);
  t.routers.forEach((r) => lsdb[r.id].forEach((it) => R.lsdbLog.push({ t: 0, at: r.id, item: it })));
  const src = hostOf(t, P.dir);
  const dst = otherHostOf(t, P.dir);
  R.before = forwardPath(t, before, src.attach, dst.attach);
  R.after = forwardPath(t, after, src.attach, dst.attach);
  startStates(tr, 'Convergido');
  tr.st(0, 'lsdb', 'idênticas', 'est');
  tr.ev(0, 'R1', 'Rede convergida: as seis LSDBs são idênticas e cada roteador tem a tabela de rotas calculada', '');
  tr.lg(0, 'Ponto de partida: OSPF convergido. Caminho de ' + src.id + ' a ' + dst.id + ': ' + R.before.path.join(' → ') + ' (custo ' + R.before.cost + ').', 'sys');

  tr.wait(1);
  tr.phase('Evento', 'evento');
  if (!changed.length) {
    tr.st(tr.t, 'phase', 'sem mudança', 'warn');
    tr.ev(tr.t, 'R1', 'O custo informado é igual ao atual: nenhuma mudança, nenhum LSA novo', '');
    tr.lg(tr.t, 'Custo igual ao atual: nada a inundar.', 'sys');
    R.links = before;
    R.tSpf = 0;
    tr.wait(1);
    packetPhase(tr, R, t, before, P.dir);
    finish(tr, R, 'same', 'nada mudou', 'est');
    return tr;
  }
  tr.st(tr.t, 'phase', P.ev === 'custo' ? 'custo alterado' : 'falha de enlace', 'bad');
  const ends = Array.from(new Set(changed.flatMap((l) => [l.a, l.b])));
  const t0 = tr.t;
  changed.forEach((l) => {
    if (P.ev === 'queda') {
      tr.add(l.a, l.b, { at: t0, dur: CP, par: true, lost: true, color: COLORS.bad, proto: 'OSPF', len: 78, label: 'Hello (sem resposta)', info: 'O enlace ' + l.id + ' caiu: ' + l.a + ' não recebe mais Hello de ' + l.b, about: 'A falha é detectada porque a interface cai ou porque o RouterDeadInterval (40 s) expira sem Hello. Detecção mais rápida usa BFD.', fields: [{ sec: 'Evento' }, ['Enlace', l.id + ' ' + l.a + ' / ' + l.b], ['Efeito', 'adjacência Full encerrada nas duas pontas']], phaseName: 'Evento' });
      tr.ev(t0, l.a, 'Perde a adjacência com ' + l.b, 'warn');
      tr.ev(t0, l.b, 'Perde a adjacência com ' + l.a, 'warn');
      tr.lg(t0, 'Falha no enlace ' + l.a + ' / ' + l.b + ' (' + l.id + ').', 'loss');
    } else {
      tr.ev(t0, l.a, 'O custo da interface para ' + l.b + ' passa de ' + l.cost + ' para ' + P.custo, 'warn');
      tr.ev(t0, l.b, 'O custo da interface para ' + l.a + ' passa de ' + l.cost + ' para ' + P.custo, 'warn');
      tr.lg(t0, 'Custo do enlace ' + l.a + ' / ' + l.b + ' alterado de ' + l.cost + ' para ' + P.custo + '.', 'sys');
    }
  });
  tr.t = t0 + CP + 0.6;
  tr.st(tr.t, 'lsdb', 'desatualizadas', 'warn');
  const seqs: Record<string, number> = {};
  ends.forEach((r) => (seqs[r + '@0'] = 2));
  originate(R, lsdb, routerItems(t, after, seqs).filter((it) => ends.indexOf(it.owner) >= 0), tr.t);
  ends.forEach((r) => tr.ev(tr.t, r, 'Origina um novo Router-LSA (seq 0x80000002), refletindo a mudança', ''));
  tr.lg(tr.t, ends.join(' e ') + ' originam novos Router-LSAs com número de sequência maior, que invalida o anterior.', 'cc');
  tr.phase('Inundação do novo LSA', 'flood');
  const rounds = floodRounds(t, after, lsdb, '0');
  R.rounds = emitRounds(tr, R, lsdb, rounds, C.lsa, 'Inundação');
  const everyone = t.routers.every((r) => lsdb[r.id].get(ends[0] + '@0')?.seq === 2);
  tr.st(tr.t, 'lsdb', everyone ? 'idênticas' : 'divergentes', everyone ? 'est' : 'bad');
  R.everyone = everyone;
  tr.wait(0.6);
  spfPhase(tr, R, t, after, 'Cada roteador alcançado recalculou o SPF sobre a LSDB atualizada.');
  R.tSpfAfter = R.tSpf;
  tr.st(tr.t, 'phase', 'Reconvergido', 'est');
  tr.wait(0.6);
  const ok = packetPhase(tr, R, t, after, P.dir);
  if (ok) finish(tr, R, R.before.path.join('>') !== R.after.path.join('>') ? 'rerouted' : 'same', R.before.path.join('>') !== R.after.path.join('>') ? 'caminho alterado' : 'mesmo caminho', 'est');
  else finish(tr, R, 'partition', 'rede particionada', 'bad');
  return tr;
}

// ---- 3. Multiárea ----

export function buildMulti(P: MultiParams): Trace {
  const t = MULTI;
  const down = P.mlink === 'none' ? [] : [P.mlink];
  const links = liveLinks(t, down);
  const { tr, R } = base('multi', t, links, { dir: P.dir, down });
  const lsdb = newLsdb(t);
  startStates(tr, 'Down');
  tr.ev(0, 'R1', 'Nove roteadores em três áreas: 1, 0 (backbone) e 2. Os ABRs (R2, R3, R8 e R9) pertencem a duas áreas', '');
  tr.lg(0, 'Simulação iniciada em OSPF multiárea.' + (down.length ? ' Enlace ' + down[0] + ' fora de serviço.' : ''), 'sys');

  tr.wait(1);
  tr.phase('1. Adjacências', 'adj');
  tr.st(tr.t, 'phase', 'Adjacência Full', 'warn');
  t.routers.forEach((r) => {
    const ns = links.filter((l) => l.up && (l.a === r.id || l.b === r.id));
    tr.ev(tr.t, r.id, 'Hello e DBD: adjacência Full com ' + ns.map((l) => (l.a === r.id ? l.b : l.a) + ' (área ' + l.area + ')').join(', '), 'ok');
  });
  tr.lg(tr.t, 'Fase ADJACÊNCIA: ' + links.filter((l) => l.up).length + ' adjacências Full. O simulador não repete aqui as mensagens de Hello e de DBD (veja o modo área única).', 'conn');
  tr.t += 1;

  tr.phase('2. Inundação em cada área', 'flood');
  tr.st(tr.t, 'phase', 'Inundação de LSA', 'warn');
  tr.st(tr.t, 'lsdb', 'incompletas', 'warn');
  originate(R, lsdb, routerItems(t, links), tr.t);
  tr.ev(tr.t, 'R2', 'O ABR origina um Router-LSA por área (um com os enlaces da área 1, outro com os da área 0)', '');
  const per = allAreas(t).map((a) => floodRounds(t, links, lsdb, a));
  R.rounds = emitRounds(tr, R, lsdb, zip(per), C.lsa, 'Inundação');
  tr.lg(tr.t, 'Cada área inundou só os próprios LSAs: as LSDBs de roteadores de áreas diferentes não são iguais.', 'cc');

  tr.wait(0.6);
  tr.phase('3. Summary LSAs', 'sum');
  tr.st(tr.t, 'phase', 'Summary LSAs', 'warn');
  const sums = summaryItems(t, links);
  R.summaries = sums;
  originate(R, lsdb, sums, tr.t);
  t.routers.filter((r) => r.areas.length > 1).forEach((b) => tr.ev(tr.t, b.id, 'ABR: resume as outras áreas em Summary LSAs (tipo 3) e as anuncia em cada uma das suas áreas', ''));
  const perS = allAreas(t).map((a) => floodRounds(t, links, lsdb, a));
  R.sumRounds = emitRounds(tr, R, lsdb, zip(perS), C.sum, 'Summary LSAs');
  tr.st(tr.t, 'lsdb', 'consistentes por área', 'est');
  tr.lg(tr.t, sums.length + ' Summary LSAs originados pelos ABRs: cada roteador interno enxerga as outras áreas só como destinos com custo, sem os detalhes.', 'cc');

  tr.wait(0.6);
  spfPhase(tr, R, t, links, 'Cada roteador calculou o SPF dentro das próprias áreas e somou o custo dos Summary LSAs para as outras.');
  tr.st(tr.t, 'phase', 'Convergido', 'est');
  tr.wait(0.6);
  const ok = packetPhase(tr, R, t, links, P.dir);
  if (ok) finish(tr, R, 'ok', 'entregue pelo backbone', 'est');
  else finish(tr, R, 'drop', 'sem rota', 'bad');
  return tr;
}

export const abrsOf = (t: Topo): string[] => t.routers.filter((r) => areasOf(t, r.id).length > 1).map((r) => r.id);
