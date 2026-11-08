import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildIcmp, type IcmpParams } from './engine';
import { topology } from './topology';

/** Simulador de ICMP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const icmpProtocol: ProtocolDef = {
  id: 'icmp',
  label: 'ICMP (ping e traceroute)',
  stateTitle: 'Estado do comando',
  rfcs: [[792, 'ICMP'], [1191, 'Path MTU Discovery'], [1812, 'Roteadores IPv4'], [2923, 'Problemas de PMTUD']],
  subs: [
    { key: 'ping', label: 'Ping', default: 'i-echo' },
    { key: 'trace', label: 'Traceroute e tracert', default: 'i-trace' },
    { key: 'hping', label: 'Scan UDP (hping3)', default: 'i-port' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: PC-A até o servidor por três roteadores',
  legend: [
    { color: 'var(--amber)', label: 'Echo Request ou sonda' },
    { color: 'var(--teal)', label: 'Echo Reply' },
    { color: 'var(--purple)', label: 'Time Exceeded' },
    { color: 'var(--blue)', label: 'UDP' },
    { color: 'var(--red)', label: 'Destination Unreachable, falha' },
  ],
  build: (P, sub) => buildIcmp(P as unknown as IcmpParams, sub),
  explain: (tr, P, scen) => explain(tr, P as unknown as IcmpParams, scen),
  reference,
  fundamentacao,
  setup,
};

export default icmpProtocol;
