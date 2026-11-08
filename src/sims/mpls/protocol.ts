import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildDados, buildFalha, buildLdp, buildTtl, C, type DadosParams, type FalhaParams, type LdpParams, type TtlParams } from './modes';
import { topology } from './topology';

/** Simulador de MPLS (LDP e L3VPN) nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const mplsProtocol: ProtocolDef = {
  id: 'mpls',
  label: 'MPLS (LDP e L3VPN)',
  stateTitle: 'Estado do pacote',
  rfcs: [[3031, 'Arquitetura'], [3032, 'Cabeçalho de rótulo'], [5036, 'LDP'], [4364, 'L3VPN'], [4381, 'Segurança das VPNs']],
  subs: [
    { key: 'ldp', label: 'LDP e LSP', default: 'ldp' },
    { key: 'dados', label: 'Plano de dados', default: 'ping' },
    { key: 'ttl', label: 'TTL e traceroute', default: 'uniform' },
    { key: 'falha', label: 'Falha de enlace', default: 'failover' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: núcleo MPLS com 2 PE e 4 P, e um host atrás de cada PE',
  legend: [
    { color: C.data, label: 'Pacote de dados / Hello' },
    { color: C.ldp, label: 'Sessão LDP / Echo Reply' },
    { color: C.map, label: 'Label Mapping' },
    { color: C.bgp, label: 'MP-BGP' },
    { color: C.icmp, label: 'ICMP de erro ou falha' },
  ],
  build: (P, sub) => {
    if (sub === 'dados') return buildDados(P as unknown as DadosParams);
    if (sub === 'ttl') return buildTtl(P as unknown as TtlParams);
    if (sub === 'falha') return buildFalha(P as unknown as FalhaParams);
    return buildLdp(P as unknown as LdpParams);
  },
  explain: (tr) => explain(tr),
  reference,
  fundamentacao,
  setup,
};

export default mplsProtocol;
