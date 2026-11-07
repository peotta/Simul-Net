import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildConv, buildFalha, C, type ConvParams, type FalhaParams } from './modes';
import { topology } from './topology';

/** Simulador de RIPv2 nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const ripProtocol: ProtocolDef = {
  id: 'rip',
  label: 'RIP (vetor de distância)',
  stateTitle: 'Estado da rede',
  rfcs: [[2453, 'RIP versão 2'], [4822, 'Autenticação criptográfica']],
  subs: [
    { key: 'conv', label: 'Convergência', default: 'rip' },
    { key: 'falha', label: 'Falha e contagem ao infinito', default: 'ripfail' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: seis roteadores e os dois PCs (o RIP conta só saltos)',
  legend: [
    { color: C.resp, label: 'Response (periódica)' },
    { color: C.trig, label: 'Response disparada (mudança)' },
    { color: C.data, label: 'Pacote de dados' },
  ],
  build: (P, sub) => (sub === 'falha' ? buildFalha(P as unknown as FalhaParams) : buildConv(P as unknown as ConvParams)),
  explain: (tr) => explain(tr),
  reference,
  setup,
};

export default ripProtocol;
