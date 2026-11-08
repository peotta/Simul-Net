// Modelo do IPv6: aritmética de endereços de 128 bits (BigInt), texto compactado (RFC 5952), identificador de interface
// EUI-64 modificado (RFC 4291, apêndice A), endereço de nó solicitado, classificação dos tipos de endereço, busca na tabela
// de rotas (prefixo mais específico) e montagem do cabeçalho fixo de 40 bytes (RFC 8200, seção 3).

/** Converte o texto de um endereço (com ou sem "::") em número de 128 bits. */
export function parse6(s: string): bigint {
  const t = s.toLowerCase();
  const [head, tail] = t.includes('::') ? t.split('::') : [t, null];
  const h = head ? head.split(':') : [];
  const l = tail ? tail.split(':') : [];
  const g = tail === null ? h : [...h, ...Array(8 - h.length - l.length).fill('0'), ...l];
  return g.reduce((a, x) => (a << 16n) | BigInt(parseInt(x || '0', 16)), 0n);
}

/** Os oito grupos de 16 bits, como números. */
export const groups6 = (n: bigint): number[] => Array.from({ length: 8 }, (_, i) => Number((n >> BigInt((7 - i) * 16)) & 0xffffn));

/** Forma completa: oito grupos de quatro dígitos hexadecimais. */
export const full6 = (n: bigint): string => groups6(n).map((x) => x.toString(16).padStart(4, '0')).join(':');

/** Forma compactada da RFC 5952: minúsculas, sem zeros à esquerda, "::" na maior sequência de grupos zero (mínimo dois). */
export function fmt6(n: bigint): string {
  const g = groups6(n);
  let bs = -1;
  let bl = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bl) {
      bs = i;
      bl = j - i;
    }
    i = j;
  }
  const hx = (x: number): string => x.toString(16);
  if (bl < 2) return g.map(hx).join(':');
  return g.slice(0, bs).map(hx).join(':') + '::' + g.slice(bs + bl).map(hx).join(':');
}

/** Normaliza o texto de um endereço para a forma compactada. */
export const norm6 = (s: string): string => fmt6(parse6(s));

export const maskOf6 = (len: number): bigint => (len <= 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - len)) - 1n));
export const netOf6 = (ip: string, len: number): string => fmt6(parse6(ip) & maskOf6(len));
export const inNet6 = (ip: string, net: string, len: number): boolean => (parse6(ip) & maskOf6(len)) === (parse6(net) & maskOf6(len));

/** Os 128 bits do endereço, em oito grupos de 16. Os `len` primeiros bits vêm em negrito se `mark` for verdadeiro. */
export const bin6 = (ip: string): string => groups6(parse6(ip)).map((x) => x.toString(2).padStart(16, '0')).join(' ');

/** Quantos bits iniciais dois endereços têm em comum. */
export function commonBits6(a: string, b: string): number {
  const x = parse6(a) ^ parse6(b);
  if (x === 0n) return 128;
  return 128 - x.toString(2).length;
}

/** Identificador de interface EUI-64 modificado a partir de um MAC de 48 bits (RFC 4291, apêndice A): insere ff:fe e inverte o bit U/L. */
export function eui64(mac: string): bigint {
  const b = mac.split(':').map((x) => parseInt(x, 16));
  const e = [b[0] ^ 0x02, b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]];
  return e.reduce((a, x) => (a << 8n) | BigInt(x), 0n);
}

/** Identificador de 64 bits, em texto (quatro grupos). */
export const iidText = (iid: bigint): string => fmt6(iid & ((1n << 64n) - 1n)).replace(/^::/, '');

export const linkLocalOf = (iid: bigint): string => fmt6((0xfe80n << 112n) | (iid & ((1n << 64n) - 1n)));
export const withPrefix = (prefix: string, iid: bigint): string => fmt6((parse6(prefix) & maskOf6(64)) | (iid & ((1n << 64n) - 1n)));

/** Endereço de nó solicitado ff02::1:ffXX:XXXX, com os 24 bits finais do endereço (RFC 4291, seção 2.7.1). */
export const solicited6 = (ip: string): string => fmt6((0xff02n << 112n) | (1n << 32n) | (0xffn << 24n) | (parse6(ip) & 0xffffffn));

/** MAC multicast que corresponde a um endereço multicast IPv6: 33:33 e os 32 bits finais (RFC 2464, seção 7). */
export function mcastMac6(ip: string): string {
  const low = parse6(ip) & 0xffffffffn;
  const b = [0x33, 0x33, Number((low >> 24n) & 255n), Number((low >> 16n) & 255n), Number((low >> 8n) & 255n), Number(low & 255n)];
  return b.map((x) => x.toString(16).padStart(2, '0')).join(':');
}

export interface Tipo6 {
  net: string;
  len: number;
  nome: string;
  rfc: string;
  ambito: string;
  /** Pode circular na internet pública? */
  publico: boolean;
  nota: string;
}

/** Tipos de endereço (RFC 4291, seção 2.4, e as RFCs de cada bloco); vence o prefixo mais longo que contém o endereço. */
export const TIPOS6: Tipo6[] = [
  { net: '::', len: 128, nome: 'Não especificado', rfc: 'RFC 4291, seção 2.5.2', ambito: 'nenhum', publico: false, nota: 'só serve de origem de um host que ainda não tem endereço, como na detecção de duplicidade; nunca é destino' },
  { net: '::1', len: 128, nome: 'Loopback', rfc: 'RFC 4291, seção 2.5.3', ambito: 'o próprio nó', publico: false, nota: 'nunca sai do host' },
  { net: 'fe80::', len: 10, nome: 'Link-local', rfc: 'RFC 4291, seção 2.5.6', ambito: 'o enlace', publico: false, nota: 'só vale no enlace; um roteador não encaminha pacotes com origem ou destino link-local' },
  { net: 'fc00::', len: 7, nome: 'Local único (ULA)', rfc: 'RFC 4193', ambito: 'a organização', publico: false, nota: 'uso privado, equivalente ao RFC 1918 do IPv4; não é roteado na internet' },
  { net: 'ff00::', len: 8, nome: 'Multicast', rfc: 'RFC 4291, seção 2.7', ambito: 'conforme o campo de escopo', publico: false, nota: 'endereço de grupo; o IPv6 não tem broadcast' },
  { net: '2001:db8::', len: 32, nome: 'Documentação', rfc: 'RFC 3849', ambito: 'nenhum', publico: false, nota: 'reservado a exemplos, não deve aparecer na internet' },
];

const GLOBAL6: Tipo6 = { net: '2000::', len: 3, nome: 'Unicast global', rfc: 'RFC 4291, seção 2.4', ambito: 'a internet', publico: true, nota: 'endereço roteável na internet (hoje alocado pelo IANA dentro de 2000::/3)' };

export function classify6(ip: string): Tipo6 {
  let best: Tipo6 = GLOBAL6;
  let bl = -1;
  TIPOS6.forEach((s) => {
    if (inNet6(ip, s.net, s.len) && s.len > bl) {
      best = s;
      bl = s.len;
    }
  });
  return best;
}

/** Escopo de um endereço multicast (RFC 4291, seção 2.7): o último dígito hexadecimal do segundo grupo. */
export function scope6(ip: string): string {
  const s = groups6(parse6(ip))[0] & 0xf;
  return ({ 1: 'interface', 2: 'enlace', 4: 'administrativo', 5: 'local', 8: 'organização', 14: 'global' } as Record<number, string>)[s] || 'reservado';
}

export type RouteKind6 = 'conn' | 'via';
export interface Route6 {
  net: string;
  len: number;
  kind: RouteKind6;
  /** Próximo salto (rotas via). */
  via?: string;
  iface: string;
  /** Origem da rota: C conectada, S estática. */
  proto: 'C' | 'S';
  metric: number;
}

export interface Lookup6 {
  /** Índices das rotas que contêm o destino. */
  matches: number[];
  /** Índice da rota escolhida, ou -1 quando nada casa. */
  winner: number;
}

/** Busca o destino na tabela: vence o maior prefixo; em empate, a menor métrica. */
export function lookup6(table: Route6[], dst: string): Lookup6 {
  const matches: number[] = [];
  table.forEach((r, i) => {
    if (inNet6(dst, r.net, r.len)) matches.push(i);
  });
  let winner = -1;
  matches.forEach((i) => {
    const r = table[i];
    const w = winner >= 0 ? table[winner] : null;
    if (!w || r.len > w.len || (r.len === w.len && r.metric < w.metric)) winner = i;
  });
  return { matches, winner };
}

export const routeText6 = (r: Route6): string => r.proto + ' ' + r.net + '/' + r.len + (r.kind === 'conn' ? ' conectada, ' + r.iface : ' via ' + r.via + ', ' + r.iface);

export interface Header6Opts {
  /** Comprimento da carga útil (tudo depois do cabeçalho de 40 bytes), em bytes. */
  plen: number;
  /** Próximo cabeçalho: 58 para ICMPv6. */
  nh: number;
  hl: number;
  src: string;
  dst: string;
  tc?: number;
  flow?: number;
}

/** Cabeçalho IPv6 fixo de 40 bytes (RFC 8200, seção 3). Não há checksum de cabeçalho: ele é do protocolo de cima. */
export function ipv6Header(o: Header6Opts): number[] {
  const tc = o.tc ?? 0;
  const fl = o.flow ?? 0;
  const w0 = (6 << 28) | (tc << 20) | (fl & 0xfffff);
  const h = [(w0 >>> 24) & 255, (w0 >>> 16) & 255, (w0 >>> 8) & 255, w0 & 255, o.plen >> 8, o.plen & 255, o.nh, o.hl];
  [parse6(o.src), parse6(o.dst)].forEach((a) => {
    for (let i = 15; i >= 0; i--) h.push(Number((a >> BigInt(i * 8)) & 255n));
  });
  return h;
}
