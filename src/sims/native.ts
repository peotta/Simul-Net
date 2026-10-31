import type { ProtocolDef } from '../sim-core/ui';

/**
 * Simuladores com engine 'nativo': identificador do registro para o módulo, carregado sob demanda
 * (cada simulador vira um bloco separado no build e não pesa no hub).
 */
export const NATIVE: Record<string, () => Promise<{ default: ProtocolDef }>> = {
  'ssh': () => import('./ssh/protocol'),
  'https': () => import('./https/protocol'),
  'ftp': () => import('./ftp/protocol'),
  'arp': () => import('./arp/protocol'),
  'icmp': () => import('./icmp/protocol'),
  'dhcp': () => import('./dhcp/protocol'),
  'http-versoes': () => import('./http-versoes/protocol'),
  'nat': () => import('./nat/protocol'),
  'dns': () => import('./dns/protocol'),
  'firewall': () => import('./firewall/protocol'),
  'switching': () => import('./switching/protocol'),
  'stp': () => import('./stp/protocol'),
  'vlan': () => import('./vlan/protocol'),
};
