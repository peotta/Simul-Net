// Regras do motor de TCP e UDP: handshake, recuperação de perdas, SACK, UDP, DNS, download e vídeo.
import { describe, expect, it } from 'vitest';
import { buildTcpUdp, type TcpUdpParams } from '../../src/sims/tcp-udp/modes';
import { scenarios } from '../../src/sims/tcp-udp/content/scenarios';
import { controls } from '../../src/sims/tcp-udp/content/controls';

const BASE = Object.fromEntries(controls.map((c) => [c.id, c.def])) as unknown as TcpUdpParams;
const run = (o: Partial<TcpUdpParams>, sub = 'tcp') => buildTcpUdp({ ...BASE, ...o }, sub);
const labels = (tr: ReturnType<typeof run>) => tr.msgs.map((m) => String(m.label));

describe('TCP: conexão', () => {
  it('abre com SYN, SYN-ACK e ACK e encerra com FIN e ACK nos dois sentidos', () => {
    const tr = run({ N: 3, rtt: 15, bw: 1, iw: 1 });
    const l = labels(tr).join(' | ');
    expect(l).toMatch(/SYN/);
    expect(tr.msgs.filter((m) => /FIN/.test(String(m.label))).length).toBe(2);
    expect(tr.raw.sims[0].raw.N).toBe(3);
  });

  it('o fast retransmit recupera um segmento perdido no meio sem timeout', () => {
    const tr = run({ N: 20, drops: '8', iw: 4, rtt: 15, bw: 1 });
    const r = tr.raw.sims[0].raw;
    expect(r.fastList).toContain(8);
    expect(r.rtoList).toEqual([]);
  });

  it('perder o último segmento só é recuperado por timeout', () => {
    const tr = run({ N: 6, drops: '6', iw: 4 });
    expect(tr.raw.sims[0].raw.rtoList).toContain(6);
  });

  it('o SACK repõe vários buracos mais rápido que o NewReno', () => {
    const o = { N: 20, drops: '5, 7, 9', iw: 10, rtt: 100, bw: 5 };
    const sem = run({ ...o, sack: false });
    const com = run({ ...o, sack: true });
    expect(com.raw.sims[0].end).toBeLessThan(sem.raw.sims[0].end);
  });

  it('a rwnd limita os segmentos em voo', () => {
    const tr = run({ N: 20, iw: 10, rwnd: 4 });
    expect(tr.raw.sims[0].raw.maxFlight).toBeLessThanOrEqual(4);
  });
});

describe('UDP, DNS, download e vídeo', () => {
  it('o UDP não retransmite: o que se perde não chega à aplicação', () => {
    const tr = run({ N: 20, loss: 10, seed: 7 }, 'stream');
    const r = tr.raw.sims[0].raw;
    expect(r.delivered).toBe(r.N - r.lostList.length);
  });

  it('o DNS repete a consulta depois de 1 s quando a primeira se perde', () => {
    const tr = run({ drops: '1', rtt: 15 }, 'dns');
    expect(tr.raw.sims[0].raw.attempts).toBe(2);
    expect(tr.raw.sims[0].raw.ok).toBe(true);
  });

  it('o download entrega o arquivo e perde por fila cheia quando a janela passa da capacidade', () => {
    const tr = run({ file: 5, rtt: 20, bw: 10, iw: 10, rwnd: 1024, ssth: 1000, sack: true }, 'dl');
    const r = tr.raw.sims[0].raw;
    expect(r.queueLoss).toBeGreaterThan(0);
    expect(r.goodput).toBeGreaterThan(0);
  });

  it('o vídeo acima da capacidade do enlace congela ou degrada quadros', () => {
    const ok = run({ vbr: 2500, bw: 5, vdur: 5, jit: 20, jb: 100 }, 'vid').raw.sims[0].raw;
    const ruim = run({ vbr: 4000, bw: 2, vdur: 5, jit: 20, jb: 100 }, 'vid').raw.sims[0].raw;
    expect(ok.cnt.ok).toBe(ok.N);
    expect(ruim.cnt.ok).toBeLessThan(ruim.N);
  });
});

describe('Comparação e cenários', () => {
  it('com a mesma semente, TCP e UDP sofrem as mesmas perdas e o TCP entrega tudo', () => {
    const tr = run({ N: 20, loss: 10, iw: 4 }, 'cmp');
    const [t, u] = tr.raw.sims;
    expect(t.raw.delivered).toBe(20);
    expect(u.raw.delivered).toBeLessThanOrEqual(20);
    expect(t.end).toBeGreaterThan(u.raw.time);
  });

  it.each(scenarios.map((s) => [s.id, s] as const))('o cenário %s monta o trace sem erro e é determinístico', (_id, s) => {
    const P = { ...BASE, ...s.set } as unknown as TcpUdpParams;
    const a = buildTcpUdp(P, s.sub);
    const b = buildTcpUdp(P, s.sub);
    expect(a.msgs.length).toBeGreaterThan(0);
    expect(JSON.stringify(a.msgs)).toBe(JSON.stringify(b.msgs));
  });
});
