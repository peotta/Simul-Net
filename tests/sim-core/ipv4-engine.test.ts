// Regras do simulador IPv4: aritmética de endereços, prefixo mais específico, TTL, uRPF e a decisão do host.
import { describe, expect, it } from 'vitest';
import { bcastOf, classify, commonBits, hostCount, ipv4Header, lookup, maskStr, netOf, type Route } from '../../src/sims/ipv4/model';
import { buildFwd, tablesFor, type FwdParams, type LookupRec } from '../../src/sims/ipv4/fwd';
import { buildEnd, type EndParams } from '../../src/sims/ipv4/end';
import { csum } from '../../src/sims/osi/model';

const F = (o: Partial<FwdParams> = {}): FwdParams => ({ hop: 2, dest: 'srv1', ttl: 64, agg: true, dfl: true, loopf: false, bh: false, back: true, dup: 'none', urpf: 'off', spoof: false, ...o });
const E = (o: Partial<EndParams> = {}): EndParams => ({ hop: 2, dest: 'b', mask: 24, gw: 'ok', ovl: false, dbfw: false, ...o });
const fwd = (o: Partial<FwdParams> = {}) => buildFwd(F(o), 'fwd');
const end = (o: Partial<EndParams> = {}) => buildEnd(E(o), 'end');
const lks = (tr: ReturnType<typeof fwd>) => tr.raw.lk as LookupRec[];

describe('aritmética de endereços', () => {
  it('máscara, rede e broadcast de prefixos conhecidos', () => {
    expect(maskStr(24)).toBe('255.255.255.0');
    expect(maskStr(19)).toBe('255.255.224.0');
    expect(maskStr(0)).toBe('0.0.0.0');
    expect(netOf('192.168.10.77', 26)).toBe('192.168.10.64');
    expect(bcastOf('192.168.10.77', 26)).toBe('192.168.10.127');
    expect(bcastOf('10.20.0.1', 24)).toBe('10.20.0.255');
  });
  it('quantidade de hosts: /31 tem dois (RFC 3021) e /32 um', () => {
    expect(hostCount(24)).toBe(254);
    expect(hostCount(30)).toBe(2);
    expect(hostCount(31)).toBe(2);
    expect(hostCount(32)).toBe(1);
  });
  it('bits em comum entre endereços', () => {
    expect(commonBits('10.2.5.20', '10.2.5.0')).toBe(27);
    expect(commonBits('10.2.5.20', '10.2.5.20')).toBe(32);
    expect(commonBits('10.2.5.20', '198.51.100.9')).toBe(0);
  });
  it('classificação dos blocos especiais', () => {
    expect(classify('10.1.1.1').nome).toBe('Uso privado');
    expect(classify('100.64.5.5').rfc).toBe('RFC 6598');
    expect(classify('169.254.10.5').nome).toBe('Link-local');
    expect(classify('192.0.2.7').rfc).toBe('RFC 5737');
    expect(classify('255.255.255.255').nome).toBe('Broadcast limitado');
    expect(classify('8.8.8.8').publico).toBe(true);
  });
  it('o cabeçalho IPv4 fecha o checksum em zero e usa o exemplo clássico', () => {
    const h = ipv4Header({ len: 0x73, id: 0, ttl: 64, proto: 0x11, src: '192.168.0.1', dst: '192.168.0.199' });
    expect(csum(h.bytes)).toBe(0);
    expect(h.bytes[8]).toBe(64);
    expect(h.bytes.length).toBe(20);
  });
});

describe('busca na tabela de rotas', () => {
  const rt = (net: string, len: number, ad: number, metric: number): Route => ({ net, len, kind: 'via', via: '1.1.1.1', iface: 'e', proto: 'S', ad, metric });
  it('vence o maior prefixo, mesmo declarado antes', () => {
    const t = [rt('0.0.0.0', 0, 1, 0), rt('10.0.0.0', 8, 1, 0), rt('10.2.0.0', 16, 1, 0)];
    const l = lookup(t, '10.2.5.20');
    expect(l.matches).toEqual([0, 1, 2]);
    expect(l.winner).toBe(2);
  });
  it('em empate de prefixo vence a menor distância administrativa e depois a menor métrica', () => {
    expect(lookup([rt('10.0.0.0', 8, 110, 5), rt('10.0.0.0', 8, 1, 50)], '10.1.1.1').winner).toBe(1);
    expect(lookup([rt('10.0.0.0', 8, 110, 30), rt('10.0.0.0', 8, 110, 20)], '10.1.1.1').winner).toBe(1);
  });
  it('sem rota que case, não há vencedora', () => {
    expect(lookup([rt('10.0.0.0', 8, 1, 0)], '172.16.0.1').winner).toBe(-1);
  });
});

describe('encaminhamento', () => {
  it('o ping ao SRV1 funciona e o R2 escolhe o /16 entre duas rotas que casam', () => {
    const tr = fwd();
    expect(tr.raw.result).toBe('ok');
    const r2 = lks(tr).find((l) => l.n === 'r2' && l.d === '10.2.1.20')!;
    expect(r2.m.length).toBe(2);
    expect(tablesFor(F()).r2[r2.w].len).toBe(16);
  });
  it('o ping ao SRV2 casa com três rotas em R2 e vence o /24', () => {
    const tr = fwd({ dest: 'srv2' });
    const r2 = lks(tr).find((l) => l.n === 'r2' && l.d === '10.2.5.20')!;
    expect(r2.m.length).toBe(3);
    expect(tablesFor(F()).r2[r2.w].len).toBe(24);
    expect(tr.raw.result).toBe('ok');
  });
  it('o TTL cai um por roteador e o pacote chega com TTL 61 na ida', () => {
    const tr = fwd();
    const ida = tr.raw.pk.filter((p: { src: string }) => p.src === '10.1.1.10');
    expect(ida.map((p: { ttl: number }) => p.ttl)).toEqual([64, 63, 62, 61]);
  });
  it('TTL 3 expira no R3 e a origem recebe o ICMP 11/0', () => {
    const tr = fwd({ ttl: 3 });
    expect(tr.raw.result).toBe('ttl');
    expect(tr.raw.pk.some((p: { ty: number; co: number }) => p.ty === 11 && p.co === 0)).toBe(true);
    expect(tr.raw.errFrom).toBe('10.0.23.2');
  });
  it('TTL 1 expira já no primeiro roteador', () => {
    const tr = fwd({ ttl: 1 });
    expect(tr.raw.result).toBe('ttl');
    expect(tr.raw.errFrom).toBe('10.1.1.1');
  });
  it('sem rota no R3, o aviso é ICMP 3/0', () => {
    const tr = fwd({ dest: 'nonet' });
    expect(tr.raw.result).toBe('unreach');
    expect(tr.raw.errFrom).toBe('10.0.23.2');
  });
  it('sem a rota agregada e sem rota padrão, quem avisa é o R2', () => {
    const tr = fwd({ agg: false, dfl: false });
    expect(tr.raw.result).toBe('unreach');
    expect(tr.raw.errFrom).toBe('10.0.12.2');
  });
  it('sem a rota agregada mas com padrão, o pacote vaza pela borda', () => {
    expect(fwd({ agg: false }).raw.result).toBe('borda');
  });
  it('o destino da internet segue as rotas padrão até o provedor', () => {
    const tr = fwd({ dest: 'inet' });
    expect(tr.raw.result).toBe('borda');
    expect(tr.cols.some((c) => c.key === 'isp')).toBe(true);
    expect(tr.cols.some((c) => c.key === 'dst')).toBe(false);
  });
  it('rotas padrão apostas entre R2 e R3 formam um loop cortado pelo TTL', () => {
    const tr = fwd({ dest: 'nonet', loopf: true, ttl: 8 });
    expect(tr.raw.result).toBe('ttl');
    const vistos = lks(tr).filter((l) => l.d === '10.2.9.9').map((l) => l.n);
    expect(vistos.filter((n) => n === 'r2').length).toBeGreaterThan(1);
    expect(vistos.filter((n) => n === 'r3').length).toBeGreaterThan(1);
  });
  it('a rota blackhole descarta em silêncio e a origem não recebe nada', () => {
    const tr = fwd({ dest: 'nonet', bh: true });
    expect(tr.raw.result).toBe('blackhole');
    expect(tr.raw.gotErr).toBeNull();
  });
  it('sem rota de volta, a ida é entregue e a resposta se perde', () => {
    const tr = fwd({ back: false });
    expect(tr.raw.result).toBe('noback');
    expect(tr.raw.reqDelivered).toBe(true);
  });
  it('distância administrativa: a estática (1) vence a OSPF (110) no mesmo prefixo', () => {
    const tr = fwd({ dest: 'srv2', dup: 'ad' });
    const r2 = lks(tr).find((l) => l.n === 'r2' && l.d === '10.2.5.20')!;
    const t = tablesFor(F({ dup: 'ad' })).r2;
    expect(r2.m.filter((i) => t[i].len === 24).length).toBe(2);
    expect(t[r2.w].proto).toBe('S');
    expect(tr.raw.result).toBe('ok');
  });
  it('métrica: a rota OSPF de menor métrica vence', () => {
    const tr = fwd({ dup: 'metric' });
    const r2 = lks(tr).find((l) => l.n === 'r2' && l.d === '10.2.1.20')!;
    expect(tablesFor(F({ dup: 'metric' })).r2[r2.w].metric).toBe(20);
    expect(tr.raw.result).toBe('ok');
  });
});

describe('uRPF e origem forjada', () => {
  it('sem uRPF a origem forjada passa e a resposta não volta para quem enviou', () => {
    const tr = fwd({ spoof: true });
    expect(tr.raw.result).toBe('spoof');
  });
  it('o uRPF estrito descarta a origem forjada na entrada do R1', () => {
    const tr = fwd({ spoof: true, urpf: 'strict' });
    expect(tr.raw.result).toBe('urpf');
    expect(tr.raw.reqDelivered).toBe(false);
  });
  it('o uRPF flexível aceita a origem forjada porque a rota padrão cobre qualquer endereço', () => {
    const tr = fwd({ spoof: true, urpf: 'loose' });
    expect(tr.raw.result).toBe('spoof');
    expect(tr.raw.notes).toContain('looseDefault');
  });
  it('o uRPF estrito não atrapalha a origem legítima', () => {
    expect(fwd({ urpf: 'strict' }).raw.result).toBe('ok');
  });
});

describe('endereçamento', () => {
  it('destino na mesma sub-rede: ARP do destino e resposta direta, sem roteador', () => {
    const tr = end();
    expect(tr.raw.result).toBe('ok');
    expect(tr.raw.onLink).toBe(true);
    expect(tr.msgs.some((m) => m.from === 'r' || m.to === 'r')).toBe(false);
  });
  it('destino remoto: o ARP é do gateway e o pacote passa pelo roteador', () => {
    const tr = end({ dest: 'srv' });
    expect(tr.raw.result).toBe('ok');
    expect(tr.raw.onLink).toBe(false);
    expect(tr.msgs[0].proto).toBe('ARP');
    expect(tr.msgs[0].to).toBe('r');
  });
  it('sem gateway ou com gateway fora da sub-rede, nada vai ao roteador e só o controle local funciona', () => {
    const a = end({ dest: 'srv', gw: 'none' });
    const b = end({ dest: 'srv', gw: 'outside' });
    expect(a.raw.result).toBe('nonet');
    expect(b.raw.result).toBe('badgw');
    expect(a.msgs.some((m) => m.from === 'r' || m.to === 'r')).toBe(false);
    expect(b.msgs.some((m) => m.from === 'r' || m.to === 'r')).toBe(false);
    expect(a.msgs.some((m) => m.proto === 'ICMP')).toBe(true);
  });
  it('máscara larga demais: o host trata o destino remoto como vizinho e o ARP falha três vezes', () => {
    const tr = end({ dest: 'other', mask: 16 });
    expect(tr.raw.onLink).toBe(true);
    expect(tr.raw.result).toBe('arpfail');
    expect(tr.raw.arpTries).toBe(3);
  });
  it('com a máscara certa, o mesmo destino vai ao gateway e recebe ICMP 3/0', () => {
    const tr = end({ dest: 'other' });
    expect(tr.raw.onLink).toBe(false);
    expect(tr.raw.result).toBe('unreach');
  });
  it('sub-redes sobrepostas no roteador: o /25 tira o servidor do /24 do ar', () => {
    expect(end({ dest: 'srv200' }).raw.result).toBe('ok');
    const tr = end({ dest: 'srv200', ovl: true });
    expect(tr.raw.result).toBe('hostunreach');
    expect(tr.raw.rl.m.length).toBe(2);
  });
  it('enlace /31 entrega ao servidor no endereço .1', () => {
    expect(end({ dest: 'srv31' }).raw.result).toBe('ok');
  });
  it('broadcast limitado e da sub-rede ficam no enlace', () => {
    expect(end({ dest: 'lbcast' }).raw.result).toBe('lbcast');
    expect(end({ dest: 'bcast' }).raw.result).toBe('bcast');
  });
  it('broadcast dirigido é bloqueado por padrão e só é encaminhado se ligado', () => {
    expect(end({ dest: 'dbcast' }).raw.result).toBe('dbdrop');
    expect(end({ dest: 'dbcast', dbfw: true }).raw.result).toBe('dbfwd');
  });
  it('link-local não é encaminhado', () => {
    expect(end({ dest: 'll' }).raw.result).toBe('dropped');
  });
  it('blocos reservados sem rota recebem ICMP 3/0', () => {
    expect(end({ dest: 'cgnat' }).raw.result).toBe('unreach');
    expect(end({ dest: 'doc' }).raw.result).toBe('unreach');
  });
  it('o mesmo parâmetro produz o mesmo trace', () => {
    expect(JSON.stringify(fwd({ spoof: true, urpf: 'loose' }))).toBe(JSON.stringify(fwd({ spoof: true, urpf: 'loose' })));
    expect(JSON.stringify(end({ dest: 'srv200', ovl: true }))).toBe(JSON.stringify(end({ dest: 'srv200', ovl: true })));
  });
});
