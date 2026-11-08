// Motor do IPv4, modo "fwd" (encaminhamento): um ping atravessa quatro roteadores com tabelas estáticas.
//   - cada roteador busca o destino na sua tabela e vence o maior prefixo (RFC 1812, seção 5.2.4.3);
//   - em empate de prefixo, vence a menor distância administrativa (a preferência administrativa da RFC 1812, seção
//     5.2.4.4, cujos valores são convenções de fabricantes) e depois a menor métrica;
//   - o TTL é decrementado a cada salto e, ao chegar a zero, o pacote é descartado com ICMP 11/0 (RFC 1812, seção 5.3.1);
//   - sem rota, o roteador responde ICMP 3/0 (RFC 792); uma rota blackhole descarta em silêncio;
//   - o uRPF confere a origem na entrada do R1 (RFC 3704, seções 2.2 e 2.4).
// Os endereços são de uso privado (RFC 1918) e de documentação (RFC 5737). Não há tráfego real. O ping é apenas a sonda:
// o foco é a decisão de cada roteador, não o ICMP (veja o simulador de ICMP).
import { COLORS as C0, newTrace, type Column, type Field, type Message, type StateDef, type Trace } from '../../sim-core';
import { ipv4Header, lookup, routeText, type Route } from './model';

export interface FwdParams {
  hop: number;
  dest: 'srv1' | 'srv2' | 'nonet' | 'inet';
  ttl: number;
  agg: boolean;
  dfl: boolean;
  loopf: boolean;
  bh: boolean;
  back: boolean;
  dup: 'none' | 'ad' | 'metric';
  urpf: 'off' | 'strict' | 'loose';
  spoof: boolean;
}

export const DEST_IP = { srv1: '10.2.1.20', srv2: '10.2.5.20', nonet: '10.2.9.9', inet: '198.51.100.9' } as const;
export const PC_IP = '10.1.1.10';
export const SPOOF_IP = '192.0.2.77';

export const NODE_LABEL: Record<string, string> = { pc: 'PC-A', r1: 'R1', r2: 'R2', r3: 'R3', r4: 'R4', srv1: 'SRV1', srv2: 'SRV2', isp: 'Provedor' };
const HOST_IP: Record<string, string> = { pc: PC_IP, srv1: DEST_IP.srv1, srv2: DEST_IP.srv2 };
/** Quem é dono de cada endereço de interface (para resolver o próximo salto de uma rota). */
const OWNER: Record<string, string> = {
  '10.1.1.1': 'r1', '10.0.12.1': 'r1', '10.0.12.2': 'r2', '10.0.23.1': 'r2', '10.0.24.1': 'r2', '10.0.23.2': 'r3', '10.0.24.2': 'r4', '10.2.1.1': 'r3', '10.2.5.1': 'r4', '203.0.113.1': 'isp',
};
/** Endereço da interface por onde cada nó recebe o pacote de cada vizinho: é a origem dos avisos ICMP. */
const ING: Record<string, Record<string, string>> = {
  r1: { pc: '10.1.1.1', r2: '10.0.12.1' },
  r2: { r1: '10.0.12.2', r3: '10.0.23.1', r4: '10.0.24.1' },
  r3: { r2: '10.0.23.2', srv1: '10.2.1.1' },
  r4: { r2: '10.0.24.2', srv2: '10.2.5.1', isp: '203.0.113.2' },
};
const HOSTS_BEHIND: Record<string, string[]> = { r1: ['pc'], r3: ['srv1'], r4: ['srv2'] };

export const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'ttl', label: 'TTL do pacote' },
  { key: 'rota', label: 'Última decisão de rota' },
  { key: 'res', label: 'Resultado' },
];

const C = (net: string, len: number, iface: string): Route => ({ net, len, kind: 'conn', iface, proto: 'C', ad: 0, metric: 0 });
const S = (net: string, len: number, via: string, iface: string, metric = 0): Route => ({ net, len, kind: 'via', via, iface, proto: 'S', ad: 1, metric });
const O = (net: string, len: number, via: string, iface: string, metric: number): Route => ({ net, len, kind: 'via', via, iface, proto: 'O', ad: 110, metric });

/** Tabelas de rotas de cada nó, conforme as opções do cenário. */
export function tablesFor(P: FwdParams): Record<string, Route[]> {
  const r2: Route[] = [C('10.0.12.0', 30, 'eth0'), C('10.0.23.0', 30, 'eth1'), C('10.0.24.0', 30, 'eth2'), S('10.1.0.0', 16, '10.0.12.1', 'eth0')];
  if (P.agg) {
    if (P.dup === 'metric') r2.push(O('10.2.0.0', 16, '10.0.23.2', 'eth1', 20), O('10.2.0.0', 16, '10.0.24.2', 'eth2', 30));
    else r2.push(S('10.2.0.0', 16, '10.0.23.2', 'eth1'));
  }
  r2.push(S('10.2.5.0', 24, '10.0.24.2', 'eth2'));
  if (P.dup === 'ad') r2.push(O('10.2.5.0', 24, '10.0.23.2', 'eth1', 20));
  if (P.dfl) r2.push(S('0.0.0.0', 0, '10.0.24.2', 'eth2'));
  const r3: Route[] = [C('10.0.23.0', 30, 'eth0'), C('10.2.1.0', 24, 'eth1')];
  if (P.back) r3.push(S('10.1.0.0', 16, '10.0.23.1', 'eth0'));
  if (P.loopf) r3.push(S('0.0.0.0', 0, '10.0.23.1', 'eth0'));
  if (P.bh) r3.push({ net: '10.2.9.0', len: 24, kind: 'blackhole', iface: 'Null0', proto: 'S', ad: 1, metric: 0 });
  return {
    pc: [C('10.1.1.0', 24, 'eth0'), S('0.0.0.0', 0, '10.1.1.1', 'eth0')],
    r1: [C('10.1.1.0', 24, 'eth0'), C('10.0.12.0', 30, 'eth1'), S('0.0.0.0', 0, '10.0.12.2', 'eth1')],
    r2,
    r3,
    r4: [C('10.0.24.0', 30, 'eth0'), C('10.2.5.0', 24, 'eth1'), C('203.0.113.0', 30, 'eth2'), S('10.1.0.0', 16, '10.0.24.1', 'eth0'), S('0.0.0.0', 0, '203.0.113.1', 'eth2')],
    srv1: [C('10.2.1.0', 24, 'eth0'), S('0.0.0.0', 0, '10.2.1.1', 'eth0')],
    srv2: [C('10.2.5.0', 24, 'eth0'), S('0.0.0.0', 0, '10.2.5.1', 'eth0')],
  };
}

interface Pkt {
  src: string;
  dst: string;
  ttl: number;
  type: 'req' | 'rep' | 'err';
  icmp: [number, number];
}

export interface LookupRec {
  t: number;
  n: string;
  d: string;
  m: number[];
  w: number;
  note: string;
}
export interface PktRec {
  m: number;
  ttl: number;
  src: string;
  dst: string;
  id: number;
  len: number;
  ty: number;
  co: number;
}

const ICMP_NAME: Record<string, string> = { '8/0': 'Echo Request (8/0)', '0/0': 'Echo Reply (0/0)', '11/0': 'Time Exceeded (11/0)', '3/0': 'Destination Unreachable, rede (3/0)', '3/1': 'Destination Unreachable, host (3/1)' };

function fieldsOf(p: Pkt, id: number, len: number, hdr: { sum: number }): Field[] {
  const f: Field[] = [
    { sec: 'IPv4 (RFC 791)' },
    ['Versão e IHL', '4 e 5', 'IPv4, cabeçalho de 20 bytes (5 palavras de 32 bits)'],
    ['Comprimento total', len + ' bytes', ''],
    ['Identificação', '0x' + id.toString(16).padStart(4, '0'), ''],
    ['TTL', String(p.ttl), 'cada roteador o decrementa; um pacote que chega com 1 é descartado (RFC 1812, seção 5.3.1)'],
    ['Protocolo', '1 (ICMP)', ''],
    ['Checksum do cabeçalho', '0x' + hdr.sum.toString(16).padStart(4, '0'), 'recalculado a cada salto, porque o TTL muda (RFC 1071)'],
    ['Origem', p.src, ''],
    ['Destino', p.dst, ''],
    { sec: 'ICMP (RFC 792)' },
    ['Tipo e código', p.icmp[0] + '/' + p.icmp[1], ICMP_NAME[p.icmp.join('/')] || ''],
  ];
  if (p.type === 'err') f.push(['Conteúdo', 'cabeçalho IP original e 8 bytes', 'permite à origem identificar qual pacote falhou']);
  return f;
}

export function buildFwd(P: FwdParams, _sub: string): Trace {
  const COLS: Column[] = [
    { key: 'pc', label: 'PC-A', sub: 'origem', addr: PC_IP },
    { key: 'r1', label: 'R1', sub: 'roteador', addr: '10.1.1.1' },
    { key: 'r2', label: 'R2', sub: 'roteador', addr: '10.0.12.2' },
    { key: 'r3', label: 'R3', sub: 'roteador', addr: '10.0.23.2' },
    { key: 'r4', label: 'R4', sub: 'roteador', addr: '10.0.24.2' },
    { key: 'dst', label: P.dest === 'srv2' ? 'SRV2' : P.dest === 'srv1' ? 'SRV1' : 'Destino', sub: P.dest === 'nonet' ? 'sem host' : 'servidor', addr: DEST_IP[P.dest === 'inet' ? 'nonet' : P.dest] },
    { key: 'isp', label: 'Provedor', sub: 'saída pela borda', addr: '203.0.113.1' },
  ];
  const tr = newTrace(COLS, STATES, P.hop * 2);
  const T = tablesFor(P);
  const dstIp = DEST_IP[P.dest];
  const srcIp = P.spoof ? SPOOF_IP : PC_IP;
  const L: LookupRec[] = [];
  const K: PktRec[] = [];
  const R: Record<string, any> = { P, dstIp, srcIp, tables: T, lk: L, pk: K, reqDelivered: false, gotReply: false, gotErr: null as null | string, edge: false, drop: null as null | { node: string; why: string }, hops: 0, notes: [] as string[] };
  let idc = 0x1c40;
  let guard = 0;
  const col = (n: string): string => (n === 'srv1' || n === 'srv2' ? 'dst' : n);
  const nm = (n: string): string => NODE_LABEL[n];

  function hop(from: string, to: string, p: Pkt, info: string, about: string): Message {
    const id = idc++;
    const len = p.type === 'err' ? 56 : 84;
    const h = ipv4Header({ len, id, ttl: p.ttl, proto: 1, src: p.src, dst: p.dst });
    const name = p.type === 'req' ? 'Echo Request' : p.type === 'rep' ? 'Echo Reply' : p.icmp[0] === 11 ? 'Time Exceeded' : p.icmp[1] === 1 ? 'Host Unreachable' : 'Net Unreachable';
    const m = tr.add(col(from), col(to), {
      label: name + ', TTL ' + p.ttl, proto: 'ICMP', color: p.type === 'err' ? C0.bad : p.type === 'rep' ? C0.data : C0.plain, len, info, about,
      phaseName: p.type === 'req' ? 'Ida' : p.type === 'rep' ? 'Volta' : 'Aviso ICMP', fields: fieldsOf(p, id, len, h), route: [from, to],
    });
    K.push({ m: m.id, ttl: p.ttl, src: p.src, dst: p.dst, id, len, ty: p.icmp[0], co: p.icmp[1] });
    tr.st(m.tSend, 'ttl', String(p.ttl), p.ttl <= 2 ? 'warn' : 'est');
    return m;
  }

  /** Explica por que a rota venceu: maior prefixo ou, em empate, distância administrativa e métrica. */
  function why(node: string, l: ReturnType<typeof lookup>): string {
    const tb = T[node];
    if (l.winner < 0) return 'nenhuma rota casa';
    const w = tb[l.winner];
    const tie = l.matches.filter((i) => i !== l.winner && tb[i].len === w.len);
    if (tie.length) {
      const o = tb[tie[0]];
      return o.ad !== w.ad ? 'mesmo prefixo: vence a menor distância administrativa (' + w.ad + ' contra ' + o.ad + ')' : 'mesmo prefixo e mesma distância: vence a menor métrica (' + w.metric + ' contra ' + o.metric + ')';
    }
    return l.matches.length > 1 ? 'vence o maior prefixo, /' + w.len : 'única rota que casa';
  }

  function silent(node: string, why: string, text: string): void {
    tr.ev(tr.t, col(node), text, 'bad');
    tr.lg(tr.t, nm(node) + ': ' + text, 'loss');
    R.drop = { node, why };
  }

  function icmpErr(node: string, from: string | null, p: Pkt, type: number, code: number, text: string): void {
    tr.ev(tr.t, col(node), text, 'bad');
    tr.lg(tr.t, nm(node) + ': ' + text, 'err');
    if (p.type === 'err') {
      tr.ev(tr.t, col(node), 'Não se gera erro ICMP sobre outro erro ICMP (RFC 1812, seção 4.3.2.7)', 'warn');
      R.drop = { node, why: 'err' };
      return;
    }
    const src = (from && ING[node] && ING[node][from]) || Object.values(ING[node] || {})[0];
    send(node, null, { src, dst: p.src, ttl: 64, type: 'err', icmp: [type, code] });
  }

  /** Decide o próximo salto de um pacote que está no nó (originado ali ou recebido de from). */
  function send(node: string, from: string | null, p: Pkt): void {
    if (++guard > 90) return;
    const tb = T[node];
    const l = lookup(tb, p.dst);
    const note = nm(node) + ': ' + p.dst + (l.winner < 0 ? ' não casa com nenhuma rota' : ' casa com ' + l.matches.length + (l.matches.length === 1 ? ' rota' : ' rotas') + '; vence ' + tb[l.winner].net + '/' + tb[l.winner].len + ' (' + why(node, l) + ')');
    L.push({ t: tr.t, n: node, d: p.dst, m: l.matches, w: l.winner, note });
    tr.ev(tr.t, col(node), note, l.winner < 0 ? 'bad' : 'ok');
    tr.lg(tr.t, note, 'conn');
    tr.st(tr.t, 'rota', l.winner < 0 ? 'sem rota para ' + p.dst : nm(node) + ': ' + routeText(tb[l.winner]), l.winner < 0 ? 'bad' : 'est');
    if (l.winner < 0) return icmpErr(node, from, p, 3, 0, 'Sem rota para ' + p.dst + ': descarta e avisa a origem (ICMP 3/0)');
    const r = tb[l.winner];
    const q: Pkt = { ...p, ttl: from ? p.ttl - 1 : p.ttl };
    if (r.kind === 'blackhole') return silent(node, 'blackhole', 'Rota blackhole para ' + r.net + '/' + r.len + ': descarta em silêncio');
    if (r.kind === 'conn') {
      const host = (HOSTS_BEHIND[node] || []).find((h) => HOST_IP[h] === p.dst);
      if (!host) return icmpErr(node, from, p, 3, 1, 'Rede conectada, mas nenhum host responde por ' + p.dst + ': host inalcançável (ICMP 3/1)');
      hop(node, host, q, 'Entrega na rede conectada', 'O roteador entrega o pacote ao destino na rede conectada (ARP já resolvido).');
      return receive(host, node, q);
    }
    const next = OWNER[r.via!];
    R.hops++;
    hop(node, next, q, 'Próximo salto: ' + nm(next), nm(node) + ' encaminha para ' + r.via + ' (' + nm(next) + ') pela interface ' + r.iface + (from ? ', depois de decrementar o TTL.' : '.'));
    if (next === 'isp') {
      R.edge = true;
      tr.ev(tr.t, 'isp', 'O pacote saiu pela borda para o provedor', 'warn');
      tr.lg(tr.t, 'Provedor: recebe ' + p.dst + ' vindo de ' + p.src + '. Fim do trajeto simulado.', 'conn');
      return;
    }
    receive(next, node, q);
  }

  function receive(node: string, from: string, p: Pkt): void {
    if (node === 'pc' || node === 'srv1' || node === 'srv2') return atHost(node, p);
    // uRPF na entrada do R1, pela interface da LAN (RFC 3704)
    if (node === 'r1' && from === 'pc' && P.urpf !== 'off') {
      const rl = lookup(T.r1, p.src);
      const rt = rl.winner >= 0 ? T.r1[rl.winner] : null;
      const ok = P.urpf === 'loose' ? !!rt : !!rt && rt.iface === 'eth0';
      const how = rt ? 'a rota de volta para ' + p.src + ' é ' + (rt.net === '0.0.0.0' ? 'a padrão' : rt.net + '/' + rt.len) + ', pela interface ' + rt.iface : 'não há rota de volta para ' + p.src;
      if (!ok) {
        tr.ev(tr.t, 'r1', 'uRPF ' + (P.urpf === 'strict' ? 'estrito' : 'flexível') + ': ' + how + '. Origem inválida, descarta', 'bad');
        tr.lg(tr.t, 'R1: uRPF reprova a origem ' + p.src + ' recebida na eth0 (' + how + ').', 'loss');
        R.drop = { node: 'r1', why: 'urpf' };
        tr.st(tr.t, 'rota', 'uRPF descartou o pacote', 'bad');
        return;
      }
      tr.ev(tr.t, 'r1', 'uRPF ' + (P.urpf === 'strict' ? 'estrito' : 'flexível') + ': ' + how + '. Origem aceita', 'ok');
      tr.lg(tr.t, 'R1: uRPF aprova a origem ' + p.src + ' (' + how + ').', 'conn');
      if (P.urpf === 'loose' && rt && rt.net === '0.0.0.0') R.notes.push('looseDefault');
    }
    if (p.ttl <= 1) {
      tr.st(tr.t, 'ttl', '1: expira', 'bad');
      return icmpErr(node, from, p, 11, 0, 'TTL chegou com 1: ao decrementar vira 0, descarta e avisa a origem (ICMP 11/0)');
    }
    send(node, from, p);
  }

  function atHost(node: string, p: Pkt): void {
    if (p.type === 'req') {
      R.reqDelivered = true;
      R.reqAt = node;
      tr.ev(tr.t, col(node), 'Recebe o Echo Request de ' + p.src + ' e responde', 'ok');
      tr.lg(tr.t, nm(node) + ': Echo Request de ' + p.src + ' recebido (TTL ' + p.ttl + '). Envia o Echo Reply.', 'conn');
      tr.phase('Volta', 'volta');
      send(node, null, { src: p.dst, dst: p.src, ttl: 64, type: 'rep', icmp: [0, 0] });
      return;
    }
    if (node === 'pc') {
      if (p.type === 'rep') {
        R.gotReply = true;
        tr.ev(tr.t, 'pc', 'Echo Reply recebido: o ping funcionou', 'ok');
        tr.lg(tr.t, 'PC-A: resposta de ' + p.src + ' (TTL ' + p.ttl + ').', 'conn');
      } else {
        R.gotErr = p.icmp[0] === 11 ? 'ttl' : p.icmp[1] === 1 ? 'host' : 'net';
        R.errFrom = p.src;
        tr.ev(tr.t, 'pc', 'Recebe ICMP ' + p.icmp[0] + '/' + p.icmp[1] + ' de ' + p.src + ': ' + (p.icmp[0] === 11 ? 'tempo excedido em trânsito' : 'destino inalcançável'), 'bad');
        tr.lg(tr.t, 'PC-A: ' + ICMP_NAME[p.icmp.join('/')] + ' vindo de ' + p.src + '.', 'err');
      }
      return;
    }
    tr.ev(tr.t, col(node), 'Recebe o aviso ICMP ' + p.icmp[0] + '/' + p.icmp[1] + ' sobre a própria resposta', 'warn');
    R.srvErr = true;
  }

  tr.ev(0, 'pc', 'Ping de ' + srcIp + ' para ' + dstIp + ', TTL ' + P.ttl, '');
  tr.lg(0, 'PC-A: ping para ' + dstIp + ' com TTL ' + P.ttl + (P.spoof ? ' e origem forjada ' + srcIp : '') + '.', 'sys');
  tr.st(0, 'phase', 'ida', 'warn');
  tr.st(0, 'ttl', String(P.ttl), 'est');
  tr.st(0, 'rota', '-', 'closed');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.mile(0, 'Ida', 'ping');
  tr.phase('Ida', 'ida');
  send('pc', null, { src: srcIp, dst: dstIp, ttl: P.ttl, type: 'req', icmp: [8, 0] });

  // resultado, do ponto de vista de quem enviou o ping
  let res: string;
  if (R.gotReply) res = 'ok';
  else if (R.gotErr === 'ttl') res = 'ttl';
  else if (R.gotErr) res = 'unreach';
  else if (R.edge) res = 'borda';
  else if (R.reqDelivered) res = P.spoof ? 'spoof' : 'noback';
  else if (R.drop && R.drop.why === 'urpf') res = 'urpf';
  else if (R.drop && R.drop.why === 'blackhole') res = 'blackhole';
  else res = 'timeout';
  if (!R.gotReply && !R.gotErr && !R.edge) {
    tr.wait(1000);
    tr.ev(tr.t, 'pc', 'Sem resposta: o ping expira (1 s)', 'bad');
    tr.lg(tr.t, 'PC-A: tempo esgotado, nenhuma resposta nem aviso ICMP.', 'loss');
  }
  const label: Record<string, string> = { ok: 'ping funcionou', ttl: 'TTL excedido', unreach: 'destino inalcançável', borda: 'saiu pela borda', spoof: 'entregue com origem forjada', noback: 'ida entregue, volta perdida', urpf: 'descartado pelo uRPF', blackhole: 'descartado em silêncio', timeout: 'sem resposta' };
  tr.st(tr.t, 'res', label[res], res === 'ok' ? 'est' : 'bad');
  tr.st(tr.t, 'phase', 'fim', 'closed');
  tr.mile(tr.t, 'Fim', label[res]);
  R.result = res;
  tr.cols = tr.cols.filter((c) => c.key !== 'dst' || tr.msgs.some((m) => m.from === 'dst' || m.to === 'dst')).filter((c) => c.key !== 'isp' || tr.msgs.some((m) => m.to === 'isp'));
  tr.raw = R;
  return tr;
}
