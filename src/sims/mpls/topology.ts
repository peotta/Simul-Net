// Topologia do simulador de MPLS: dois hosts, dois PEs e quatro P, com os enlaces, os custos IGP e os enlaces caídos.
import type { Trace } from '../../sim-core';
import type { TopoNode, TopologyDef } from '../../sim-core/ui';
import { HOSTS, LSRS, type Net } from './model';

const POS: Record<string, [number, number]> = {
  'H-A': [80, 180],
  PE1: [220, 180],
  P1: [410, 70],
  P2: [410, 290],
  P3: [630, 70],
  P4: [630, 290],
  PE2: [820, 180],
  'H-B': [960, 180],
};

export const topology = (_sub: string, tr: Trace): TopologyDef => {
  const net = tr.raw.net as Net;
  const nodes: TopoNode[] = [
    ...LSRS.map((r): TopoNode => ({ key: r.id, label: r.id, sub: (r.role === 'PE' ? 'PE, lo ' : 'P, lo ') + r.lo.split('.').slice(2).join('.'), x: POS[r.id][0], y: POS[r.id][1], kind: 'router', w: 110 })),
    ...HOSTS.map((h): TopoNode => ({ key: h.id, label: h.id, sub: h.ip, x: POS[h.id][0], y: POS[h.id][1], kind: 'host', w: 110 })),
  ];
  const links: TopologyDef['links'] = [
    ...net.links.map((l): [string, string, { label: string; down?: boolean }] => [l.a, l.b, { label: l.id + ', custo ' + l.cost + (l.up ? '' : ' (caído)'), down: !l.up }]),
    ...HOSTS.map((h): [string, string] => [h.id, h.pe]),
  ];
  return { width: 1040, height: 360, nodes, links, route: (m) => (m.via as string[] | undefined) || [m.from, m.to] };
};
