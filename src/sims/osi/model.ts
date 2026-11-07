// Modelo do simulador OSI: construção de quadros com bytes reais (Ethernet II com 802.1Q opcional, IPv4,
// TCP ou ICMP, HTTP/1.1) e os cálculos que cada camada faz: checksum do IPv4 (RFC 791), checksum do TCP
// com pseudo-cabeçalho (RFC 9293, seção 3.1), checksum do ICMP (RFC 792) e FCS CRC-32 (IEEE 802.3).
// Os endereços são de documentação (RFC 5737 para IPv4, RFC 7042 para MAC). Não há tráfego real.
import type { Field } from '../../sim-core';

export type SegKey = 'eth' | 'vlan' | 'ip' | 'tcp' | 'icmp' | 'app' | 'pad' | 'fcs';

/** Camada do modelo OSI a que cada parte do quadro pertence (5 e 6 vão dentro da aplicação, sem cabeçalho próprio). */
export const SEG_LAYER: Record<SegKey, 2 | 3 | 4 | 7> = { eth: 2, vlan: 2, ip: 3, tcp: 4, icmp: 3, app: 7, pad: 2, fcs: 2 };

export const NODE = {
  cli: { ip: '192.0.2.10', mac: '00:00:5e:00:53:0a', name: 'Cliente' },
  rtl: { ip: '192.0.2.1', mac: '00:00:5e:00:53:01', name: 'Roteador (interface da LAN)' },
  rtw: { ip: '198.51.100.1', mac: '00:00:5e:00:53:11', name: 'Roteador (interface da WAN)' },
  srv: { ip: '198.51.100.80', mac: '00:00:5e:00:53:50', name: 'Servidor' },
} as const;

export const VLAN_ID = 10;
export const CLI_PORT = 49152;
export const SRV_PORT = 80;
export const CLI_SEQ = 1001;
export const SRV_SEQ = 5001;
/** Tamanho mínimo do quadro Ethernet sem o FCS (IEEE 802.3: 64 bytes com o FCS). */
const MIN_NO_FCS = 60;

const hex = (n: number, w: number): string => '0x' + (n >>> 0).toString(16).padStart(w, '0');
const be16 = (n: number): number[] => [(n >> 8) & 255, n & 255];
const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const mac2b = (m: string): number[] => m.split(':').map((x) => parseInt(x, 16));
const ip2b = (a: string): number[] => a.split('.').map(Number);
export const ascii = (s: string): number[] => Array.from(s).map((c) => c.charCodeAt(0) & 255);

/** Soma de complemento de um sobre palavras de 16 bits (RFC 1071). */
export function csum(b: number[]): number {
  let s = 0;
  for (let i = 0; i < b.length; i += 2) s += (b[i] << 8) + (i + 1 < b.length ? b[i + 1] : 0);
  while (s >>> 16) s = (s & 0xffff) + (s >>> 16);
  return ~s & 0xffff;
}

const CRC_T: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

/** CRC-32 do IEEE 802.3, a mesma função do FCS da Ethernet. */
export function crc32(b: number[]): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC_T[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface HttpView {
  /** Linha inicial (requisição) ou de status (resposta). */
  start: string;
  heads: [string, string][];
  body: string;
}

export interface Spec {
  dmac: string;
  smac: string;
  /** VLAN 802.1Q; null quando o quadro vai sem etiqueta. */
  vid: number | null;
  sip: string;
  dip: string;
  ttl: number;
  id: number;
  l4: 'tcp' | 'icmp';
  sport?: number;
  dport?: number;
  flags?: string[];
  seq?: number;
  ack?: number;
  win?: number;
  /** Mensagem HTTP (camada 7) carregada pelo segmento. */
  http?: HttpView;
  /** ICMP: tipo, código e o trecho do datagrama original citado na mensagem. */
  icmp?: { type: number; code: number; quote: number[] };
}

export interface Seg {
  key: SegKey;
  layer: 2 | 3 | 4 | 7;
  label: string;
  off: number;
  len: number;
}

export interface Frame {
  spec: Spec;
  /** Bytes do quadro, do MAC de destino ao FCS. */
  bytes: number[];
  segs: Seg[];
  fields: Field[];
  ipSum: number;
  l4Sum: number;
  fcs: number;
  /** FCS recalculado sobre os bytes recebidos (difere de fcs quando o quadro foi corrompido). */
  fcsCalc: number;
  fcsOk: boolean;
  /** Nome curto da PDU de cada camada, com o tamanho em bytes. */
  sizes: { app: number; l4: number; l3: number; l2: number };
}

export const FLAG_BITS: Record<string, number> = { FIN: 1, SYN: 2, RST: 4, PSH: 8, ACK: 16 };
const flagByte = (f: string[]): number => f.reduce((a, x) => a | FLAG_BITS[x], 0);

export function httpBytes(h: HttpView): number[] {
  return ascii(h.start + '\r\n' + h.heads.map(([k, v]) => k + ': ' + v + '\r\n').join('') + '\r\n' + h.body);
}

/** Requisição e respostas HTTP/1.1 usadas nos cenários (RFC 9112, seção 3 e seção 4). */
export function httpRequest(path: string): HttpView {
  return { start: 'GET ' + path + ' HTTP/1.1', heads: [['Host', 'www.example.org'], ['Accept', 'text/html'], ['Connection', 'close']], body: '' };
}
export function httpResponse(code: 200 | 404): HttpView {
  const body = code === 200 ? 'Ola, OSI!\n' : 'Nao encontrado\n';
  return { start: code === 200 ? 'HTTP/1.1 200 OK' : 'HTTP/1.1 404 Not Found', heads: [['Content-Type', 'text/plain'], ['Content-Length', String(body.length)], ['Connection', 'close']], body };
}

/** Monta o quadro completo e a lista de campos por camada. Com prev, marca os campos que mudaram em relação ao salto anterior. */
export function buildFrame(s: Spec, prev?: Frame | null, corrupt = false): Frame {
  const segs: Seg[] = [];
  const bytes: number[] = [];
  const push = (key: SegKey, label: string, b: number[]): void => {
    segs.push({ key, layer: SEG_LAYER[key], label, off: bytes.length, len: b.length });
    bytes.push(...b);
  };
  const tagged = s.vid !== null;
  // L2: cabeçalho (MAC de destino e de origem, etiqueta 802.1Q opcional, tipo)
  push('eth', 'Ethernet: MAC de destino e de origem', [...mac2b(s.dmac), ...mac2b(s.smac)]);
  if (tagged) push('vlan', '802.1Q: TPID 0x8100 e TCI (prioridade e VLAN)', [...be16(0x8100), ...be16(s.vid as number)]);
  push('eth', 'Ethernet: tipo (EtherType)', be16(0x0800));
  // L7 e L4
  const app = s.http ? httpBytes(s.http) : [];
  let l4: number[];
  let l4Sum = 0;
  if (s.l4 === 'tcp') {
    const hdr = [...be16(s.sport as number), ...be16(s.dport as number), ...be32(s.seq as number), ...be32(s.ack as number), 0x50, flagByte(s.flags as string[]), ...be16(s.win as number), 0, 0, 0, 0];
    const len = hdr.length + app.length;
    l4Sum = csum([...ip2b(s.sip), ...ip2b(s.dip), 0, 6, ...be16(len), ...hdr, ...app]);
    hdr[16] = l4Sum >> 8;
    hdr[17] = l4Sum & 255;
    l4 = hdr.concat(app);
  } else {
    const ic = s.icmp as NonNullable<Spec['icmp']>;
    const m = [ic.type, ic.code, 0, 0, 0, 0, 0, 0, ...ic.quote];
    l4Sum = csum(m);
    m[2] = l4Sum >> 8;
    m[3] = l4Sum & 255;
    l4 = m;
  }
  // L3: cabeçalho IPv4 de 20 bytes, sem opções, com DF
  const total = 20 + l4.length;
  const ip = [0x45, 0, ...be16(total), ...be16(s.id), 0x40, 0, s.ttl, s.l4 === 'tcp' ? 6 : 1, 0, 0, ...ip2b(s.sip), ...ip2b(s.dip)];
  const ipSum = csum(ip);
  ip[10] = ipSum >> 8;
  ip[11] = ipSum & 255;
  push('ip', 'IPv4: cabeçalho de 20 bytes', ip);
  if (s.l4 === 'tcp') {
    push('tcp', 'TCP: cabeçalho de 20 bytes', l4.slice(0, 20));
    if (app.length) push('app', 'HTTP: mensagem da aplicação', app);
  } else push('icmp', 'ICMP: mensagem de erro', l4);
  // L2: preenchimento até 60 bytes e FCS
  const pad = Math.max(0, MIN_NO_FCS - bytes.length);
  if (pad) push('pad', 'Preenchimento até o mínimo de 64 bytes com o FCS', new Array(pad).fill(0));
  const fcs = crc32(bytes);
  push('fcs', 'FCS: CRC-32 sobre todo o quadro', [fcs & 255, (fcs >>> 8) & 255, (fcs >>> 16) & 255, (fcs >>> 24) & 255]);
  let fcsCalc = fcs;
  if (corrupt) {
    // um bit invertido no meio do conteúdo: o FCS enviado não muda, e o recalculado no destino não confere
    const at = segs.find((x) => x.key === 'app' || x.key === 'icmp') as Seg;
    bytes[at.off + Math.min(5, at.len - 1)] ^= 0x04;
    fcsCalc = crc32(bytes.slice(0, bytes.length - 4));
  }
  const f: Frame = {
    spec: s,
    bytes,
    segs,
    fields: [],
    ipSum,
    l4Sum,
    fcs,
    fcsCalc,
    fcsOk: fcsCalc === fcs,
    sizes: { app: app.length, l4: l4.length, l3: total, l2: bytes.length },
  };
  f.fields = fieldsOf(f, prev || null);
  return f;
}

const flagText = (f: string[]): string => f.join(', ');

function fieldsOf(f: Frame, prev: Frame | null): Field[] {
  const s = f.spec;
  const out: Field[] = [];
  const bc = (v: string): string => (v === 'ff:ff:ff:ff:ff:ff' ? 'broadcast' : '');
  out.push({ sec: 'Camada 1 (física): preâmbulo e SFD, fora do quadro' });
  out.push(['Preâmbulo', '7 x 10101010', 'sincroniza o relógio do receptor com o do transmissor']);
  out.push(['SFD', '10101011', 'marca o fim do preâmbulo: o próximo byte é o MAC de destino']);
  out.push({ sec: 'Camada 2 (enlace): Ethernet II (IEEE 802.3)' });
  out.push(['MAC de destino', s.dmac, 'próximo salto: muda em cada salto de camada 3' + bc(s.dmac)]);
  out.push(['MAC de origem', s.smac, 'quem enviou neste enlace, não o host original']);
  if (s.vid !== null) {
    out.push(['802.1Q TPID', '0x8100', 'indica que o quadro leva uma etiqueta de VLAN']);
    out.push(['802.1Q PCP, DEI, VID', '0, 0, ' + s.vid, 'VLAN ' + s.vid + ' no enlace tronco']);
  }
  out.push(['Tipo', '0x0800 (IPv4)', 'diz à camada 2 quem recebe o conteúdo: o IPv4']);
  out.push({ sec: 'Camada 3 (rede): IPv4 (RFC 791)' });
  out.push(['Versão e IHL', '4 e 5 (20 bytes)', 'IPv4, cabeçalho sem opções']);
  out.push(['Comprimento total', String(f.sizes.l3), 'cabeçalho IP mais a carga de camada 4']);
  out.push(['Identificação', hex(s.id, 4), 'distingue datagramas do mesmo emissor']);
  out.push(['Flags', 'DF', 'não fragmentar (descoberta do MTU do caminho)']);
  out.push(['TTL', String(s.ttl), 'cada roteador subtrai um (RFC 1812, seção 5.3.1)']);
  out.push(['Protocolo', s.l4 === 'tcp' ? '6 (TCP)' : '1 (ICMP)', 'qual protocolo de camada 4 vem a seguir']);
  out.push(['Checksum do cabeçalho', hex(f.ipSum, 4), 'cobre só o cabeçalho IP, recalculado quando o TTL muda']);
  out.push(['IP de origem', s.sip, 'fim a fim: não muda ao atravessar o roteador']);
  out.push(['IP de destino', s.dip, 'fim a fim: não muda ao atravessar o roteador']);
  if (s.l4 === 'tcp') {
    out.push({ sec: 'Camada 4 (transporte): TCP (RFC 9293)' });
    out.push(['Porta de origem', String(s.sport), 'identifica o processo de origem (porta efêmera)']);
    out.push(['Porta de destino', String(s.dport), s.dport === 80 ? 'serviço HTTP' : s.dport === CLI_PORT ? 'porta efêmera do cliente' : 'porta sem serviço escutando']);
    out.push(['Número de sequência', String(s.seq), 'posição do primeiro byte de dados deste segmento']);
    out.push(['Número de confirmação', String(s.ack), s.flags && s.flags.includes('ACK') ? 'próximo byte esperado do outro lado' : 'sem ACK: campo ignorado']);
    out.push(['Deslocamento de dados', '5 (20 bytes)', 'cabeçalho sem opções']);
    out.push(['Flags', flagText(s.flags as string[]), 'controle da conexão']);
    out.push(['Janela', String(s.win), 'bytes que o emissor aceita receber']);
    out.push(['Checksum', hex(f.l4Sum, 4), 'cobre pseudo-cabeçalho IP, cabeçalho TCP e dados']);
    if (s.http) {
      out.push({ sec: 'Camadas 5 a 7 (sessão, apresentação e aplicação): HTTP/1.1 (RFC 9112)' });
      out.push([s.http.start.startsWith('GET') ? 'Linha de requisição' : 'Linha de status', s.http.start, 'método, alvo e versão, ou versão, código e frase']);
      s.http.heads.forEach(([k, v]) => out.push([k, v, 'campo de cabeçalho HTTP']));
      if (s.http.body) out.push(['Corpo', s.http.body.trim(), f.sizes.app + ' bytes de mensagem em ASCII, sem TLS']);
    }
  } else {
    const ic = s.icmp as NonNullable<Spec['icmp']>;
    out.push({ sec: 'Camada 3 (rede): ICMP (RFC 792)' });
    out.push(['Tipo e código', ic.type + ' e ' + ic.code + ' (Time Exceeded, em trânsito)', 'o roteador descartou o pacote porque o TTL chegou a zero']);
    out.push(['Checksum', hex(f.l4Sum, 4), 'cobre a mensagem ICMP inteira']);
    out.push(['Conteúdo citado', 'cabeçalho IP original e 8 bytes do segmento', 'permite ao host identificar qual conexão gerou o erro']);
  }
  const padSeg = f.segs.find((x) => x.key === 'pad');
  out.push({ sec: 'Camada 2 (enlace): fim do quadro' });
  if (padSeg) out.push(['Preenchimento', padSeg.len + ' bytes zero', 'completa o mínimo de 60 bytes antes do FCS']);
  out.push(['FCS', hex(f.fcs, 8), 'CRC-32 de todo o quadro, recalculado em cada salto' + (f.fcsOk ? '' : '. Recalculado no destino: ' + hex(f.fcsCalc, 8) + ' (não confere)'), f.fcsOk ? undefined : 'chk-bad']);
  if (!prev) return out;
  // marca os campos que mudaram em relação ao salto anterior (mesma seção e mesmo nome)
  const key = (sec: string, name: string): string => sec + '|' + name;
  const was = new Map<string, string>();
  let sec = '';
  prev.fields.forEach((x) => {
    if (!Array.isArray(x)) sec = x.sec;
    else was.set(key(sec, x[0]), x[1]);
  });
  sec = '';
  return out.map((x) => {
    if (!Array.isArray(x)) {
      sec = x.sec;
      return x;
    }
    const w = was.get(key(sec, x[0]));
    if (w !== undefined && w !== x[1] && !x[3]) return [x[0], x[1], (x[2] ? x[2] + '. ' : '') + 'Mudou neste salto (antes: ' + w + ')', 'chg'] as Field;
    return x;
  });
}

/** Trecho citado numa mensagem ICMP de erro: o cabeçalho IP original e os 8 primeiros bytes do segmento (RFC 792). */
export function quoteOf(f: Frame): number[] {
  const ip = f.segs.find((x) => x.key === 'ip') as Seg;
  return f.bytes.slice(ip.off, ip.off + 20 + 8);
}
