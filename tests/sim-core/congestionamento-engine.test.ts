import { describe, expect, it } from 'vitest';
import { buildCongestion, bufferSegs, CUBIC_ALPHA, runFlow, segPerMs, type Algo, type CongParams } from '../../src/sims/congestionamento/engine';
import { congestionamentoProtocol } from '../../src/sims/congestionamento/protocol';
import { scenarioParams } from '../../src/sim-core/ui';

const base: CongParams = { bw: 20, rtt: 50, buf: 1, loss: 0, dur: 20, shift: 'none', iw: 10, sack: true, fastConv: false, seed: 7 };
const flow = (a: Algo, o: Partial<CongParams> = {}) => runFlow(a, { ...base, ...o });
const stats = (a: Algo, o: Partial<CongParams> = {}) => flow(a, o).stats;

describe('motor de congestionamento: Reno', () => {
  it('slow start dobra a janela a cada rodada a partir da janela inicial', () => {
    expect(flow('reno').rounds.slice(0, 4).map((x) => x.cwnd)).toEqual([10, 20, 40, 80]);
  });

  it('a janela inicial menor atrasa o slow start', () => {
    expect(flow('reno', { iw: 1 }).rounds[3].cwnd).toBe(8);
  });

  it('na perda por estouro de fila, a cwnd cai à metade dos dados em voo', () => {
    const r = flow('reno').rounds;
    const i = r.findIndex((x) => x.evKind === 'loss');
    expect(i).toBeGreaterThan(0);
    expect(r[i + 1].cwnd).toBe(Math.floor(r[i].w * 0.5));
  });

  it('na congestion avoidance soma 1 segmento por rodada', () => {
    const r = flow('reno').rounds;
    const i = r.findIndex((x) => x.phase === 'Congestion avoidance');
    expect(r[i + 1].cwnd - r[i].cwnd).toBe(1);
  });

  it('com fila de 1 BDP o enlace fica quase cheio; com fila rasa, a utilização cai', () => {
    expect(stats('reno').util).toBeGreaterThan(0.95);
    expect(stats('reno', { buf: 0.25 }).util).toBeLessThan(stats('reno').util);
  });

  it('a fila funda aumenta o RTT médio (bufferbloat)', () => {
    expect(stats('reno', { buf: 4 }).avgRtt).toBeGreaterThan(3 * base.rtt);
  });

  it('sem SACK, a rajada de perdas do primeiro estouro termina em timeout', () => {
    expect(stats('reno', { sack: false }).rtos).toBeGreaterThan(0);
    expect(stats('reno', { sack: true }).rtos).toBe(0);
  });

  it('a perda aleatória derruba a vazão (ordem de grandeza de Mathis)', () => {
    const g = stats('reno', { loss: 1 }).goodput;
    expect(g).toBeGreaterThan(1.5);
    expect(g).toBeLessThan(5);
  });
});

describe('motor de congestionamento: CUBIC', () => {
  it('reduz a janela em 30% (β = 0,7) na perda', () => {
    const r = flow('cubic', { buf: 0.25 }).rounds;
    const i = r.findIndex((x) => x.evKind === 'loss');
    expect(r[i + 1].cwnd).toBeCloseTo(r[i].w * 0.7, 5);
  });

  it('α do Reno-friendly vale 3 (1 - β) / (1 + β)', () => {
    expect(CUBIC_ALPHA).toBeCloseTo(0.5294, 3);
  });

  it('usa a região côncava e se recupera mais rápido que o Reno em caminho longo e largo', () => {
    const o = { bw: 50, rtt: 200, dur: 40, buf: 0.25 };
    expect(new Set(flow('cubic', o).rounds.map((x) => x.phase)).has('CUBIC: região côncava')).toBe(true);
    expect(stats('cubic', o).util).toBeGreaterThan(stats('reno', o).util);
  });

  it('em caminho curto, entra na região Reno-friendly', () => {
    expect(new Set(flow('cubic', { bw: 10, rtt: 20 }).rounds.map((x) => x.phase)).has('CUBIC: região Reno-friendly')).toBe(true);
  });

  it('com capacidade que dobra, entra na região convexa', () => {
    expect(new Set(flow('cubic', { shift: 'up' }).rounds.map((x) => x.phase)).has('CUBIC: região convexa')).toBe(true);
  });
});

describe('motor de congestionamento: BBR', () => {
  it('passa por Startup, Drain, ProbeBW e ProbeRTT', () => {
    const phases = new Set(flow('bbr').rounds.map((x) => x.phase));
    ['Startup', 'Drain', 'ProbeBW_DOWN', 'ProbeBW_CRUISE', 'ProbeBW_REFILL', 'ProbeBW_UP', 'ProbeRTT'].forEach((p) => expect(phases.has(p), p).toBe(true));
  });

  it('a estimativa de banda converge para a capacidade e a fila fica curta', () => {
    const r = flow('bbr').rounds;
    expect(r[r.length - 1].bw).toBeCloseTo(20, 0);
    expect(stats('bbr').avgRtt).toBeLessThan(1.15 * base.rtt);
  });

  it('com fila funda mantém o RTT baixo, ao contrário do Reno e do CUBIC', () => {
    const o = { buf: 4 };
    expect(stats('bbr', o).avgRtt).toBeLessThan(stats('reno', o).avgRtt / 2);
    expect(stats('bbr', o).avgRtt).toBeLessThan(stats('cubic', o).avgRtt / 2);
  });

  it('a perda aleatória de 1% quase não afeta o BBR, mas derruba o Reno e o CUBIC', () => {
    const o = { loss: 1 };
    expect(stats('bbr', o).goodput).toBeGreaterThan(0.8 * base.bw);
    expect(stats('reno', o).goodput).toBeLessThan(0.3 * base.bw);
    expect(stats('cubic', o).goodput).toBeLessThan(0.3 * base.bw);
  });

  it('a perda acima de 2% limita a vazão do BBR, mas menos que a do Reno', () => {
    const o = { loss: 5 };
    expect(stats('bbr', o).goodput).toBeLessThan(stats('bbr').goodput);
    expect(stats('bbr', o).goodput).toBeGreaterThan(stats('reno', o).goodput);
  });

  it('descobre a banda nova só em uma sondagem depois da mudança de capacidade', () => {
    const r = flow('bbr', { shift: 'up' }).rounds;
    const half = (base.dur * 1000) / 2;
    const first = r.find((x) => x.t >= half && x.rate > 30);
    expect(first).toBeTruthy();
    expect(first!.t).toBeGreaterThan(half + 500);
  });
});

describe('motor de congestionamento: geral', () => {
  it('é determinístico e a fila nunca passa do limite', () => {
    (['reno', 'cubic', 'bbr'] as Algo[]).forEach((a) => {
      const x = flow(a, { loss: 1 });
      expect(JSON.stringify(x)).toBe(JSON.stringify(flow(a, { loss: 1 })));
      x.rounds.forEach((r) => expect(r.q).toBeLessThanOrEqual(bufferSegs(base) + 1e-6));
    });
  });

  it('o BDP em segmentos segue capacidade x RTT', () => {
    expect(segPerMs(20) * 50).toBeCloseTo(83.33, 1);
  });

  it('o trace tem as colunas de cada modo e amostra as rodadas', () => {
    const P = scenarioParams(congestionamentoProtocol.controls, congestionamentoProtocol.scenarios[0]) as unknown as CongParams;
    expect(buildCongestion(P, 'reno').cols.map((c) => c.key)).toEqual(['snd', 'rcv']);
    expect(buildCongestion(P, 'cmp').cols.map((c) => c.key)).toEqual(['reno', 'cubic', 'bbr', 'rcv']);
    expect(buildCongestion({ ...P, dur: 40, rtt: 20 }, 'reno').msgs.length).toBeLessThan(250);
  });
});

describe('motor de congestionamento: tempo até 90% da capacidade', () => {
  it('só conta a vazão sustentada: com perda aleatória de 1%, o Reno nunca chega; sem perda, chega logo', () => {
    expect(stats('reno', { loss: 1 }).t90).toBeNull();
    expect(stats('reno').t90).not.toBeNull();
    expect(stats('bbr', { loss: 1 }).t90).not.toBeNull();
  });
});
