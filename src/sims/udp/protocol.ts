import type { ProtocolDef } from '../../sim-core/ui';
import { explain, setup } from '../transporte-base/content/explain';
import { stageTitles } from '../transporte-base/content/scenarios';
import { derive } from '../transporte-base/derive';
import { buildTcpUdp, C, type TcpUdpParams } from '../transporte-base/modes';
import { comparacao } from './content/comparacao';
import { reference } from './content/reference';

const d = derive(['stream', 'dns', 'vid', 'cmp'], comparacao);

/** Simulador de UDP nativo: motor TypeScript puro (compartilhado com o TCP) e apresentação pela bancada genérica. */
export const udpProtocol: ProtocolDef = {
  id: 'udp',
  label: 'UDP',
  stateTitle: 'Estado da conexão',
  rfcs: [[768, 'UDP'], [3550, 'RTP'], [1035, 'DNS'], [9293, 'TCP (comparação)']],
  subs: [
    { key: 'stream', label: 'UDP: fluxo', default: 'ustream' },
    { key: 'dns', label: 'UDP: DNS', default: 'udns' },
    { key: 'vid', label: 'UDP: vídeo', default: 'vidok' },
    { key: 'cmp', label: 'Comparação UDP x TCP', default: 'closs' },
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
  setup,
};

export default udpProtocol;
