// Regras do motor de RIPv2: métrica em saltos, rodadas de Response, split horizon, falha e contagem ao infinito.
import { describe, expect, it } from 'vitest';
import { liveLinks, SINGLE } from '../../src/sims/roteamento-base/topologia';
import { advertise, converge, INF, initTables, ripPath, ripRound } from '../../src/sims/rip/model';
import { buildConv, buildFalha } from '../../src/sims/rip/modes';

const conv = (down: string[] = [], sh = true) => converge(SINGLE, liveLinks(SINGLE, down), initTables(SINGLE), sh);

describe('RIPv2: convergência', () => {
  it('cada roteador começa conhecendo só a si mesmo, com métrica 0', () => {
    const tb = initTables(SINGLE);
    expect(tb.R1.size).toBe(1);
    expect(tb.R1.get('R1')).toEqual({ metric: 0, next: null });
  });

  it('a primeira rodada ensina os vizinhos diretos, com métrica 1', () => {
    const r = ripRound(SINGLE, liveLinks(SINGLE), initTables(SINGLE), true);
    expect(r.next.R1.get('R2')).toEqual({ metric: 1, next: 'R2' });
    expect(r.next.R1.get('R3')).toBeUndefined();
  });

  it('o caminho de PC-A a PC-B tem 3 saltos: R1, R2, R3, R6', () => {
    const { tables } = conv();
    const p = ripPath(tables, 'R1', 'R6');
    expect(p.path).toEqual(['R1', 'R2', 'R3', 'R6']);
    expect(p.metric).toBe(3);
  });

  it('o custo do enlace é ignorado: com custo 50 em R2 / R3 o caminho continua o mesmo', () => {
    const tr = buildConv({ dir: 'PC-A', cost23: 50, sh: true });
    expect(tr.raw.fp.path).toEqual(['R1', 'R2', 'R3', 'R6']);
    expect(tr.raw.cmp.path).toEqual(['R1', 'R2', 'R5', 'R6']);
    expect(tr.raw.ripCost).toBe(70);
  });

  it('com split horizon, o vetor volta ao vizinho de quem foi aprendido com métrica 16', () => {
    const { tables } = conv();
    const vec = advertise(tables.R2, 'R3', true);
    expect(vec.get('R6')).toBe(INF);
    expect(advertise(tables.R2, 'R3', false).get('R6')).toBe(2);
  });

  it('o modo de convergência termina com uma rodada sem mudança e entrega o pacote', () => {
    const tr = buildConv({ dir: 'PC-A', cost23: 10, sh: true });
    expect(tr.raw.res).toBe('ok');
    expect(tr.raw.rounds).toBe(tr.raw.roundsChanged + 1);
    expect(tr.raw.fp.reached).toBe(true);
  });
});

describe('RIPv2: falha', () => {
  it('derrubar R2 / R3 faz o tráfego passar por R4 e R5 e o destino continua alcançável', () => {
    const tr = buildFalha({ dir: 'PC-A', link: 'L3', link2: 'none', sh: true });
    expect(tr.raw.before.path).toEqual(['R1', 'R2', 'R3', 'R6']);
    expect(tr.raw.after.path).toEqual(['R1', 'R4', 'R5', 'R6']);
    expect(tr.raw.res).toBe('rerouted');
    expect(tr.raw.capHit).toBe(false);
  });

  it('isolar o PC-B (L5 e L7 caídos) deixa as rotas para R6 em 16 em todos os roteadores', () => {
    const tr = buildFalha({ dir: 'PC-A', link: 'L5', link2: 'L7', sh: true });
    expect(tr.raw.res).toBe('partition');
    const fim = tr.raw.snaps[tr.raw.snaps.length - 1].tables;
    ['R1', 'R2', 'R3', 'R4', 'R5'].forEach((r) => expect(fim[r].R6.metric).toBe(INF));
  });

  it('sem split horizon, a contagem ao infinito leva várias rodadas; com split horizon, também nesta topologia', () => {
    const sem = buildFalha({ dir: 'PC-A', link: 'L5', link2: 'L7', sh: false });
    const com = buildFalha({ dir: 'PC-A', link: 'L5', link2: 'L7', sh: true });
    expect(sem.raw.roundsChanged).toBeGreaterThan(8);
    expect(com.raw.roundsChanged).toBeGreaterThan(3);
    expect(sem.raw.roundsChanged).toBeGreaterThanOrEqual(com.raw.roundsChanged);
  });

  it('uma falha fora do caminho não muda o caminho', () => {
    const tr = buildFalha({ dir: 'PC-A', link: 'L7', link2: 'none', sh: true });
    expect(tr.raw.res).toBe('same');
  });
});
