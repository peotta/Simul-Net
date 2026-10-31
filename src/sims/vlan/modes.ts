// Motores dos cinco modos do simulador de VLAN. Cada um monta a rede, propaga um ou mais quadros (model.spread)
// e registra o resultado em tr.raw para a explicação, as abas e a topologia.
import { COLORS as C0, newTrace, type Column, type StateDef, type Trace } from '../../sim-core';
import { arpReq, emit, HOSTS, LABEL, makeNet, ping, R1, spread, SW_MAC, type Net, type Spread, type Wire } from './model';

const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'via', label: 'Quadro no último enlace' },
  { key: 'res', label: 'Resultado' },
];

const ADDR: Record<string, string> = { a: HOSTS.a.ip, b: HOSTS.b.ip, c: HOSTS.c.ip, d: HOSTS.d.ip, m: HOSTS.m.ip, r1: R1.gw10 + ' e ' + R1.gw20, sw1: SW_MAC.sw1, sw2: SW_MAC.sw2 };
const SUB: Record<string, string> = { a: 'VLAN 10', b: 'VLAN 20', c: 'VLAN 10', d: 'VLAN 20', m: 'porta de acesso do SW1', r1: 'router-on-a-stick', sw1: 'switch', sw2: 'switch' };

const columns = (keys: string[]): Column[] => keys.map((k) => ({ key: k, label: LABEL[k], sub: SUB[k], addr: ADDR[k] }));

const COLS_ALL = ['a', 'b', 'sw1', 'sw2', 'c', 'd'];

function base(sub: string, cols: string[], net: Net, rtt: number, extra: Record<string, unknown> = {}): { tr: Trace; R: Record<string, any> } {
  const tr = newTrace(columns(cols), STATES, rtt);
  const R = (tr.raw = { sub, mode: sub, net, cols, hasR: !!net.ports['sw1:4'], hasM: !!net.ports['sw1:5'], res: '', delivered: [] as string[], ignored: [] as string[], dropped: [] as string[], hidden: 0, tEnd: 0, ...extra } as Record<string, any>);
  return { tr, R };
}

function run(tr: Trace, R: Record<string, any>, sp: Spread, cols: string[]) {
  R.hidden += emit(tr, sp.steps, cols);
  R.delivered.push(...sp.delivered);
  R.ignored.push(...sp.ignored);
  R.dropped.push(...sp.dropped);
}

function finish(tr: Trace, R: Record<string, any>, res: string, text: string, cls: string) {
  R.res = res;
  tr.phase('Resultado', 'resultado');
  tr.st(tr.t, 'phase', 'concluído', cls === 'bad' ? 'bad' : 'est');
  tr.st(tr.t, 'res', text, cls);
  tr.mile(tr.t, text.length > 28 ? text.slice(0, 26) + '...' : text, '');
  R.tEnd = tr.t;
}

// ---- 1. Marcação 802.1Q ----

export interface MarcParams {
  rtt: number;
  nat: number;
  allowed: 'all' | 'no10';
}

export function buildMarc(P: MarcParams): Trace {
  const cols = ['a', 'sw1', 'sw2', 'c'];
  const net = makeNet({ nat1: P.nat, nat2: P.nat, allowed: P.allowed === 'no10' ? [20] : null });
  const { tr, R } = base('marc', cols, net, P.rtt, { nat: P.nat, allowed: P.allowed });
  tr.st(0, 'phase', 'o Host A envia', 'warn');
  tr.st(0, 'via', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.ev(0, 'a', 'Envia um ping para o Host C (mesma VLAN 10, outro switch). O host não sabe que existem VLANs: o quadro sai sem tag', '');
  const sp = spread(net, 'a', ping(HOSTS.a, HOSTS.c));
  run(tr, R, sp, cols);
  const arrived = sp.delivered.indexOf('c') >= 0;
  const untagged = P.nat === 10;
  R.untagged = untagged;
  if (!arrived) finish(tr, R, 'blocked', 'VLAN 10 não passa pelo tronco', 'bad');
  else finish(tr, R, untagged ? 'untag' : 'tag', 'entregue ao Host C', 'est');
  return tr;
}

// ---- 2. Segmentação ----

export interface SegParams {
  rtt: number;
  traffic: 'uni' | 'bc' | 'cross';
}

export function buildSeg(P: SegParams): Trace {
  const net = makeNet();
  const { tr, R } = base('seg', COLS_ALL, net, P.rtt, { traffic: P.traffic });
  tr.st(0, 'phase', 'o Host A envia', 'warn');
  tr.st(0, 'via', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  let w: Wire;
  if (P.traffic === 'uni') {
    tr.ev(0, 'a', 'Envia um ping para o Host C (mesma VLAN 10, outro switch)', '');
    w = ping(HOSTS.a, HOSTS.c);
  } else if (P.traffic === 'bc') {
    tr.ev(0, 'a', 'Pergunta por ARP quem tem 192.168.10.12: um broadcast, que vale para toda a VLAN 10', '');
    w = arpReq(HOSTS.a, HOSTS.c.ip);
  } else {
    tr.ev(0, 'a', 'Envia um quadro com o MAC do Host B (VLAN 20) como destino, como se soubesse o endereço dele', 'warn');
    w = ping(HOSTS.a, HOSTS.b);
  }
  const sp = spread(net, 'a', w);
  run(tr, R, sp, COLS_ALL);
  R.reachedOther = sp.delivered.concat(sp.ignored).filter((k) => HOSTS[k].vlan !== 10);
  if (P.traffic === 'uni') finish(tr, R, 'uni', 'só o Host C recebeu', 'est');
  else if (P.traffic === 'bc') finish(tr, R, 'bc', 'broadcast contido na VLAN 10', 'est');
  else finish(tr, R, 'cross', 'o Host B não recebeu', 'est');
  return tr;
}

// ---- 3. Roteamento entre VLANs (router-on-a-stick) ----

export interface RotaParams {
  rtt: number;
  rdst: 'b' | 'd';
  rmode: 'ok' | 'nosubif' | 'poda';
}

export function buildRota(P: RotaParams): Trace {
  const cols = ['a', 'b', 'sw1', 'r1', 'sw2', 'd'];
  const net = makeNet({ router: P.rmode === 'poda' ? [10] : [10, 20] });
  const dst = HOSTS[P.rdst];
  const { tr, R } = base('rota', cols, net, P.rtt, { rdst: P.rdst, rmode: P.rmode, ttlIn: 64, ttlOut: 0 });
  tr.st(0, 'phase', 'o Host A envia', 'warn');
  tr.st(0, 'via', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.ev(0, 'a', 'Quer falar com ' + dst.name + ' (' + dst.ip + '), que está em outra sub-rede. Envia o quadro ao gateway 192.168.10.1, cujo MAC é o do R1', '');
  const w1 = ping(HOSTS.a, dst, R1.mac);
  const sp1 = spread(net, 'a', w1);
  run(tr, R, sp1, cols);
  if (sp1.delivered.indexOf('r1') < 0) {
    finish(tr, R, 'nogw', 'o quadro não chegou ao R1', 'bad');
    return tr;
  }
  tr.wait(0.4);
  if (P.rmode === 'nosubif') {
    tr.ev(tr.t, 'r1', 'Consulta a tabela de rotas: só existe a subinterface da VLAN 10. Não há rota para 192.168.20.0/24', 'bad');
    tr.lg(tr.t, 'R1 não tem rota para 192.168.20.0/24 e responde com ICMP Destination Unreachable (RFC 792).', 'loss');
    const un: Wire = { smac: R1.mac, dmac: HOSTS.a.mac, tags: [10], kind: 'unreach', sip: R1.gw10, dip: HOSTS.a.ip, ttl: 64 };
    run(tr, R, spread(net, 'r1', un), cols);
    R.delivered = R.delivered.filter((k: string) => k !== 'r1');
    finish(tr, R, 'noroute', 'sem rota para a VLAN 20', 'bad');
    return tr;
  }
  tr.ev(tr.t, 'r1', 'Recebe pela subinterface .10 (tag 10), consulta a tabela de rotas: 192.168.20.0/24 está ligada à subinterface .20. Reduz o TTL de 64 para 63 e reescreve os MACs', 'ok');
  R.ttlOut = 63;
  const w2: Wire = { smac: R1.mac, dmac: dst.mac, tags: [20], kind: 'icmp', sip: HOSTS.a.ip, dip: dst.ip, ttl: 63 };
  const before = R.delivered.length;
  run(tr, R, spread(net, 'r1', w2), cols);
  const got = R.delivered.slice(before).indexOf(P.rdst) >= 0;
  if (got) finish(tr, R, 'ok', 'entregue a ' + dst.name + ' pelo R1', 'est');
  else finish(tr, R, 'poda', 'o tronco do R1 não leva a VLAN 20', 'bad');
  return tr;
}

// ---- 4. VLAN nativa ----

export interface NativaParams {
  rtt: number;
  nat1: number;
  nat2: number;
  src: 'a' | 'b';
}

export function buildNativa(P: NativaParams): Trace {
  const net = makeNet({ nat1: P.nat1, nat2: P.nat2 });
  const { tr, R } = base('nativa', COLS_ALL, net, P.rtt, { nat1: P.nat1, nat2: P.nat2, src: P.src });
  const from = HOSTS[P.src];
  const to = HOSTS[P.src === 'a' ? 'c' : 'd'];
  tr.st(0, 'phase', from.name + ' envia', 'warn');
  tr.st(0, 'via', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.ev(0, P.src, 'Envia um ping para ' + to.name + ' (mesma VLAN ' + from.vlan + ', outro switch). A VLAN nativa é ' + P.nat1 + ' no SW1 e ' + P.nat2 + ' no SW2', P.nat1 === P.nat2 ? '' : 'warn');
  const sp = spread(net, P.src, ping(from, to));
  run(tr, R, sp, COLS_ALL);
  const ok = sp.delivered.indexOf(to.key) >= 0;
  R.leakedTo = sp.ignored.filter((k) => HOSTS[k].vlan !== from.vlan);
  R.crossedUntagged = from.vlan === P.nat1;
  if (ok) finish(tr, R, from.vlan === P.nat1 ? 'ok-untag' : 'ok-tag', 'entregue a ' + to.name, 'est');
  else finish(tr, R, 'leak', 'o quadro foi para a VLAN ' + (R.leakedTo.length ? HOSTS[R.leakedTo[0]].vlan : P.nat2), 'bad');
  return tr;
}

// ---- 5. VLAN hopping e defesas ----

export interface HopParams {
  rtt: number;
  hatk: 'spoof' | 'double';
  hdef: 'none' | 'def';
}

export function buildHop(P: HopParams): Trace {
  const cols = ['m', 'a', 'sw1', 'sw2', 'c', 'd'];
  const spoof = P.hatk === 'spoof';
  const def = P.hdef === 'def';
  // spoof: a porta do invasor é dinâmica (negocia tronco) ou fixa em acesso; double: a VLAN nativa do tronco é a do invasor ou uma VLAN sem uso
  const net = makeNet(spoof ? { attacker: { mode: 'access', vid: 10, native: 0, allowed: null } } : { nat1: def ? 999 : 10, nat2: def ? 999 : 10, attacker: { mode: 'access', vid: 10, native: 0, allowed: null } });
  const { tr, R } = base('hop', cols, net, P.rtt, { hatk: P.hatk, hdef: P.hdef, dynamic: spoof && !def });
  tr.st(0, 'phase', 'o invasor age', 'warn');
  tr.st(0, 'via', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  const victim = HOSTS.d;
  if (spoof) {
    tr.ev(0, 'sw1', def ? 'Porta 5 fixa em modo acesso (VLAN 10), com a negociação de tronco desligada' : 'Porta 5 em modo dinâmico: aceita virar tronco se o outro lado pedir', def ? 'ok' : 'warn');
    tr.phase('1. O invasor tenta negociar um tronco', 'negociação');
    tr.st(tr.t, 'phase', 'negociação de tronco', 'warn');
    const m1 = tr.add('m', 'sw1', { label: 'Pedido de tronco', proto: 'negociação (proprietária)', color: C0.plain, len: 0, fields: [{ sec: 'Negociação de tronco' }, ['Porta', 'p5 do SW1', ''], ['Pedido', 'o invasor se apresenta como switch e quer um tronco', 'o formato do protocolo é proprietário e não é reproduzido aqui']], info: 'O host se faz passar por um switch', about: 'Recursos de negociação automática de tronco são proprietários de alguns fabricantes (não fazem parte do IEEE 802.1Q). O simulador mostra só o efeito, não o formato da mensagem.', phaseName: 'Negociação' });
    if (def) {
      tr.ev(m1.tArr, 'sw1', 'Ignora o pedido: a porta é fixa em acesso e não negocia', 'ok');
      tr.st(m1.tArr, 'via', 'sem tronco: porta continua de acesso', 'est');
    } else {
      tr.add('sw1', 'm', { label: 'Aceita o tronco', proto: 'negociação (proprietária)', color: C0.bad, len: 0, fields: [{ sec: 'Negociação de tronco' }, ['Resultado', 'a porta 5 passa a ser tronco', 'todas as VLANs permitidas']], info: 'O SW1 aceita', about: 'A porta de acesso virou um tronco: o invasor agora pode marcar quadros com qualquer VLAN.', phaseName: 'Negociação' });
      net.ports['sw1:5'] = { mode: 'trunk', vid: 0, native: 1, allowed: null };
      tr.ev(tr.t, 'sw1', 'A porta 5 virou tronco: aceita quadros de qualquer VLAN', 'bad');
    }
    tr.wait(0.4);
    const w = ping(HOSTS.m, victim);
    w.tags = [20];
    tr.ev(tr.t, 'm', 'Envia um quadro marcado com a VLAN 20 ao ' + victim.name, 'warn');
    run(tr, R, spread(net, 'm', w), cols);
    R.escaped = R.delivered.indexOf('d') >= 0;
    if (R.escaped) finish(tr, R, 'spoof-ok', 'o quadro chegou à VLAN 20', 'bad');
    else finish(tr, R, 'spoof-def', 'ataque barrado na porta', 'est');
  } else {
    tr.ev(0, 'sw1', 'Tronco com a VLAN nativa ' + (def ? '999 (sem hosts)' : '10 (a mesma VLAN do invasor)'), def ? 'ok' : 'warn');
    tr.ev(0, 'm', 'Envia um quadro com duas tags: a externa é a VLAN 10 e a interna é a VLAN 20', 'warn');
    const w = ping(HOSTS.m, victim);
    w.tags = [10, 20];
    run(tr, R, spread(net, 'm', w), cols);
    R.escaped = R.delivered.indexOf('d') >= 0;
    if (R.escaped) finish(tr, R, 'dbl-ok', 'o quadro chegou à VLAN 20', 'bad');
    else finish(tr, R, 'dbl-def', 'nenhuma entrega na VLAN 20', 'est');
  }
  return tr;
}
