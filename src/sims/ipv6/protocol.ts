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

/** Simulador de IPv6 (fundamentos) nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const ipv6Protocol: ProtocolDef = {
  id: 'ipv6',
  label: 'IPv6',
  stateTitle: 'Estado da decisão',
  rfcs: [[8200, 'IPv6'], [4291, 'Endereçamento'], [4443, 'ICMPv6'], [4861, 'Neighbor Discovery'], [4862, 'SLAAC e DAD'], [5952, 'Representação textual'], [3849, 'Documentação'], [4193, 'Local único (ULA)'], [8981, 'Endereços temporários'], [7217, 'Identificador estável opaco'], [2464, 'IPv6 sobre Ethernet']],
  subs: [
    { key: 'end', label: 'Endereçamento e SLAAC', default: 'e-slaac' },
    { key: 'fwd', label: 'Encaminhamento', default: 'f-lpm48' },
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

export default ipv6Protocol;
