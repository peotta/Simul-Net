import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { scenarioChart } from './content/charts';
import { fundamentacao } from './content/fundamentacao';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildCongestion, COL_COLORS, type CongParams } from './engine';

/** Simulador de controle de congestionamento nativo (Reno/NewReno, CUBIC e BBR): motor puro por rodadas e bancada genérica. */
export const congestionamentoProtocol: ProtocolDef = {
  id: 'congestionamento',
  label: 'Controle de congestionamento (Reno, CUBIC e BBR)',
  stateTitle: 'Estado do algoritmo',
  rfcs: [[5681, 'Reno'], [6582, 'NewReno'], [9438, 'CUBIC'], [6928, 'Janela inicial'], [2018, 'SACK'], [6298, 'RTO']],
  subs: [
    { key: 'reno', label: 'Reno/NewReno', default: 'reno-serra' },
    { key: 'cubic', label: 'CUBIC', default: 'cubic-curva' },
    { key: 'bbr', label: 'BBR', default: 'bbr-fases' },
    { key: 'cmp', label: 'Comparação', default: 'cmp-base' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  timeLabel: (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : ms.toFixed(1) + ' ms'),
  legend: [
    { color: COL_COLORS.data, label: 'Rodada de dados (janela em voo)' },
    { color: COL_COLORS.ack, label: 'ACKs' },
    { color: COL_COLORS.bad, label: 'Rodada com perda' },
  ],
  build: (P, sub) => buildCongestion(P as unknown as CongParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as CongParams),
  reference,
  fundamentacao,
  docChart: scenarioChart,
  setup,
};

export default congestionamentoProtocol;
