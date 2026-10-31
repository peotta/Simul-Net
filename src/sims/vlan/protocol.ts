import type { ProtocolDef } from '../../sim-core/ui';
import { COLORS } from '../../sim-core';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildHop, buildMarc, buildNativa, buildRota, buildSeg, type HopParams, type MarcParams, type NativaParams, type RotaParams, type SegParams } from './modes';
import { topology } from './topology';

/** Simulador de VLAN e trunking (802.1Q) nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const vlanProtocol: ProtocolDef = {
  id: 'vlan',
  label: 'VLAN e trunking (802.1Q)',
  stateTitle: 'Estado do quadro',
  rfcs: [],
  subs: [
    { key: 'marc', label: 'Marcação 802.1Q', default: 'v-tag' },
    { key: 'seg', label: 'Segmentação', default: 's-uni' },
    { key: 'rota', label: 'Roteamento entre VLANs', default: 'r-b' },
    { key: 'nativa', label: 'VLAN nativa', default: 'n-ok' },
    { key: 'hop', label: 'VLAN hopping', default: 'h-spoof' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: dois switches em tronco, hosts nas VLANs 10 e 20 e o roteador',
  legend: [
    { color: COLORS.plain, label: 'Quadro sem tag' },
    { color: COLORS.data, label: 'Quadro com tag 802.1Q' },
    { color: COLORS.bad, label: 'Descartado ou ação indevida' },
  ],
  build: (P, sub) => {
    if (sub === 'seg') return buildSeg(P as unknown as SegParams);
    if (sub === 'rota') return buildRota(P as unknown as RotaParams);
    if (sub === 'nativa') return buildNativa(P as unknown as NativaParams);
    if (sub === 'hop') return buildHop(P as unknown as HopParams);
    return buildMarc(P as unknown as MarcParams);
  },
  explain: (tr) => explain(tr),
  reference,
  setup,
};

export default vlanProtocol;
