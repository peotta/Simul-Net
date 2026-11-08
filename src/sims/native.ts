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
  '802-1x': () => import('./802-1x/protocol'),
  'wifi': () => import('./wifi/protocol'),
  'mpls': () => import('./mpls/protocol'),
  'ospf': () => import('./ospf/protocol'),
  'rip': () => import('./rip/protocol'),
  'bgp': () => import('./bgp/protocol'),
  tcp: () => import('./tcp/protocol'),
  udp: () => import('./udp/protocol'),
  ipv4: () => import('./ipv4/protocol'),
  ipv6: () => import('./ipv6/protocol'),
  'ataques-tcp-udp': () => import('./ataques-tcp-udp/protocol'),
  'osi': () => import('./osi/protocol'),
};
