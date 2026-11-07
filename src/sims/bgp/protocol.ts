import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildBgp, C, type BgpParams } from './modes';
import { topology } from './topology';

/** Simulador de BGP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const bgpProtocol: ProtocolDef = {
  id: 'bgp',
  label: 'BGP (sessões e seleção de caminho)',
  stateTitle: 'Estado da rede',
  rfcs: [[4271, 'BGP-4'], [6793, 'ASN de 4 bytes'], [5398, 'ASN de documentação'], [6811, 'Validação de origem (ROV)'], [7908, 'Vazamento de rota'], [9319, 'maxLength dos ROAs'], [9582, 'ROA'], [8212, 'eBGP sem política']],
  subs: [
    { key: 'sessao', label: 'Sessões', default: 'open' },
    { key: 'rotas', label: 'Rotas e política', default: 'prop' },
    { key: 'seguranca', label: 'Segurança e defesa', default: 'hijack' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: seis sistemas autônomos e as relações comerciais entre eles',
  timeLabel: (ms) => (ms >= 1000 ? (ms / 1000).toFixed(0) + ' s' : ms.toFixed(1) + ' ms'),
  legend: [
    { color: C.tcp, label: 'TCP (porta 179)' },
    { color: C.open, label: 'OPEN e KEEPALIVE' },
    { color: C.upd, label: 'UPDATE' },
    { color: C.wd, label: 'Retirada ou NOTIFICATION' },
    { color: C.data, label: 'Tráfego de dados' },
  ],
  build: (P, sub) => buildBgp(P as unknown as BgpParams, sub),
  explain: (tr) => explain(tr),
  reference,
  setup,
};

export default bgpProtocol;
