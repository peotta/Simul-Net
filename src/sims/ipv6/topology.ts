// Topologia do IPv6: no encaminhamento, quatro roteadores com as redes entre eles; no endereçamento, o host A, o host B, o
// roteador e o servidor. O pacote percorre o caminho que o trace registra em cada mensagem.
import type { Trace } from '../../sim-core';
import type { TopologyDef } from '../../sim-core/ui';
import type { FwdParams } from './fwd';

const FWD: TopologyDef = {
  width: 1000,
  height: 290,
  nodes: [
    { key: 'pc', label: 'PC-A', sub: '2001:db8:1:1::10', x: 85, y: 130, kind: 'host', w: 130 },
    { key: 'r1', label: 'R1', sub: 'fe80::1', x: 265, y: 130, kind: 'router', w: 100 },
    { key: 'r2', label: 'R2', sub: '2001:db8:0:12::2', x: 450, y: 130, kind: 'router', w: 130 },
    { key: 'r3', label: 'R3', sub: '2001:db8:0:23::2', x: 640, y: 50, kind: 'router', w: 130 },
    { key: 'r4', label: 'R4', sub: '2001:db8:0:24::2', x: 640, y: 190, kind: 'router', w: 130 },
    { key: 'srv1', label: 'SRV1', sub: '2001:db8:2:1::20', x: 870, y: 50, kind: 'host', w: 130 },
    { key: 'srv2', label: 'SRV2', sub: '2001:db8:2:5::20', x: 870, y: 150, kind: 'host', w: 130 },
    { key: 'isp', label: 'Provedor', sub: '2001:db8:0:ff::1', x: 870, y: 245, kind: 'cloud', w: 130 },
  ],
  links: [
    ['pc', 'r1', { label: '2001:db8:1:1::/64' }],
    ['r1', 'r2', { label: '2001:db8:0:12::/64' }],
    ['r2', 'r3', { label: '2001:db8:0:23::/64' }],
    ['r2', 'r4', { label: '2001:db8:0:24::/64' }],
    ['r3', 'srv1', { label: '2001:db8:2:1::/64' }],
    ['r4', 'srv2', { label: '2001:db8:2:5::/64' }],
    ['r4', 'isp', { label: '2001:db8:0:ff::/64' }],
  ],
  route: (m) => (m.route as string[] | undefined) || [m.from, m.to],
  notes: (tr: Trace) => {
    const P = (tr.raw.P || {}) as Partial<FwdParams>;
    const out: Record<string, string[]> = {};
    const r2: string[] = [];
    if (P.agg === false) r2.push('sem 2001:db8:2::/48');
    if (P.dfl === false) r2.push('sem rota padrão');
    if (r2.length) out.r2 = r2;
    if (P.back === false) out.r3 = ['sem rota para 2001:db8:1::/48'];
    return out;
  },
};

const END: TopologyDef = {
  width: 900,
  height: 262,
  nodes: [
    { key: 'a', label: 'Host A', sub: 'fe80::...', x: 120, y: 60, kind: 'host', w: 170 },
    { key: 'b', label: 'Host B', sub: '2001:db8:10:1::20', x: 120, y: 190, kind: 'host', w: 170 },
    { key: 'r', label: 'Roteador', sub: 'fe80::1', x: 450, y: 125, kind: 'router', w: 130 },
    { key: 's', label: 'Servidor', sub: '2001:db8:20:2::50', x: 780, y: 125, kind: 'host', w: 170 },
  ],
  links: [['a', 'r', { label: 'eth0 2001:db8:10:1::/64' }], ['b', 'r'], ['r', 's', { label: 'eth1 2001:db8:20:2::/64' }]],
  route: (m) => (m.route as string[] | undefined) || [m.from, m.to],
};

export const topology = (sub: string, tr: Trace): TopologyDef => {
  if (sub === 'fwd') return FWD;
  const c = tr.cols.find((x) => x.key === 'a');
  return { ...END, nodes: END.nodes.map((n) => (n.key === 'a' && c && c.addr ? { ...n, sub: c.addr } : n)) };
};
