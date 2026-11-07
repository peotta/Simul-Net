import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildTcpUdp, C, type TcpUdpParams } from './modes';

/** Simulador de TCP e UDP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const tcpUdpProtocol: ProtocolDef = {
  id: 'tcp-udp',
  label: 'TCP e UDP',
  stateTitle: 'Estado da conexão',
  rfcs: [[9293, 'TCP'], [5681, 'cwnd'], [6298, 'RTO'], [2018, 'SACK'], [8985, 'RACK e TLP'], [768, 'UDP'], [3550, 'RTP'], [1035, 'DNS']],
  subs: [
    { key: 'tcp', label: 'TCP: conexão', default: 'hs' },
    { key: 'dl', label: 'TCP: download', default: 'dlok' },
    { key: 'stream', label: 'UDP: fluxo', default: 'ustream' },
    { key: 'dns', label: 'UDP: DNS', default: 'udns' },
    { key: 'vid', label: 'UDP: vídeo', default: 'vidok' },
    { key: 'cmp', label: 'Comparação TCP x UDP', default: 'closs' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  timeLabel: (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : ms.toFixed(1) + ' ms'),
  legend: [
    { color: C.conn, label: 'Conexão (SYN, FIN)' },
    { color: C.data, label: 'Dados' },
    { color: C.ack, label: 'ACK e resposta' },
    { color: C.bad, label: 'Segmento perdido' },
  ],
  build: (P, sub) => buildTcpUdp(P as unknown as TcpUdpParams, sub),
  explain: (tr) => explain(tr),
  reference,
  setup,
};

export default tcpUdpProtocol;
