// Topologia do simulador de BGP: seis sistemas autônomos, as relações comerciais e o estado final dos enlaces.
import type { Trace } from '../../sim-core';
import type { TopoNode, TopologyDef } from '../../sim-core/ui';
import { AS_ORDER, ASES, type Net } from './model';

export const topology = (_sub: string, tr: Trace): TopologyDef => {
  const net = tr.raw.net as Net;
  const nodes: TopoNode[] = AS_ORDER.map((id): TopoNode => ({
    key: id,
    label: ASES[id].name,
    sub: 'AS' + ASES[id].asn + (ASES[id].prefix ? ', ' + ASES[id].prefix : ''),
    x: ASES[id].x,
    y: ASES[id].y,
    kind: id === 'M' ? 'attacker' : 'router',
    w: 150,
  }));
  const links: TopologyDef['links'] = net.links.map((l): [string, string, { label: string; dashed?: boolean; down?: boolean }] => {
    const bad = !l.up || (l.silent && l.state === 'Idle');
    const nome = l.rel === 'peer' ? 'peering' : 'trânsito';
    return [l.a, l.b, { label: l.id + ', ' + nome + (!l.up ? ' (caído)' : bad ? ' (sem sessão)' : ''), dashed: l.rel === 'peer', down: bad }];
  });
  return { width: 1000, height: 360, nodes, links, route: (msg) => [msg.from, msg.to] };
};
