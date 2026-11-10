import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildEnd, type EndParams } from './end';
import { buildFwd, type FwdParams } from './fwd';
import { topology } from './topology';

/** Simulador de IPv4 nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const ipv4Protocol: ProtocolDef = {
  id: 'ipv4',
  label: 'IPv4',
  stateTitle: 'Estado da decisão',
  rfcs: [[791, 'IPv4'], [1122, 'Requisitos de hosts'], [1812, 'Requisitos de roteadores'], [1071, 'Checksum'], [1918, 'Endereços privados'], [4632, 'CIDR'], [2474, 'DSCP'], [3168, 'ECN'], [2644, 'Broadcast dirigido'], [3021, 'Prefixo /31'], [3704, 'uRPF'], [2827, 'BCP 38'], [3927, 'Link-local'], [5737, 'Documentação'], [6598, 'CGNAT'], [6890, 'Uso especial'], [919, 'Broadcast limitado']],
  subs: [
    { key: 'fwd', label: 'Encaminhamento', default: 'f-lpm16' },
    { key: 'end', label: 'Endereçamento', default: 'e-local' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: o caminho do pacote',
  timeLabel: (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : ms.toFixed(1) + ' ms'),
  build: (P, sub) => (sub === 'end' ? buildEnd({ ...P, dest: P.edest } as unknown as EndParams, sub) : buildFwd(P as unknown as FwdParams, sub)),
  explain: (tr, P, scen) => explain(tr, P, scen),
  reference,
  fundamentacao,
  setup,
};

export default ipv4Protocol;
