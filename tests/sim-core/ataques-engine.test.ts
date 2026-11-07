// Regras do motor de ataques e defesas TCP/UDP: eficácia por controle, ponto de atuação, atraso da operadora e resposta a incidente.
import { describe, expect, it } from 'vitest';
import { buildAtaques, type AtkParams } from '../../src/sims/ataques-tcp-udp/modes';
import { simulate } from '../../src/sims/ataques-tcp-udp/model';
import { scenarios } from '../../src/sims/ataques-tcp-udp/content/scenarios';
import { controls } from '../../src/sims/ataques-tcp-udp/content/controls';

const BASE = Object.fromEntries(controls.map((c) => [c.id, c.def])) as unknown as AtkParams;
const run = (o: Partial<AtkParams>, sub = 'tcp') => simulate({ ...BASE, ...o }, sub);
const last = (o: Partial<AtkParams>, sub = 'tcp') => {
  const s = run(o, sub);
  return { s, m: s.cycles[s.cycles.length - 1].snap };
};

describe('Ataques TCP', () => {
  it('sem defesas, o SYN flood chega inteiro à vítima e satura o servidor', () => {
    const { s, m } = last({ attackTcp: 'syn-flood', intensity: 4 });
    expect(m.blocked).toBe(0);
    expect(m.delivered).toBe(m.generated);
    expect(s.peakLoad).toBeGreaterThan(70);
  });

  it('SYN cookies protegem a fila; o TLS não muda nada no SYN flood', () => {
    const base = last({ attackTcp: 'syn-flood', intensity: 4 }).m;
    const cookies = last({ attackTcp: 'syn-flood', intensity: 4, synCookies: true }).m;
    const tls = last({ attackTcp: 'syn-flood', intensity: 4, tls: true }).m;
    expect(cookies.delivered).toBeLessThan(base.delivered * 0.4);
    expect(tls.blocked).toBe(0);
  });

  it('no RST injection, o TLS não protege e o firewall stateful protege', () => {
    expect(last({ attackTcp: 'rst-injection', tls: true }).m.blocked).toBe(0);
    const st = last({ attackTcp: 'rst-injection', stateful: true }).m;
    expect(st.blocked / st.generated).toBeGreaterThan(0.45);
  });

  it('no Slowloris, SYN cookies, TLS e upstream não mudam nada; o hardening resolve', () => {
    const inutil = last({ attackTcp: 'slowloris', synCookies: true, tls: true, upstream: 'on' }).m;
    expect(inutil.blocked).toBe(0);
    const ok = last({ attackTcp: 'slowloris', hardening: true }).m;
    expect(ok.blocked).toBeGreaterThan(0);
  });

  it('a varredura lenta envia uma sonda a cada 3 ciclos e o IDS quase não a vê', () => {
    const s = run({ attackTcp: 'slow-scan', ids: true, cycles: 30 });
    expect(s.cycles.filter((c) => c.pkts.some((p) => p.kind === 'attack' || p.kind === 'scan')).length).toBe(10);
  });
});

describe('Ataques UDP', () => {
  it('na amplificação, o anti-spoofing barra a requisição na borda da origem', () => {
    const { s, m } = last({ attackUdp: 'amplification', antiSpoof: true }, 'udp');
    expect(s.cycles.some((c) => c.pkts.some((p) => p.kind === 'request' && p.to === 'edge' && p.by === 'antiSpoof'))).toBe(true);
    expect(m.reqBlocked).toBeGreaterThan(0);
  });

  it('a mitigação upstream só age 6 ciclos depois de acionada; always-on age desde o início', () => {
    const on = run({ attackUdp: 'botnet', upstream: 'on', intensity: 5 }, 'udp');
    const tarde = run({ attackUdp: 'botnet', upstream: '3', intensity: 5 }, 'udp');
    const firstUp = (s: ReturnType<typeof run>) => s.cycles.find((c) => c.pkts.some((p) => p.by === 'upstream'))!.tick;
    expect(firstUp(on)).toBe(1);
    expect(firstUp(tarde)).toBeGreaterThanOrEqual(9);
    expect(tarde.upstreamCall).toBe(3);
  });

  it('o rate limiting no DNS water torture gera falsos positivos contra clientes legítimos', () => {
    const s = run({ attackUdp: 'dns-water-torture', rateLimit: true, cycles: 40, intensity: 3 }, 'udp');
    expect(s.fpDrops).toBeGreaterThan(0);
  });
});

describe('Resposta a incidente e determinismo', () => {
  it('com os controles essenciais prontos desde o início, a preparação e a contenção ocorrem no ciclo 1', () => {
    const s = run({ attackTcp: 'syn-flood', synCookies: true, rateLimit: true, ids: true, upstream: 'on' });
    expect(s.ir.prepared).toBe(true);
    expect(s.ir.contain).toBe(1);
  });

  it('sem IDS, ataques de baixo volume podem nunca ser detectados', () => {
    expect(run({ attackTcp: 'slow-scan', cycles: 20 }).ir.detect).toBeNull();
  });

  it.each(scenarios.map((s) => [s.id, s] as const))('o cenário %s monta o trace sem erro e é determinístico', (_id, s) => {
    const P = { ...BASE, ...s.set, ids: true } as unknown as AtkParams;
    const a = buildAtaques(P, s.sub);
    const b = buildAtaques(P, s.sub);
    expect(a.msgs.length).toBeGreaterThan(0);
    expect(JSON.stringify(a.msgs)).toBe(JSON.stringify(b.msgs));
  });
});
