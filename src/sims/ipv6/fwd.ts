// Motor do IPv6, modo "fwd" (encaminhamento): um ping atravessa roteadores com tabelas estáticas.
//   - cada roteador busca o destino na sua tabela e vence o maior prefixo, como no IPv4;
//   - o Hop Limit é decrementado a cada salto e, ao chegar a zero, o pacote é descartado com ICMPv6 3/0 (RFC 8200, seção 3;
//     RFC 4443, seção 3.3). Não há checksum de cabeçalho a recalcular: o cabeçalho IPv6 não o tem;
//   - sem rota, o roteador responde ICMPv6 1/0 (RFC 4443, seção 3.1);
//   - o Neighbor Discovery (RFC 4861) substitui o ARP: o primeiro salto do host e a entrega ao destino usam Neighbor
//     Solicitation e Advertisement; sem resposta, o roteador envia ICMPv6 1/3, endereço inalcançável (RFC 4443, seção 3.1).
// Os endereços são de documentação (RFC 3849). Não há tráfego real. O ping é só a sonda: o foco é a decisão de cada roteador.
import { COLORS as C0, newTrace, type Column, type Field, type Message, type StateDef, type Trace } from '../../sim-core';
import { fmt6, lookup6, mcastMac6, parse6, routeText6, solicited6, type Route6 } from './model';

export interface FwdParams {
  hop: number;
  dest: 'srv1' | 'srv2' | 'ghost' | 'nonet' | 'ext';
  hl: number;
  agg: boolean;
  dfl: boolean;
  back: boolean;
}

export const DEST_IP = { srv1: '2001:db8:2:1::20', srv2: '2001:db8:2:5::20', ghost: '2001:db8:2:1::99', nonet: '2001:db8:2:9::9', ext: '2001:db8:ffff::1' } as const;
export const PC_IP = '2001:db8:1:1::10';

export const NODE_LABEL: Record<string, string> = { pc: 'PC-A', r1: 'R1', r2: 'R2', r3: 'R3', r4: 'R4', srv1: 'SRV1', srv2: 'SRV2', isp: 'Provedor' };
const HOST_IP: Record<string, string> = { pc: PC_IP, srv1: DEST_IP.srv1, srv2: DEST_IP.srv2 };
/** Endereço de enlace local do R1 na LAN do PC-A: é o próximo salto da rota padrão do host, aprendido pelo RA (RFC 4861). */
export const GW_LL = 'fe80::1';
/** Quem é dono de cada endereço de interface (para resolver o próximo salto de uma rota). */
const OWNER: Record<string, string> = {
  'fe80::1': 'r1', '2001:db8:1:1::1': 'r1', '2001:db8:0:12::1': 'r1', '2001:db8:0:12::2': 'r2', '2001:db8:0:23::1': 'r2', '2001:db8:0:24::1': 'r2',
  '2001:db8:0:23::2': 'r3', '2001:db8:2:1::1': 'r3', '2001:db8:0:24::2': 'r4', '2001:db8:2:5::1': 'r4', '2001:db8:0:ff::2': 'r4', '2001:db8:0:ff::1': 'isp',
};
/** Endereço da interface por onde cada nó recebe o pacote de cada vizinho: é a origem dos avisos ICMPv6. */
const ING: Record<string, Record<string, string>> = {
  r1: { pc: '2001:db8:1:1::1', r2: '2001:db8:0:12::1' },
  r2: { r1: '2001:db8:0:12::2', r3: '2001:db8:0:23::1', r4: '2001:db8:0:24::1' },
  r3: { r2: '2001:db8:0:23::2', srv1: '2001:db8:2:1::1' },
  r4: { r2: '2001:db8:0:24::2', srv2: '2001:db8:2:5::1', isp: '2001:db8:0:ff::2' },
};
const HOSTS_BEHIND: Record<string, string[]> = { r1: ['pc'], r3: ['srv1'], r4: ['srv2'] };
export const MAC: Record<string, string> = { pc: '00:00:5e:00:53:0a', r1: '00:00:5e:00:53:01', r3: '00:00:5e:00:53:03', r4: '00:00:5e:00:53:04', srv1: '00:00:5e:00:53:21', srv2: '00:00:5e:00:53:22' };

export const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'hl', label: 'Hop Limit do pacote' },
  { key: 'rota', label: 'Última decisão de rota' },
  { key: 'res', label: 'Resultado' },
];

const C = (net: string, len: number, iface: string): Route6 => ({ net, len, kind: 'conn', iface, proto: 'C', metric: 0 });
const S = (net: string, len: number, via: string, iface: string): Route6 => ({ net, len, kind: 'via', via, iface, proto: 'S', metric: 0 });

/** Tabelas de rotas de cada nó, conforme as opções do cenário. */
export function tablesFor(P: FwdParams): Record<string, Route6[]> {
  const r2: Route6[] = [C('2001:db8:0:12::', 64, 'eth0'), C('2001:db8:0:23::', 64, 'eth1'), C('2001:db8:0:24::', 64, 'eth2'), S('2001:db8:1::', 48, '2001:db8:0:12::1', 'eth0')];
  if (P.agg) r2.push(S('2001:db8:2::', 48, '2001:db8:0:23::2', 'eth1'));
  r2.push(S('2001:db8:2:5::', 64, '2001:db8:0:24::2', 'eth2'));
  if (P.dfl) r2.push(S('::', 0, '2001:db8:0:24::2', 'eth2'));
  const r3: Route6[] = [C('2001:db8:0:23::', 64, 'eth0'), C('2001:db8:2:1::', 64, 'eth1')];
  if (P.back) r3.push(S('2001:db8:1::', 48, '2001:db8:0:23::1', 'eth0'));
  return {
    pc: [C('2001:db8:1:1::', 64, 'eth0'), S('::', 0, GW_LL, 'eth0')],
    r1: [C('2001:db8:1:1::', 64, 'eth0'), C('2001:db8:0:12::', 64, 'eth1'), S('::', 0, '2001:db8:0:12::2', 'eth1')],
    r2,
    r3,
    r4: [C('2001:db8:0:24::', 64, 'eth0'), C('2001:db8:2:5::', 64, 'eth1'), C('2001:db8:0:ff::', 64, 'eth2'), S('2001:db8:1::', 48, '2001:db8:0:24::1', 'eth0'), S('::', 0, '2001:db8:0:ff::1', 'eth2')],
    srv1: [C('2001:db8:2:1::', 64, 'eth0'), S('::', 0, '2001:db8:2:1::1', 'eth0')],
    srv2: [C('2001:db8:2:5::', 64, 'eth0'), S('::', 0, '2001:db8:2:5::1', 'eth0')],
  };
}

interface Pkt {
  src: string;
  dst: string;
  hl: number;
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
  hl: number;
  src: string;
  dst: string;
  plen: number;
  nh: number;
  ty: number;
  co: number;
}

const ICMP_NAME: Record<string, string> = {
  '128/0': 'Echo Request (128)', '129/0': 'Echo Reply (129)', '3/0': 'Time Exceeded, hop limit (3/0)', '1/0': 'Destination Unreachable, sem rota (1/0)', '1/3': 'Destination Unreachable, endereço inalcançável (1/3)', '1/2': 'Destination Unreachable, além do escopo da origem (1/2)',
};

function fieldsOf(p: Pkt, plen: number): Field[] {
  const f: Field[] = [
    { sec: 'IPv6 (RFC 8200)' },
    ['Versão', '6', 'cabeçalho fixo de 40 bytes'],
    ['Comprimento da carga', plen + ' bytes', 'o que vem depois do cabeçalho de 40 bytes'],
    ['Próximo cabeçalho', '58 (ICMPv6)', ''],
    ['Hop Limit', String(p.hl), 'cada roteador o decrementa; um pacote que chega com 1 é descartado (RFC 8200, seção 3)'],
    ['Origem', p.src, ''],
    ['Destino', p.dst, ''],
    { sec: 'ICMPv6 (RFC 4443)' },
    ['Tipo e código', p.icmp[0] + '/' + p.icmp[1], ICMP_NAME[p.icmp.join('/')] || ''],
    ['Checksum', 'calculado sobre o pseudocabeçalho', 'cobre as origens e destinos IPv6, pois o IPv6 não tem checksum de cabeçalho (RFC 4443, seção 2.3)'],
  ];
  if (p.type === 'err') f.push(['Conteúdo', 'o máximo do pacote original', 'sem passar do MTU mínimo do IPv6, 1280 bytes (RFC 4443, seção 2.4; RFC 8200, seção 5)']);
  return f;
}

export function buildFwd(P: FwdParams, _sub: string): Trace {
  const COLS: Column[] = [
    { key: 'pc', label: 'PC-A', sub: 'origem', addr: PC_IP },
    { key: 'r1', label: 'R1', sub: 'roteador', addr: GW_LL },
    { key: 'r2', label: 'R2', sub: 'roteador', addr: '2001:db8:0:12::2' },
    { key: 'r3', label: 'R3', sub: 'roteador', addr: '2001:db8:0:23::2' },
    { key: 'r4', label: 'R4', sub: 'roteador', addr: '2001:db8:0:24::2' },
    { key: 'dst', label: P.dest === 'srv2' ? 'SRV2' : P.dest === 'srv1' ? 'SRV1' : 'Destino', sub: P.dest === 'ghost' || P.dest === 'nonet' ? 'sem host' : 'servidor', addr: DEST_IP[P.dest === 'ext' ? 'nonet' : P.dest] },
    { key: 'isp', label: 'Provedor', sub: 'saída pela borda', addr: '2001:db8:0:ff::1' },
  ];
  const tr = newTrace(COLS, STATES, P.hop * 2);
  const T = tablesFor(P);
  const dstIp = DEST_IP[P.dest];
  const L: LookupRec[] = [];
  const K: PktRec[] = [];
  const R: Record<string, any> = { P, dstIp, srcIp: PC_IP, tables: T, lk: L, pk: K, nd: [] as { t: number; who: string; target: string; ok: boolean }[], reqDelivered: false, gotReply: false, gotErr: null as null | string, edge: false, drop: null as null | { node: string; why: string }, hops: 0, notes: [] as string[] };
  let guard = 0;
  const col = (n: string): string => (n === 'srv1' || n === 'srv2' ? 'dst' : n);
  const nm = (n: string): string => NODE_LABEL[n];
  const addrOf = (n: string, toward: string): string => (n === 'pc' ? PC_IP : (ING[n] && ING[n][toward]) || Object.values(ING[n] || {})[0]);

  function hop(from: string, to: string, p: Pkt, info: string, about: string): Message {
    const plen = p.type === 'err' ? 104 : 56;
    const name = p.type === 'req' ? 'Echo Request' : p.type === 'rep' ? 'Echo Reply' : p.icmp[0] === 3 ? 'Time Exceeded' : p.icmp[1] === 3 ? 'Address Unreachable' : 'No Route';
    const m = tr.add(col(from), col(to), {
      label: name + ', HL ' + p.hl, proto: 'ICMPv6', color: p.type === 'err' ? C0.bad : p.type === 'rep' ? C0.data : C0.plain, len: 40 + plen, info, about,
      phaseName: p.type === 'req' ? 'Ida' : p.type === 'rep' ? 'Volta' : 'Aviso ICMPv6', fields: fieldsOf(p, plen), route: [from, to],
    });
    K.push({ m: m.id, hl: p.hl, src: p.src, dst: p.dst, plen, nh: 58, ty: p.icmp[0], co: p.icmp[1] });
    tr.st(m.tSend, 'hl', String(p.hl), p.hl <= 2 ? 'warn' : 'est');
    return m;
  }

  /** Neighbor Discovery de um salto: NS ao endereço de nó solicitado do alvo e NA unicast de volta (RFC 4861, seção 7.2). */
  function nd(from: string, to: string, srcAddr: string, target: string, ok: boolean, why: string): boolean {
    const sol = solicited6(target);
    const fromMac = MAC[from] || MAC.r1;
    const tries = ok ? 1 : 3;
    tr.phase('Neighbor Discovery', 'nd');
    for (let n = 1; n <= tries; n++) {
      const ns = tr.add(col(from), col(to), {
        label: 'NS: quem tem ' + target + '?', proto: 'ICMPv6', color: C0.plain, len: 72, lost: !ok,
        info: ok ? 'Neighbor Solicitation, ' + why : 'Neighbor Solicitation ' + n + ' de 3, sem resposta',
        about: 'O nó pergunta, no endereço multicast de nó solicitado ' + sol + ', qual é o MAC de ' + target + '. O endereço multicast chega só aos nós cujos 24 bits finais coincidem, e não a todos os hosts, como o broadcast do ARP.',
        phaseName: 'Neighbor Discovery',
        fields: [{ sec: 'Ethernet II' }, ['Destino', mcastMac6(sol), 'MAC multicast: 33:33 e os 32 bits finais do endereço IPv6'], ['Origem', fromMac, ''], { sec: 'IPv6 (RFC 8200)' }, ['Hop Limit', '255', 'o valor 255 prova que a mensagem veio do mesmo enlace (RFC 4861, seção 7.1)'], ['Origem', srcAddr, ''], ['Destino', sol, 'nó solicitado de ' + target], { sec: 'ICMPv6 (RFC 4861)' }, ['Tipo', '135 (Neighbor Solicitation)', ''], ['Endereço alvo', target, ''], ['Opção 1', 'endereço de enlace de origem ' + fromMac, 'permite ao alvo já guardar o MAC de quem perguntou']],
        route: [from, to],
      });
      tr.lg(ns.tSend, nm(from) + ': Neighbor Solicitation por ' + target + (ok ? '.' : ' (tentativa ' + n + ' de 3).'), 'conn');
      if (!ok && n < tries) tr.wait(1000);
    }
    if (ok) {
      const toMac = MAC[to] || MAC.r1;
      tr.add(col(to), col(from), {
        label: 'NA: ' + target + ' está em ' + toMac, proto: 'ICMPv6', color: C0.data, len: 72, info: 'Neighbor Advertisement', about: 'O alvo responde por unicast, com o próprio MAC, e o nó que perguntou guarda a entrada na tabela de vizinhos.', phaseName: 'Neighbor Discovery',
        fields: [{ sec: 'IPv6 (RFC 8200)' }, ['Hop Limit', '255', ''], ['Origem', target, ''], ['Destino', srcAddr, ''], { sec: 'ICMPv6 (RFC 4861)' }, ['Tipo', '136 (Neighbor Advertisement)', ''], ['Flags', 'R, S, O', 'S: resposta a uma solicitação; O: sobrescreve a entrada antiga'], ['Opção 2', 'endereço de enlace do alvo ' + toMac, '']],
        route: [to, from],
      });
    }
    R.nd.push({ t: tr.t, who: from, target, ok });
    return ok;
  }

  /** Explica por que a rota venceu: maior prefixo ou, em empate, a métrica. */
  function why(node: string, l: ReturnType<typeof lookup6>): string {
    const tb = T[node];
    if (l.winner < 0) return 'nenhuma rota casa';
    const w = tb[l.winner];
    return l.matches.length > 1 ? 'vence o maior prefixo, /' + w.len : 'única rota que casa';
  }

  function icmpErr(node: string, from: string | null, p: Pkt, type: number, code: number, text: string): void {
    tr.ev(tr.t, col(node), text, 'bad');
    tr.lg(tr.t, nm(node) + ': ' + text, 'err');
    if (p.type === 'err') {
      tr.ev(tr.t, col(node), 'Não se gera erro ICMPv6 sobre outro erro ICMPv6 (RFC 4443, seção 2.4)', 'warn');
      R.drop = { node, why: 'err' };
      return;
    }
    send(node, null, { src: addrOf(node, from || ''), dst: p.src, hl: 64, type: 'err', icmp: [type, code] });
  }

  /** Decide o próximo salto de um pacote que está no nó (originado ali ou recebido de from). */
  function send(node: string, from: string | null, p: Pkt): void {
    if (++guard > 90) return;
    const tb = T[node];
    const l = lookup6(tb, p.dst);
    const note = nm(node) + ': ' + p.dst + (l.winner < 0 ? ' não casa com nenhuma rota' : ' casa com ' + l.matches.length + (l.matches.length === 1 ? ' rota' : ' rotas') + '; vence ' + tb[l.winner].net + '/' + tb[l.winner].len + ' (' + why(node, l) + ')');
    L.push({ t: tr.t, n: node, d: p.dst, m: l.matches, w: l.winner, note });
    tr.ev(tr.t, col(node), note, l.winner < 0 ? 'bad' : 'ok');
    tr.lg(tr.t, note, 'conn');
    tr.st(tr.t, 'rota', l.winner < 0 ? 'sem rota para ' + p.dst : nm(node) + ': ' + routeText6(tb[l.winner]), l.winner < 0 ? 'bad' : 'est');
    if (l.winner < 0) return icmpErr(node, from, p, 1, 0, 'Sem rota para ' + p.dst + ': descarta e avisa a origem (ICMPv6 1/0)');
    const r = tb[l.winner];
    const q: Pkt = { ...p, hl: from ? p.hl - 1 : p.hl };
    if (r.kind === 'conn') {
      const host = (HOSTS_BEHIND[node] || []).find((h) => HOST_IP[h] === p.dst);
      if (p.type === 'req') {
        const target = p.dst;
        if (!nd(node, host || 'dst', ING[node][host || 'srv1'] || addrOf(node, ''), target, !!host, 'o roteador precisa do MAC de ' + target)) {
          return icmpErr(node, from, p, 1, 3, 'ND sem resposta para ' + p.dst + ' (3 tentativas): endereço inalcançável (ICMPv6 1/3)');
        }
        tr.phase('Ida', 'ida');
      } else if (!host) {
        return icmpErr(node, from, p, 1, 3, 'Nenhum host responde por ' + p.dst + ': endereço inalcançável (ICMPv6 1/3)');
      }
      hop(node, host!, q, 'Entrega na rede conectada', 'O roteador entrega o pacote ao destino na rede conectada.');
      return receive(host!, node, q);
    }
    const next = OWNER[fmt6(parse6(r.via!))];
    if (node === 'pc' && p.type === 'req') {
      nd('pc', next, PC_IP, r.via!, true, 'o PC-A precisa do MAC do roteador padrão');
      tr.phase('Ida', 'ida');
    }
    R.hops++;
    hop(node, next, q, 'Próximo salto: ' + nm(next), nm(node) + ' encaminha para ' + r.via + ' (' + nm(next) + ') pela interface ' + r.iface + (from ? ', depois de decrementar o Hop Limit.' : '.'));
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
    if (p.hl <= 1) {
      tr.st(tr.t, 'hl', '1: expira', 'bad');
      return icmpErr(node, from, p, 3, 0, 'Hop Limit chegou com 1: ao decrementar vira 0, descarta e avisa a origem (ICMPv6 3/0)');
    }
    send(node, from, p);
  }

  function atHost(node: string, p: Pkt): void {
    if (p.type === 'req') {
      R.reqDelivered = true;
      R.reqAt = node;
      tr.ev(tr.t, col(node), 'Recebe o Echo Request de ' + p.src + ' e responde', 'ok');
      tr.lg(tr.t, nm(node) + ': Echo Request de ' + p.src + ' recebido (Hop Limit ' + p.hl + '). Envia o Echo Reply.', 'conn');
      tr.phase('Volta', 'volta');
      send(node, null, { src: p.dst, dst: p.src, hl: 64, type: 'rep', icmp: [129, 0] });
      return;
    }
    if (node === 'pc') {
      if (p.type === 'rep') {
        R.gotReply = true;
        tr.ev(tr.t, 'pc', 'Echo Reply recebido: o ping funcionou', 'ok');
        tr.lg(tr.t, 'PC-A: resposta de ' + p.src + ' (Hop Limit ' + p.hl + ').', 'conn');
      } else {
        R.gotErr = p.icmp[0] === 3 ? 'hl' : p.icmp[1] === 3 ? 'addr' : 'net';
        R.errFrom = p.src;
        tr.ev(tr.t, 'pc', 'Recebe ICMPv6 ' + p.icmp[0] + '/' + p.icmp[1] + ' de ' + p.src + ': ' + (p.icmp[0] === 3 ? 'tempo excedido em trânsito' : 'destino inalcançável'), 'bad');
        tr.lg(tr.t, 'PC-A: ' + ICMP_NAME[p.icmp.join('/')] + ' vindo de ' + p.src + '.', 'err');
      }
      return;
    }
    tr.ev(tr.t, col(node), 'Recebe o aviso ICMPv6 ' + p.icmp[0] + '/' + p.icmp[1] + ' sobre a própria resposta', 'warn');
    R.srvErr = true;
  }

  tr.ev(0, 'pc', 'Ping de ' + PC_IP + ' para ' + dstIp + ', Hop Limit ' + P.hl, '');
  tr.lg(0, 'PC-A: ping para ' + dstIp + ' com Hop Limit ' + P.hl + '.', 'sys');
  tr.st(0, 'phase', 'ida', 'warn');
  tr.st(0, 'hl', String(P.hl), 'est');
  tr.st(0, 'rota', '-', 'closed');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.mile(0, 'Ida', 'ping');
  tr.phase('Ida', 'ida');
  send('pc', null, { src: PC_IP, dst: dstIp, hl: P.hl, type: 'req', icmp: [128, 0] });

  // resultado, do ponto de vista de quem enviou o ping
  let res: string;
  if (R.gotReply) res = 'ok';
  else if (R.gotErr === 'hl') res = 'hl';
  else if (R.gotErr === 'addr') res = 'addr';
  else if (R.gotErr) res = 'unreach';
  else if (R.edge) res = 'borda';
  else if (R.reqDelivered) res = 'noback';
  else res = 'timeout';
  if (!R.gotReply && !R.gotErr && !R.edge) {
    tr.wait(1000);
    tr.ev(tr.t, 'pc', 'Sem resposta: o ping expira (1 s)', 'bad');
    tr.lg(tr.t, 'PC-A: tempo esgotado, nenhuma resposta nem aviso ICMPv6.', 'loss');
  }
  const label: Record<string, string> = { ok: 'ping funcionou', hl: 'Hop Limit excedido', addr: 'endereço inalcançável (ND)', unreach: 'destino inalcançável', borda: 'saiu pela borda', noback: 'ida entregue, volta perdida', timeout: 'sem resposta' };
  tr.st(tr.t, 'res', label[res], res === 'ok' ? 'est' : 'bad');
  tr.st(tr.t, 'phase', 'fim', 'closed');
  tr.mile(tr.t, 'Fim', label[res]);
  R.result = res;
  tr.cols = tr.cols.filter((c) => c.key !== 'dst' || tr.msgs.some((m) => m.from === 'dst' || m.to === 'dst')).filter((c) => c.key !== 'isp' || tr.msgs.some((m) => m.to === 'isp'));
  tr.raw = R;
  return tr;
}
