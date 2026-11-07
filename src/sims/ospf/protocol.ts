import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildConv, buildEvento, buildMulti, C, type ConvParams, type EventoParams, type MultiParams } from './modes';
import { topology } from './topology';

/** Simulador de OSPF nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const ospfProtocol: ProtocolDef = {
  id: 'ospf',
  label: 'OSPF (estado de enlace)',
  stateTitle: 'Estado da rede',
  rfcs: [[2328, 'OSPF versão 2'], [5709, 'Autenticação HMAC-SHA']],
  subs: [
    { key: 'conv', label: 'Convergência', default: 'ospf' },
    { key: 'evento', label: 'Custo e falha', default: 'cost' },
    { key: 'multi', label: 'Multiárea', default: 'multi' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: roteadores, custo de cada enlace e os dois PCs',
  legend: [
    { color: C.hello, label: 'Hello' },
    { color: C.adj, label: 'DBD, LSR, LSU e LSAck (adjacência)' },
    { color: C.lsa, label: 'LSU da inundação (Router-LSA)' },
    { color: C.sum, label: 'Pacote de dados / Summary LSA' },
  ],
  build: (P, sub) => {
    if (sub === 'evento') return buildEvento(P as unknown as EventoParams);
    if (sub === 'multi') return buildMulti(P as unknown as MultiParams);
    return buildConv(P as unknown as ConvParams);
  },
  explain: (tr) => explain(tr),
  reference,
  setup,
};

export default ospfProtocol;
