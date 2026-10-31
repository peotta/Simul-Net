// Modelo de VLAN (IEEE 802.1Q): hosts, portas de acesso e de tronco, VLAN nativa e propagação de um quadro pelos switches.
// Rede: dois switches ligados por um tronco, um roteador em uma porta de tronco do SW1 (router-on-a-stick) e quatro hosts.
//   SW1: p1 Host A (VLAN 10), p2 Host B (VLAN 20), p3 tronco para o SW2, p4 tronco para o R1, p5 invasor (só no modo VLAN hopping).
//   SW2: p1 Host C (VLAN 10), p2 Host D (VLAN 20), p3 tronco para o SW1.
// Simplificações: sem spanning tree (a topologia é uma árvore), sem tabela MAC dinâmica (o destino de um unicast é "conhecido"
// na VLAN em que ele está) e sem GVRP/MVRP.
import { COLORS as C0, type Field, type Trace } from '../../sim-core';

export type NodeKey = 'a' | 'b' | 'c' | 'd' | 'm' | 'r1' | 'sw1' | 'sw2';

export interface Host {
  key: NodeKey;
  name: string;
  mac: string;
  ip: string;
  vlan: number;
  sw: 1 | 2;
  port: number;
}

/** Endereços de documentação (RFC 7042, substituída pela RFC 9542). Redes privadas 192.168.10.0/24 (VLAN 10) e 192.168.20.0/24 (VLAN 20). */
export const HOSTS: Record<string, Host> = {
  a: { key: 'a', name: 'Host A', mac: '00:00:5e:00:53:a1', ip: '192.168.10.11', vlan: 10, sw: 1, port: 1 },
  b: { key: 'b', name: 'Host B', mac: '00:00:5e:00:53:b1', ip: '192.168.20.11', vlan: 20, sw: 1, port: 2 },
  c: { key: 'c', name: 'Host C', mac: '00:00:5e:00:53:c1', ip: '192.168.10.12', vlan: 10, sw: 2, port: 1 },
  d: { key: 'd', name: 'Host D', mac: '00:00:5e:00:53:d1', ip: '192.168.20.12', vlan: 20, sw: 2, port: 2 },
  m: { key: 'm', name: 'Invasor', mac: '00:00:5e:00:53:e1', ip: '192.168.10.99', vlan: 10, sw: 1, port: 5 },
};
export const R1 = { key: 'r1' as NodeKey, name: 'Roteador R1', mac: '00:00:5e:00:53:f1', gw10: '192.168.10.1', gw20: '192.168.20.1', sw: 1 as const, port: 4 };
export const SW_MAC: Record<string, string> = { sw1: '00:00:5e:00:53:01', sw2: '00:00:5e:00:53:02' };
export const BC = 'ff:ff:ff:ff:ff:ff';

export const NAME: Record<string, string> = { a: 'Host A', b: 'Host B', c: 'Host C', d: 'Host D', m: 'o invasor', r1: 'o R1', sw1: 'SW1', sw2: 'SW2' };
export const LABEL: Record<string, string> = { a: 'Host A', b: 'Host B', c: 'Host C', d: 'Host D', m: 'Invasor', r1: 'R1', sw1: 'SW1', sw2: 'SW2' };

export const isSwitch = (k: string): boolean => k === 'sw1' || k === 'sw2';

// ---- configuração das portas ----

export interface PortCfg {
  mode: 'access' | 'trunk';
  /** VLAN de acesso (porta de acesso). */
  vid: number;
  /** VLAN nativa (porta de tronco): os quadros dela trafegam sem tag. */
  native: number;
  /** VLANs permitidas no tronco; null significa todas. */
  allowed: number[] | null;
}

export interface Net {
  /** Chave "sw1:3" (switch e porta). */
  ports: Record<string, PortCfg>;
}

const acc = (vid: number): PortCfg => ({ mode: 'access', vid, native: 0, allowed: null });
const trk = (native: number, allowed: number[] | null = null): PortCfg => ({ mode: 'trunk', vid: 0, native, allowed });

export interface NetOpts {
  nat1?: number;
  nat2?: number;
  /** VLANs permitidas no tronco entre os switches. */
  allowed?: number[] | null;
  /** Porta do SW1 para o roteador: ausente, ou tronco com as VLANs dadas. */
  router?: number[] | null | false;
  /** Porta do invasor no SW1. */
  attacker?: PortCfg | false;
}

export function makeNet(o: NetOpts = {}): Net {
  const allowed = o.allowed === undefined ? null : o.allowed;
  const ports: Record<string, PortCfg> = {
    'sw1:1': acc(10),
    'sw1:2': acc(20),
    'sw1:3': trk(o.nat1 ?? 1, allowed),
    'sw2:1': acc(10),
    'sw2:2': acc(20),
    'sw2:3': trk(o.nat2 ?? 1, allowed),
  };
  if (o.router !== false && o.router !== undefined) ports['sw1:4'] = trk(1, o.router);
  if (o.attacker) ports['sw1:5'] = o.attacker;
  return { ports };
}

/** Quem está na outra ponta de cada porta. */
const PEER: Record<string, string> = { 'sw1:1': 'a', 'sw1:2': 'b', 'sw1:3': 'sw2:3', 'sw1:4': 'r1', 'sw1:5': 'm', 'sw2:1': 'c', 'sw2:2': 'd', 'sw2:3': 'sw1:3' };
/** Porta de cada switch que leva até cada nó (a topologia é uma árvore). */
const TOWARD: Record<string, Record<string, number>> = {
  sw1: { a: 1, b: 2, m: 5, r1: 4, c: 3, d: 3 },
  sw2: { c: 1, d: 2, a: 3, b: 3, m: 3, r1: 3 },
};
/** Ponto de ligação de cada nó terminal. */
const ATTACH: Record<string, [number, number]> = { a: [1, 1], b: [1, 2], m: [1, 5], r1: [1, 4], c: [2, 1], d: [2, 2] };

export const portsOfSwitch = (net: Net, sw: number): number[] =>
  Object.keys(net.ports)
    .filter((k) => k.startsWith('sw' + sw + ':'))
    .map((k) => Number(k.split(':')[1]))
    .sort((x, y) => x - y);

export const peerName = (sw: number, port: number): string => PEER['sw' + sw + ':' + port] || '-';

// ---- quadros ----

export interface Wire {
  smac: string;
  dmac: string;
  /** Tags no enlace, da mais externa para a mais interna. */
  tags: number[];
  kind: 'icmp' | 'arp' | 'unreach';
  sip: string;
  dip: string;
  ttl: number;
}

export const ping = (from: Host, to: Host, dmac: string = to.mac): Wire => ({ smac: from.mac, dmac, tags: [], kind: 'icmp', sip: from.ip, dip: to.ip, ttl: 64 });
export const arpReq = (from: Host, targetIp: string): Wire => ({ smac: from.mac, dmac: BC, tags: [], kind: 'arp', sip: from.ip, dip: targetIp, ttl: 0 });

export interface MsgStep {
  t: 'msg';
  from: string;
  to: string;
  wire: Wire;
  verdict: 'ok' | 'drop' | 'recv' | 'ignore';
  /** VLAN em que o switch classificou o quadro. */
  vlan?: number;
  /** Como o switch classificou o quadro (vira evento). */
  cls?: string;
  why?: string;
}
export interface EvStep {
  t: 'ev';
  who: string;
  text: string;
  kind: 'ok' | 'warn' | 'bad' | '';
}
export type Step = MsgStep | EvStep;

export interface Spread {
  steps: Step[];
  /** Quem recebeu o quadro endereçado a ele (ou broadcast). */
  delivered: string[];
  /** Quem recebeu mas ignorou (MAC de destino de outro). */
  ignored: string[];
  /** Switches que descartaram o quadro. */
  dropped: string[];
}

const hostOfMac = (mac: string): string | undefined => {
  if (mac === R1.mac) return 'r1';
  return Object.keys(HOSTS).find((k) => HOSTS[k].mac === mac);
};
const vlanOfHost = (k: string): number | null => (HOSTS[k] ? HOSTS[k].vlan : null);

/**
 * Propaga um quadro a partir de um nó terminal. Em cada switch: classifica o quadro numa VLAN pela porta de entrada,
 * escolhe as portas de saída (só a do destino, se o MAC dele é conhecido na VLAN; senão, todas as da VLAN) e remarca
 * o quadro conforme o tipo da porta de saída.
 */
export function spread(net: Net, src: string, wire: Wire): Spread {
  const out: Spread = { steps: [], delivered: [], ignored: [], dropped: [] };
  const [sw0, port0] = ATTACH[src];
  arrive(src, sw0, port0, wire);
  return out;

  function arrive(from: string, sw: number, port: number, w: Wire) {
    const me = 'sw' + sw;
    const cfg = net.ports[me + ':' + port];
    const step: MsgStep = { t: 'msg', from, to: me, wire: w, verdict: 'ok' };
    out.steps.push(step);
    let vlan: number;
    let rest = w.tags;
    if (cfg.mode === 'access') {
      if (!w.tags.length) {
        vlan = cfg.vid;
        step.cls = 'Porta ' + port + ' (acesso, VLAN ' + cfg.vid + '): o quadro sem tag entra na VLAN ' + vlan;
      } else if (w.tags[0] === cfg.vid) {
        vlan = cfg.vid;
        rest = w.tags.slice(1);
        step.cls = 'Porta ' + port + ' (acesso, VLAN ' + cfg.vid + '): a tag externa coincide com a VLAN da porta, é aceita e removida; o quadro entra na VLAN ' + vlan;
      } else {
        step.verdict = 'drop';
        step.why = 'a porta ' + port + ' é de acesso na VLAN ' + cfg.vid + ' e não aceita um quadro com a tag ' + w.tags[0];
        out.dropped.push(me);
        return;
      }
    } else {
      if (!w.tags.length) {
        vlan = cfg.native;
        step.cls = 'Porta ' + port + ' (tronco): o quadro sem tag pertence à VLAN nativa (' + vlan + ')';
      } else {
        vlan = w.tags[0];
        rest = w.tags.slice(1);
        step.cls = 'Porta ' + port + ' (tronco): a tag diz VLAN ' + vlan;
      }
      if (cfg.allowed && cfg.allowed.indexOf(vlan) < 0) {
        step.verdict = 'drop';
        step.why = 'a VLAN ' + vlan + ' não é permitida no tronco da porta ' + port;
        out.dropped.push(me);
        return;
      }
    }
    step.vlan = vlan;

    const dk = w.dmac === BC ? undefined : hostOfMac(w.dmac);
    const known = !!dk && vlanOfHost(dk) === vlan && dk !== from;
    // o roteador é "conhecido" na VLAN se o tronco dele a carrega
    const knownR = dk === 'r1' && (!net.ports['sw1:4'] ? false : !net.ports['sw1:4'].allowed || net.ports['sw1:4'].allowed.indexOf(vlan) >= 0);
    let ports = portsOfSwitch(net, sw).filter((p) => p !== port);
    const unicast = known || knownR;
    if (unicast) ports = ports.filter((p) => p === TOWARD[me][dk!]);
    ports.forEach((p) => {
      const c = net.ports[me + ':' + p];
      const member = c.mode === 'access' ? c.vid === vlan : !c.allowed || c.allowed.indexOf(vlan) >= 0;
      if (!member) {
        if (unicast) {
          out.steps.push({ t: 'ev', who: me, text: 'Não encaminha pela porta ' + p + ': a VLAN ' + vlan + (c.mode === 'trunk' ? ' não é permitida no tronco' : ' não pertence à porta') + '. O quadro é descartado', kind: 'bad' });
          out.dropped.push(me);
        }
        return;
      }
      const tags = c.mode === 'access' ? rest : vlan === c.native ? rest : [vlan, ...rest];
      const peer = PEER[me + ':' + p];
      const nw: Wire = { ...w, tags };
      if (peer.startsWith('sw')) {
        const [osw, op] = peer.split(':');
        arrive(me, Number(osw.slice(2)), Number(op), nw);
      } else {
        const mine = peer === 'r1' ? R1.mac : HOSTS[peer].mac;
        const ok = w.dmac === BC || w.dmac === mine;
        out.steps.push({ t: 'msg', from: me, to: peer, wire: nw, verdict: ok ? 'recv' : 'ignore', vlan });
        (ok ? out.delivered : out.ignored).push(peer);
      }
    });
  }
}

// ---- apresentação ----

export const tagText = (tags: number[]): string => (tags.length ? (tags.length > 1 ? 'tags ' + tags.join(' e ') : 'tag ' + tags[0]) : 'sem tag');

export function frameFields(w: Wire): Field[] {
  const f: Field[] = [{ sec: 'Ethernet II' }, ['Destino', w.dmac, w.dmac === BC ? 'broadcast: todas as portas da VLAN' : ''], ['Origem', w.smac, '']];
  w.tags.forEach((v, i) => {
    f.push({ sec: w.tags.length > 1 ? (i === 0 ? 'Tag 802.1Q externa' : 'Tag 802.1Q interna') : 'Tag 802.1Q (IEEE 802.1Q)' });
    f.push(['TPID', '0x8100', 'identifica o quadro como marcado']);
    f.push(['PCP', '0', 'prioridade (3 bits)']);
    f.push(['DEI', '0', 'elegibilidade para descarte (1 bit)']);
    f.push(['VID', String(v), 'identificador da VLAN (12 bits)']);
  });
  f.push(['Tipo', w.kind === 'arp' ? '0x0806 (ARP)' : '0x0800 (IPv4)', 'campo que vem depois das tags']);
  if (w.kind === 'arp') {
    f.push({ sec: 'ARP (RFC 826)' }, ['Operação', '1 (requisição)', ''], ['IP de origem', w.sip, ''], ['IP do alvo', w.dip, 'quem tem este IP?']);
  } else {
    f.push({ sec: 'IPv4 (RFC 791)' }, ['Origem', w.sip, ''], ['Destino', w.dip, ''], ['TTL', String(w.ttl), w.ttl < 64 ? 'o roteador reduziu em 1' : ''], ['Protocolo', '1 (ICMP)', '']);
    f.push({ sec: 'ICMP (RFC 792)' });
    if (w.kind === 'icmp') f.push(['Tipo', '8 (Echo Request)', '']);
    else f.push(['Tipo', '3 (Destination Unreachable)', ''], ['Código', '0 (rede inalcançável)', '']);
  }
  return f;
}

export const frameLen = (w: Wire): number => (w.kind === 'arp' ? 42 : w.kind === 'icmp' ? 98 : 70) + 4 * w.tags.length;

const KIND_LABEL: Record<string, string> = { icmp: 'Echo Request', arp: 'ARP Request', unreach: 'Net Unreachable' };

/** Converte os passos da propagação em mensagens, eventos e estados do trace. Devolve quantos passos ficaram fora das colunas. */
export function emit(tr: Trace, steps: Step[], cols: string[]): number {
  let hidden = 0;
  let cat = '';
  let n = (tr.raw.phaseN as number) || 0;
  const kindOf = (s: MsgStep) => (isSwitch(s.from) ? (isSwitch(s.to) ? 'tronco' : 'saída') : 'entrada');
  const TITLE: Record<string, string> = { entrada: 'O quadro entra no switch', tronco: 'O quadro cruza o tronco', saída: 'O switch entrega o quadro' };
  steps.forEach((s) => {
    if (s.t === 'ev') {
      if (cols.indexOf(s.who) < 0) return void hidden++;
      tr.ev(tr.t, s.who, s.text, s.kind);
      if (s.kind === 'bad') tr.lg(tr.t, s.text, 'loss');
      return;
    }
    if (cols.indexOf(s.from) < 0 || cols.indexOf(s.to) < 0) return void hidden++;
    const k = kindOf(s);
    if (k !== cat) {
      cat = k;
      n++;
      tr.phase(n + '. ' + TITLE[k], k);
      tr.st(tr.t, 'phase', TITLE[k], 'warn');
    }
    const lost = s.verdict === 'drop';
    const m = tr.add(s.from, s.to, {
      label: KIND_LABEL[s.wire.kind] + ' (' + tagText(s.wire.tags) + ')',
      proto: s.wire.tags.length ? '802.1Q' : 'Ethernet',
      color: lost ? C0.bad : s.wire.tags.length ? C0.data : C0.plain,
      len: frameLen(s.wire),
      fields: frameFields(s.wire),
      lost,
      info: (s.wire.tags.length ? 'Quadro com ' + tagText(s.wire.tags) : 'Quadro sem tag') + ' de ' + NAME[s.from] + ' para ' + NAME[s.to],
      about: s.vlan ? 'O switch classificou o quadro na VLAN ' + s.vlan + '.' : 'Quadro na VLAN indicada pela tag, ou pela configuração da porta quando não há tag.',
      phaseName: 'Quadro Ethernet',
    });
    tr.st(m.tArr, 'via', tagText(s.wire.tags) + (isSwitch(s.from) && isSwitch(s.to) ? ' no tronco' : ''), s.wire.tags.length ? 'est' : 'warn');
    if (isSwitch(s.to) && s.cls) tr.ev(m.tArr, s.to, s.cls, '');
    if (s.verdict === 'drop') {
      tr.ev(m.tArr, s.to, 'Descarta: ' + s.why, 'bad');
      tr.lg(m.tArr, s.to.toUpperCase() + ' descartou o quadro: ' + s.why + '.', 'loss');
    } else if (s.verdict === 'recv') {
      tr.ev(m.tArr, s.to, 'Recebe o quadro' + (s.wire.tags.length ? ' (com tag residual ' + s.wire.tags.join(' e ') + ')' : ''), 'ok');
    } else if (s.verdict === 'ignore') {
      tr.ev(m.tArr, s.to, 'Ignora: o MAC de destino não é o dele', '');
    }
  });
  tr.raw.phaseN = n;
  return hidden;
}
