// Topologia do simulador de RIP: seis roteadores, os enlaces (o RIP ignora o custo) e os dois PCs.
import type { Trace } from '../../sim-core';
import type { TopoNode, TopologyDef } from '../../sim-core/ui';
import { routerIdOf, type LiveLink, type Topo } from '../roteamento-base/topologia';

export const topology = (_sub: string, tr: Trace): TopologyDef => {
  const R = tr.raw;
  const t = R.t as Topo;
  const shown = R.links as LiveLink[];
  const nodes: TopoNode[] = [
    ...t.routers.map((r): TopoNode => ({ key: r.id, label: r.id, sub: routerIdOf(r.id), x: t.pos[r.id][0], y: t.pos[r.id][1], kind: 'router', w: 110 })),
    ...t.hosts.map((h): TopoNode => ({ key: h.id, label: h.id, sub: h.id === 'PC-A' ? '192.168.1.10' : '192.168.2.10', x: t.pos[h.id][0], y: t.pos[h.id][1], kind: 'host', w: 110 })),
  ];
  const links: TopologyDef['links'] = [
    ...shown.map((l): [string, string, { label: string; down?: boolean }] => {
      const orig = t.links.find((x) => x.id === l.id)!;
      const nota = l.cost !== orig.cost ? ', custo ' + l.cost + ' (ignorado)' : '';
      return [l.a, l.b, { label: l.id + ', 1 salto' + nota + (l.up ? '' : ' (caído)'), down: !l.up }];
    }),
    ...t.hosts.map((h): [string, string] => [h.id, h.attach]),
  ];
  return { width: 920, height: 440, nodes, links, route: (msg) => [msg.from, msg.to] };
};
