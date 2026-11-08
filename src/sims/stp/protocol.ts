import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildLaco, type LacoParams } from './laco';
import { buildMstp, type MstpParams } from './mstp';
import { buildProt, type ProtParams } from './prot';
import { buildRstp, type RstpParams } from './rstp';
import { buildStp, type StpParams } from './stp';
import { topology } from './topology';
import { fmtMs } from '../../sim-core';

/** Simulador de STP, RSTP e MSTP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const stpProtocol: ProtocolDef = {
  id: 'stp',
  label: 'STP, RSTP e MSTP',
  stateTitle: 'Estado da árvore',
  rfcs: [],
  subs: [
    { key: 'stp', label: 'STP clássico', default: 's-elect' },
    { key: 'rstp', label: 'RSTP', default: 'r-elect' },
    { key: 'mstp', label: 'MSTP', default: 'm-two' },
    { key: 'laco', label: 'Laço e tempestade', default: 'l-nostp' },
    { key: 'prot', label: 'Proteções', default: 'p-none' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: três switches em triângulo',
  build: (P, sub) => {
    if (sub === 'rstp') return buildRstp(P as unknown as RstpParams);
    if (sub === 'mstp') return buildMstp(P as unknown as MstpParams);
    if (sub === 'laco') return buildLaco(P as unknown as LacoParams);
    if (sub === 'prot') return buildProt(P as unknown as ProtParams);
    return buildStp(P as unknown as StpParams);
  },
  explain: (tr) => explain(tr),
  reference,
  fundamentacao,
  setup,
  timeLabel: (ms) => (ms >= 1000 ? (Math.round(ms / 100) / 10).toString().replace('.', ',') + ' s' : fmtMs(ms)),
};

export default stpProtocol;
