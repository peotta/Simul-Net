import type { ProtocolDef } from '../../sim-core/ui';
import { COLORS } from '../../sim-core';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildCanal, buildDesc, buildMeio, buildMov, type CanalParams, type DescParams, type MeioParams, type MovParams } from './engine';
import { fmtTime } from './model';
import { topology } from './topology';

/** Simulador de Wi-Fi (IEEE 802.11) nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const wifiProtocol: ProtocolDef = {
  id: 'wifi',
  label: 'Wi-Fi: operação (802.11)',
  stateTitle: 'Estado',
  rfcs: [[9542, 'Endereços MAC de documentação']],
  subs: [
    { key: 'desc', label: 'Descoberta e associação', default: 'd-passivo' },
    { key: 'meio', label: 'Acesso ao meio', default: 'm-basico' },
    { key: 'mov', label: 'Roaming e energia', default: 'r-roam' },
    { key: 'canal', label: 'Canais', default: 'c-ok' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: clientes, pontos de acesso e a rede cabeada',
  timeLabel: fmtTime,
  legend: [
    { color: COLORS.plain, label: 'Gerência (beacon, probe, autenticação, associação)' },
    { color: COLORS.tcp, label: 'Controle (ACK, RTS, CTS, PS-Poll)' },
    { color: COLORS.data, label: 'Dados e Ethernet' },
    { color: COLORS.enc, label: 'Handshake de chaves (EAPOL-Key)' },
    { color: COLORS.bad, label: 'Colisão, frame perdido ou descartado' },
  ],
  build: (P, sub) => {
    if (sub === 'meio') return buildMeio(P as unknown as MeioParams);
    if (sub === 'mov') return buildMov(P as unknown as MovParams);
    if (sub === 'canal') return buildCanal(P as unknown as CanalParams);
    return buildDesc(P as unknown as DescParams);
  },
  explain: (tr) => explain(tr),
  reference,
  fundamentacao,
  setup,
};

export default wifiProtocol;
