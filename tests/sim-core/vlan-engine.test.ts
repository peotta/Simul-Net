// Regras do motor de VLAN: classificação por porta, tags no tronco, VLAN nativa, roteamento entre VLANs e VLAN hopping.
import { describe, expect, it } from 'vitest';
import { scenarioParams, type Params } from '../../src/sim-core/ui';
import { controls } from '../../src/sims/vlan/content/controls';
import { scenarios } from '../../src/sims/vlan/content/scenarios';
import { HOSTS, makeNet, ping, spread, type MsgStep } from '../../src/sims/vlan/model';
import { vlanProtocol } from '../../src/sims/vlan/protocol';

const run = (id: string, over: Params = {}) => {
  const s = scenarios.find((x) => x.id === id)!;
  return vlanProtocol.build({ ...scenarioParams(controls, s), ...over }, s.sub);
};
const msgs = (tr: ReturnType<typeof run>) => tr.msgs.map((m) => `${m.from}>${m.to}:${m.label}`);

describe('propagação do quadro (modelo)', () => {
  it('a tag nasce no tronco e some na porta de acesso', () => {
    const sp = spread(makeNet(), 'a', ping(HOSTS.a, HOSTS.c));
    const m = sp.steps.filter((s): s is MsgStep => s.t === 'msg');
    expect(m.map((x) => x.wire.tags)).toEqual([[], [10], []]);
    expect(sp.delivered).toEqual(['c']);
  });

  it('o unicast conhecido não chega a hosts de outra VLAN', () => {
    const sp = spread(makeNet(), 'a', ping(HOSTS.a, HOSTS.c));
    expect(sp.ignored).toEqual([]);
  });

  it('uma VLAN fora da lista do tronco não passa', () => {
    const sp = spread(makeNet({ allowed: [20] }), 'a', ping(HOSTS.a, HOSTS.c));
    expect(sp.delivered).toEqual([]);
    expect(sp.dropped).toContain('sw1');
  });

  it('porta de acesso descarta uma tag de outra VLAN', () => {
    const w = ping(HOSTS.a, HOSTS.c);
    w.tags = [20];
    const sp = spread(makeNet(), 'a', w);
    expect(sp.delivered).toEqual([]);
    expect(sp.dropped).toEqual(['sw1']);
  });
});

describe('Marcação', () => {
  it('com a nativa em 1, o tronco leva a tag 10; com a nativa em 10, não leva tag', () => {
    expect(msgs(run('v-tag'))[1]).toContain('(tag 10)');
    expect(msgs(run('v-nat'))[1]).toContain('(sem tag)');
  });

  it('retirar a VLAN 10 do tronco isola o Host C', () => {
    const tr = run('v-poda');
    expect(tr.raw.res).toBe('blocked');
    expect(tr.raw.delivered).toEqual([]);
  });
});

describe('Segmentação', () => {
  it('o broadcast fica na VLAN 10', () => {
    const tr = run('s-bc');
    expect(tr.raw.delivered).toEqual(['c']);
    expect(tr.raw.ignored).toEqual([]);
  });

  it('um quadro para o MAC de B não sai da VLAN 10', () => {
    const tr = run('s-cross');
    expect(tr.raw.delivered).toEqual([]);
    expect(tr.raw.ignored).toEqual(['c']);
    expect(tr.raw.reachedOther).toEqual([]);
  });
});

describe('Roteamento entre VLANs', () => {
  it('sobe com a tag 10, volta com a 20 e o TTL cai em 1', () => {
    const tr = run('r-b');
    expect(tr.raw.res).toBe('ok');
    expect(msgs(tr)).toEqual(['a>sw1:Echo Request (sem tag)', 'sw1>r1:Echo Request (tag 10)', 'r1>sw1:Echo Request (tag 20)', 'sw1>b:Echo Request (sem tag)']);
    expect(tr.raw.ttlOut).toBe(tr.raw.ttlIn - 1);
  });

  it('com destino no outro switch, o quadro de volta cruza o tronco', () => {
    expect(msgs(run('r-d'))).toContain('sw1>sw2:Echo Request (tag 20)');
  });

  it('sem a subinterface da VLAN 20, o R1 responde com ICMP inalcançável', () => {
    const tr = run('r-nosub');
    expect(tr.raw.res).toBe('noroute');
    expect(msgs(tr).some((m) => m.startsWith('sw1>a:Net Unreachable'))).toBe(true);
    expect(tr.raw.delivered).not.toContain('b');
  });

  it('com o tronco do R1 sem a VLAN 20, o SW1 descarta o quadro de volta', () => {
    const tr = run('r-poda');
    expect(tr.raw.res).toBe('poda');
    expect(tr.msgs[tr.msgs.length - 1].lost).toBe(true);
  });
});

describe('VLAN nativa', () => {
  it('pontas iguais entregam', () => expect(run('n-ok').raw.res).toBe('ok-untag'));

  it('pontas diferentes mandam o quadro sem tag para outra VLAN', () => {
    const tr = run('n-mis');
    expect(tr.raw.res).toBe('leak');
    expect(tr.raw.delivered).toEqual([]);
    expect(tr.raw.leakedTo).toEqual(['d']);
  });

  it('o quadro com tag não é afetado pela divergência', () => expect(run('n-b').raw.res).toBe('ok-tag'));
});

describe('VLAN hopping', () => {
  it('a porta dinâmica vira tronco e o quadro chega à VLAN 20', () => {
    const tr = run('h-spoof');
    expect(tr.raw.res).toBe('spoof-ok');
    expect(tr.raw.delivered).toEqual(['d']);
    expect(tr.raw.net.ports['sw1:5'].mode).toBe('trunk');
  });

  it('a porta fixa em acesso barra o ataque', () => {
    const tr = run('h-spoof-def');
    expect(tr.raw.res).toBe('spoof-def');
    expect(tr.raw.delivered).toEqual([]);
    expect(tr.raw.net.ports['sw1:5'].mode).toBe('access');
  });

  it('duas tags: a externa some na nativa e a interna vale no segundo switch', () => {
    const tr = run('h-dbl');
    expect(tr.raw.res).toBe('dbl-ok');
    expect(tr.raw.delivered).toEqual(['d']);
    expect(msgs(tr)).toContain('sw1>sw2:Echo Request (tag 20)');
  });

  it('a nativa em VLAN sem uso mantém as duas tags e nada chega à VLAN 20', () => {
    const tr = run('h-dbl-def');
    expect(tr.raw.res).toBe('dbl-def');
    expect(tr.raw.delivered).toEqual([]);
    expect(msgs(tr)).toContain('sw1>sw2:Echo Request (tags 10 e 20)');
  });
});

describe('integridade', () => {
  it('nenhum passo cai fora das colunas do diagrama', () => {
    scenarios.forEach((s) => expect(run(s.id).raw.hidden, s.id).toBe(0));
  });
});
