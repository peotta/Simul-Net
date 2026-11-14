// Motor do simulador de controle de congestionamento (Reno/NewReno, CUBIC e BBR). Função pura: dados os parâmetros,
// devolve o Trace. O modelo é por rodadas (uma por RTT): um emissor de transferência longa, um gargalo com fila
// finita (descarte no fim da fila) e perda aleatória opcional. Unidade: segmentos de 1500 bytes. Tempos em ms.
// Referências: RFC 5681 e 6582 (Reno e NewReno), RFC 9438 (CUBIC), RFC 6928 (janela inicial) e o
// Internet-Draft draft-ietf-ccwg-bbr (BBR; ainda não é RFC).
import { COLORS as C, newTrace, type Column, type Field, type StateDef, type Trace } from '../../sim-core';

export type Algo = 'reno' | 'cubic' | 'bbr';

export interface CongParams {
  bw: number;
  rtt: number;
  buf: number;
  loss: number;
  dur: number;
  shift: string;
  iw: number;
  sack: boolean;
  fastConv: boolean;
  seed: number;
}

export const ALGO_NAME: Record<Algo, string> = { reno: 'Reno/NewReno', cubic: 'CUBIC', bbr: 'BBR' };
export const PKT = 1500;
/** Constantes do CUBIC (RFC 9438, seções 4.2, 4.3 e 4.6). */
export const CUBIC_C = 0.4;
export const CUBIC_BETA = 0.7;
export const CUBIC_ALPHA = (3 * (1 - CUBIC_BETA)) / (1 + CUBIC_BETA);
/** Constantes do BBR (draft-ietf-ccwg-bbr). */
export const BBR = { startupGain: 2.77, cwndGain: 2, drainGain: 0.5, downGain: 0.9, upGain: 1.25, upCwndGain: 2.25, lossThresh: 0.02, beta: 0.7, headroom: 0.15, minPipe: 4, probeRttGain: 0.5, probeRttMs: 200, minRttLenMs: 10000 };

export const segPerMs = (mbps: number): number => (mbps * 1e6) / 8 / PKT / 1000;
export const toMbps = (segPerMsV: number): number => (segPerMsV * PKT * 8) / 1000;

export interface Round {
  k: number;
  t: number;
  /** Duração da rodada (ms), incluindo a espera do RTO. */
  dur: number;
  /** Janela (cwnd, ou limite de dados em voo no BBR) no início da rodada, em segmentos. */
  cwnd: number;
  /** Segmentos enviados na rodada. */
  w: number;
  /** Fila no gargalo ao fim da rodada, em segmentos. */
  q: number;
  /** RTT medido (ms). */
  rtt: number;
  lost: number;
  /** Vazão entregue (Mbit/s) e capacidade do enlace (Mbit/s). */
  rate: number;
  cap: number;
  /** Produto banda x atraso do caminho (segmentos). */
  bdp: number;
  ssth: number | null;
  phase: string;
  ev: string;
  evKind: '' | 'loss' | 'rto' | 'phase';
  /** Só BBR: estimativas e ganho. */
  bw?: number;
  minRtt?: number;
  gain?: number;
  /** Segmentos entregues na rodada. */
  got: number;
}

export interface Stats {
  goodput: number;
  util: number;
  avgRtt: number;
  maxRtt: number;
  avgQ: number;
  lossEvents: number;
  rtos: number;
  lostSegs: number;
  sentSegs: number;
  t90: number | null;
}

export interface Flow {
  algo: Algo;
  rounds: Round[];
  stats: Stats;
}

/** Cubo e raiz cúbica só com operações básicas (IEEE 754): o resultado não depende da plataforma nem da versão do Node, como Math.pow e Math.cbrt podem. */
const cube = (x: number): number => x * x * x;
function cbrt(x: number): number {
  if (x <= 0) return 0;
  let r = x >= 1 ? x : 1;
  for (let i = 0; i < 60; i++) r = (2 * r + x / (r * r)) / 3;
  return r;
}

/** Número pseudoaleatório determinístico em [0, 1) a partir da semente e de dois índices. */
function rnd(seed: number, a: number, b: number): number {
  let t = ((seed * 1000003) ^ (a * 7919) ^ (b * 104729)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Perdas aleatórias em uma rodada: a parte inteira do esperado mais um sorteio para a fração. */
function randLoss(p: number, w: number, seed: number, k: number, salt: number): number {
  const e = (w * p) / 100;
  return Math.min(w, Math.floor(e) + (rnd(seed, k, salt) < e - Math.floor(e) ? 1 : 0));
}

const MAX_ROUNDS = 3000;

export function capacityAt(P: CongParams, t: number): number {
  const base = segPerMs(P.bw);
  if (t < (P.dur * 1000) / 2) return base;
  return P.shift === 'up' ? base * 2 : P.shift === 'down' ? base / 2 : base;
}

export const bufferSegs = (P: CongParams): number => Math.max(4, Math.round(P.buf * segPerMs(P.bw) * P.rtt));

function summarize(P: CongParams, rounds: Round[]): Stats {
  const end = rounds.length ? rounds[rounds.length - 1].t + rounds[rounds.length - 1].dur : 1;
  let got = 0;
  let sent = 0;
  let lost = 0;
  let lossEvents = 0;
  let rtos = 0;
  let sumRtt = 0;
  let sumQ = 0;
  let maxRtt = 0;
  let capInt = 0;
  let t90: number | null = null;
  rounds.forEach((r) => {
    got += r.got;
    sent += r.w;
    lost += r.lost;
    if (r.evKind === 'loss' || r.evKind === 'rto') lossEvents++;
    if (r.evKind === 'rto') rtos++;
    sumRtt += r.rtt * r.dur;
    sumQ += r.q * r.dur;
    maxRtt = Math.max(maxRtt, r.rtt);
    capInt += toMbps(capacityAt(P, r.t)) * r.dur;
  });
  // Tempo até 90% da capacidade: primeira rodada cuja vazão média nas 5 rodadas seguintes chega a 90% (ignora picos).
  for (let i = 0; i + 5 <= rounds.length && t90 === null; i++) {
    const win = rounds.slice(i, i + 5);
    if (win.reduce((a, r) => a + r.rate, 0) / 5 >= 0.9 * win[0].cap) t90 = rounds[i].t;
  }
  const goodput = toMbps(got / end);
  return { goodput, util: capInt ? (goodput * end) / capInt : 0, avgRtt: sumRtt / end, maxRtt, avgQ: sumQ / end, lossEvents, rtos, lostSegs: lost, sentSegs: sent, t90 };
}

// ---------- Reno/NewReno e CUBIC: controle por janela ----------

function simWindow(algo: 'reno' | 'cubic', P: CongParams): Flow {
  const rtt0 = P.rtt;
  const durMs = P.dur * 1000;
  const B = bufferSegs(P);
  const beta = algo === 'reno' ? 0.5 : CUBIC_BETA;
  const rounds: Round[] = [];
  let cwnd = P.iw;
  let ssth = Infinity;
  let t = 0;
  let k = 0;
  let recLeft = 0;
  // CUBIC
  let wmax = 0;
  let epoch: number | null = null;
  let K = 0;
  let west = 0;
  let cwndPrior = 0;
  let afterRto = false;
  while (t < durMs && k < MAX_ROUNDS) {
    const Cap = capacityAt(P, t);
    const bdp = Cap * rtt0;
    const w = Math.max(1, Math.floor(cwnd));
    const qraw = Math.max(0, w - bdp);
    const drops = Math.max(0, Math.round(w - bdp - B));
    const q = Math.min(qraw, B);
    const rl = randLoss(P.loss, w, P.seed, k, 1);
    const lost = Math.min(w, drops + rl);
    const rtt = rtt0 + q / Cap;
    const got = w - lost;
    const cwndStart = cwnd;
    let dur = rtt;
    let phase = recLeft > 0 ? 'Recuperação rápida' : cwnd < ssth ? 'Slow start' : algo === 'reno' ? 'Congestion avoidance' : 'CUBIC: congestion avoidance';
    let ev = '';
    let evKind: Round['evKind'] = '';
    if (lost > 0 && recLeft === 0) {
      const lossWhy = drops > 0 ? 'a fila do gargalo estourou (' + drops + ' descartados)' : 'perda aleatória';
      const noSackBurst = !P.sack && lost >= 4;
      const rto = w < 4 || w - lost < 3 || noSackBurst;
      if (algo === 'cubic') {
        cwndPrior = cwnd;
        wmax = P.fastConv && cwnd < wmax ? (cwnd * (1 + CUBIC_BETA)) / 2 : cwnd;
        epoch = null;
      }
      ssth = algo === 'reno' ? Math.max(Math.floor(w * beta), 2) : Math.max(w * beta, 2);
      if (rto) {
        cwnd = 1;
        afterRto = algo === 'cubic';
        dur += Math.max(200, 2 * rtt);
        evKind = 'rto';
        phase = 'Timeout (RTO)';
        ev = 'Timeout (' + lost + ' de ' + w + ' perdidos; ' + lossWhy + '): ssthresh = ' + fmt(ssth) + ', cwnd = 1';
        recLeft = 0;
      } else {
        cwnd = ssth;
        recLeft = 1 + (P.sack ? 0 : lost - 1);
        evKind = 'loss';
        phase = 'Fast retransmit';
        ev = 'Perda (' + lost + ' de ' + w + '; ' + lossWhy + '): fast retransmit, ssthresh = cwnd = ' + fmt(ssth);
      }
    } else if (recLeft > 0) {
      recLeft--;
    } else if (cwnd < ssth) {
      cwnd = Math.min(cwnd + w, ssth);
      if (cwnd >= ssth) {
        ev = 'cwnd chegou ao ssthresh (' + fmt(ssth) + '): congestion avoidance';
        evKind = 'phase';
      }
    } else if (algo === 'reno') {
      cwnd += 1;
    } else {
      if (epoch === null) {
        epoch = t;
        if (afterRto) {
          K = 0;
          wmax = cwnd;
          afterRto = false;
        } else if (cwnd < wmax) K = cbrt((wmax - cwnd) / CUBIC_C);
        else {
          K = 0;
          wmax = cwnd;
        }
        west = cwnd;
      }
      const tNow = (t - epoch) / 1000;
      const wcNow = CUBIC_C * cube(tNow - K) + wmax;
      const wcNext = CUBIC_C * cube(tNow + rtt / 1000 - K) + wmax;
      west += (west >= cwndPrior ? 1 : CUBIC_ALPHA) * (w / cwnd);
      const target = wcNext < cwnd ? cwnd : wcNext > 1.5 * cwnd ? 1.5 * cwnd : wcNext;
      if (wcNow < west) {
        cwnd = Math.max(cwnd, west);
        phase = 'CUBIC: região Reno-friendly';
      } else {
        phase = cwnd < wmax ? 'CUBIC: região côncava' : 'CUBIC: região convexa';
        cwnd = target;
      }
    }
    const rate = toMbps(Math.min(got / rtt, Cap));
    rounds.push({ k, t, dur, cwnd: cwndStart, w, q, rtt, lost, rate, cap: toMbps(Cap), bdp, ssth: Number.isFinite(ssth) ? ssth : null, phase, ev, evKind, got });
    t += dur;
    k++;
  }
  return { algo, rounds, stats: summarize(P, rounds) };
}

// ---------- BBR: controle por modelo (banda e RTT mínimo) ----------

type BbrMode = 'Startup' | 'Drain' | 'ProbeBW_DOWN' | 'ProbeBW_CRUISE' | 'ProbeBW_REFILL' | 'ProbeBW_UP' | 'ProbeRTT';

function simBbr(P: CongParams): Flow {
  const rtt0 = P.rtt;
  const durMs = P.dur * 1000;
  const B = bufferSegs(P);
  const rounds: Round[] = [];
  let t = 0;
  let k = 0;
  let q = 0;
  let mode = 'Startup' as BbrMode;
  let inMode = 0;
  let bwCur = 0;
  let bwPrev = 0;
  let btlbw = 0;
  let minRtt = Infinity;
  let minStamp = 0;
  let fullBw = 0;
  let fullCnt = 0;
  let infHi = Infinity;
  let upRounds = 0;
  let cruiseUntil = 0;
  let probeRttEnd = 0;
  const gains = (m: BbrMode): [number, number] => {
    switch (m) {
      case 'Startup': return [BBR.startupGain, BBR.cwndGain];
      case 'Drain': return [BBR.drainGain, BBR.cwndGain];
      case 'ProbeBW_DOWN': return [BBR.downGain, BBR.cwndGain];
      case 'ProbeBW_UP': return [BBR.upGain, BBR.upCwndGain];
      case 'ProbeRTT': return [1, BBR.probeRttGain];
      default: return [1, BBR.cwndGain];
    }
  };
  while (t < durMs && k < MAX_ROUNDS) {
    const Cap = capacityAt(P, t);
    const Tr = rtt0 + q / Cap;
    const [g, cg] = gains(mode);
    const bdpEst = btlbw * minRtt;
    let limit = Infinity;
    let w: number;
    if (k === 0) w = P.iw;
    else {
      limit = Math.max(BBR.minPipe, cg * bdpEst);
      if (Number.isFinite(infHi)) {
        const hi = mode === 'ProbeBW_DOWN' || mode === 'ProbeBW_CRUISE' ? infHi - Math.max(1, BBR.headroom * infHi) : infHi;
        limit = Math.min(limit, Math.max(hi, BBR.minPipe));
      }
      w = Math.max(BBR.minPipe, Math.min(g * btlbw * Tr, limit));
    }
    const cwndShown = k === 0 ? P.iw : limit;
    const qEndRaw = q + w - Cap * Tr;
    const served = qEndRaw < 0 ? q + w : Cap * Tr;
    let qEnd = Math.max(0, qEndRaw);
    const drops = Math.max(0, Math.round(qEnd - B));
    qEnd = Math.min(qEnd, B);
    const rl = randLoss(P.loss, Math.round(w), P.seed, k, 2);
    const lost = Math.min(Math.round(w), drops + rl);
    const got = Math.max(0, served - rl);
    const sample = got / Tr;
    const bwBefore = btlbw;
    bwCur = Math.max(bwCur, sample);
    btlbw = Math.max(bwCur, bwPrev);
    if (Tr < minRtt || t - minStamp > BBR.minRttLenMs) {
      minRtt = Tr;
      minStamp = t;
    }
    const lossRate = w > 0 ? lost / w : 0;
    // Só a sondagem reage à perda (draft, seção "Handle inflight too high"): na Startup são exigidas 6 perdas; fora da
    // sondagem o BBR real usa limites de curto prazo (inflight_shortterm), que o simulador não modela.
    const probing = mode === 'ProbeBW_UP' || mode === 'ProbeBW_REFILL' || (mode === 'Startup' && lost >= 6);
    const tooHigh = probing && lossRate > BBR.lossThresh && lost >= 1;
    const phase = mode;
    let ev = '';
    let evKind: Round['evKind'] = '';
    const bdpNow = btlbw * minRtt;
    inMode++;
    const go = (m: BbrMode, text: string): void => {
      mode = m;
      inMode = 0;
      ev = text;
      evKind = 'phase';
    };
    const tNext = t + Tr;
    if (tooHigh) {
      infHi = Math.min(infHi, Math.max(w, 0) * BBR.beta);
      infHi = Math.max(infHi, bdpNow, BBR.minPipe);
      evKind = 'loss';
      ev = 'Perda de ' + (Math.round(lossRate * 1000) / 10).toString().replace('.', ',') + '% acima de 2%: inflight_longterm = ' + fmt(infHi);
    }
    if (mode === 'Startup') {
      if (k > 0) {
        if (btlbw >= fullBw * 1.25) {
          fullBw = btlbw;
          fullCnt = 0;
        } else fullCnt++;
      }
      if (fullCnt >= 3 || (tooHigh && lost >= 6)) {
        go('Drain', fullCnt >= 3 ? 'Startup terminou: a banda parou de crescer por 3 rodadas (encheu o tubo). Drain: esvazia a fila' : 'Startup terminou por perda alta. Drain: esvazia a fila');
      }
    } else if (mode === 'Drain') {
      if (qEnd <= 1 || inMode >= 3) go('ProbeBW_DOWN', 'Drain terminou: a fila foi esvaziada. ProbeBW_DOWN');
    } else if (mode === 'ProbeBW_DOWN') {
      if (qEnd <= 1) {
        cruiseUntil = tNext + (2 + rnd(P.seed, k, 3)) * 1000;
        bwPrev = bwCur;
        bwCur = 0;
        go('ProbeBW_CRUISE', 'Fila vazia: ProbeBW_CRUISE por ' + (Math.round((cruiseUntil - tNext) / 100) / 10).toString().replace('.', ',') + ' s');
      }
    } else if (mode === 'ProbeBW_CRUISE') {
      if (tNext >= cruiseUntil) go('ProbeBW_REFILL', 'ProbeBW_REFILL: enche o tubo antes de sondar');
    } else if (mode === 'ProbeBW_REFILL') {
      upRounds = 0;
      go('ProbeBW_UP', 'ProbeBW_UP: sonda 1,25 x a banda estimada');
    } else if (mode === 'ProbeBW_UP') {
      upRounds++;
      const grew = btlbw > bwBefore * 1.001;
      if (!tooHigh && Number.isFinite(infHi)) infHi += Math.pow(2, Math.min(upRounds, 20));
      if (tooHigh || !grew || upRounds >= 12) go('ProbeBW_DOWN', tooHigh ? 'A sonda causou perda: ProbeBW_DOWN' : grew ? 'ProbeBW_DOWN' : 'A sonda não achou mais banda: ProbeBW_DOWN');
    } else if (mode === 'ProbeRTT') {
      if (inMode >= 1 && tNext >= probeRttEnd) {
        minStamp = tNext;
        cruiseUntil = tNext + (2 + rnd(P.seed, k, 3)) * 1000;
        go('ProbeBW_CRUISE', 'ProbeRTT terminou: o RTT mínimo foi renovado. Volta ao ProbeBW_CRUISE');
      }
    }
    if (mode !== 'Startup' && mode !== 'ProbeRTT' && tNext - minStamp > BBR.minRttLenMs) {
      probeRttEnd = tNext + BBR.probeRttMs;
      go('ProbeRTT', 'Passaram 10 s sem renovar o RTT mínimo: ProbeRTT (janela de 0,5 x BDP por 200 ms)');
    }
    const dur = Tr;
    rounds.push({ k, t, dur, cwnd: cwndShown, w, q: qEnd, rtt: Tr, lost, rate: toMbps(sample), cap: toMbps(Cap), bdp: Cap * rtt0, ssth: null, phase, ev, evKind, bw: toMbps(btlbw), minRtt: Number.isFinite(minRtt) ? minRtt : Tr, gain: g, got });
    q = qEnd;
    t += dur;
    k++;
  }
  return { algo: 'bbr', rounds, stats: summarize(P, rounds) };
}

export function runFlow(algo: Algo, P: CongParams): Flow {
  return algo === 'bbr' ? simBbr(P) : simWindow(algo, P);
}

const fmt = (v: number): string => (Math.round(v * 10) / 10).toString().replace('.', ',');
export const num1 = fmt;

// ---------- Trace ----------

export const SND_IP = '203.0.113.80';
export const RCV_IP = '198.51.100.10';

const clamp = (v: unknown, a: number, b: number, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d;
};

export function normalize(P: CongParams): CongParams {
  return {
    bw: clamp(P.bw, 1, 1000, 20),
    rtt: clamp(P.rtt, 5, 1000, 50),
    buf: clamp(P.buf, 0.05, 20, 1),
    loss: clamp(P.loss, 0, 20, 0),
    dur: clamp(P.dur, 5, 60, 20),
    shift: ['up', 'down'].includes(String(P.shift)) ? String(P.shift) : 'none',
    iw: Math.round(clamp(P.iw, 1, 20, 10)),
    sack: !!P.sack,
    fastConv: !!P.fastConv,
    seed: Math.round(clamp(P.seed, 1, 9999, 7)),
  };
}

const STATES_ONE: StateDef[] = [
  { key: 'fase', label: 'Fase' },
  { key: 'cwnd', label: 'Janela (cwnd)' },
  { key: 'ssth', label: 'ssthresh' },
  { key: 'fila', label: 'Fila no gargalo' },
  { key: 'rtt', label: 'RTT medido' },
  { key: 'taxa', label: 'Vazão' },
];
const STATES_BBR: StateDef[] = [
  { key: 'fase', label: 'Estado do BBR' },
  { key: 'cwnd', label: 'Dados em voo (limite)' },
  { key: 'bw', label: 'BtlBw estimada' },
  { key: 'minrtt', label: 'RTprop estimado' },
  { key: 'fila', label: 'Fila no gargalo' },
  { key: 'taxa', label: 'Vazão' },
];
const STATES_CMP: StateDef[] = [
  { key: 'reno', label: 'Reno/NewReno' },
  { key: 'cubic', label: 'CUBIC' },
  { key: 'bbr', label: 'BBR' },
];

export const COL_COLORS = { data: C.plain, ack: C.data, bad: C.bad };

const ALGO_FILL: Record<Algo, string> = { reno: 'Reno/NewReno', cubic: 'CUBIC', bbr: 'BBR' };

function fieldsOf(algo: Algo, r: Round, P: CongParams): Field[] {
  const f: Field[] = [{ sec: 'Rodada ' + (r.k + 1) + ' (' + ALGO_FILL[algo] + ')' }];
  f.push(['Instante', fmt(r.t) + ' ms', 'início da rodada']);
  f.push(['Fase', r.phase, '']);
  f.push([algo === 'bbr' ? 'Limite de dados em voo' : 'cwnd', fmt(r.cwnd) + ' segmentos', algo === 'bbr' ? 'ganho de janela x BDP estimado (BtlBw x RTprop)' : 'janela de congestionamento no início da rodada']);
  if (r.ssth !== null) f.push(['ssthresh', fmt(r.ssth) + ' segmentos', 'limite entre slow start e congestion avoidance']);
  f.push(['Enviados', fmt(r.w) + ' segmentos', 'cada segmento = 1500 bytes (MSS 1460 + 40 de cabeçalhos)']);
  f.push(['Perdidos', String(r.lost), r.lost ? 'descartes na fila cheia e/ou perda aleatória (' + P.loss + '%)' : 'nenhum']);
  f.push(['Fila no gargalo', fmt(r.q) + ' segmentos', 'atraso de fila = ' + fmt(r.q / (r.cap / ((PKT * 8) / 1000))) + ' ms']);
  f.push(['RTT medido', fmt(r.rtt) + ' ms', 'RTT base de ' + P.rtt + ' ms mais o atraso de fila']);
  f.push(['Vazão entregue', fmt(r.rate) + ' Mbit/s', 'capacidade do enlace: ' + fmt(r.cap) + ' Mbit/s']);
  if (algo === 'bbr') {
    f.push(['BtlBw estimada', fmt(r.bw || 0) + ' Mbit/s', 'máximo das amostras de vazão (duas voltas do ProbeBW)']);
    f.push(['RTprop estimado', fmt(r.minRtt || 0) + ' ms', 'mínimo dos RTTs medidos nos últimos 10 s']);
    f.push(['Ganho de ritmo (pacing)', fmt(r.gain || 0), 'taxa de envio = ganho x BtlBw']);
  }
  return f;
}

export function buildCongestion(PIn: CongParams, sub: string): Trace {
  const P = normalize(PIn);
  const algos: Algo[] = sub === 'cmp' ? ['reno', 'cubic', 'bbr'] : [sub as Algo];
  const flows = algos.map((a) => runFlow(a, P));
  const cmp = sub === 'cmp';
  const cols: Column[] = cmp
    ? [...algos.map((a) => ({ key: a, label: ALGO_NAME[a], sub: 'emissor', addr: SND_IP })), { key: 'rcv', label: 'Receptor', sub: 'cliente', addr: RCV_IP }]
    : [{ key: 'snd', label: 'Emissor (' + ALGO_NAME[algos[0]] + ')', sub: 'servidor', addr: SND_IP }, { key: 'rcv', label: 'Receptor', sub: 'cliente', addr: RCV_IP }];
  const tr = newTrace(cols, cmp ? STATES_CMP : sub === 'bbr' ? STATES_BBR : STATES_ONE, P.rtt);
  const end = Math.max(...flows.map((f) => f.rounds[f.rounds.length - 1].t + f.rounds[f.rounds.length - 1].dur));
  tr.raw = { sub, P, flows, end, buf: bufferSegs(P), bdp0: segPerMs(P.bw) * P.rtt };

  flows.forEach((fl) => {
    const key = cmp ? fl.algo : 'snd';
    const step = Math.max(1, Math.ceil(fl.rounds.length / (cmp ? 18 : 45)));
    let evCount = 0;
    let lastPhase = '';
    fl.rounds.forEach((r) => {
      const isEv = !!r.ev;
      if (isEv) evCount++;
      const show = r.k < 8 || (isEv && evCount <= (cmp ? 10 : 40)) || r.k % step === 0 || r.k === fl.rounds.length - 1;
      if (!show) return;
      const lossy = r.lost > 0;
      const label = Math.round(r.w) + ' segm.' + (lossy ? ' (' + r.lost + ' perdidos)' : '');
      tr.add(key, 'rcv', {
        at: r.t, dur: r.dur / 2, par: true, color: lossy ? C.bad : C.plain, proto: 'Rodada', len: Math.round(r.w) * PKT, label,
        info: 'Rodada ' + (r.k + 1) + ': ' + fmt(r.w) + ' segmentos em voo, fila de ' + fmt(r.q) + ', RTT de ' + fmt(r.rtt) + ' ms',
        about: 'Uma rodada é o conjunto de segmentos enviados durante um RTT. O diagrama mostra uma amostra das rodadas: as primeiras, as que têm evento e algumas intermediárias.',
        fields: fieldsOf(fl.algo, r, P), tags: lossy ? ['perda'] : [], phaseName: r.phase,
      });
      tr.add('rcv', key, { at: r.t + r.dur / 2, dur: r.dur / 2, par: true, color: C.data, proto: 'ACK', len: 0, label: 'ACKs de ' + fmt(r.got) + ' segm.', info: 'ACKs da rodada ' + (r.k + 1), about: 'Os ACKs que voltam liberam novos envios (relógio de ACKs).', fields: fieldsOf(fl.algo, r, P), tags: [] });
      if (isEv) {
        tr.ev(r.t, key, r.ev, r.evKind === 'phase' ? '' : 'bad');
        tr.lg(r.t, (cmp ? ALGO_NAME[fl.algo] + ': ' : '') + r.ev + '.', r.evKind === 'loss' || r.evKind === 'rto' ? 'loss' : 'cc');
      }
      if (!cmp && r.phase !== lastPhase) {
        tr.phases.push({ t: r.t, label: r.phase, key: r.phase });
        lastPhase = r.phase;
      }
      const cls = lossy ? 'bad' : '';
      if (cmp) tr.st(r.t, fl.algo, fmt(r.cwnd) + ' segm., ' + fmt(r.rate) + ' Mbit/s', cls);
      else {
        tr.st(r.t, 'fase', r.phase, cls);
        tr.st(r.t, 'cwnd', fmt(r.cwnd) + ' segm.', '');
        if (fl.algo === 'bbr') {
          tr.st(r.t, 'bw', fmt(r.bw || 0) + ' Mbit/s', '');
          tr.st(r.t, 'minrtt', fmt(r.minRtt || 0) + ' ms', '');
        } else tr.st(r.t, 'ssth', r.ssth === null ? 'sem limite' : fmt(r.ssth) + ' segm.', '');
        tr.st(r.t, 'fila', fmt(r.q) + ' segm.', r.q >= bufferSegs(P) - 0.5 ? 'bad' : '');
        tr.st(r.t, 'rtt', fmt(r.rtt) + ' ms', '');
        tr.st(r.t, 'taxa', fmt(r.rate) + ' Mbit/s', '');
      }
    });
  });
  const f0 = flows[0];
  if (!cmp) {
    f0.rounds.filter((r) => r.evKind === 'loss' || r.evKind === 'rto').slice(0, 6).forEach((r) => tr.mile(r.t, r.evKind === 'rto' ? 'RTO' : 'Perda', fmt(r.t) + ' ms'));
  }
  tr.t = end;
  tr.lg(end, 'Fim da simulação (' + P.dur + ' s).', 'sys');
  return tr;
}
