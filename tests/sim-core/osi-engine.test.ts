// Regras do simulador OSI: verificadores reais (CRC-32, checksum do IPv4), encapsulamento, o que muda a cada salto
// e o efeito de cada defeito por camada.
import { describe, expect, it } from 'vitest';
import { buildFrame, crc32, csum, httpRequest, NODE } from '../../src/sims/osi/model';
import { buildOsi, type FrameRec, type OsiParams } from '../../src/sims/osi/modes';
import { osiProtocol } from '../../src/sims/osi/protocol';
import { prepare } from '../../src/sim-core';
import { scenarioParams } from '../../src/sim-core/ui';

const run = (over: Partial<OsiParams>, sub: string) => buildOsi({ rtt: 12, vlan: false, ...over }, sub);
const frames = (tr: ReturnType<typeof run>) => tr.raw.frames as FrameRec[];

describe('verificadores', () => {
  it('CRC-32 do IEEE 802.3 confere com o vetor de teste padrão', () => {
    expect(crc32(Array.from('123456789').map((c) => c.charCodeAt(0)))).toBe(0xcbf43926);
  });
  it('checksum do IPv4 confere com o exemplo clássico', () => {
    const h = [0x45, 0, 0, 0x73, 0, 0, 0x40, 0, 0x40, 0x11, 0, 0, 0xc0, 0xa8, 0, 1, 0xc0, 0xa8, 0, 0xc7];
    expect(csum(h)).toBe(0xb861);
  });
  it('o quadro tem o FCS correto, o mínimo de 64 bytes e o checksum do IP fecha em zero', () => {
    const f = buildFrame({ dmac: NODE.rtl.mac, smac: NODE.cli.mac, vid: null, sip: NODE.cli.ip, dip: NODE.srv.ip, ttl: 64, id: 1, l4: 'tcp', sport: 49152, dport: 8080, flags: ['SYN'], seq: 1000, ack: 0, win: 64240 });
    expect(f.sizes.l2).toBe(64);
    expect(f.fcsOk).toBe(true);
    const ip = f.segs.find((s) => s.key === 'ip')!;
    expect(csum(f.bytes.slice(ip.off, ip.off + 20))).toBe(0);
    expect(crc32(f.bytes.slice(0, f.bytes.length - 4))).toBe(f.fcs);
  });
  it('a etiqueta 802.1Q acrescenta 4 bytes e muda o FCS', () => {
    const base = { dmac: NODE.rtl.mac, smac: NODE.cli.mac, sip: NODE.cli.ip, dip: NODE.srv.ip, ttl: 64, id: 1, l4: 'tcp' as const, sport: 49152, dport: 80, flags: ['PSH', 'ACK'], seq: 1001, ack: 5001, win: 64240, http: httpRequest('/') };
    const a = buildFrame({ ...base, vid: null });
    const b = buildFrame({ ...base, vid: 10 });
    expect(b.bytes.length).toBe(a.bytes.length + 4);
    expect(b.fcs).not.toBe(a.fcs);
    expect(b.segs.some((s) => s.key === 'vlan')).toBe(true);
  });
  it('um bit alterado faz o FCS recalculado não conferir', () => {
    const f = buildFrame({ dmac: NODE.rtl.mac, smac: NODE.cli.mac, vid: null, sip: NODE.cli.ip, dip: NODE.srv.ip, ttl: 64, id: 1, l4: 'tcp', sport: 49152, dport: 80, flags: ['PSH', 'ACK'], seq: 1001, ack: 5001, win: 64240, http: httpRequest('/') }, null, true);
    expect(f.fcsOk).toBe(false);
    expect(f.fcsCalc).not.toBe(f.fcs);
  });
});

describe('jornada normal', () => {
  const tr = run({}, 'jor');
  const fr = frames(tr);
  it('tem três saltos na ida e três na volta', () => {
    expect(fr.map((f) => f.dir + f.hop)).toEqual(['req1', 'req2', 'req3', 'resp1', 'resp2', 'resp3']);
    expect(tr.raw.result).toBe('ok');
  });
  it('o TTL cai um no roteador e os MACs mudam, mas o IP não', () => {
    expect(fr[0].ttl).toBe(64);
    expect(fr[2].ttl).toBe(63);
    expect(fr[0].dmac).not.toBe(fr[2].dmac);
    expect(fr[0].ipSum).not.toBe(fr[2].ipSum);
    expect(fr[0].sip).toBe(fr[2].sip);
    expect(fr[0].dip).toBe(fr[2].dip);
  });
  it('os sete níveis aparecem no cliente e só dois no switch', () => {
    const st = tr.raw.steps as { who: string; layers: number[] }[];
    const of = (w: string) => new Set(st.filter((s) => s.who === w).flatMap((s) => s.layers));
    expect(Array.from(of('cli')).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(Array.from(of('sw')).sort()).toEqual([1, 2]);
    expect(Array.from(of('rt')).sort()).toEqual([1, 2, 3]);
  });
  it('sem VLAN, nenhum quadro é etiquetado; com VLAN, só o salto de tronco', () => {
    expect(fr.every((f) => f.vid === null)).toBe(true);
    const v = frames(run({ vlan: true }, 'jor'));
    expect(v.map((f) => f.vid)).toEqual([null, 10, null, null, 10, null]);
    expect(v[1].sizes.l2).toBe(v[0].sizes.l2 + 4);
  });
});

describe('palco (vistas 1 e 2)', () => {
  const tr = run({}, 'jor');
  const end = prepare(tr);
  const steps = tr.raw.steps as { t: number }[];
  it('é função pura do trace e do relógio e funciona em qualquer instante', () => {
    for (let c = 0; c <= end; c += 0.37) {
      const h = osiProtocol.stage!(tr, c);
      expect(h).toContain('osi-svg');
      expect(h).toContain('osi-onion');
      expect(osiProtocol.stage!(tr, c)).toBe(h);
    }
  });
  it('no início só há os dados; no meio da descida o quadro já está completo', () => {
    const first = osiProtocol.stage!(tr, 0);
    expect(first).toContain('Camadas 5 a 7: dados');
    expect(first).not.toContain('Camada 2: quadro');
    const idx = tr.events.findIndex((e) => e.text.startsWith('L1 bits'));
    const r = tr.events[idx].r as number;
    expect(osiProtocol.stage!(tr, r)).toContain('Camada 2: quadro');
  });
  it('o roteador retira o quadro (camada 2) antes de refazê-lo', () => {
    const i = tr.events.findIndex((e) => e.who === 'rt' && e.text.startsWith('L3'));
    const h = osiProtocol.stage!(tr, tr.events[i].r as number);
    expect(h).not.toContain('Camada 2: quadro');
    expect(h).toContain('Camada 3: pacote');
  });
  it('há um passo por evento e o modo único não tem topologia', () => {
    expect(steps.length).toBe(tr.events.length);
    expect(osiProtocol.topology).toBeUndefined();
  });
});

describe('determinismo e cenários', () => {
  it('o mesmo parâmetro produz o mesmo trace', () => {
    expect(JSON.stringify(run({ vlan: true }, 'jor'))).toBe(JSON.stringify(run({ vlan: true }, 'jor')));
  });
  it('todos os cenários constroem um trace com mensagens e texto de experimento', () => {
    osiProtocol.scenarios.forEach((s) => {
      const P = scenarioParams(osiProtocol.controls, s);
      const tr = osiProtocol.build(P, s.sub);
      expect(tr.msgs.length, s.id).toBe(6);
      expect(osiProtocol.explain(tr, P, s).length, s.id).toBeGreaterThan(50);
    });
  });
});
