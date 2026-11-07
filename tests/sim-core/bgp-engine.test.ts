// Regras do motor de BGP: sessões, decisão de caminho, exportação valley-free, política, falhas e defesas.
import { describe, expect, it } from 'vitest';
import { bestOf, type Net } from '../../src/sims/bgp/model';
import { buildBgp, type BgpParams } from '../../src/sims/bgp/modes';
import { scenarios } from '../../src/sims/bgp/content/scenarios';
import { controls } from '../../src/sims/bgp/content/controls';

const BASE = { dir: 'DC', lpA: 100, prependB: 0, ev: 'none', link: 'L5', attack: 'none', relLP: false, rov: 'off', cust: 'off', peer: 'off', damp: false, root: 'D' } as BgpParams;
const run = (o: Partial<BgpParams>, sub = 'rotas') => buildBgp({ ...BASE, ...o }, sub);
const net = (tr: ReturnType<typeof run>): Net => tr.raw.net as Net;
const best = (tr: ReturnType<typeof run>, x: string, p: string) => bestOf(net(tr), x, p).best!;
const names = (tr: ReturnType<typeof run>) => (tr.raw.fwd.path as string[]).join('>');
const V = '203.0.113.0/24';
const L = '198.51.100.0/24';

describe('BGP: sessões', () => {
  it('as oito sessões passam por TCP, OPEN e KEEPALIVE até Established', () => {
    const tr = run({}, 'sessao');
    const t = (type: string) => tr.msgs.filter((m) => m.label === type);
    expect(t('SYN :179')).toHaveLength(8);
    expect(t('OPEN')).toHaveLength(16);
    expect(t('KEEPALIVE')).toHaveLength(16);
    expect(net(tr).links.every((l) => l.state === 'Established')).toBe(true);
    expect(tr.phases.map((p) => p.key).slice(0, 4)).toEqual(['tcp', 'open', 'ka', 'update']);
  });

  it('o OPEN leva o AS, o hold time e o router ID', () => {
    const tr = run({}, 'sessao');
    const open = tr.msgs.find((m) => m.label === 'OPEN')!;
    const flat = JSON.stringify(open.fields);
    expect(flat).toContain('180 s');
    expect(flat).toContain('BGP Identifier');
  });

  it('o vizinho silencioso só é percebido depois do hold timer, com NOTIFICATION de código 4', () => {
    const tr = run({ ev: 'hold', link: 'L5' }, 'sessao');
    const n = tr.msgs.find((m) => m.label === 'NOTIFICATION')!;
    expect(n).toBeTruthy();
    expect(n.from).toBe('C');
    expect(n.to).toBe('B');
    expect(JSON.stringify(n.fields)).toContain('Hold Timer Expired');
    const ka = tr.msgs.filter((m) => m.label === 'KEEPALIVE').pop()!;
    expect(n.tSend - ka.tSend).toBeGreaterThanOrEqual(180000);
    expect(net(tr).links.find((l) => l.id === 'L5')!.state).toBe('Idle');
  });
});

describe('BGP: decisão e exportação', () => {
  it('o Conteúdo chega ao Cliente pelo peering com o ISP B (AS_PATH mais curto)', () => {
    const tr = run({});
    expect(tr.raw.dc0).toBe('Conteúdo → ISP B → Cliente');
    expect(best(tr, 'D', V).reason).toBe('AS_PATH');
    expect(names(tr)).toBe('D>B>C');
  });

  it('o ISP A só tem um caminho para 198.51.100.0/24: o peer não repassa ao peer (valley-free)', () => {
    const tr = run({});
    expect(bestOf(net(tr), 'A', L).cands).toHaveLength(1);
    expect(bestOf(net(tr), 'B', L).cands).toHaveLength(2);
  });

  it('o Trânsito desempata os dois caminhos iguais pelo menor router ID (ISP A)', () => {
    const tr = run({});
    const b = best(tr, 'T', V);
    expect(b.from).toBe('A');
    expect(b.reason).toBe('router ID');
  });

  it('o AS_PATH ganha o número de cada AS e o NEXT_HOP muda a cada salto', () => {
    const tr = run({});
    const ups = tr.msgs.filter((m) => m.label === 'UPDATE' && String(m.info).startsWith(V));
    expect(ups.some((u) => String(u.info).includes('AS_PATH 64510 NEXT_HOP'))).toBe(true);
    expect(ups.some((u) => String(u.info).includes('AS_PATH 64500 64510'))).toBe(true);
    expect(ups.some((u) => String(u.info).includes('AS_PATH 64496 64500 64510'))).toBe(true);
  });
});

describe('BGP: política do Cliente', () => {
  it('LOCAL_PREF 200 nas rotas do ISP A faz o Cliente sair pelo ISP A, apesar do AS_PATH maior', () => {
    const tr = run({ lpA: 200, dir: 'CD' });
    expect(names(tr)).toBe('C>A>T>D');
    expect(best(tr, 'C', L).reason).toBe('LOCAL_PREF');
  });

  it('o prepend para o ISP B faz o tráfego entrar pelo ISP A', () => {
    const tr = run({ prependB: 3 });
    expect(names(tr)).toBe('D>T>A>C');
    expect(tr.msgs.some((m) => String(m.info).includes('AS_PATH 64510 64510 64510 64510'))).toBe(true);
  });
});

describe('BGP: eventos', () => {
  it('a queda de L5 reconverge pelo Trânsito e pelo ISP A', () => {
    const tr = run({ ev: 'down', link: 'L5' });
    expect(names(tr)).toBe('D>T>A>C');
    expect(tr.raw.evStats.withdraws).toBeGreaterThan(0);
    expect(net(tr).links.find((l) => l.id === 'L5')!.up).toBe(false);
  });

  it('a retirada do prefixo deixa o tráfego sem rota no Conteúdo', () => {
    const tr = run({ ev: 'retirar' });
    expect(tr.raw.fwd.ok).toBe(false);
    expect(tr.raw.fwd.at).toBe('D');
    expect(tr.msgs.some((m) => m.label === 'WITHDRAW')).toBe(true);
  });
});

describe('BGP: segurança e defesa', () => {
  const sec = (o: Partial<BgpParams>) => run({ attack: 'hijack', ...o }, 'seguranca');

  it('no sequestro, o ISP B e o Conteúdo usam a rota falsa e o tráfego é descartado pelo Atacante', () => {
    const tr = sec({});
    expect(tr.raw.reach).toEqual(['B', 'D']);
    expect(tr.raw.fwd).toMatchObject({ ok: false, attack: 'blackhole' });
    expect(names(tr)).toBe('D>B>M');
  });

  it('o filtro de prefixos no ISP B barra o sequestro; no Trânsito, não', () => {
    const ok = sec({ cust: 'B' });
    expect(ok.raw.reach).toEqual([]);
    expect(ok.raw.fwd.ok).toBe(true);
    expect(ok.raw.rejects.some((r: any) => r.by === 'cust' && r.at === 'B')).toBe(true);
    expect(sec({ cust: 'T' }).raw.reach).toEqual(['B', 'D']);
  });

  it('o ROV no ISP B barra o sequestro; só no ISP A, o Conteúdo continua desviado', () => {
    expect(sec({ rov: 'B' }).raw.reach).toEqual([]);
    const a = sec({ rov: 'A' });
    expect(a.raw.reach).toContain('D');
    expect(a.raw.fwd.ok).toBe(false);
  });

  it('no vazamento, o ISP A passa a usar o ISP B com LOCAL_PREF por relação; o filtro de peers desfaz', () => {
    const base = { attack: 'route-leak', dir: 'AD', relLP: true } as Partial<BgpParams>;
    expect(names(sec(base))).toBe('A>B>D');
    expect(names(sec({ ...base, peer: 'A' }))).toBe('A>T>D');
    expect(names(sec({ ...base, relLP: false }))).toBe('A>T>D');
  });

  it('o flapping repete retiradas e anúncios, e o damping suprime o prefixo', () => {
    const sem = sec({ attack: 'route-flap' });
    const com = sec({ attack: 'route-flap', damp: true });
    expect(sem.raw.stats.flaps).toBe(2);
    expect(sem.raw.stats.withdraws).toBeGreaterThan(0);
    expect(com.raw.suppressed).toBeGreaterThan(0);
    expect(com.raw.stats.updates).toBeLessThanOrEqual(sem.raw.stats.updates);
  });

  it('nos modos sem segurança, o ataque e as defesas são ignorados', () => {
    const tr = run({ attack: 'hijack', rov: 'ALL' }, 'rotas');
    expect(tr.raw.attack).toBe('none');
    expect(tr.raw.fwd.ok).toBe(true);
  });
});

describe('BGP: cenários e determinismo', () => {
  const defaults = Object.fromEntries(controls.map((c) => [c.id, c.def]));
  it.each(scenarios.map((s) => [s.id, s] as const))('o cenário %s monta o trace sem erro e é determinístico', (_id, s) => {
    const P = { ...defaults, ...s.set } as unknown as BgpParams;
    const a = buildBgp(P, s.sub);
    const b = buildBgp(P, s.sub);
    expect(a.msgs.length).toBeGreaterThan(0);
    expect(JSON.stringify(a.msgs)).toBe(JSON.stringify(b.msgs));
    expect(a.raw.snaps.length).toBeGreaterThan(3);
  });
});
