// Modelo do IPv4: aritmética de endereços e máscaras, busca na tabela de rotas (prefixo mais específico), classificação
// dos blocos especiais (RFC 6890) e montagem do cabeçalho de 20 bytes com o checksum da RFC 1071.
import { csum } from '../osi/model';

export const toInt = (s: string): number => s.split('.').reduce((a, o) => a * 256 + Number(o), 0) >>> 0;
export const toStr = (n: number): string => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
export const maskOf = (len: number): number => (len <= 0 ? 0 : (0xffffffff << (32 - len)) >>> 0);
export const maskStr = (len: number): string => toStr(maskOf(len));
export const netOf = (ip: string, len: number): string => toStr((toInt(ip) & maskOf(len)) >>> 0);
export const bcastOf = (ip: string, len: number): string => toStr(((toInt(ip) & maskOf(len)) | (~maskOf(len) >>> 0)) >>> 0);
export const inNet = (ip: string, net: string, len: number): boolean => ((toInt(ip) & maskOf(len)) >>> 0) === ((toInt(net) & maskOf(len)) >>> 0);

/** Os 32 bits do endereço, em quatro grupos de oito. */
export const bin32 = (ip: string): string => ip.split('.').map((o) => Number(o).toString(2).padStart(8, '0')).join('.');

/** Quantos bits iniciais dois endereços têm em comum. */
export function commonBits(a: string, b: string): number {
  const x = (toInt(a) ^ toInt(b)) >>> 0;
  return x === 0 ? 32 : Math.clz32(x);
}

/** Endereços utilizáveis por host em um prefixo: /31 tem dois (RFC 3021) e /32 tem um; os demais perdem rede e broadcast. */
export function hostCount(len: number): number {
  if (len >= 32) return 1;
  if (len === 31) return 2;
  return 2 ** (32 - len) - 2;
}

export type RouteKind = 'conn' | 'via' | 'blackhole';
export interface Route {
  net: string;
  len: number;
  kind: RouteKind;
  /** Próximo salto (rotas via). */
  via?: string;
  iface: string;
  /** Origem da rota: C conectada, S estática, O aprendida por protocolo de roteamento. */
  proto: 'C' | 'S' | 'O';
  /** Distância administrativa: confiança na origem da rota (menor vence). */
  ad: number;
  metric: number;
}

export interface Lookup {
  /** Índices das rotas que contêm o destino. */
  matches: number[];
  /** Índice da rota escolhida, ou -1 quando nada casa. */
  winner: number;
}

/** Busca o destino na tabela: vence o maior prefixo; em empate, a menor distância administrativa e depois a menor métrica. */
export function lookup(table: Route[], dst: string): Lookup {
  const matches: number[] = [];
  table.forEach((r, i) => {
    if (inNet(dst, r.net, r.len)) matches.push(i);
  });
  let winner = -1;
  matches.forEach((i) => {
    const r = table[i];
    const w = winner >= 0 ? table[winner] : null;
    if (!w || r.len > w.len || (r.len === w.len && (r.ad < w.ad || (r.ad === w.ad && r.metric < w.metric)))) winner = i;
  });
  return { matches, winner };
}

export const routeText = (r: Route): string =>
  r.proto + ' ' + r.net + '/' + r.len + (r.kind === 'conn' ? ' conectada, ' + r.iface : r.kind === 'blackhole' ? ' blackhole' : ' via ' + r.via + ', ' + r.iface) + (r.kind === 'conn' ? '' : ' [' + r.ad + '/' + r.metric + ']');

export interface Special {
  net: string;
  len: number;
  nome: string;
  rfc: string;
  /** Pode circular na internet pública? */
  publico: boolean;
  nota: string;
}

/** Blocos de uso especial relevantes (RFC 6890 e as RFCs de cada bloco); o de maior prefixo que contém o endereço classifica-o. */
export const SPECIAL: Special[] = [
  { net: '0.0.0.0', len: 8, nome: 'Esta rede', rfc: 'RFC 1122, seção 3.2.1.3', publico: false, nota: 'só vale como origem, em hosts que ainda não têm endereço' },
  { net: '10.0.0.0', len: 8, nome: 'Uso privado', rfc: 'RFC 1918', publico: false, nota: 'não é roteado na internet' },
  { net: '100.64.0.0', len: 10, nome: 'Espaço compartilhado (CGNAT)', rfc: 'RFC 6598', publico: false, nota: 'reservado ao NAT de operadora, dentro do provedor' },
  { net: '127.0.0.0', len: 8, nome: 'Loopback', rfc: 'RFC 1122, seção 3.2.1.3', publico: false, nota: 'nunca sai do próprio host' },
  { net: '169.254.0.0', len: 16, nome: 'Link-local', rfc: 'RFC 3927', publico: false, nota: 'só vale no enlace local e nunca é encaminhado por roteadores (seção 2.7)' },
  { net: '172.16.0.0', len: 12, nome: 'Uso privado', rfc: 'RFC 1918', publico: false, nota: 'não é roteado na internet' },
  { net: '192.0.0.0', len: 24, nome: 'Protocolos da IETF', rfc: 'RFC 6890', publico: false, nota: 'atribuições especiais da IETF' },
  { net: '192.0.2.0', len: 24, nome: 'Documentação (TEST-NET-1)', rfc: 'RFC 5737', publico: false, nota: 'reservado a exemplos, não deve aparecer na internet' },
  { net: '192.168.0.0', len: 16, nome: 'Uso privado', rfc: 'RFC 1918', publico: false, nota: 'não é roteado na internet' },
  { net: '198.18.0.0', len: 15, nome: 'Testes de desempenho', rfc: 'RFC 2544', publico: false, nota: 'reservado a testes de equipamentos' },
  { net: '198.51.100.0', len: 24, nome: 'Documentação (TEST-NET-2)', rfc: 'RFC 5737', publico: false, nota: 'reservado a exemplos, não deve aparecer na internet' },
  { net: '203.0.113.0', len: 24, nome: 'Documentação (TEST-NET-3)', rfc: 'RFC 5737', publico: false, nota: 'reservado a exemplos, não deve aparecer na internet' },
  { net: '224.0.0.0', len: 4, nome: 'Multicast', rfc: 'RFC 5771', publico: false, nota: 'endereços de grupo, fora do escopo deste simulador' },
  { net: '240.0.0.0', len: 4, nome: 'Reservado', rfc: 'RFC 1112, seção 4', publico: false, nota: 'reservado para uso futuro' },
  { net: '255.255.255.255', len: 32, nome: 'Broadcast limitado', rfc: 'RFC 919', publico: false, nota: 'vai a todos do enlace e nunca é encaminhado' },
];

const GLOBAL: Special = { net: '0.0.0.0', len: 0, nome: 'Unicast global', rfc: 'RFC 791', publico: true, nota: 'endereço roteável na internet' };

export function classify(ip: string): Special {
  let best: Special = GLOBAL;
  SPECIAL.forEach((s) => {
    if (inNet(ip, s.net, s.len) && s.len > best.len) best = s;
  });
  return best;
}

export interface HeaderOpts {
  len: number;
  id: number;
  ttl: number;
  proto: number;
  src: string;
  dst: string;
}

/** Cabeçalho IPv4 de 20 bytes (sem opções), com o checksum calculado sobre o cabeçalho (RFC 1071). */
export function ipv4Header(o: HeaderOpts): { bytes: number[]; sum: number } {
  const s = toInt(o.src);
  const d = toInt(o.dst);
  const h = [0x45, 0, o.len >> 8, o.len & 255, o.id >> 8, o.id & 255, 0, 0, o.ttl, o.proto, 0, 0, s >>> 24, (s >>> 16) & 255, (s >>> 8) & 255, s & 255, d >>> 24, (d >>> 16) & 255, (d >>> 8) & 255, d & 255];
  const sum = csum(h);
  h[10] = sum >> 8;
  h[11] = sum & 255;
  return { bytes: h, sum };
}
