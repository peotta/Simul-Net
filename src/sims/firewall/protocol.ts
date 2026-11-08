import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildFirewall, fmtTime, type FwParams } from './engine';
import { topology } from './topology';

/** Simulador de firewall nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const firewallProtocol: ProtocolDef = {
  id: 'firewall',
  label: 'Firewall: filtragem e estado',
  stateTitle: 'Estado do firewall',
  rfcs: [[2979, 'Firewalls na Internet'], [9293, 'TCP'], [2827, 'Filtro de ingresso, BCP 38'], [5737, 'Endereços de documentação'], [6298, 'Retransmissão do TCP']],
  subs: [
    { key: 'acl', label: 'Filtro sem estado (ACL)', default: 'a-ok' },
    { key: 'est', label: 'Filtro com estado', default: 'e-tcp' },
    { key: 'dmz', label: 'Perímetro com DMZ', default: 'd-pub' },
    { key: 'def', label: 'Forja, varredura e limite de taxa', default: 'f-in-off' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: o firewall e suas zonas',
  timeLabel: fmtTime,
  legend: [
    { color: 'var(--amber)', label: 'Pacote chegando ao firewall' },
    { color: 'var(--blue)', label: 'Pacote encaminhado' },
    { color: 'var(--teal)', label: 'Conteúdo cifrado' },
    { color: 'var(--red)', label: 'Negado ou recusado' },
  ],
  build: (P, sub) => buildFirewall(P as unknown as FwParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as FwParams),
  reference,
  fundamentacao,
  setup,
};

export default firewallProtocol;
