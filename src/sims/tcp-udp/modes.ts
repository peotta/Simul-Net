// Montagem do trace nativo do simulador de TCP e UDP: lê os parâmetros, roda o motor (sim.ts) do modo escolhido
// e converte o traço em mensagens, eventos, log, estados e marcos do contrato do núcleo.
import { newTrace, type Column, type Field, type StateDef, type Trace } from '../../sim-core';
import { CLI, COL, MSS, SRV, simDns, simDownload, simTcp, simUdp, simVideo } from './sim';

export const C = { conn: COL.conn, data: COL.data, ack: COL.ack, bad: COL.bad };

export interface TcpUdpParams {
  N: number;
  rtt: number;
  bw: number;
  loss: number;
  seed: number;
  file: number;
  vbr: number;
  vdur: number;
  jit: number;
  jb: number;
  sack: boolean;
  reorder: number;
  iw: number;
  rwnd: number;
  ssth: number;
  drops: string;
  ackLoss: boolean;
}

const clamp = (v: unknown, a: number, b: number, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(b, Math.max(a, Math.round(n))) : d;
};

/** Parâmetros no formato que o motor espera (perdas em fração, descartes como lista). */
export function engineParams(p: TcpUdpParams): any {
  return {
    N: clamp(p.N, 1, 40, 20), rtt: Number(p.rtt) || 15, bw: Number(p.bw) || 1,
    loss: clamp(p.loss, 0, 30, 0) / 100, reorder: clamp(p.reorder, 0, 30, 0) / 100,
    seed: clamp(p.seed, 1, 9999, 7), ackLoss: !!p.ackLoss,
    drops: String(p.drops || '').split(/[,; ]+/).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 40),
    iw: Number(p.iw) || 1, rwnd: Number(p.rwnd) || 16, ssth: Number(p.ssth) || 64,
    sack: !!p.sack, file: Number(p.file) || 5, vbr: Number(p.vbr) || 2500, vdur: Number(p.vdur) || 5, jit: Number(p.jit) || 0, jb: Number(p.jb) || 100,
  };
}

// ---- Campos de um segmento (aba Mensagem) ----

const ipb = (ip: string): number[] => ip.split('.').map(Number);
function csum(b: number[]): number {
  let s = 0;
  for (let i = 0; i < b.length; i += 2) s += (b[i] << 8) + (i + 1 < b.length ? b[i + 1] : 0);
  while (s >>> 16) s = (s & 0xffff) + (s >>> 16);
  return ~s & 0xffff;
}
/** Tamanho do cabeçalho TCP: 20 fixos + opções do SYN (MSS e SACK_PERM) + opção SACK dos ACKs. */
const hdrLen = (s: any): number => 20 + (s.opts ? (s.opts.includes('SACK_PERM') ? 8 : 4) : 0) + (s.sack && s.sack.length ? 4 + 8 * s.sack.length : 0);

function checksumOf(s: any): number {
  const src = s.from === 's' ? SRV.ip : CLI.ip;
  const dst = s.to === 's' ? SRV.ip : CLI.ip;
  const L = s.len ? s.pktLen || s.len : 0;
  const pl: number[] = [];
  for (let i = 0; i < L; i++) pl.push(((s.seq || 0) + i) & 255);
  if (s.proto === 'UDP') {
    const len = 8 + L;
    const h = [s.sport >> 8, s.sport & 255, s.dport >> 8, s.dport & 255, len >> 8, len & 255, 0, 0];
    return csum(ipb(src).concat(ipb(dst), [0, 17, len >> 8, len & 255], h, pl));
  }
  const has = (f: string): number => (s.flags.includes(f) ? 1 : 0);
  const fl = has('FIN') | (has('SYN') << 1) | (has('RST') << 2) | (has('PSH') << 3) | (has('ACK') << 4);
  const isnL = s.from === 'c' ? CLI.isn : SRV.isn;
  const isnR = s.from === 'c' ? SRV.isn : CLI.isn;
  const seq = (isnL + s.seq) >>> 0;
  const ack = s.ack === null ? 0 : (isnR + s.ack) >>> 0;
  const hl = hdrLen(s);
  const len = hl + L;
  const h = [s.sport >> 8, s.sport & 255, s.dport >> 8, s.dport & 255, seq >>> 24, (seq >>> 16) & 255, (seq >>> 8) & 255, seq & 255, ack >>> 24, (ack >>> 16) & 255, (ack >>> 8) & 255, ack & 255, (hl / 4) << 4, fl, (s.win >> 8) & 255, s.win & 255, 0, 0, 0, 0];
  if (s.opts) {
    h.push(2, 4, MSS >> 8, MSS & 255);
    if (s.opts.includes('SACK_PERM')) h.push(4, 2, 1, 1);
  }
  if (s.sack && s.sack.length) {
    h.push(1, 1, 5, 2 + 8 * s.sack.length);
    s.sack.forEach((b: number[]) => b.forEach((v) => {
      const a = (isnR + v) >>> 0;
      h.push(a >>> 24, (a >>> 16) & 255, (a >>> 8) & 255, a & 255);
    }));
  }
  return csum(ipb(src).concat(ipb(dst), [0, 6, len >> 8, len & 255], h, pl));
}

const hex = (n: number): string => '0x' + n.toString(16).padStart(4, '0');

function fieldsOf(s: any): Field[] {
  const f: Field[] = [];
  f.push({ sec: 'IPv4' });
  f.push(['Origem', s.from === 's' ? SRV.ip : CLI.ip, s.from === 's' ? 'servidor' : 'cliente']);
  f.push(['Destino', s.to === 's' ? SRV.ip : CLI.ip, '']);
  f.push(['Protocolo', s.proto === 'TCP' ? '6 (TCP)' : '17 (UDP)', '']);
  if (s.proto === 'TCP') {
    const isnL = s.from === 'c' ? CLI.isn : SRV.isn;
    const isnR = s.from === 'c' ? SRV.isn : CLI.isn;
    f.push({ sec: 'TCP (RFC 9293)' });
    f.push(['Porta de origem', String(s.sport), s.sport === 80 ? 'servidor (HTTP)' : 'porta efêmera do cliente']);
    f.push(['Porta de destino', String(s.dport), '']);
    f.push(['Número de sequência', s.seq + ' (relativo)', 'valor real: ' + ((isnL + s.seq) >>> 0) + '. Posição do primeiro byte deste segmento no fluxo']);
    f.push(['Número de reconhecimento', s.ack === null ? '0 (flag ACK desligada)' : s.ack + ' (relativo)', s.ack === null ? '' : 'valor real: ' + ((isnR + s.ack) >>> 0) + '. Próximo byte esperado (ACK cumulativo)']);
    f.push(['Tamanho do cabeçalho', hdrLen(s) + ' bytes', hdrLen(s) > 20 ? '20 fixos + opções' : 'sem opções']);
    const meaning: Record<string, string> = { SYN: 'abre a conexão', FIN: 'encerra este sentido', ACK: 'campo de reconhecimento válido', PSH: 'entregar os dados à aplicação sem esperar' };
    f.push(['Flags', s.flags.join(', '), meaning[s.flags[0]] || '']);
    f.push(['Janela', s.win + ' bytes', 'espaço livre anunciado pelo emissor deste segmento (controle de fluxo)']);
    f.push(['Checksum', hex(checksumOf(s)), 'cobre pseudo-cabeçalho IP, cabeçalho e dados']);
    if (s.opts) f.push(['Opções', s.opts, 'negociadas apenas no SYN e no SYN-ACK' + (s.opts.includes('SACK_PERM') ? '. SACK_PERM: os dois lados aceitam a confirmação seletiva' : '')]);
    if (s.sack && s.sack.length) f.push(['Opção SACK (RFC 2018)', s.sack.map((b: number[]) => 'SLE=' + b[0] + ' SRE=' + b[1]).join('; '), 'blocos de bytes já recebidos além da lacuna (números relativos; SRE é exclusivo). O emissor repõe só o que falta']);
    f.push(['Dados', s.len + ' bytes', s.agg ? s.agg : s.len ? 'segmento ' + (s.idx + 1) + ' do arquivo (MSS = 1000)' : 'segmento só de controle']);
  } else {
    f.push({ sec: 'UDP (RFC 768)' });
    f.push(['Porta de origem', String(s.sport), s.sport === 5004 ? 'RTP (mídia)' : '']);
    const dp: Record<number, string> = { 53: 'DNS', 5004: 'RTP (mídia)' };
    f.push(['Porta de destino', String(s.dport), dp[s.dport] || '']);
    f.push(['Comprimento', 8 + (s.pktLen || s.len) + ' bytes', 'cabeçalho (8) + dados' + (s.agg ? ' de um pacote RTP' : '')]);
    if (s.agg) f.push(['Dados', s.len + ' bytes', s.agg]);
    f.push(['Checksum', hex(checksumOf(s)), 'opcional no IPv4, obrigatório no IPv6']);
    f.push(['Sequência, ACK e janela', 'não existem', 'o cabeçalho UDP tem só estes quatro campos']);
  }
  return f;
}

function aboutOf(s: any): string {
  if (s.agg) return s.agg;
  if (s.proto === 'UDP') return s.dport === 53 || s.sport === 53 ? 'Mensagem DNS em um único datagrama UDP. Se ela se perder, só a aplicação (o resolvedor) percebe.' : 'Datagrama UDP: sem conexão, sem confirmação e sem retransmissão (RFC 768).';
  if (s.kind === 'ctl') return 'Segmento de controle da conexão: abertura (SYN, SYN-ACK, ACK) ou encerramento (FIN e ACK) do TCP (RFC 9293, seção 3.5 e 3.6).';
  if (s.kind === 'ack') return 'ACK cumulativo: confirma tudo até o byte anterior ao número de reconhecimento. Um ACK repetido (duplicado) indica que falta um segmento.';
  return 'Segmento de dados do TCP, de até 1000 bytes (MSS). A cwnd e a rwnd limitam quantos ficam em voo.';
}

// ---- Conversão do traço do motor em Trace nativo ----

interface KeyMap {
  c: string;
  s: string;
}

function emit(tr: Trace, sim: any, km: KeyMap, prefix: string, main: boolean): void {
  sim.segs.forEach((s: any) => {
    const dur = s.tArr - s.tSend;
    tr.add(km[s.from as 'c' | 's'], km[s.to as 'c' | 's'], {
      at: s.tSend, dur, par: true, color: s.color, proto: s.proto, len: (s.proto === 'TCP' ? hdrLen(s) + 20 : 8 + 20) + (s.len || 0),
      label: s.label || undefined, info: s.info, about: aboutOf(s), fields: fieldsOf(s), tags: s.tags || [], lost: !!s.lost,
      phaseName: sim.proto, sport: s.sport, dport: s.dport, flags: s.flags, seq: s.seq, ack: s.ack, win: s.win, kind: s.kind, idx: s.idx,
    });
  });
  sim.events.forEach((e: any) => tr.ev(e.t, km[e.who as 'c' | 's'], e.text, ''));
  sim.log.forEach((l: any) => tr.lg(l.t, prefix + l.text, l.tag));
  sim.metro.forEach((m: any) => {
    if (main) {
      tr.mile(m.t, m.label, m.sub);
      tr.phases.push({ t: m.t, label: m.label, key: m.label });
    }
  });
}

const STATE_CLS = (v: string): string => (v === 'ESTABLISHED' ? 'est' : '');

function tcpStates(tr: Trace, sim: any, mode: string): void {
  sim.states.forEach((x: any) => tr.st(x.t, x.who, x.st, STATE_CLS(x.st)));
  sim.samples.forEach((s: any) => {
    tr.st(s.t, 'cwnd', s.cwnd + ' / ' + (s.ssthresh >= 1000 ? 'sem limite' : s.ssthresh), '');
    tr.st(s.t, 'voo', String(s.flight), '');
    tr.st(s.t, 'rto', s.rto + ' ms', '');
    if (s.got !== undefined) tr.st(s.t, 'got', Math.min(100, Math.round((s.got / sim.raw.N) * 100)) + '% (' + (Math.round((s.got * MSS) / 1e5) / 10).toString().replace('.', ',') + ' MB)', '');
  });
  void mode;
}

const TCP_STATES: StateDef[] = [
  { key: 'c', label: 'Cliente' },
  { key: 's', label: 'Servidor' },
  { key: 'cwnd', label: 'cwnd / ssthresh' },
  { key: 'voo', label: 'Segmentos em voo' },
  { key: 'rto', label: 'RTO' },
];
const DL_STATES: StateDef[] = [...TCP_STATES, { key: 'got', label: 'Arquivo recebido' }];
const UDP_STATES: StateDef[] = [{ key: 'c', label: 'Cliente' }, { key: 's', label: 'Servidor' }];
const VID_STATES: StateDef[] = [
  { key: 'sent', label: 'Quadros enviados' },
  { key: 'ok', label: 'Exibidos sem defeito' },
  { key: 'art', label: 'Com artefatos' },
  { key: 'fz', label: 'Congelados' },
];

const cols = (sim: any, pre: string, tag: string): Column[] => sim.cols.map((c: any) => ({ key: pre + c.key, label: c.label + tag, sub: c.sub }));

function videoStates(tr: Trace, sim: any): void {
  const N = sim.raw.N;
  const ev: { t: number; kind: string; f: any }[] = [];
  sim.frames.forEach((f: any) => {
    ev.push({ t: f.t, kind: 'send', f });
    ev.push({ t: f.play, kind: 'show', f });
  });
  ev.sort((a, b) => a.t - b.t);
  let sent = 0;
  let ok = 0;
  let art = 0;
  let fz = 0;
  tr.st(0, 'sent', '0 de ' + N, '');
  tr.st(0, 'ok', '0', '');
  tr.st(0, 'art', '0', '');
  tr.st(0, 'fz', '0', '');
  ev.forEach((e) => {
    if (e.kind === 'send') {
      sent++;
      tr.st(e.t, 'sent', sent + ' de ' + N, '');
    } else {
      if (e.f.status === 'ok') ok++;
      else if (e.f.status === 'artefatos') art++;
      else fz++;
      tr.st(e.t, 'ok', String(ok), '');
      tr.st(e.t, 'art', String(art), art ? 'bad' : '');
      tr.st(e.t, 'fz', String(fz), fz ? 'bad' : '');
    }
  });
}

export function buildTcpUdp(P: TcpUdpParams, sub: string): Trace {
  const E = engineParams(P);
  let sims: any[];
  if (sub === 'cmp') sims = [simTcp(E, 'TCP'), simUdp(E, 'UDP')];
  else if (sub === 'tcp') sims = [simTcp(E, undefined)];
  else if (sub === 'dl') sims = [simDownload(E, undefined)];
  else if (sub === 'vid') sims = [simVideo(E, undefined)];
  else if (sub === 'dns') sims = [simDns(E)];
  else sims = [simUdp(E, undefined)];

  const first = sims[0];
  const isTcp = sub === 'tcp' || sub === 'dl' || sub === 'cmp';
  const stateDefs = sub === 'vid' ? VID_STATES : sub === 'dl' ? DL_STATES : sub === 'cmp' ? [...TCP_STATES, { key: 'uc', label: 'Cliente (UDP)' }, { key: 'us', label: 'Servidor (UDP)' }] : isTcp ? TCP_STATES : UDP_STATES;
  const columns = sub === 'cmp' ? [...cols(sims[0], '', ' (TCP)'), ...cols(sims[1], 'u', ' (UDP)')] : cols(first, '', '');
  const tr = newTrace(columns, stateDefs, E.rtt);
  // Em raw ficam só os resumos que as abas e o Experimento usam; segmentos, eventos e log já estão no trace.
  const slim = sims.map((s) => ({ raw: s.raw, samples: s.samples, vsamples: s.vsamples, frames: s.frames, stats: s.stats, end: s.end, proto: s.proto }));
  const R: Record<string, any> = (tr.raw = { sub, P: E, sims: slim, kind: first.raw.kind, end: Math.max(...sims.map((s) => s.end)) });

  emit(tr, sims[0], { c: 'c', s: 's' }, sub === 'cmp' ? 'TCP: ' : '', true);
  if (sub === 'cmp') emit(tr, sims[1], { c: 'uc', s: 'us' }, 'UDP: ', false);

  if (isTcp) tcpStates(tr, sims[0], sub);
  else if (sub === 'vid') videoStates(tr, first);
  else first.states.forEach((x: any) => tr.st(x.t, x.who, x.st, ''));
  if (sub === 'cmp') sims[1].states.forEach((x: any) => tr.st(x.t, x.who === 'c' ? 'uc' : 'us', x.st, ''));

  tr.t = R.end;
  tr.lg(R.end, 'Fim da simulação.', 'sys');
  return tr;
}
