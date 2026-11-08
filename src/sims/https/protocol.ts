import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildHttps, type TlsParams } from './engine';

/** Simulador de HTTPS e TLS nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const httpsProtocol: ProtocolDef = {
  id: 'https',
  label: 'HTTPS',
  stateTitle: 'Estado da conexão HTTPS',
  rfcs: [[9846, 'TLS 1.3'], [5246, 'TLS 1.2'], [9525, 'verificação de nome'], [8996, 'TLS 1.0 e 1.1'], [5280, 'X.509'], [6797, 'HSTS']],
  subs: [
    { key: 'handshake', label: 'Handshake TLS', default: 'h13' },
    { key: 'cert', label: 'Certificados', default: 'c-ok' },
    { key: 'web', label: 'HTTP, HTTPS e HSTS', default: 'w-none' },
    { key: 'cmp', label: 'Comparação HTTP x HTTPS', default: 'k-login' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  build: (P, sub) => buildHttps(P as unknown as TlsParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as TlsParams),
  reference,
  fundamentacao,
  setup,
};

export default httpsProtocol;
