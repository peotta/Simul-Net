import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildApr, type AprParams } from './engine';
import { buildEsp, type EspParams } from './especiais';
import { buildInu, type InuParams } from './inundacao';
import { topology } from './topology';

/** Simulador de switching nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const switchingProtocol: ProtocolDef = {
  id: 'switching',
  label: 'Switching',
  stateTitle: 'Estado do switch',
  rfcs: [[1112, 'Multicast IP'], [4541, 'IGMP snooping'], [9776, 'IGMPv3']],
  subs: [
    { key: 'apr', label: 'Aprendizado e encaminhamento', default: 'a-first' },
    { key: 'inu', label: 'Inundação de MAC e segurança de porta', default: 'i-normal' },
    { key: 'esp', label: 'Broadcast, multicast e reservados', default: 'e-bcast' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: switch com quatro portas',
  build: (P, sub) => (sub === 'inu' ? buildInu(P as unknown as InuParams) : sub === 'esp' ? buildEsp(P as unknown as EspParams) : buildApr(P as unknown as AprParams)),
  explain: (tr) => explain(tr, null),
  reference,
  fundamentacao,
  setup,
  timeLabel: (ms) => (ms >= 1000 ? (Math.round(ms / 100) / 10).toString().replace('.', ',') + ' s' : (Math.round(ms * 10) / 10).toString().replace('.', ',') + ' ms'),
};

export default switchingProtocol;
