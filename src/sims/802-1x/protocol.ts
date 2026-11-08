import type { ProtocolDef } from '../../sim-core/ui';
import { COLORS } from '../../sim-core';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildAuth, buildFalha, buildPorta, buildSeg, type AuthParams, type FalhaParams, type PortaParams, type SegParams } from './engine';
import { fmtTime, GREEN } from './model';
import { topology } from './topology';

/** Simulador de 802.1X e RADIUS (EAP) nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const x8021Protocol: ProtocolDef = {
  id: '802-1x',
  label: '802.1X e RADIUS (EAP)',
  stateTitle: 'Estado da porta',
  rfcs: [[3748, 'EAP'], [2865, 'RADIUS'], [3579, 'RADIUS e EAP'], [5216, 'EAP-TLS'], [9190, 'EAP-TLS 1.3'], [5080, 'Problemas comuns do RADIUS']],
  subs: [
    { key: 'auth', label: 'Autenticação', default: 'a-tls' },
    { key: 'falha', label: 'Falhas', default: 'f-cred' },
    { key: 'porta', label: 'Porta e sessão', default: 'p-reauth' },
    { key: 'seg', label: 'Riscos e defesas', default: 's-md5' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: suplicante, switch autenticador, servidor RADIUS e a rede protegida',
  timeLabel: fmtTime,
  legend: [
    { color: COLORS.plain, label: 'EAPOL (suplicante e switch)' },
    { color: COLORS.data, label: 'RADIUS (switch e servidor) e dados' },
    { color: COLORS.enc, label: 'Dentro do túnel TLS' },
    { color: GREEN, label: 'Accept ou Success' },
    { color: COLORS.bad, label: 'Reject, falha ou descartado' },
  ],
  build: (P, sub) => {
    if (sub === 'falha') return buildFalha(P as unknown as FalhaParams);
    if (sub === 'porta') return buildPorta(P as unknown as PortaParams);
    if (sub === 'seg') return buildSeg(P as unknown as SegParams);
    return buildAuth(P as unknown as AuthParams);
  },
  explain: (tr) => explain(tr),
  reference,
  fundamentacao,
  setup,
};

export default x8021Protocol;
