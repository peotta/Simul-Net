// Regras do motor de MPLS: LDP, LIB e LFIB, push, swap e pop, PHP, modelos de TTL, L3VPN e reconvergência após falha.
import { describe, expect, it } from 'vitest';
import { prepare } from '../../src/sim-core';
import { forward, fecs, lspHops, lspText, makeNet, localLabel, outLabel, type Cfg } from '../../src/sims/mpls/model';
import { buildDados, buildFalha, buildLdp, buildTtl } from '../../src/sims/mpls/modes';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ service: 'ip', php: 'implicit', propagate: true, step: 4, down: [], ...o });
const P = { service: 'ip', php: 'implicit', prop: true } as const;
const echo = { src: '192.168.1.10', dst: '192.168.2.10', ipttl: 64, kind: 'echo' as const, stack: [] };

describe('MPLS: IGP, FECs e rótulos', () => {
  it('o caminho IGP padrão de PE1 a PE2 é PE1, P1, P3, PE2 (custo 30)', () => {
    const net = makeNet(cfg());
    expect(net.spf.PE1.dist.PE2).toBe(30);
    expect(lspText(net, 'H-A')).toBe('PE1 [208] → P1 [408] → P3 [IP] → PE2');
  });

  it('cada LSR usa a própria faixa de rótulos e o egresso anuncia implicit-null, explicit-null ou rótulo próprio', () => {
    const f = fecs(makeNet(cfg())).find((x) => x.owner === 'PE2' && x.kind === 'loopback')!;
    expect(localLabel(makeNet(cfg()), 'P3', f)).toBe(406);
    expect(localLabel(makeNet(cfg()), 'PE2', f)).toBe(3);
    expect(localLabel(makeNet(cfg({ php: 'explicit' })), 'PE2', f)).toBe(0);
    expect(localLabel(makeNet(cfg({ php: 'none' })), 'PE2', f)).toBe(606);
  });

  it('a L3VPN não tem as redes dos clientes entre as FECs; o IP sobre MPLS tem', () => {
    expect(fecs(makeNet(cfg())).length).toBe(8);
    expect(fecs(makeNet(cfg({ service: 'vpn' }))).length).toBe(6);
  });

  it('antes da fase de mapeamento não há rótulo de saída', () => {
    const net = makeNet(cfg({ step: 2 }));
    const f = fecs(net)[5];
    expect(outLabel(net, 'PE1', f).label).toBeNull();
  });
});

describe('MPLS: plano de dados', () => {
  it('ping IP sobre MPLS: push no PE1, swap no P1 e pop no P3 (PHP); TTL recebido 60 no Uniform', () => {
    const tr = buildDados({ ...P, dir: 'H-A', ctl: 'ok' });
    expect(tr.raw.res).toBe('ok');
    expect(tr.raw.ida).toEqual(['PE1: push 208 (FEC 192.168.2.0/24)', 'P1: swap 208 → 408', 'P3: pop 408 (PHP, PE2 anunciou imp-null)', 'PE2: entrega na rede conectada']);
    expect(tr.raw.ttlRecv).toBe(60);
  });

  it('no modelo Pipe só os PEs decrementam o TTL: recebido 62', () => {
    const tr = buildDados({ ...P, prop: false, dir: 'H-A', ctl: 'ok' });
    expect(tr.raw.ttlRecv).toBe(62);
  });

  it('explicit-null leva o rótulo 0 até o PE2; sem PHP leva o rótulo próprio do PE2', () => {
    const ex = forward(makeNet(cfg({ php: 'explicit' })), { ...echo }, 'H-A');
    const lastLsr = ex.steps.filter((s) => s.t === 'hop').slice(-2)[0] as any;
    expect(lastLsr.pkt.stack[0].label).toBe(0);
    const np = forward(makeNet(cfg({ php: 'none' })), { ...echo }, 'H-A');
    const hops = np.steps.filter((s) => s.t === 'hop') as any[];
    expect(hops[hops.length - 2].pkt.stack[0].label).toBeGreaterThan(600);
  });

  it('L3VPN: pilha de dois rótulos (transporte e VPN) e os P não olham o rótulo VPN', () => {
    const net = makeNet(cfg({ service: 'vpn' }));
    expect(lspHops(net, 'H-A')[0].stack).toEqual([206, 690]);
    const o = forward(net, { ...echo }, 'H-A');
    expect(o.status).toBe('delivered');
  });

  it('sem LDP: IP sobre MPLS segue por roteamento comum, mas a L3VPN descarta no PE', () => {
    const ip = buildDados({ ...P, dir: 'H-A', ctl: 'semldp' });
    expect(ip.raw.res).toBe('ok');
    expect(ip.raw.ida.every((x: string) => !/push|swap|pop [0-9]/.test(x))).toBe(true);
    const vpn = buildDados({ ...P, service: 'vpn', dir: 'H-A', ctl: 'semldp' });
    expect(vpn.raw.res).toBe('drop');
    expect(vpn.raw.at).toBe('PE1');
  });

  it('a volta usa outro LSP, com outros rótulos', () => {
    const net = makeNet(cfg());
    expect(lspText(net, 'H-A')).not.toBe(lspText(net, 'H-B'));
  });
});

describe('MPLS: traceroute', () => {
  it('Uniform: todos os saltos do núcleo aparecem, com a pilha devolvida no ICMP', () => {
    const tr = buildTtl({ ...P, dir: 'H-A' });
    expect(tr.raw.reached).toBe(true);
    expect(tr.raw.seen).toEqual(['PE1', 'P1', 'P3', 'PE2']);
    expect(tr.raw.hops[1].mode).toBe('label');
  });

  it('Pipe: só os PEs aparecem', () => {
    const tr = buildTtl({ ...P, prop: false, dir: 'H-A' });
    expect(tr.raw.seen).toEqual(['PE1', 'PE2']);
  });
});

describe('MPLS: LDP e falha de enlace', () => {
  it('as quatro fases do LDP aparecem na ordem e terminam com a LFIB instalada', () => {
    const tr = buildLdp({ ...P });
    expect(tr.phases.map((p) => p.key)).toEqual(['disc', 'sess', 'map', 'lsp', 'resultado']);
    expect(tr.raw.tStep[1]).toBeLessThan(tr.raw.tStep[2]);
    expect(tr.raw.tStep[3]).toBeLessThan(tr.raw.tStep[4]);
    expect(tr.msgs.filter((m) => m.label === 'Hello').length).toBe(16);
    expect(tr.msgs.filter((m) => m.label === 'Label Mapping').length).toBe(16);
  });

  it('a L3VPN troca rotas VPNv4 por MP-BGP na fase de mapeamento', () => {
    const tr = buildLdp({ ...P, service: 'vpn' });
    expect(tr.msgs.filter((m) => m.proto === 'BGP').length).toBe(2);
    expect(buildLdp({ ...P }).msgs.filter((m) => m.proto === 'BGP').length).toBe(0);
  });

  it('a queda do enlace L4 muda o LSP para PE1, P2, P4, PE2 sem nova sinalização', () => {
    const tr = buildFalha({ ...P, dir: 'H-A', fail: 'L4' });
    expect(tr.raw.res).toBe('rerouted');
    expect(tr.raw.lspBefore).toContain('P1');
    expect(tr.raw.lspAfter).toContain('P2');
    expect(tr.raw.lspAfter).toContain('P4');
  });

  it('a queda de um enlace fora do LSP não muda o caminho', () => {
    const tr = buildFalha({ ...P, dir: 'H-A', fail: 'L8' });
    expect(tr.raw.res).toBe('same');
  });

  it('nenhuma falha isolada desconecta o núcleo', () => {
    for (let i = 1; i <= 8; i++) expect(buildFalha({ ...P, dir: 'H-A', fail: 'L' + i }).raw.okAfter, 'L' + i).toBe(true);
  });

  it('o trace de cada modo é determinístico e preparável', () => {
    const a = buildDados({ ...P, dir: 'H-B', ctl: 'ok' });
    const b = buildDados({ ...P, dir: 'H-B', ctl: 'ok' });
    prepare(a);
    prepare(b);
    expect(JSON.stringify(a.msgs.map((m) => [m.from, m.to, m.tSend, m.tArr, m.label]))).toBe(JSON.stringify(b.msgs.map((m) => [m.from, m.to, m.tSend, m.tArr, m.label])));
  });
});
