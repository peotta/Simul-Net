// Topologia do simulador de ataques e defesas: onde cada controle atua e por onde cada pacote passa.
import type { Trace } from '../../sim-core';
import type { TopoNode, TopologyDef } from '../../sim-core/ui';
import { VICTIM } from './content/data';
import type { Sim } from './model';

export const topology = (_sub: string, tr: Trace): TopologyDef => {
  const s = (tr.raw.sim as Sim).s;
  const reflect = s.mode === 'reflect';
  const nodes: TopoNode[] = [
    { key: 'attacker', label: s.multi ? 'Botnet' : 'Atacante', sub: s.multi ? 'milhares de IPs' : '198.51.100.x', x: 110, y: 90, kind: 'attacker', w: 150 },
    { key: 'client', label: 'Cliente', sub: '198.51.100.77', x: 110, y: 300, kind: 'host', w: 150 },
    { key: 'upstream', label: 'Operadora', sub: 'upstream (scrubbing, FlowSpec)', x: reflect ? 700 : 400, y: reflect ? 190 : 120, kind: 'cloud', w: 170 },
    { key: 'firewall', label: 'FW / IDS', sub: 'borda da vítima', x: 560, y: 300, kind: 'router', w: 150 },
    { key: 'server', label: 'Vítima', sub: VICTIM, x: 890, y: 300, kind: 'host', w: 150 },
  ];
  const links: TopologyDef['links'] = [['client', 'firewall'], ['firewall', 'server'], ['upstream', 'firewall']];
  if (reflect) {
    nodes.push({ key: 'edge', label: 'ISP', sub: 'borda da origem', x: 330, y: 50, kind: 'router', w: 150 }, { key: 'reflector', label: 'Refletor', sub: '192.0.2.53', x: 890, y: 70, kind: 'host', w: 150 });
    links.push(['attacker', 'edge'], ['edge', 'reflector'], ['reflector', 'upstream']);
  } else links.push(['attacker', 'upstream']);
  return { width: 1000, height: 380, nodes, links, route: (m) => (m.route as string[]) || [m.from, m.to] };
};
