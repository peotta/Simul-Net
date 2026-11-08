import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { fundamentacao } from './content/fundamentacao';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildOsi, C, type OsiParams } from './modes';
import { stage } from './stage';

/** Simulador do modelo OSI nativo: motor TypeScript puro e palco próprio (pilhas de camadas e encapsulamento). */
export const osiProtocol: ProtocolDef = {
  id: 'osi',
  label: 'Modelo OSI',
  stateTitle: 'Estado da pilha',
  rfcs: [[791, 'IPv4'], [9293, 'TCP'], [9112, 'HTTP/1.1'], [1812, 'Requisitos de roteadores']],
  subs: [{ key: 'jor', label: 'Jornada de um quadro', default: 'j-get' }],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  stage,
  legend: [
    { color: C.req, label: 'Requisição' },
    { color: C.resp, label: 'Resposta' },
  ],
  build: (P, sub) => buildOsi(P as unknown as OsiParams, sub),
  explain: (tr) => explain(tr),
  reference,
  fundamentacao,
  setup,
};

export default osiProtocol;
