import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildDns, fmtTime, type DnsParams } from './engine';
import { topology } from './topology';

/** Simulador de DNS e DNSSEC nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const dnsProtocol: ProtocolDef = {
  id: 'dns',
  label: 'DNS e DNSSEC',
  stateTitle: 'Estado da consulta',
  rfcs: [[1034, 'Conceitos'], [1035, 'Implementação'], [2308, 'Cache negativo'], [4033, 'DNSSEC'], [4035, 'Protocolo DNSSEC'], [5452, 'Resistência a forja'], [7858, 'DoT'], [8310, 'Perfis de uso do DoT'], [8484, 'DoH']],
  subs: [
    { key: 'res', label: 'Resolução', default: 'r-completa' },
    { key: 'sec', label: 'DNSSEC', default: 's-ok' },
    { key: 'env', label: 'Envenenamento de cache', default: 'e-nenhuma' },
    { key: 'amp', label: 'Amplificação', default: 'a-aberto' },
    { key: 'priv', label: 'DoT e DoH', default: 'p-udp' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: cliente, resolvedor e servidores do DNS',
  timeLabel: fmtTime,
  legend: [
    { color: 'var(--amber)', label: 'Consulta em claro' },
    { color: 'var(--blue)', label: 'Resposta' },
    { color: 'var(--teal)', label: 'Cifrado ou autenticado' },
    { color: 'var(--red)', label: 'Forjado, perdido ou descartado' },
  ],
  build: (P, sub) => buildDns(P as unknown as DnsParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as DnsParams),
  reference,
  fundamentacao,
  setup,
};

export default dnsProtocol;
