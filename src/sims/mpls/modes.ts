// Motores dos quatro modos do simulador de MPLS. Cada um monta a rede, encaminha pacotes (model.forward) e registra
// as mensagens, os eventos e o resultado em um Trace; os dados brutos ficam em tr.raw para a explicação, as abas e a topologia.
import { COLORS, newTrace, type Column, type Field, type StateDef, type Trace } from '../../sim-core';
import {
  fecs,
  fmtL,
  forward,
  HOSTS,
  HOST_DELAY,
  host,
  igpPath,
  isLsr,
  isVpnLabel,
  localLabel,
  lsr,
  lspText,
  LSRS,
  makeNet,
  neighbors,
  NODE_ORDER,
  otherHost,
  pathDelay,
  stackText,
  vpnLabel,
  type Cfg,
  type Net,
  type Php,
  type Pkt,
  type Service,
  type Step,
} from './model';

export const C = { hello: COLORS.plain as string, ldp: COLORS.enc as string, map: '#B48EF0', bgp: COLORS.data as string, data: COLORS.plain as string, reply: COLORS.enc as string, icmp: COLORS.bad as string };

const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'stack', label: 'Pilha de rótulos no último enlace' },
  { key: 'res', label: 'Resultado' },
];

export interface Common {
  service: Service;
  php: Php;
  prop: boolean;
}
export type LdpParams = Common;
export interface DadosParams extends Common {
  dir: string;
  ctl: 'ok' | 'semldp';
}
export interface TtlParams extends Common {
  dir: string;
}
export interface FalhaParams extends Common {
  dir: string;
  fail: string;
}

export interface TermLine {
  t: number;
  text: string;
  cls?: string;
}

const cfgOf = (P: Common, step: number, down: string[]): Cfg => ({ service: P.service, php: P.php, propagate: P.prop, step, down });

function columns(): Column[] {
  return NODE_ORDER.map((k) => {
    if (isLsr(k)) return { key: k, label: k, sub: lsr(k).role === 'PE' ? 'PE (LER)' : 'P (LSR)', addr: lsr(k).lo };
    const h = host(k);
    return { key: k, label: k, sub: 'host', addr: h.ip };
  });
}

function base(sub: string, net: Net, extra: Record<string, unknown> = {}): { tr: Trace; R: Record<string, any> } {
  const tr = newTrace(columns(), STATES, 20);
  const R = (tr.raw = { sub, net, term: [] as TermLine[], res: '', tEnd: 0, ...extra } as Record<string, any>);
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

// ---- campos das mensagens ----

const hex8 = (n: number): string => n.toString(16).padStart(8, '0');

function pktName(p: Pkt): string {
  return { echo: 'ICMP Echo Request', reply: 'ICMP Echo Reply', udp: 'UDP (sonda do traceroute)' }[p.kind] + ' ' + p.src + ' → ' + p.dst;
}

const pktColor = (p: Pkt): string => (p.kind === 'reply' ? C.reply : C.data);
const pktLabel = (p: Pkt): string => (p.stack.length ? '[' + stackText(p.stack) + '] ttl ' + p.stack[0].ttl : 'IP ttl ' + p.ipttl);
const pktLen = (p: Pkt): number => 14 + (p.kind === 'udp' ? 60 : 84) + 4 * p.stack.length;

function fieldsOf(net: Net, p: Pkt): Field[] {
  const { service, propagate } = net.cfg;
  const f: Field[] = [{ sec: 'Ethernet II' }];
  f.push(['EtherType', p.stack.length ? '0x8847 (MPLS unicast)' : '0x0800 (IPv4)', p.stack.length ? 'há uma pilha de rótulos antes do IP' : 'pacote IP puro, sem rótulo']);
  p.stack.forEach((e, i) => {
    const s = i === p.stack.length - 1 ? 1 : 0;
    const word = ((e.label << 12) | (s << 8) | e.ttl) >>> 0;
    const vpn = isVpnLabel(net, e.label);
    f.push({ sec: 'MPLS, entrada ' + (i + 1) + ' de ' + p.stack.length + (i === 0 ? ' (topo)' : '') + (vpn ? ': rótulo VPN' : service === 'vpn' ? ': rótulo de transporte' : '') });
    f.push(['Rótulo', String(e.label), i === 0 ? 'o único campo consultado pelo próximo LSR' : 'só será lido depois que os rótulos de cima forem removidos']);
    f.push(['TC (EXP)', '0', 'classe de tráfego para QoS (RFC 5462)']);
    f.push(['S (fundo da pilha)', String(s), s ? 'última entrada: depois dela vem o IP' : 'há outra entrada abaixo']);
    f.push(['TTL', String(e.ttl), propagate ? 'copiado do IP na entrada (modelo Uniform)' : 'iniciado em 255 (modelo Pipe)']);
    f.push(['Palavra de 32 bits', '0x' + hex8(word), 'rótulo (20) | TC (3) | S (1) | TTL (8)']);
  });
  f.push({ sec: 'IPv4' });
  f.push(['Origem', p.src]);
  f.push(['Destino', p.dst, service === 'vpn' && p.stack.length ? 'os roteadores P não consultam este campo' : '']);
  f.push(['TTL', String(p.ipttl), p.stack.length ? (propagate ? 'será sobrescrito pelo TTL do rótulo no pop' : 'não muda dentro do núcleo (Pipe)') : 'decrementado a cada salto IP']);
  f.push(['Protocolo', p.kind === 'udp' ? '17 (UDP)' : '1 (ICMP)', p.kind === 'udp' ? 'porta de destino ' + p.udp + ' (traceroute)' : '']);
  return f;
}

/** Registra os saltos e as decisões de um Outcome. Devolve a lista das operações dos LSRs, para a explicação. */
function emit(tr: Trace, net: Net, steps: Step[], phaseName: string): string[] {
  const ops: string[] = [];
  steps.forEach((s) => {
    if (s.t === 'note') {
      tr.ev(tr.t, s.who, s.text, s.kind);
      tr.lg(tr.t, s.who + ': ' + s.text + '.', s.kind === 'warn' ? 'loss' : 'sys');
      return;
    }
    const p = s.pkt;
    const mpls = p.stack.length > 0;
    const m = tr.add(s.from, s.to, {
      dur: s.dur,
      color: pktColor(p),
      proto: mpls ? 'MPLS' : 'IPv4',
      len: pktLen(p),
      label: pktLabel(p),
      fields: fieldsOf(net, p),
      tags: mpls && p.stack.length > 1 ? ['Pilha com ' + p.stack.length + ' rótulos'] : [],
      info: s.op,
      about: 'Operação no emissor: ' + s.op + '. ' + pktName(p) + '.',
      phaseName,
    });
    if (isLsr(s.from)) {
      tr.ev(m.tSend, s.from, s.op, '');
      ops.push(s.from + ': ' + s.op);
    }
    tr.lg(m.tSend, s.from + ': ' + s.op + ' → ' + s.to + ' ' + (mpls ? '[pilha ' + stackText(p.stack) + ', TTL ' + p.stack[0].ttl + ']' : '[IP, TTL ' + p.ipttl + ']'), 'data');
    tr.st(m.tArr, 'stack', mpls ? stackText(p.stack) : 'IP puro', mpls ? 'est' : 'warn');
  });
  return ops;
}

// ---- mensagens do plano de controle ----

const CP = 2; // atraso fixo dos enlaces nas mensagens do plano de controle (ms), para o diagrama ficar compacto

function ldpFields(kind: string, from: string, to: string, net: Net): Field[] {
  const f: Field[] = [{ sec: 'LDP (RFC 5036)' }];
  f.push(['LDP ID', lsr(from).lo + ':0', 'identifica o LSR e o espaço de rótulos (0 = por plataforma)']);
  if (kind === 'Hello') {
    f.push(['Transporte', 'UDP 646 para 224.0.0.2', 'descoberta básica: Hello em multicast, em cada interface MPLS']);
    f.push(['Hold time', '15 s', 'tempo padrão do Hello de enlace; o simulador não temporiza']);
  } else if (kind === 'TCP SYN') {
    f.push(['Transporte', 'TCP 646', 'o LSR com o maior endereço de transporte abre a conexão (papel ativo)']);
    f.push(['Papel de ' + from, 'ativo', 'destino: ' + to + ' (passivo)']);
  } else if (kind === 'Initialization') {
    f.push(['Tipo', 'Initialization', 'negocia parâmetros: versão, KeepAlive, modo de distribuição']);
    f.push(['Modo de anúncio', 'Downstream Unsolicited', 'anuncia sem esperar pedido']);
    f.push(['Controle', 'Independent', 'cada LSR anuncia sem esperar o próximo salto']);
    f.push(['Retenção', 'Liberal', 'guarda os rótulos de todos os vizinhos na LIB']);
  } else if (kind === 'KeepAlive') {
    f.push(['Tipo', 'KeepAlive', 'confirma a Initialization e mantém a sessão; a sessão chega a OPERATIONAL']);
  } else {
    f.push(['Tipo', 'Label Mapping', 'associa cada FEC a um rótulo local de ' + from]);
    fecs(net).forEach((x) => f.push([x.id, fmtL(localLabel(net, from, x)), 'FEC de ' + x.owner + (x.kind === 'cliente' ? ' (rede de cliente)' : ' (loopback)')]));
  }
  return f;
}

// ---- 1. LDP e montagem do LSP ----

export function buildLdp(P: LdpParams): Trace {
  const net = makeNet(cfgOf(P, 4, []));
  const { tr, R } = base('ldp', net, { tStep: [0, 0, 0, 0, 0] as number[] });
  const ups = net.links.filter((l) => l.up);
  tr.st(0, 'phase', 'IGP convergido', 'warn');
  tr.st(0, 'stack', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.ev(0, 'PE1', 'O OSPF já convergiu: todos conhecem as loopbacks' + (P.service === 'ip' ? ' e as redes dos clientes' : '; as redes dos clientes ficam só nas VRFs dos PEs') + '. Ainda não há rótulos', '');
  tr.lg(0, 'Rede iniciada em modo ' + (P.service === 'vpn' ? 'L3VPN' : 'IP sobre MPLS') + '. O IGP já convergiu. Ainda não há rótulos.', 'sys');

  // Fase 1: Discovery
  tr.wait(1);
  tr.phase('1. Discovery', 'disc');
  tr.st(tr.t, 'phase', 'Discovery', 'warn');
  let t0 = tr.t;
  tr.ev(t0, 'PE1', 'Envia LDP Hello (UDP 646) para 224.0.0.2 em cada interface MPLS. Quem responde vira vizinho LDP', '');
  ups.forEach((l) => {
    [[l.a, l.b], [l.b, l.a]].forEach(([a, b]) => {
      tr.add(a, b, { at: t0, dur: CP, par: true, color: C.hello, proto: 'LDP', len: 70, label: 'Hello', info: 'LDP Hello de ' + a + ' para ' + b, about: 'Descoberta de vizinhos (RFC 5036, seção 2.4.1): Hello em UDP 646 para 224.0.0.2.', fields: ldpFields('Hello', a, b, net), phaseName: 'Discovery' });
    });
  });
  tr.t = t0 + CP + 0.4;
  LSRS.forEach((r) => tr.ev(t0 + CP, r.id, 'Descobriu: ' + neighbors(net, r.id).map((n) => n.id).join(', '), 'ok'));
  tr.lg(t0 + CP, 'Fase DISCOVERY: ' + ups.length + ' adjacências por Hello (UDP 646, 224.0.0.2).', 'conn');
  tr.st(tr.t, 'stack', 'Hello (sem rótulo)', '');
  R.tStep[1] = tr.t;

  // Fase 2: sessões
  tr.wait(0.6);
  tr.phase('2. Sessão', 'sess');
  tr.st(tr.t, 'phase', 'Sessão', 'warn');
  t0 = tr.t;
  const G = CP + 0.3;
  const sessions: string[] = [];
  ups.forEach((l) => {
    const act = +lsr(l.a).lo.split('.').pop()! > +lsr(l.b).lo.split('.').pop()! ? l.a : l.b;
    const pas = act === l.a ? l.b : l.a;
    sessions.push(l.a + ' / ' + l.b + ' (ativo: ' + act + ')');
    tr.add(act, pas, { at: t0, dur: CP, par: true, color: C.ldp, proto: 'TCP', len: 74, label: 'TCP SYN :646', info: 'Abre a conexão TCP 646 de ' + act + ' para ' + pas, about: 'O LSR com o maior endereço de transporte (a loopback) assume o papel ativo (RFC 5036, seção 2.5.2).', fields: ldpFields('TCP SYN', act, pas, net), phaseName: 'Sessão' });
    [[act, pas], [pas, act]].forEach(([a, b]) => tr.add(a, b, { at: t0 + G, dur: CP, par: true, color: C.ldp, proto: 'LDP', len: 90, label: 'Initialization', info: 'Initialization de ' + a + ' para ' + b, about: 'Negocia os parâmetros da sessão (RFC 5036, seção 3.5.3).', fields: ldpFields('Initialization', a, b, net), phaseName: 'Sessão' }));
    [[act, pas], [pas, act]].forEach(([a, b]) => tr.add(a, b, { at: t0 + 2 * G, dur: CP, par: true, color: C.ldp, proto: 'LDP', len: 68, label: 'KeepAlive', info: 'KeepAlive de ' + a + ' para ' + b, about: 'Confirma a Initialization e leva a sessão ao estado OPERATIONAL.', fields: ldpFields('KeepAlive', a, b, net), phaseName: 'Sessão' }));
  });
  tr.t = t0 + 2 * G + CP + 0.4;
  LSRS.forEach((r) => tr.ev(t0 + 2 * G + CP, r.id, 'Sessões OPERATIONAL com ' + neighbors(net, r.id).map((n) => n.id).join(', '), 'ok'));
  tr.lg(t0 + 2 * G + CP, 'Fase SESSÃO: ' + sessions.length + ' sessões LDP OPERATIONAL: ' + sessions.join('; ') + '.', 'conn');
  R.tStep[2] = tr.t;

  // Fase 3: mapeamento de rótulos
  tr.wait(0.6);
  tr.phase('3. Mapping', 'map');
  tr.st(tr.t, 'phase', 'Mapping', 'warn');
  t0 = tr.t;
  ups.forEach((l) => {
    [[l.a, l.b], [l.b, l.a]].forEach(([a, b]) => tr.add(a, b, { at: t0, dur: CP, par: true, color: C.map, proto: 'LDP', len: 60 + 12 * fecs(net).length, label: 'Label Mapping', info: 'Label Mapping de ' + a + ' para ' + b + ' (' + fecs(net).length + ' FECs)', about: 'Cada LSR anuncia um rótulo local para cada FEC que conhece pelo IGP (Downstream Unsolicited, retenção liberal).', fields: ldpFields('Label Mapping', a, b, net), phaseName: 'Mapping' }));
  });
  const fPe2 = fecs(net).find((x) => x.owner === 'PE2' && x.kind === 'loopback')!;
  const sample = ['PE2', 'P3', 'P4', 'P1', 'P2', 'PE1'].map((r) => r + ' anunciou ' + fmtL(localLabel(net, r, fPe2))).join(', ');
  tr.ev(t0 + CP, 'PE2', 'Para a FEC ' + fPe2.id + ' (a própria loopback), anuncia ' + fmtL(localLabel(net, 'PE2', fPe2)), '');
  tr.lg(t0 + CP, 'Fase MAPPING: exemplo para a FEC ' + fPe2.id + ': ' + sample + '.', 'cc');
  if (P.php === 'implicit') tr.lg(t0 + CP, 'PE1 e PE2 anunciam implicit-null (3) para as próprias FECs: o penúltimo salto fará pop (PHP).', 'cc');
  tr.t = t0 + CP + 0.4;
  R.sample = sample;
  R.fecN = fecs(net).length;
  if (P.service === 'vpn') {
    tr.wait(0.4);
    const tb = tr.t;
    [['PE2', 'PE1'], ['PE1', 'PE2']].forEach(([a, b]) => {
      const h = HOSTS.find((x) => x.pe === a)!;
      const m = tr.add(a, b, { at: tb, dur: pathDelay(net, a, b), par: true, color: C.bgp, proto: 'BGP', len: 120, label: 'MP-BGP UPDATE (VPNv4)', info: a + ' anuncia ' + h.net + ' (RD 65000:1), rótulo VPN ' + vpnLabel(a), about: 'As rotas VPNv4 da VRF CLIENTE trocam de PE por MP-BGP (RFC 4364, seção 4), cada uma com um rótulo VPN.', phaseName: 'MP-BGP', fields: [{ sec: 'MP-BGP (RFC 4364)' }, ['Família', 'VPNv4 (AFI 1, SAFI 128)', 'rotas de VPN com Route Distinguisher'], ['Prefixo', h.net, 'rede do cliente na VRF CLIENTE'], ['RD', '65000:1', 'distinguidor de rota: torna o prefixo único no MP-BGP'], ['Next hop', lsr(a).lo, 'loopback do PE de saída'], ['Rótulo VPN', String(vpnLabel(a)), 'o PE de entrada o empilha sob o rótulo de transporte']] });
      m.via = igpPath(net, a, b);
    });
    tr.t = tb + pathDelay(net, 'PE1', 'PE2') + 0.4;
    tr.ev(tb + pathDelay(net, 'PE1', 'PE2'), 'PE1', 'Aprende 192.168.2.0/24 por MP-BGP: next hop ' + lsr('PE2').lo + ', rótulo VPN ' + vpnLabel('PE2'), 'ok');
    tr.ev(tb + pathDelay(net, 'PE1', 'PE2'), 'PE2', 'Aprende 192.168.1.0/24 por MP-BGP: next hop ' + lsr('PE1').lo + ', rótulo VPN ' + vpnLabel('PE1'), 'ok');
    tr.lg(tb, 'MP-BGP: PE1 e PE2 formam sessão iBGP entre loopbacks (TCP 179) e trocam rotas VPNv4, cada uma com um rótulo VPN (' + vpnLabel('PE1') + ' e ' + vpnLabel('PE2') + ').', 'cc');
  }
  R.tStep[3] = tr.t;

  // Fase 4: LFIB
  tr.wait(0.6);
  tr.phase('4. LSP', 'lsp');
  tr.st(tr.t, 'phase', 'LSP', 'warn');
  LSRS.forEach((r) => tr.ev(tr.t, r.id, 'Combina a LIB com o próximo salto do IGP e instala a LFIB', 'ok'));
  tr.lg(tr.t, 'Fase LSP: só o rótulo do próximo salto do IGP entra na LFIB; os demais ficam na LIB como reserva.', 'conn');
  R.ab = lspText(net, 'H-A');
  R.ba = lspText(net, 'H-B');
  tr.lg(tr.t, 'LSP de ida: ' + R.ab + '. LSP de volta: ' + R.ba + '.', 'data');
  tr.t += 0.6;
  R.tStep[4] = tr.t;
  tr.st(tr.t, 'stack', 'LFIB instalada', 'est');
  finish(tr, R, 'ok', 'LSPs instalados', 'est');
  return tr;
}

// ---- 2. Plano de dados: push, swap e pop ----

const ping = (src: { ip: string }, dst: { ip: string }, kind: 'echo' | 'reply'): Pkt => ({ src: src.ip, dst: dst.ip, ipttl: 64, kind, stack: [] });

export function buildDados(P: DadosParams): Trace {
  const net = makeNet(cfgOf(P, P.ctl === 'ok' ? 4 : 0, []));
  const src = host(P.dir);
  const dst = otherHost(P.dir);
  const { tr, R } = base('dados', net, { dir: P.dir, ctl: P.ctl, ida: [] as string[], volta: [] as string[], rtt: 0, ttlRecv: 0 });
  tr.st(0, 'phase', src.id + ' envia', 'warn');
  tr.st(0, 'stack', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  const term = R.term as TermLine[];
  term.push({ t: 0, text: 'aluno@' + src.id.toLowerCase() + ':~$ ping -c 1 ' + dst.ip, cls: 't-prompt' });
  term.push({ t: 0, text: 'PING ' + dst.ip + ' (' + dst.ip + ') 56(84) bytes of data.' });
  tr.ev(0, src.id, 'Envia Echo Request para ' + dst.ip + '. O host não sabe que existe MPLS: envia IP comum ao gateway ' + src.gw, '');
  tr.phase('Echo Request (ida)', 'ida');
  const o1 = forward(net, ping(src, dst, 'echo'), src.id);
  R.ida = emit(tr, net, o1.steps, 'Ida');
  R.status = o1.status;
  R.at = o1.at;
  let ok = false;
  if (o1.status === 'delivered') {
    tr.ev(tr.t, dst.id, 'Responde com Echo Reply. A volta usa outro LSP (LSPs são unidirecionais), com outros rótulos', '');
    tr.phase('Echo Reply (volta)', 'volta');
    const o2 = forward(net, ping(dst, src, 'reply'), dst.id);
    R.volta = emit(tr, net, o2.steps, 'Volta');
    R.status = o2.status;
    R.at = o2.at;
    if (o2.status === 'delivered') {
      ok = true;
      R.rtt = o1.delay + 0.05 + o2.delay;
      R.ttlRecv = o2.ipttl;
      term.push({ t: tr.t, text: '64 bytes from ' + dst.ip + ': icmp_seq=1 ttl=' + o2.ipttl + ' time=' + R.rtt.toFixed(2) + ' ms' });
      tr.lg(tr.t, 'TTL recebido em ' + src.id + ': ' + o2.ipttl + ' (' + (64 - o2.ipttl) + ' decrementos). ' + (P.prop ? 'Com propagação, cada LSR do caminho conta.' : 'Sem propagação, só os PEs decrementam o TTL do IP.'), 'sys');
    } else if (o2.status === 'expired') R.expiredAt = o2.at;
  } else if (o1.status === 'expired') {
    R.expiredAt = o1.at;
    term.push({ t: tr.t, text: 'From ' + o1.from + ' icmp_seq=1 Time to live exceeded', cls: 't-err' });
  }
  term.push({ t: tr.t, text: '' });
  term.push({ t: tr.t, text: '--- ' + dst.ip + ' ping statistics ---' });
  term.push({ t: tr.t, text: '1 packets transmitted, ' + (ok ? 1 : 0) + ' received, ' + (ok ? 0 : 100) + '% packet loss, time 0ms' });
  if (ok) term.push({ t: tr.t, text: 'rtt min/avg/max/mdev = ' + [R.rtt, R.rtt, R.rtt, 0].map((v: number) => v.toFixed(3)).join('/') + ' ms' });
  if (ok) finish(tr, R, 'ok', 'ping respondido', 'est');
  else finish(tr, R, o1.status === 'expired' ? 'ttl' : 'drop', 'pacote descartado' + (R.at ? ' em ' + R.at : ''), 'bad');
  return tr;
}

// ---- 3. TTL e traceroute ----

export function buildTtl(P: TtlParams): Trace {
  const net = makeNet(cfgOf(P, 4, []));
  const src = host(P.dir);
  const dst = otherHost(P.dir);
  const { tr, R } = base('ttl', net, { dir: P.dir, hops: [] as any[], reached: false });
  tr.st(0, 'phase', 'sondas', 'warn');
  tr.st(0, 'stack', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  const term = R.term as TermLine[];
  term.push({ t: 0, text: 'aluno@' + src.id.toLowerCase() + ':~$ traceroute -n -e -q 1 -m 10 ' + dst.ip, cls: 't-prompt' });
  term.push({ t: 0, text: 'traceroute to ' + dst.ip + ' (' + dst.ip + '), 10 hops max, 60 byte packets' });
  tr.ev(0, src.id, 'Inicia o traceroute: sondas UDP com TTL 1, 2, 3...', '');
  const srcPe = src.pe;
  const tgt = dst.pe;
  for (let ttl = 1; ttl <= 10; ttl++) {
    tr.phase('Sonda TTL ' + ttl, 'ttl' + ttl);
    const pk: Pkt = { src: src.ip, dst: dst.ip, ipttl: ttl, kind: 'udp', stack: [], udp: 33433 + ttl };
    const o = forward(net, pk, src.id, true);
    emit(tr, net, o.steps, 'Sonda TTL ' + ttl);
    const n = String(ttl).padStart(2, ' ');
    if (o.status === 'expired') {
      const labels = o.labels || [];
      R.hops.push({ ttl, status: 'expired', at: o.at, from: o.from, mode: o.mode, labels });
      let back = 0;
      const icmp = (a: string, b: string, dur: number, via: string[], withStack: boolean, who: string) => {
        const m = tr.add(a, b, {
          dur,
          color: C.icmp,
          proto: withStack ? 'MPLS' : 'ICMP',
          len: 14 + 70 + (withStack ? 4 * labels.length + 16 : 0),
          label: 'ICMP Time Exceeded' + (withStack ? ' [' + stackText(labels) + ']' : ''),
          info: 'Time Exceeded de ' + who + ' para ' + src.id,
          about: withStack ? 'O ICMP leva a pilha de rótulos recebida (RFC 4950) e é encaminhado adiante pelo LSP até o egresso, que o devolve à origem (RFC 3032, seção 2.3.2).' : 'Resposta ICMP Time Exceeded (tipo 11, código 0), enviada a partir do endereço ' + o.from + '.',
          fields: [{ sec: 'ICMP Time Exceeded' }, ['Tipo', '11 (Time Exceeded)'], ['Código', '0 (TTL expirou em trânsito)'], ['Origem do ICMP', o.from || ''], ...(withStack ? ([{ sec: 'Extensão MPLS (RFC 4950)' }, ['Pilha recebida', labels.map((e) => 'L=' + e.label + ',E=0,S=' + (e === labels[labels.length - 1] ? 1 : 0) + ',T=' + e.ttl).join(' / ')]] as Field[]) : [])],
          phaseName: 'Sonda TTL ' + ttl,
        });
        m.via = via;
        back += dur;
      };
      let rtt: number;
      if (o.mode === 'label') {
        const sendBack = o.at !== tgt;
        if (sendBack) icmp(o.at, tgt, pathDelay(net, o.at, tgt), igpPath(net, o.at, tgt), true, o.at);
        icmp(tgt, src.id, pathDelay(net, tgt, srcPe) + HOST_DELAY, [...igpPath(net, tgt, srcPe), src.id], !sendBack, tgt);
        rtt = o.delay + back + 0.4;
        const ext = '<MPLS:' + labels.map((e, i) => 'L=' + e.label + ',E=0,S=' + (i === labels.length - 1 ? 1 : 0) + ',T=' + e.ttl).join('/') + '>';
        term.push({ t: tr.t, text: n + '  ' + o.from + '  ' + rtt.toFixed(3) + ' ms ' + ext });
        tr.lg(tr.t, 'TTL do rótulo expira em ' + o.at + (o.at === tgt ? ', o próprio egresso, que gera o ICMP Time Exceeded com a pilha recebida (RFC 4950) e o devolve a ' + src.id + '.' : '. Ele gera o ICMP com a pilha recebida (RFC 4950) e o envia pelo LSP até ' + tgt + ', que o devolve a ' + src.id + '.'), 'ttl');
      } else {
        icmp(o.at, src.id, pathDelay(net, o.at, srcPe) + HOST_DELAY, [...igpPath(net, o.at, srcPe), src.id], false, o.at);
        rtt = o.delay + back + 0.3;
        term.push({ t: tr.t, text: n + '  ' + o.from + '  ' + rtt.toFixed(3) + ' ms' });
        tr.lg(tr.t, 'TTL do IP expira em ' + o.at + ', que responde com ICMP Time Exceeded a partir de ' + o.from + '.', 'ttl');
      }
    } else if (o.status === 'delivered') {
      R.hops.push({ ttl, status: 'delivered', at: o.at });
      R.reached = true;
      const back = pathDelay(net, tgt, srcPe) + 2 * HOST_DELAY;
      const m = tr.add(dst.id, src.id, { dur: back, color: C.reply, proto: 'ICMP', len: 14 + 70, label: 'ICMP Port Unreachable', info: dst.id + ' responde: destino alcançado', about: 'O destino não tem serviço na porta UDP ' + pk.udp + ' e responde Destination Unreachable, código 3 (porta inalcançável): o traceroute termina.', fields: [{ sec: 'ICMP Destination Unreachable' }, ['Tipo', '3'], ['Código', '3 (porta inalcançável)']], phaseName: 'Sonda TTL ' + ttl });
      m.via = [dst.id, ...igpPath(net, tgt, srcPe), src.id];
      const rtt = o.delay + back + 0.1;
      term.push({ t: tr.t, text: n + '  ' + dst.ip + '  ' + rtt.toFixed(3) + ' ms' });
      tr.lg(tr.t, dst.id + ' responde Port Unreachable: destino alcançado.', 'ttl');
      break;
    } else {
      R.hops.push({ ttl, status: 'dropped', at: o.at });
      term.push({ t: tr.t, text: n + '  *' });
    }
  }
  tr.lg(tr.t, P.prop ? 'Com propagação de TTL (Uniform), os LSRs do núcleo aparecem no traceroute.' : 'Sem propagação de TTL (Pipe), o rótulo começa com TTL 255 e o núcleo fica invisível: só os PEs aparecem.', 'sys');
  const seen = R.hops.filter((h: any) => h.status === 'expired').map((h: any) => h.at as string);
  R.seen = seen;
  finish(tr, R, R.reached ? 'ok' : 'noreach', R.reached ? 'destino alcançado em ' + R.hops.length + ' saltos' : 'destino não alcançado', R.reached ? 'est' : 'bad');
  return tr;
}

// ---- 4. Falha de enlace ----

export function buildFalha(P: FalhaParams): Trace {
  const before = makeNet(cfgOf(P, 4, []));
  const net = makeNet(cfgOf(P, 4, [P.fail]));
  const src = host(P.dir);
  const dst = otherHost(P.dir);
  const fl = net.links.find((x) => x.id === P.fail)!;
  const { tr, R } = base('falha', net, { dir: P.dir, fail: P.fail, netBefore: before, failLink: fl, rtt: [0, 0] as number[] });
  tr.st(0, 'phase', 'antes da falha', 'warn');
  tr.st(0, 'stack', '-', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  const term = R.term as TermLine[];
  const run = (n: Net, label: string, phase: string, k: number): boolean => {
    term.push({ t: tr.t, text: 'aluno@' + src.id.toLowerCase() + ':~$ ping -c 1 ' + dst.ip + '   # ' + label, cls: 't-prompt' });
    tr.phase(phase, 'ping' + k);
    const o1 = forward(n, ping(src, dst, 'echo'), src.id);
    const ops1 = emit(tr, n, o1.steps, phase);
    if (o1.status !== 'delivered') {
      term.push({ t: tr.t, text: 'Request timeout (descartado em ' + o1.at + ')', cls: 't-err' });
      return false;
    }
    const o2 = forward(n, ping(dst, src, 'reply'), dst.id);
    const ops2 = emit(tr, n, o2.steps, phase);
    R['ops' + k] = [ops1, ops2];
    if (o2.status !== 'delivered') {
      term.push({ t: tr.t, text: 'Request timeout (descartado em ' + o2.at + ')', cls: 't-err' });
      return false;
    }
    R.rtt[k] = o1.delay + 0.05 + o2.delay;
    term.push({ t: tr.t, text: '64 bytes from ' + dst.ip + ': icmp_seq=1 ttl=' + o2.ipttl + ' time=' + R.rtt[k].toFixed(2) + ' ms' });
    return true;
  };
  tr.ev(0, src.id, 'Primeiro ping, com a rede íntegra', '');
  R.lspBefore = lspText(before, P.dir);
  R.okBefore = run(before, 'antes da falha', 'Ping antes da falha', 0);
  // falha
  tr.wait(1);
  tr.phase('Falha do enlace ' + P.fail, 'falha');
  tr.st(tr.t, 'phase', 'falha em ' + P.fail, 'bad');
  const tf = tr.t;
  R.tFail = tf;
  tr.add(fl.a, fl.b, { dur: CP, lost: true, color: C.icmp, proto: 'LDP', len: 70, label: 'Hello (sem resposta)', info: 'O enlace ' + P.fail + ' caiu: ' + fl.a + ' não recebe mais Hello de ' + fl.b, about: 'A perda do enlace derruba a adjacência e a sessão LDP. Os rótulos aprendidos por essa sessão saem da LIB e o OSPF recalcula os caminhos.', fields: [{ sec: 'Evento' }, ['Enlace', P.fail + ' ' + fl.a + ' / ' + fl.b, 'rede ' + fl.net], ['Efeito', 'adjacência e sessão LDP encerradas']], phaseName: 'Falha' });
  tr.ev(tf, fl.a, 'Perde o enlace ' + P.fail + ': a sessão LDP com ' + fl.b + ' termina e os rótulos dela saem da LIB', 'warn');
  tr.ev(tf, fl.b, 'Perde o enlace ' + P.fail + ': a sessão LDP com ' + fl.a + ' termina e os rótulos dela saem da LIB', 'warn');
  tr.ev(tf + CP + 0.5, 'PE1', 'O OSPF reconverge (SPF) e a LFIB passa a usar outro próximo salto', 'ok');
  tr.lg(tf, 'Falha no enlace ' + fl.a + ' / ' + fl.b + '. O OSPF reconverge; a sessão LDP ' + fl.a + ' / ' + fl.b + ' cai e os rótulos aprendidos por ela são removidos da LIB.', 'loss');
  tr.lg(tf + CP, 'Retenção liberal: os LSRs já tinham na LIB os rótulos dos outros vizinhos, então a LFIB muda sem esperar nova sinalização LDP.', 'conn');
  tr.t = tf + CP + 1;
  R.lspAfter = lspText(net, P.dir);
  tr.st(tr.t, 'phase', 'reconvergido', 'warn');
  tr.ev(tr.t, src.id, 'Segundo ping, depois da reconvergência', '');
  R.okAfter = run(net, 'depois da falha', 'Ping depois da falha', 1);
  R.changed = R.lspBefore !== R.lspAfter;
  if (R.okAfter) finish(tr, R, R.changed ? 'rerouted' : 'same', R.changed ? 'LSP refeito por outro caminho' : 'o LSP não usava o enlace', 'est');
  else finish(tr, R, 'down', 'sem caminho após a falha', 'bad');
  return tr;
}
