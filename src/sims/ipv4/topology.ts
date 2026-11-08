// Topologia do IPv4: no encaminhamento, quatro roteadores com as redes entre eles; no endereçamento, o host A, o host B,
// o roteador e o servidor. O pacote percorre o caminho que o trace registra em cada mensagem.
import type { Trace } from '../../sim-core';
import type { TopologyDef } from '../../sim-core/ui';
import type { FwdParams } from './fwd';
import type { EndParams } from './end';

const FWD: TopologyDef = {
  width: 1000,
  height: 290,
  nodes: [
    { key: 'pc', label: 'PC-A', sub: '10.1.1.10', x: 80, y: 130, kind: 'host', w: 100 },
    { key: 'r1', label: 'R1', sub: '10.1.1.1', x: 250, y: 130, kind: 'router', w: 100 },
    { key: 'r2', label: 'R2', sub: '10.0.12.2', x: 430, y: 130, kind: 'router', w: 100 },
    { key: 'r3', label: 'R3', sub: '10.0.23.2', x: 630, y: 50, kind: 'router', w: 100 },
    { key: 'r4', label: 'R4', sub: '10.0.24.2', x: 630, y: 190, kind: 'router', w: 100 },
    { key: 'srv1', label: 'SRV1', sub: '10.2.1.20', x: 850, y: 50, kind: 'host', w: 110 },
    { key: 'srv2', label: 'SRV2', sub: '10.2.5.20', x: 850, y: 150, kind: 'host', w: 110 },
    { key: 'isp', label: 'Provedor', sub: '203.0.113.1', x: 850, y: 245, kind: 'cloud', w: 130 },
  ],
  links: [
    ['pc', 'r1', { label: '10.1.1.0/24' }],
    ['r1', 'r2', { label: '10.0.12.0/30' }],
    ['r2', 'r3', { label: '10.0.23.0/30' }],
    ['r2', 'r4', { label: '10.0.24.0/30' }],
    ['r3', 'srv1', { label: '10.2.1.0/24' }],
    ['r4', 'srv2', { label: '10.2.5.0/24' }],
    ['r4', 'isp', { label: '203.0.113.0/30' }],
  ],
  route: (m) => (m.route as string[] | undefined) || [m.from, m.to],
  notes: (tr: Trace) => {
    const P = (tr.raw.P || {}) as Partial<FwdParams>;
    const out: Record<string, string[]> = {};
    if (P.spoof) out.pc = ['origem forjada: ' + (tr.raw.srcIp as string)];
    if (P.urpf && P.urpf !== 'off') out.r1 = ['uRPF ' + (P.urpf === 'strict' ? 'estrito' : 'flexível') + ' na eth0'];
    const r2: string[] = [];
    if (P.agg === false) r2.push('sem 10.2.0.0/16');
    if (P.dfl === false) r2.push('sem rota padrão');
    if (P.dup === 'ad') r2.push('10.2.5.0/24: estática e OSPF');
    if (P.dup === 'metric') r2.push('10.2.0.0/16: métricas 20 e 30');
    if (r2.length) out.r2 = r2;
    const r3: string[] = [];
    if (P.loopf) r3.push('padrão via R2');
    if (P.bh) r3.push('10.2.9.0/24: blackhole');
    if (P.back === false) r3.push('sem rota para 10.1.0.0/16');
    if (r3.length) out.r3 = r3;
    return out;
  },
};

const END: TopologyDef = {
  width: 900,
  height: 262,
  nodes: [
    { key: 'a', label: 'Host A', sub: '192.168.10.10', x: 110, y: 60, kind: 'host', w: 130 },
    { key: 'b', label: 'Host B', sub: '192.168.10.20', x: 110, y: 190, kind: 'host', w: 130 },
    { key: 'r', label: 'Roteador', sub: '192.168.10.1', x: 440, y: 125, kind: 'router', w: 130 },
    { key: 's', label: 'Servidor', sub: '10.20.0.50', x: 790, y: 60, kind: 'host', w: 130 },
    { key: 'lan2', label: '10.20.0.128/25', sub: 'eth2 sobreposta', x: 790, y: 190, kind: 'cloud', w: 150 },
  ],
  links: [['a', 'r', { label: 'eth0 192.168.10.0/24' }], ['b', 'r'], ['r', 's', { label: 'eth1 10.20.0.0/24' }]],
  route: (m) => (m.route as string[] | undefined) || [m.from, m.to],
};

export const topology = (sub: string, tr: Trace): TopologyDef => {
  if (sub === 'fwd') return FWD;
  const P = (tr.raw.P || {}) as Partial<EndParams>;
  const link31 = P.dest === 'srv31';
  const nodes = END.nodes.filter((n) => n.key !== 'lan2' || P.ovl).map((n) => {
    const c = tr.cols.find((x) => x.key === n.key);
    const base = n.key === 'a' && c && c.addr ? { ...n, sub: c.addr } : n.key === 's' && c && c.addr ? { ...n, sub: c.addr } : n;
    return base;
  });
  return {
    ...END,
    nodes,
    links: [
      ['a', 'r', { label: 'eth0 192.168.10.0/24' }],
      ['b', 'r'],
      ['r', 's', { label: link31 ? 'eth3 10.20.1.0/31' : 'eth1 10.20.0.0/24' }],
      ...(P.ovl ? [['r', 'lan2', { dashed: true, label: 'eth2' }] as [string, string, { dashed: boolean; label: string }]] : []),
    ],
  };
};
