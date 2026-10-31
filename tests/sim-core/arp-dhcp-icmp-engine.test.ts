// Regras dos motores de ARP, DHCP e ICMP: resolução, cache, proxy ARP, DORA, temporizadores do lease e TTL.
import { describe, expect, it } from 'vitest';
import { scenarioParams } from '../../src/sim-core/ui';
import { controls as arpControls } from '../../src/sims/arp/content/controls';
import { scenarios as arpScenarios } from '../../src/sims/arp/content/scenarios';
import { buildArp } from '../../src/sims/arp/engine';
import { controls as dhcpControls } from '../../src/sims/dhcp/content/controls';
import { scenarios as dhcpScenarios } from '../../src/sims/dhcp/content/scenarios';
import { buildDhcp, t1Secs, t2Secs } from '../../src/sims/dhcp/engine';
import { controls as icmpControls } from '../../src/sims/icmp/content/controls';
import { scenarios as icmpScenarios } from '../../src/sims/icmp/content/scenarios';
import { buildIcmp } from '../../src/sims/icmp/engine';

type Sc = { id: string; sub: string };
const make = (controls: any, scenarios: Sc[], build: (p: any, sub: string) => any) => (id: string) => {
  const s = scenarios.find((x) => x.id === id)!;
  return build(scenarioParams(controls, s as any), s.sub);
};
const labels = (tr: any) => tr.msgs.map((m: any) => m.label as string);

describe('ARP', () => {
  const arp = make(arpControls, arpScenarios as Sc[], buildArp);

  it('primeira resolução: Request em broadcast, Reply do vizinho e só então o Echo', () => {
    const tr = arp('r-local');
    expect(tr.raw.result).toBe('ok');
    expect(tr.raw.learned).toBe(true);
    const l = labels(tr);
    expect(l.indexOf('ARP Reply')).toBeGreaterThan(l.indexOf('ARP Request'));
    expect(l.indexOf('Echo Request')).toBeGreaterThan(l.indexOf('ARP Reply'));
  });

  it('entrada em cache dispensa o ARP', () => {
    const tr = arp('r-cache');
    expect(tr.raw.cacheHit).toBe(true);
    expect(labels(tr).some((x: string) => x.startsWith('ARP'))).toBe(false);
  });

  it('proxy ARP: o gateway responde pelo destino remoto; sem ele a resolução falha após as tentativas', () => {
    const ok = arp('r-proxy');
    expect(ok.raw.responder).toBe('g');
    expect(ok.raw.result).toBe('ok');
    const fail = arp('r-noproxy');
    expect(fail.raw.result).toBe('failed');
    expect(fail.raw.tries).toBe(3);
    expect(labels(fail).includes('Echo Request')).toBe(false);
  });

  it('perda do primeiro Request: nova tentativa depois de cerca de 1 s e resolução concluída', () => {
    const tr = arp('r-lost');
    expect(tr.raw.result).toBe('ok');
    expect(tr.raw.tries).toBe(2);
    expect(tr.msgs.filter((m: any) => m.lost).length).toBeGreaterThan(0);
    expect(tr.raw.tEnd).toBeGreaterThanOrEqual(1000);
  });
});

describe('DHCP', () => {
  const dhcp = make(dhcpControls, dhcpScenarios as Sc[], buildDhcp);

  it('DORA básico termina com o cliente em BOUND e a ordem DISCOVER, OFFER, REQUEST, ACK', () => {
    const tr = dhcp('d-dora');
    expect(tr.raw.result).toBe('bound');
    const l = labels(tr).filter((x: string) => !x.startsWith('ARP'));
    const first = (n: string) => l.indexOf(n);
    expect(first('DISCOVER')).toBeLessThan(first('OFFER'));
    expect(first('OFFER')).toBeLessThan(first('REQUEST'));
    expect(first('REQUEST')).toBeLessThan(first('ACK'));
  });

  it('com dois servidores há duas ofertas e um único ACK', () => {
    const l = labels(dhcp('d-two'));
    expect(l.filter((x: string) => x === 'OFFER')).toHaveLength(2);
    expect(l.filter((x: string) => x === 'ACK')).toHaveLength(1);
  });

  it('T1 é 50% e T2 é 87,5% do lease', () => {
    expect(t1Secs(1)).toBe(1800);
    expect(t2Secs(1)).toBe(3150);
    expect(t1Secs(8)).toBe(14400);
    expect(t2Secs(8)).toBe(25200);
  });
});

describe('ICMP', () => {
  const icmp = make(icmpControls, icmpScenarios as Sc[], buildIcmp);

  it('ping até o SRV: 4 enviados, 4 respondidos e o TTL cai 1 por roteador', () => {
    const tr = icmp('i-echo');
    expect(tr.raw.sent).toBe(4);
    expect(tr.raw.recv).toBe(4);
    const req = tr.msgs.filter((m: any) => m.label.startsWith('ECHO REQ'));
    expect(req.slice(0, 4).map((m: any) => m.label)).toEqual(['ECHO REQ ttl=64', 'ECHO REQ ttl=63', 'ECHO REQ ttl=62', 'ECHO REQ ttl=61']);
  });

  it('TTL 2 expira no segundo roteador, que responde Time Exceeded e nenhum Echo Reply chega', () => {
    const tr = icmp('i-ttl');
    expect(tr.raw.recv).toBe(0);
    const l = labels(tr);
    expect(l.some((x: string) => x.startsWith('TIME EXCEEDED'))).toBe(true);
    expect(l.some((x: string) => x.startsWith('ECHO REP'))).toBe(false);
  });
});
