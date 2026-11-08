import type { ProtocolDef } from '../../sim-core/ui';
import { explain, setup } from '../transporte-base/content/explain';
import { stageTitles } from '../transporte-base/content/scenarios';
import { derive } from '../transporte-base/derive';
import { buildTcpUdp, C, type TcpUdpParams } from '../transporte-base/modes';
import { comparacao } from './content/comparacao';
import { fundamentacao } from './content/fundamentacao';
import { reference } from './content/reference';

const d = derive(['tcp', 'dl', 'cmp'], comparacao);

/** Simulador de TCP nativo: motor TypeScript puro (compartilhado com o UDP) e apresentação pela bancada genérica. */
export const tcpProtocol: ProtocolDef = {
  id: 'tcp',
  label: 'TCP',
  stateTitle: 'Estado da conexão',
  rfcs: [[9293, 'TCP'], [5681, 'cwnd'], [6298, 'RTO'], [2018, 'SACK'], [8985, 'RACK e TLP'], [768, 'UDP (comparação)']],
  subs: [
    { key: 'tcp', label: 'TCP: conexão', default: 'hs' },
    { key: 'dl', label: 'TCP: download', default: 'dlok' },
    { key: 'cmp', label: 'Comparação TCP x UDP', default: 'closs' },
  ],
  controls: d.controls,
  scenarios: d.scenarios,
  groupDoc: d.groupDoc,
  scenDoc: d.scenDoc,
  tabs: d.tabs,
  stageTitle: (sub) => stageTitles[sub],
  timeLabel: (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : ms.toFixed(1) + ' ms'),
  legend: [
    { color: C.conn, label: 'Conexão (SYN, FIN)' },
    { color: C.data, label: 'Dados' },
    { color: C.ack, label: 'ACK e resposta' },
    { color: C.bad, label: 'Segmento perdido' },
  ],
  build: (P, sub) => buildTcpUdp(P as unknown as TcpUdpParams, sub),
  explain,
  reference,
  fundamentacao,
  setup,
};

export default tcpProtocol;
