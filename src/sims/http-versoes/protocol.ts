import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildHttp, type HttpParams } from './engine';
import { topology } from './topology';

/** Simulador das versões do HTTP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const httpProtocol: ProtocolDef = {
  id: 'http-versoes',
  label: 'HTTP/1.1, HTTP/2 e HTTP/3',
  stateTitle: 'Estado da página',
  rfcs: [[9110, 'Semântica do HTTP'], [9112, 'HTTP/1.1'], [9113, 'HTTP/2'], [9114, 'HTTP/3'], [9000, 'QUIC'], [7541, 'HPACK'], [9204, 'QPACK']],
  subs: [
    { key: 'h1', label: 'HTTP/1.1', default: 'h1-six' },
    { key: 'h2', label: 'HTTP/2', default: 'h2-mux' },
    { key: 'h3', label: 'HTTP/3', default: 'h3-1rtt' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: navegador, Internet e servidor',
  legend: [
    { color: 'var(--amber)', label: 'Pedido (GET)' },
    { color: 'var(--blue)', label: 'Resposta (200)' },
    { color: 'var(--teal)', label: 'Handshake TLS ou QUIC' },
    { color: 'var(--muted)', label: 'TCP, ACK, SETTINGS' },
    { color: 'var(--red)', label: 'Perda ou entrega retida' },
  ],
  build: (P, sub) => buildHttp(P as unknown as HttpParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as HttpParams),
  reference,
  fundamentacao,
  setup,
};

export default httpProtocol;
