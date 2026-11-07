// Regras do motor de OSPF: SPF por menor custo, inundação de LSAs, reação a custo e falha, multiárea e Summary LSAs.
import { describe, expect, it } from 'vitest';
import { liveLinks, MULTI, SINGLE } from '../../src/sims/roteamento-base/topologia';
import { convergedLsdb, floodRounds, forwardPath, newLsdb, routeTable, routerItems, summaryItems } from '../../src/sims/ospf/model';
import { buildConv, buildEvento, buildMulti } from '../../src/sims/ospf/modes';

describe('OSPF: área única', () => {
  it('o caminho de PC-A a PC-B é R1, R2, R3, R6 com custo 30 (e não o de menos saltos)', () => {
    const fp = forwardPath(SINGLE, liveLinks(SINGLE), 'R1', 'R6');
    expect(fp.path).toEqual(['R1', 'R2', 'R3', 'R6']);
    expect(fp.cost).toBe(30);
  });

  it('a inundação deixa as seis LSDBs idênticas', () => {
    const links = liveLinks(SINGLE);
    const db = newLsdb(SINGLE);
    routerItems(SINGLE, links).forEach((it) => db[it.owner].set(it.key, it));
    const rounds = floodRounds(SINGLE, links, db, '0');
    expect(rounds.length).toBeGreaterThanOrEqual(2);
    SINGLE.routers.forEach((r) => expect(db[r.id].size).toBe(6));
  });

  it('a tabela de R1 tem custo e próximo salto para todos os destinos', () => {
    const rows = routeTable(SINGLE, liveLinks(SINGLE), 'R1');
    expect(rows.find((r) => r.dest === 'R5')).toMatchObject({ cost: 25, next: 'R2' });
    expect(rows.find((r) => r.dest === 'R4')).toMatchObject({ cost: 20, next: 'R4' });
  });

  it('o modo de convergência passa por Hello, adjacência, inundação e SPF, e entrega o pacote', () => {
    const tr = buildConv({ dir: 'PC-A' });
    expect(tr.phases.map((p) => p.key)).toEqual(['hello', 'adj', 'flood', 'spf', 'pacote', 'resultado']);
    expect(tr.raw.res).toBe('ok');
    expect(tr.raw.fp.path).toEqual(['R1', 'R2', 'R3', 'R6']);
    expect(tr.msgs.filter((m) => m.label === 'Hello').length).toBe(14);
  });
});

describe('OSPF: evento', () => {
  it('custo 50 em R2 / R3 desvia o tráfego para R2, R5, R6 (custo 45)', () => {
    const tr = buildEvento({ dir: 'PC-A', ev: 'custo', link: 'L3', custo: 50, link2: 'none' });
    expect(tr.raw.before.path).toEqual(['R1', 'R2', 'R3', 'R6']);
    expect(tr.raw.after.path).toEqual(['R1', 'R2', 'R5', 'R6']);
    expect(tr.raw.after.cost).toBe(45);
    expect(tr.raw.res).toBe('rerouted');
    expect(tr.raw.changed).toEqual(['L3']);
  });

  it('só os dois roteadores do enlace originam novos LSAs, com sequência maior', () => {
    const tr = buildEvento({ dir: 'PC-A', ev: 'queda', link: 'L3', custo: 10, link2: 'none' });
    const novos = tr.raw.lsdbLog.filter((x: any) => x.item.seq === 2 && x.item.owner === x.at).map((x: any) => x.at);
    expect(novos.sort()).toEqual(['R2', 'R3']);
    expect(tr.raw.everyone).toBe(true);
    expect(tr.raw.after.path).toEqual(['R1', 'R2', 'R5', 'R6']);
  });

  it('derrubar L5 e L7 isola o PC-B e o pacote é descartado', () => {
    const tr = buildEvento({ dir: 'PC-A', ev: 'queda', link: 'L5', custo: 10, link2: 'L7' });
    expect(tr.raw.res).toBe('partition');
    expect(tr.raw.after.reached).toBe(false);
  });

  it('o mesmo custo não muda nada', () => {
    const tr = buildEvento({ dir: 'PC-A', ev: 'custo', link: 'L3', custo: 10, link2: 'none' });
    expect(tr.raw.res).toBe('same');
  });
});

describe('OSPF: multiárea', () => {
  it('o caminho de PC-A a PC-B atravessa o backbone pelos ABRs: R1, R2, R4, R8, R7', () => {
    const fp = forwardPath(MULTI, liveLinks(MULTI), 'R1', 'R7');
    expect(fp.path).toEqual(['R1', 'R2', 'R4', 'R8', 'R7']);
    expect(fp.cost).toBe(65);
  });

  it('um roteador interno aprende as outras áreas como rotas inter-área, via ABR', () => {
    const rows = routeTable(MULTI, liveLinks(MULTI), 'R1');
    expect(rows.find((r) => r.dest === 'R2')?.kind).toBe('intra');
    expect(rows.find((r) => r.dest === 'R7')).toMatchObject({ kind: 'inter', cost: 65, via: 'R2' });
    expect(rows.find((r) => r.dest === 'R4')).toMatchObject({ kind: 'inter', via: 'R2' });
  });

  it('as áreas têm LSDBs diferentes: R1 não tem o Router-LSA de R7, só um Summary LSA', () => {
    const tr = buildMulti({ dir: 'PC-A', mlink: 'none' });
    const lsdbDeR1 = tr.raw.lsdbLog.filter((x: any) => x.at === 'R1').map((x: any) => x.item.key);
    expect(lsdbDeR1.some((k: string) => k.startsWith('R7@'))).toBe(false);
    expect(lsdbDeR1.some((k: string) => k.startsWith('S:') && k.endsWith(':R7'))).toBe(true);
    expect(tr.raw.res).toBe('ok');
  });

  it('só os ABRs originam Summary LSAs, e o backbone não recebe as rotas do próprio backbone', () => {
    const sums = summaryItems(MULTI, liveLinks(MULTI));
    expect(new Set(sums.map((s) => s.owner))).toEqual(new Set(['R2', 'R3', 'R8', 'R9']));
    expect(sums.filter((s) => s.area === '0').every((s) => ['R1', 'R7'].includes(s.dest!))).toBe(true);
  });

  it('com o enlace R4 / R8 fora de serviço o tráfego passa por R6 e R9', () => {
    const tr = buildMulti({ dir: 'PC-A', mlink: 'MA12' });
    expect(tr.raw.fp.reached).toBe(true);
    expect(tr.raw.fp.path).toContain('R9');
  });

  it('o convergedLsdb de uma rede íntegra tem um Router-LSA por roteador e área em cada LSDB da área', () => {
    const db = convergedLsdb(MULTI, liveLinks(MULTI));
    expect(db.R1.size).toBe(3);
    expect(db.R2.size).toBe(10);
  });
});
