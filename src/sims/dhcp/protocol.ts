import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildDhcp, type DhcpParams } from './engine';
import { topology } from './topology';

/**
 * Tempo simulado em escala humana: o ciclo do lease vai de milissegundos a horas. Formato compacto, com a unidade
 * principal e o resto (por exemplo "4h+1,4ms"), para o instante de cada mensagem continuar distinguível.
 */
export function fmtTime(ms: number): string {
  const f = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (ms < 1000) return f(ms) + 'ms';
  const unit = ms >= 3600000 ? 3600000 : ms >= 60000 ? 60000 : 1000;
  const name = unit === 3600000 ? 'h' : unit === 60000 ? 'min' : 's';
  const base = Math.floor(ms / unit);
  const rem = ms - base * unit;
  return base + name + (rem < 0.05 ? '' : '+' + fmtTime(rem));
}

/** Simulador de DHCP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const dhcpProtocol: ProtocolDef = {
  id: 'dhcp',
  label: 'DHCP (DORA)',
  stateTitle: 'Estado do cliente',
  rfcs: [[2131, 'DHCP'], [2132, 'Opções DHCP'], [5227, 'ARP Probe']],
  subs: [
    { key: 'dora', label: 'Concessão (DORA)', default: 'd-dora' },
    { key: 'lease', label: 'Ciclo do lease', default: 'd-renew' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  topology,
  topologyTitle: 'Topologia: cliente, switch e servidores DHCP',
  timeLabel: fmtTime,
  legend: [
    { color: 'var(--amber)', label: 'DISCOVER' },
    { color: 'var(--blue)', label: 'OFFER' },
    { color: 'var(--purple)', label: 'REQUEST' },
    { color: 'var(--teal)', label: 'ACK' },
    { color: 'var(--red)', label: 'DECLINE, falha' },
    { color: 'var(--muted)', label: 'RELEASE, ARP' },
  ],
  build: (P, sub) => buildDhcp(P as unknown as DhcpParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as DhcpParams),
  reference,
  fundamentacao,
  setup,
};

export default dhcpProtocol;
