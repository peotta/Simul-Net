import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildArp, type ArpParams } from './engine';
import { buildEnvenenamento, type EnvParams } from './envenenamento';
import { buildGratuito, type GraParams } from './gratuito';
import { topology } from './topology';

/** Simulador de ARP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const arpProtocol: ProtocolDef = {
  id: 'arp',
  label: 'ARP',
  stateTitle: 'Estado da resolução',
  rfcs: [[826, 'ARP'], [1027, 'Proxy ARP'], [1122, 'Requisitos de hosts'], [5227, 'Conflito de endereço']],
  subs: [
    { key: 'res', label: 'Resolução', default: 'r-local' },
    { key: 'gra', label: 'ARP gratuito e conflito', default: 'g-announce' },
    { key: 'env', label: 'Envenenamento de cache', default: 'e-normal' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: rede local com switch e gateway',
  build: (P, sub) =>
    sub === 'env' ? buildEnvenenamento(P as unknown as EnvParams) : sub === 'gra' ? buildGratuito(P as unknown as GraParams) : buildArp(P as unknown as ArpParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as ArpParams),
  reference,
  fundamentacao,
  setup,
};

export default arpProtocol;
