// Modelo do MPLS: seis LSRs (2 PE e 4 P), dois hosts de cliente, IGP (OSPF simplificado, Dijkstra), LDP (FECs, LIB e LFIB)
// e o encaminhamento de um pacote com push, swap e pop. Tudo é função pura: o mesmo parâmetro produz o mesmo resultado.
// Referências: RFC 3031 (arquitetura), RFC 3032 (cabeçalho), RFC 5036 (LDP), RFC 4364 (L3VPN), RFC 3443 (TTL), RFC 4950 (ICMP).
// Simplificações: um só IGP com custo simétrico, rótulos de faixa própria por LSR, sem temporizadores do LDP e sem Route Reflector.

export type Service = 'ip' | 'vpn';
export type Php = 'implicit' | 'explicit' | 'none';

export interface Lsr {
  id: string;
  role: 'PE' | 'P';
  lo: string;
  /** Faixa de rótulos do LSR (base + 1 a base + 99), só para facilitar a leitura. */
  base: number;
}

export interface HostDef {
  id: string;
  ip: string;
  gw: string;
  pe: string;
  net: string;
}

/** Endereços de loopback e redes de clientes em faixas privadas (RFC 1918) e de documentação de uso didático. */
export const LSRS: Lsr[] = [
  { id: 'PE1', role: 'PE', lo: '10.255.255.1', base: 100 },
  { id: 'P1', role: 'P', lo: '10.255.255.2', base: 200 },
  { id: 'P2', role: 'P', lo: '10.255.255.3', base: 300 },
  { id: 'P3', role: 'P', lo: '10.255.255.4', base: 400 },
  { id: 'P4', role: 'P', lo: '10.255.255.5', base: 500 },
  { id: 'PE2', role: 'PE', lo: '10.255.255.6', base: 600 },
];

export const HOSTS: HostDef[] = [
  { id: 'H-A', ip: '192.168.1.10', gw: '192.168.1.1', pe: 'PE1', net: '192.168.1.0/24' },
  { id: 'H-B', ip: '192.168.2.10', gw: '192.168.2.1', pe: 'PE2', net: '192.168.2.0/24' },
];

/** Colunas do diagrama, da esquerda para a direita. */
export const NODE_ORDER = ['H-A', 'PE1', 'P1', 'P2', 'P3', 'P4', 'PE2', 'H-B'];

/** [id, a, b, custo OSPF, atraso em ms]. */
const LINKS_INIT: [string, string, string, number, number][] = [
  ['L1', 'PE1', 'P1', 10, 2.1],
  ['L2', 'PE1', 'P2', 10, 2.4],
  ['L3', 'P1', 'P2', 10, 1.2],
  ['L4', 'P1', 'P3', 10, 3.8],
  ['L5', 'P2', 'P4', 15, 4.1],
  ['L6', 'P3', 'P4', 10, 1.3],
  ['L7', 'P3', 'PE2', 10, 2.2],
  ['L8', 'P4', 'PE2', 10, 2.6],
];

export const HOST_DELAY = 0.3;

export interface Link {
  id: string;
  a: string;
  b: string;
  cost: number;
  delay: number;
  up: boolean;
  net: string;
  ipA: string;
  ipB: string;
}

export interface Cfg {
  service: Service;
  php: Php;
  /** Modelo Uniform (propaga o TTL do IP para o rótulo) ou Pipe (rótulo começa em 255). */
  propagate: boolean;
  /** Fase do plano de controle: 0 = só IGP, 1 = Hello, 2 = sessões, 3 = mapeamentos, 4 = LFIB instalada. */
  step: number;
  /** Enlaces caídos (ids). */
  down: string[];
}

export interface SpfEntry {
  dist: Record<string, number>;
  first: Record<string, string>;
}

export interface Net {
  cfg: Cfg;
  links: Link[];
  spf: Record<string, SpfEntry>;
}

export const lsr = (id: string): Lsr => LSRS.find((r) => r.id === id)!;
export const host = (id: string): HostDef => HOSTS.find((h) => h.id === id)!;
export const isLsr = (id: string): boolean => LSRS.some((r) => r.id === id);
export const otherHost = (id: string): HostDef => HOSTS.find((h) => h.id !== id)!;

export function makeNet(cfg: Cfg): Net {
  const links: Link[] = LINKS_INIT.map((d, i) => ({
    id: d[0],
    a: d[1],
    b: d[2],
    cost: d[3],
    delay: d[4],
    up: cfg.down.indexOf(d[0]) < 0,
    net: '10.0.' + (i + 1) + '.0/30',
    ipA: '10.0.' + (i + 1) + '.1',
    ipB: '10.0.' + (i + 1) + '.2',
  }));
  const net: Net = { cfg, links, spf: {} };
  LSRS.forEach((r) => (net.spf[r.id] = dijkstra(net, r.id)));
  return net;
}

export const linkBetween = (net: Net, a: string, b: string): Link | undefined => net.links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
export const ipOn = (l: Link, id: string): string => (l.a === id ? l.ipA : l.ipB);
const other = (l: Link, id: string): string => (l.a === id ? l.b : l.a);
export const neighbors = (net: Net, id: string): { id: string; link: Link }[] => net.links.filter((l) => l.up && (l.a === id || l.b === id)).map((l) => ({ id: other(l, id), link: l }));

// ---- IGP (OSPF simplificado: Dijkstra) ----

function dijkstra(net: Net, src: string): SpfEntry {
  const dist: Record<string, number> = {};
  const first: Record<string, string> = {};
  const done = new Set<string>();
  LSRS.forEach((r) => (dist[r.id] = Infinity));
  dist[src] = 0;
  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    LSRS.forEach((r) => {
      if (!done.has(r.id) && dist[r.id] < best) {
        best = dist[r.id];
        u = r.id;
      }
    });
    if (u === null) break;
    const cur: string = u;
    done.add(cur);
    neighbors(net, cur).forEach((n) => {
      const d = dist[cur] + n.link.cost;
      if (d < dist[n.id]) {
        dist[n.id] = d;
        first[n.id] = cur === src ? n.id : first[cur];
      }
    });
  }
  return { dist, first };
}

export const igpNext = (net: Net, r: string, dest: string): string | null => (r === dest ? null : net.spf[r].first[dest] || null);

/** Nós do caminho IGP de a até b, inclusive. */
export function igpPath(net: Net, a: string, b: string): string[] {
  const out = [a];
  let cur = a;
  for (let g = 0; cur !== b && g < 10; g++) {
    const nh = igpNext(net, cur, b);
    if (!nh) break;
    out.push(nh);
    cur = nh;
  }
  return out;
}

/** Atraso (ms) somado ao longo do caminho IGP de a até b. */
export function pathDelay(net: Net, a: string, b: string): number {
  const p = igpPath(net, a, b);
  let d = 0;
  for (let i = 0; i + 1 < p.length; i++) d += linkBetween(net, p[i], p[i + 1])!.delay;
  return d;
}

// ---- FECs, rótulos e tabelas ----

export interface Fec {
  id: string;
  owner: string;
  idx: number;
  kind: 'loopback' | 'cliente';
}

export function fecs(net: Net): Fec[] {
  const list: Fec[] = LSRS.map((r, i) => ({ id: r.lo + '/32', owner: r.id, idx: i + 1, kind: 'loopback' }));
  if (net.cfg.service === 'ip') HOSTS.forEach((h, i) => list.push({ id: h.net, owner: h.pe, idx: 7 + i, kind: 'cliente' }));
  return list;
}

const ip2int = (ip: string): number => ip.split('.').reduce((a, o) => ((a << 8) >>> 0) + +o, 0) >>> 0;
export function inNet(ip: string, cidr: string): boolean {
  const [n, l] = cidr.split('/');
  const len = +l;
  const m = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
  return ((ip2int(ip) & m) >>> 0) === ((ip2int(n) & m) >>> 0);
}

export function fecFor(net: Net, ip: string): Fec | null {
  let best: Fec | null = null;
  fecs(net).forEach((f) => {
    if (inNet(ip, f.id) && (!best || +f.id.split('/')[1] > +best.id.split('/')[1])) best = f;
  });
  return best;
}

export function localLabel(net: Net, rid: string, f: Fec): number {
  if (f.owner === rid) return net.cfg.php === 'implicit' ? 3 : net.cfg.php === 'explicit' ? 0 : lsr(rid).base + f.idx;
  return lsr(rid).base + f.idx;
}

export const vpnLabel = (pe: string): number => lsr(pe).base + 90;
export const isVpnLabel = (net: Net, l: number): boolean => net.cfg.service === 'vpn' && LSRS.some((r) => r.role === 'PE' && vpnLabel(r.id) === l);
export const sessionUp = (net: Net, a: string, b: string): boolean => {
  const l = linkBetween(net, a, b);
  return net.cfg.step >= 2 && !!l && l.up;
};

export interface Out {
  nh: string | null;
  label: number | null;
}

export function outLabel(net: Net, rid: string, f: Fec): Out {
  const nh = igpNext(net, rid, f.owner);
  if (!nh) return { nh: null, label: null };
  if (net.cfg.step < 3 || !sessionUp(net, rid, nh)) return { nh, label: null };
  return { nh, label: localLabel(net, nh, f) };
}

export const fmtL = (l: number): string => (l === 3 ? 'imp-null' : l === 0 ? '0 (exp-null)' : String(l));

export function ownsLabel(net: Net, rid: string, label: number): boolean {
  if (net.cfg.service === 'vpn' && lsr(rid).role === 'PE' && label === vpnLabel(rid)) return true;
  return fecs(net).some((f) => f.owner === rid && localLabel(net, rid, f) === label && label !== 3);
}

export interface Entry {
  label: number;
  ttl: number;
}

export const stackText = (stack: { label: number }[]): string => (stack.length ? stack.map((e) => e.label).join(' | ') : 'IP');

// ---- plano de dados ----

export interface Pkt {
  src: string;
  dst: string;
  ipttl: number;
  kind: 'echo' | 'reply' | 'udp';
  stack: Entry[];
  udp?: number;
}

export type Step =
  | { t: 'note'; who: string; text: string; kind: string }
  | { t: 'hop'; from: string; to: string; link: string; op: string; pkt: Pkt; dur: number };

export interface Outcome {
  status: 'delivered' | 'expired' | 'dropped';
  at: string;
  /** Endereço de origem do ICMP Time Exceeded (expirado). */
  from?: string;
  labels?: Entry[];
  mode?: 'label' | 'ip';
  steps: Step[];
  /** Soma dos atrasos dos enlaces percorridos (ms). */
  delay: number;
  ipttl: number;
}

const snap = (p: Pkt): Pkt => ({ ...p, stack: p.stack.map((e) => ({ ...e })) });

/** Percorre o LSP de um host até o outro, sem enviar pacote, para mostrar o caminho e a pilha de cada enlace. */
export function lspHops(net: Net, fromId: string): { from: string; to: string; stack: number[] }[] {
  const h = host(fromId);
  const tgt = otherHost(fromId);
  const hops: { from: string; to: string; stack: number[] }[] = [];
  if (net.cfg.step < 4) return hops;
  let cur = h.pe;
  let stack: number[];
  let o: Out;
  if (net.cfg.service === 'vpn') {
    const fLo = fecs(net).find((f) => f.owner === tgt.pe && f.kind === 'loopback')!;
    o = outLabel(net, cur, fLo);
    if (!o.nh || o.label === null) return hops;
    stack = [vpnLabel(tgt.pe)];
    if (o.label !== 3) stack.unshift(o.label);
  } else {
    const f = fecFor(net, tgt.ip)!;
    o = outLabel(net, cur, f);
    if (!o.nh || o.label === null) return hops;
    stack = o.label === 3 ? [] : [o.label];
  }
  hops.push({ from: cur, to: o.nh, stack: stack.slice() });
  cur = o.nh;
  for (let g = 0; cur !== tgt.pe && g < 12; g++) {
    if (!stack.length) {
      const nh = igpNext(net, cur, tgt.pe);
      if (!nh) break;
      hops.push({ from: cur, to: nh, stack: [] });
      cur = nh;
      continue;
    }
    const top = stack[0];
    const f = fecs(net).find((x) => x.owner !== cur && localLabel(net, cur, x) === top);
    if (!f) break;
    const oo = outLabel(net, cur, f);
    if (!oo.nh || oo.label === null) break;
    if (oo.label === 3) stack.shift();
    else stack[0] = oo.label;
    hops.push({ from: cur, to: oo.nh, stack: stack.slice() });
    cur = oo.nh;
  }
  return cur === tgt.pe ? hops : [];
}

export const lspText = (net: Net, fromId: string): string => {
  const hops = lspHops(net, fromId);
  const tgt = otherHost(fromId);
  if (!hops.length) return 'sem LSP completo de ' + host(fromId).pe + ' até ' + tgt.pe;
  return hops.map((h) => h.from + ' [' + stackText(h.stack.map((label) => ({ label }))) + ']').join(' → ') + ' → ' + tgt.pe;
};

/**
 * Encaminha um pacote do host de origem até o destino, registrando cada salto (com a pilha de rótulos vista naquele enlace)
 * e as decisões dos LSRs. Termina entregue, descartado ou com o TTL expirado (que gera o ICMP Time Exceeded).
 */
export function forward(net: Net, p: Pkt, fromHost: string, quiet = false): Outcome {
  const { service, propagate, step } = net.cfg;
  const steps: Step[] = [];
  const h = host(fromHost);
  let cur = h.pe;
  let inIf = h.gw;
  let delay = 0;
  const hop = (from: string, to: string, link: string, op: string, dur: number) => {
    steps.push({ t: 'hop', from, to, link, op, pkt: snap(p), dur });
    delay += dur;
  };
  const note = (who: string, text: string, kind = '') => {
    if (!quiet || kind === 'warn') steps.push({ t: 'note', who, text, kind });
  };
  const move = (nh: string, op: string) => {
    const l = linkBetween(net, cur, nh)!;
    hop(cur, nh, l.id + ' ' + cur + ' → ' + nh, op, l.delay);
    inIf = ipOn(l, nh);
    cur = nh;
  };
  const end = (status: Outcome['status'], extra: Partial<Outcome> = {}): Outcome => ({ status, at: cur, steps, delay, ipttl: p.ipttl, ...extra });
  const expire = (mode: 'label' | 'ip'): Outcome => {
    const vrfIf = service === 'vpn' && mode === 'label' && p.stack.length === 1 && isVpnLabel(net, p.stack[0].label) && ownsLabel(net, cur, p.stack[0].label);
    return end('expired', { from: vrfIf ? HOSTS.find((x) => x.pe === cur)!.gw : inIf, labels: p.stack.map((e) => ({ ...e })), mode });
  };

  hop(h.id, h.pe, h.id + ' / ' + h.pe, 'envio pelo host (gateway ' + h.gw + ')', HOST_DELAY);

  for (let guard = 0; guard < 40; guard++) {
    const r = lsr(cur);
    let disposed = false;
    if (p.stack.length) {
      const top = p.stack[0];
      if (top.ttl <= 1) {
        note(cur, 'O TTL do rótulo expirou', 'warn');
        return expire('label');
      }
      top.ttl--;
      if (ownsLabel(net, cur, top.label)) {
        const popped: number[] = [];
        while (p.stack.length && ownsLabel(net, cur, p.stack[0].label)) {
          const e = p.stack.shift()!;
          popped.push(e.label);
          if (propagate) {
            if (p.stack.length) p.stack[0].ttl = e.ttl;
            else p.ipttl = e.ttl;
          }
        }
        note(cur, 'É o egresso: pop de ' + popped.join(' e ') + (service === 'vpn' ? ' e consulta na VRF CLIENTE' : ' e consulta IP'), 'ok');
        disposed = true;
      } else {
        const f = fecs(net).find((x) => x.owner !== cur && localLabel(net, cur, x) === top.label);
        if (!f) {
          note(cur, 'O rótulo ' + top.label + ' não está na LFIB: descarta', 'warn');
          return end('dropped');
        }
        const o = outLabel(net, cur, f);
        if (!o.nh || o.label === null) {
          note(cur, 'Sem próximo salto rotulado para ' + f.id + ': descarta', 'warn');
          return end('dropped');
        }
        let op: string;
        if (o.label === 3) {
          const e = p.stack.shift()!;
          if (propagate) {
            if (p.stack.length) p.stack[0].ttl = e.ttl;
            else p.ipttl = e.ttl;
          }
          op = 'pop ' + e.label + ' (PHP, ' + o.nh + ' anunciou imp-null)';
        } else {
          op = 'swap ' + top.label + ' → ' + o.label;
          top.label = o.label;
        }
        move(o.nh, op);
        continue;
      }
    }
    // Pacote IP: chegou sem rótulo ou acabou de ser desencapsulado no egresso.
    if (!disposed || !propagate) {
      if (p.ipttl <= 1) {
        note(cur, 'O TTL do IP expirou', 'warn');
        return expire('ip');
      }
      p.ipttl--;
    }
    const dh = HOSTS.find((x) => x.pe === cur && inNet(p.dst, x.net));
    if (dh) {
      hop(cur, dh.id, cur + ' / ' + dh.id, 'entrega na rede conectada', HOST_DELAY);
      return end('delivered', { at: dh.id });
    }
    if (service === 'vpn') {
      if (r.role !== 'PE') {
        note(cur, 'É um P e não conhece rotas de clientes da VPN: descarta', 'warn');
        return end('dropped');
      }
      const tgt = HOSTS.find((x) => inNet(p.dst, x.net));
      if (!tgt) {
        note(cur, 'Sem rota para ' + p.dst + ': descarta', 'warn');
        return end('dropped');
      }
      if (step < 4) {
        note(cur, 'Ainda sem rota VPNv4 nem LSP até ' + tgt.pe + ': descarta', 'warn');
        return end('dropped');
      }
      const fLo = fecs(net).find((f) => f.owner === tgt.pe && f.kind === 'loopback')!;
      const o = outLabel(net, cur, fLo);
      if (!o.nh || o.label === null) {
        note(cur, 'Sem LSP até ' + tgt.pe + ': descarta', 'warn');
        return end('dropped');
      }
      const t = propagate ? p.ipttl : 255;
      p.stack = [{ label: vpnLabel(tgt.pe), ttl: t }];
      let op = 'push VPN ' + vpnLabel(tgt.pe);
      if (o.label !== 3) {
        p.stack.unshift({ label: o.label, ttl: t });
        op = 'push ' + o.label + ' (transporte) + ' + vpnLabel(tgt.pe) + ' (VPN)';
      }
      move(o.nh, op);
      continue;
    }
    const f = fecFor(net, p.dst);
    const nh = f ? igpNext(net, cur, f.owner) : null;
    if (!f || !nh) {
      note(cur, 'Sem rota IGP para ' + p.dst + ': descarta', 'warn');
      return end('dropped');
    }
    let op = 'consulta IP (LPM) em ' + f.id;
    if (step >= 4) {
      const o = outLabel(net, cur, f);
      if (o.label !== null && o.label !== 3) {
        p.stack = [{ label: o.label, ttl: propagate ? p.ipttl : 255 }];
        op = 'push ' + o.label + ' (FEC ' + f.id + ')';
      } else if (o.label === 3) op = 'consulta IP; ' + nh + ' anunciou imp-null, segue sem rótulo';
    }
    move(nh, op);
  }
  return end('dropped');
}
