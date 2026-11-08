import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildNat, fmtTime, type NatParams } from './engine';
import { topology } from './topology';

/** Simulador de NAT nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const natProtocol: ProtocolDef = {
  id: 'nat',
  label: 'NAT (SNAT, DNAT e NAPT)',
  stateTitle: 'Estado do NAT',
  rfcs: [[2663, 'Terminologia'], [3022, 'NAT tradicional'], [4787, 'UDP'], [5382, 'TCP'], [5508, 'ICMP'], [6598, 'Espaço 100.64.0.0/10'], [6888, 'CGN']],
  subs: [
    { key: 'snat', label: 'Saída: Basic NAT e NAPT', default: 'n-napt' },
    { key: 'dnat', label: 'Entrada: DNAT', default: 'n-dnat' },
    { key: 'limites', label: 'Limites, IPsec e CGNAT', default: 'n-portas' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: rede interna, roteador NAT e servidor externo',
  timeLabel: fmtTime,
  legend: [
    { color: 'var(--amber)', label: 'Lado interno (endereços privados)' },
    { color: 'var(--blue)', label: 'Lado externo (traduzido)' },
    { color: 'var(--teal)', label: 'Entre CPE e CGN (100.64.0.0/10)' },
    { color: 'var(--red)', label: 'Descartado' },
  ],
  build: (P, sub) => buildNat(P as unknown as NatParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as NatParams),
  reference,
  fundamentacao,
  setup,
};

export default natProtocol;
