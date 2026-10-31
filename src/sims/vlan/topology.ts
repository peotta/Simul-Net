// Topologia do simulador de VLAN: dois switches em tronco, hosts nas VLANs 10 e 20, roteador e, no modo VLAN hopping, o invasor.
import type { Trace } from '../../sim-core';
import type { TopoNode, TopologyDef } from '../../sim-core/ui';
import { HOSTS, R1, type Net } from './model';

export const topology = (_sub: string, tr: Trace): TopologyDef => {
  const R = tr.raw;
  const net = R.net as Net;
  const cfg = (k: string) => net.ports[k];
  const acc = (k: string) => 'VLAN ' + cfg(k).vid;
  const lista = (k: string) => (cfg(k).allowed ? ', VLANs ' + cfg(k).allowed!.join(',') : '');
  const nodes: TopoNode[] = [
    { key: 'sw1', label: 'SW1', sub: 'switch', x: 340, y: 130, kind: 'switch' },
    { key: 'sw2', label: 'SW2', sub: 'switch', x: 640, y: 130, kind: 'switch' },
    { key: 'a', label: HOSTS.a.name, sub: HOSTS.a.ip, x: 90, y: 30, kind: 'host' },
    { key: 'b', label: HOSTS.b.name, sub: HOSTS.b.ip, x: 90, y: 130, kind: 'host' },
    { key: 'c', label: HOSTS.c.name, sub: HOSTS.c.ip, x: 820, y: 60, kind: 'host' },
    { key: 'd', label: HOSTS.d.name, sub: HOSTS.d.ip, x: 820, y: 200, kind: 'host' },
  ];
  const links: TopologyDef['links'] = [
    ['sw1', 'sw2', { label: 'tronco, nativa ' + cfg('sw1:3').native + '/' + cfg('sw2:3').native + lista('sw1:3') }],
    ['a', 'sw1', { label: acc('sw1:1') }],
    ['b', 'sw1', { label: acc('sw1:2') }],
    ['c', 'sw2', { label: acc('sw2:1') }],
    ['d', 'sw2', { label: acc('sw2:2') }],
  ];
  if (R.hasR) {
    nodes.push({ key: 'r1', label: R1.name, sub: R1.gw10 + ' e ' + R1.gw20, x: 340, y: 235, kind: 'router' });
    links.push(['r1', 'sw1', { label: 'tronco' + lista('sw1:4') }]);
  }
  if (R.hasM) {
    nodes.push({ key: 'm', label: HOSTS.m.name, sub: HOSTS.m.ip, x: 90, y: 235, kind: 'attacker' });
    links.push(['m', 'sw1', { label: cfg('sw1:5').mode === 'trunk' ? 'virou tronco' : acc('sw1:5') }]);
  }
  return { width: 900, height: 270, nodes, links };
};
