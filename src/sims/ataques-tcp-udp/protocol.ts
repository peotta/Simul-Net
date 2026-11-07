import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildAtaques, C, type AtkParams } from './modes';
import { topology } from './topology';

/** Simulador de ataques e defesas TCP/UDP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const ataquesProtocol: ProtocolDef = {
  id: 'ataques-tcp-udp',
  label: 'Ataques e defesas TCP/UDP',
  stateTitle: 'Telemetria da simulação',
  rfcs: [[4987, 'SYN flood'], [5961, 'RST e sequência'], [2827, 'BCP 38'], [5925, 'TCP-AO'], [8955, 'FlowSpec'], [7999, 'RTBH'], [8198, 'Aggressive NSEC']],
  subs: [
    { key: 'tcp', label: 'Ataques TCP', default: 'syn-flood' },
    { key: 'udp', label: 'Ataques UDP', default: 'udp-flood' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: onde cada controle atua e por onde passa cada pacote',
  timeLabel: (ms) => 'ciclo ' + (Math.floor(Math.max(0, ms - 1e-6) / 1000) + 1) + (ms % 1000 ? ' +' + Math.round(ms % 1000) + ' ms' : ''),
  legend: [
    { color: C.attack, label: 'Ataque' },
    { color: C.blocked, label: 'Neutralizado' },
    { color: C.resp, label: 'Resposta' },
    { color: C.legit, label: 'Legítimo' },
    { color: C.legitDrop, label: 'Legítimo descartado' },
  ],
  build: (P, sub) => buildAtaques(P as unknown as AtkParams, sub),
  explain: (tr) => explain(tr),
  reference,
  setup,
};

export default ataquesProtocol;
