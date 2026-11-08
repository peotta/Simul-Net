// Regras do simulador IPv6: aritmética de endereços de 128 bits, EUI-64, nó solicitado, prefixo mais específico, Hop Limit,
// Neighbor Discovery, SLAAC e DAD.
import { describe, expect, it } from 'vitest';
import { classify6, commonBits6, eui64, fmt6, full6, ipv6Header, linkLocalOf, lookup6, mcastMac6, norm6, parse6, scope6, solicited6, withPrefix } from '../../src/sims/ipv6/model';
import { buildFwd, tablesFor, type FwdParams, type LookupRec } from '../../src/sims/ipv6/fwd';
import { buildEnd, type EndParams } from '../../src/sims/ipv6/end';

const F = (o: Partial<FwdParams> = {}): FwdParams => ({ hop: 2, dest: 'srv1', hl: 64, agg: true, dfl: true, back: true, ...o });
const E = (o: Partial<EndParams> = {}): EndParams => ({ hop: 2, iid: 'eui64', ra: true, pfx: 64, aflag: true, dad: 'ok', dest: 'b', ...o });
const fwd = (o: Partial<FwdParams> = {}) => buildFwd(F(o), 'fwd');
const end = (o: Partial<EndParams> = {}) => buildEnd(E(o), 'end');
const lks = (tr: ReturnType<typeof fwd>) => tr.raw.lk as LookupRec[];

describe('aritmética de endereços', () => {
  it('forma compactada da RFC 5952', () => {
    expect(norm6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    expect(norm6('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1');
    expect(norm6('2001:db8:0:1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1');
    expect(fmt6(0n)).toBe('::');
    expect(fmt6(1n)).toBe('::1');
    expect(fmt6(parse6('fe80::1'))).toBe('fe80::1');
  });
  it('forma completa e leitura de "::"', () => {
    expect(full6(parse6('2001:db8::1'))).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(parse6('::')).toBe(0n);
  });
  it('bits em comum entre endereços', () => {
    expect(commonBits6('2001:db8:2:1::20', '2001:db8:2::')).toBe(63);
    expect(commonBits6('2001:db8::1', '2001:db8::1')).toBe(128);
    expect(commonBits6('2001:db8::1', 'fe80::1')).toBe(0);
  });
  it('EUI-64 modificado: insere ff:fe e inverte o bit U/L (RFC 4291, apêndice A)', () => {
    expect(eui64('00:00:5e:00:53:0a')).toBe(0x02005efffe00530an);
    expect(linkLocalOf(eui64('00:00:5e:00:53:0a'))).toBe('fe80::200:5eff:fe00:530a');
    expect(withPrefix('2001:db8:10:1::', eui64('00:00:5e:00:53:0a'))).toBe('2001:db8:10:1:200:5eff:fe00:530a');
  });
  it('endereço de nó solicitado e MAC multicast', () => {
    expect(solicited6('2001:db8:10:1:200:5eff:fe00:530a')).toBe('ff02::1:ff00:530a');
    expect(solicited6('fe80::1')).toBe('ff02::1:ff00:1');
    expect(mcastMac6('ff02::1:ff00:530a')).toBe('33:33:ff:00:53:0a');
    expect(mcastMac6('ff02::1')).toBe('33:33:00:00:00:01');
  });
  it('classificação dos tipos de endereço', () => {
    expect(classify6('fe80::1').nome).toBe('Link-local');
    expect(classify6('fd12:3456:789a:1::50').rfc).toBe('RFC 4193');
    expect(classify6('ff02::1').nome).toBe('Multicast');
    expect(classify6('::1').nome).toBe('Loopback');
    expect(classify6('::').nome).toBe('Não especificado');
    expect(classify6('2001:db8::1').rfc).toBe('RFC 3849');
    expect(classify6('2606:4700::1').publico).toBe(true);
    expect(scope6('ff02::1')).toBe('enlace');
  });
  it('cabeçalho fixo de 40 bytes, sem checksum', () => {
    const h = ipv6Header({ plen: 56, nh: 58, hl: 64, src: '2001:db8:1:1::10', dst: '2001:db8:2:1::20' });
    expect(h.length).toBe(40);
    expect(h[0] >> 4).toBe(6);
    expect(h[4] * 256 + h[5]).toBe(56);
    expect(h[6]).toBe(58);
    expect(h[7]).toBe(64);
  });
});

describe('busca na tabela de rotas', () => {
  it('vence o maior prefixo, mesmo com a rota padrão também casando', () => {
    const T = tablesFor(F());
    const l = lookup6(T.r2, '2001:db8:2:1::20');
    expect(l.matches.length).toBe(2);
    expect(T.r2[l.winner].len).toBe(48);
  });
  it('três candidatos: vence o /64', () => {
    const T = tablesFor(F());
    const l = lookup6(T.r2, '2001:db8:2:5::20');
    expect(l.matches.length).toBe(3);
    expect(T.r2[l.winner].len).toBe(64);
  });
  it('sem nenhuma rota, não há vencedora', () => {
    const T = tablesFor(F({ agg: false, dfl: false }));
    expect(lookup6(T.r2, '2001:db8:2:1::20').winner).toBe(-1);
  });
});

describe('encaminhamento', () => {
  it('o ping chega ao SRV1 e volta, com Neighbor Discovery no primeiro salto', () => {
    const tr = fwd();
    expect(tr.raw.result).toBe('ok');
    expect(tr.msgs.some((m) => (m.label || '').startsWith('NS'))).toBe(true);
    expect(tr.msgs.every((m) => m.proto === 'ICMPv6')).toBe(true);
  });
  it('o Hop Limit cai de um em cada roteador', () => {
    const tr = fwd();
    const ida = (tr.raw.pk as { ty: number; hl: number }[]).filter((p) => p.ty === 128).map((p) => p.hl);
    expect(ida[0]).toBe(64);
    expect(ida[ida.length - 1]).toBe(61);
  });
  it('SRV2 vai por R4 (o /64 vence o /48)', () => {
    const tr = fwd({ dest: 'srv2' });
    expect(tr.raw.result).toBe('ok');
    const l = lks(tr).find((x) => x.n === 'r2')!;
    expect(l.m.length).toBe(3);
    expect(tr.msgs.some((m) => m.route && (m.route as string[]).includes('r4'))).toBe(true);
    expect(tr.msgs.some((m) => m.route && (m.route as string[]).includes('r3'))).toBe(false);
  });
  it('sem rota específica, a rota padrão leva à borda', () => {
    expect(fwd({ dest: 'ext' }).raw.result).toBe('borda');
  });
  it('sem rota no R3: ICMPv6 1/0 vindo do R3', () => {
    const tr = fwd({ dest: 'nonet' });
    expect(tr.raw.result).toBe('unreach');
    expect(tr.raw.errFrom).toBe('2001:db8:0:23::2');
  });
  it('sem agregada e sem padrão: o R2 avisa 1/0', () => {
    const tr = fwd({ agg: false, dfl: false });
    expect(tr.raw.result).toBe('unreach');
    expect(tr.raw.errFrom).toBe('2001:db8:0:12::2');
  });
  it('ND sem resposta: três NS e ICMPv6 1/3', () => {
    const tr = fwd({ dest: 'ghost' });
    expect(tr.raw.result).toBe('addr');
    expect(tr.msgs.filter((m) => (m.label || '').startsWith('NS') && m.lost).length).toBe(3);
  });
  it('Hop Limit 3 expira no R3 com ICMPv6 3/0', () => {
    const tr = fwd({ hl: 3 });
    expect(tr.raw.result).toBe('hl');
    expect(tr.raw.errFrom).toBe('2001:db8:0:23::2');
  });
  it('Hop Limit 4 é o mínimo para chegar ao SRV1', () => {
    expect(fwd({ hl: 4 }).raw.result).toBe('ok');
    expect(fwd({ hl: 3 }).raw.result).not.toBe('ok');
  });
  it('sem rota de volta no R3: a ida é entregue e a volta se perde', () => {
    const tr = fwd({ back: false });
    expect(tr.raw.reqDelivered).toBe(true);
    expect(tr.raw.result).toBe('noback');
  });
  it('é determinístico', () => {
    expect(JSON.stringify(fwd().msgs)).toBe(JSON.stringify(fwd().msgs));
  });
});

describe('endereçamento e SLAAC', () => {
  it('SLAAC com EUI-64: forma o endereço global e faz ping ao vizinho por ND', () => {
    const tr = end();
    expect(tr.raw.slaac).toBe('ok');
    expect(tr.raw.gua).toBe('2001:db8:10:1:200:5eff:fe00:530a');
    expect(tr.raw.result).toBe('ok');
    expect(tr.msgs.filter((m) => (m.label || '').startsWith('DAD')).length).toBe(4);
  });
  it('a DAD usa origem :: e o nó solicitado do endereço testado', () => {
    const tr = end();
    const dad = (tr.raw.pk as { m: number; src: string; dst: string; ty: number }[]).find((p) => p.ty === 135)!;
    expect(dad.src).toBe('::');
    expect(dad.dst.startsWith('ff02::1:ff')).toBe(true);
  });
  it('identificador temporário não deriva do MAC', () => {
    const tr = end({ iid: 'priv' });
    expect(tr.raw.gua).not.toContain('fe00:530a');
    expect(tr.raw.slaac).toBe('ok');
  });
  it('destino remoto usa o roteador padrão sem Neighbor Solicitation (o MAC veio no RA)', () => {
    const tr = end({ dest: 'srv' });
    expect(tr.raw.result).toBe('ok');
    expect(tr.msgs.some((m) => (m.label || '').startsWith('NS: quem tem'))).toBe(false);
  });
  it('sem RA: três RS, só enlace local e rede inalcançável no host', () => {
    const tr = end({ ra: false, dest: 'srv' });
    expect(tr.raw.slaac).toBe('nora');
    expect(tr.msgs.filter((m) => (m.label || '').startsWith('RS')).length).toBe(3);
    expect(tr.raw.result).toBe('nonet');
  });
  it('flag A desligada: sem endereço global e ICMPv6 1/2 do roteador', () => {
    const tr = end({ aflag: false, dest: 'srv' });
    expect(tr.raw.slaac).toBe('aflag');
    expect(tr.raw.gua).toBeNull();
    expect(tr.raw.result).toBe('scope');
  });
  it('prefixo /80 não serve para SLAAC', () => {
    const tr = end({ pfx: 80, dest: 'srv' });
    expect(tr.raw.slaac).toBe('plen');
    expect(tr.raw.result).toBe('scope');
  });
  it('DAD com conflito: o endereço não é atribuído', () => {
    const tr = end({ dad: 'conflict', dest: 'srv' });
    expect(tr.raw.slaac).toBe('dup');
    expect(tr.raw.gua).toBeNull();
    expect(tr.raw.result).toBe('scope');
  });
  it('enlace local sem roteador: usa ND e funciona', () => {
    const tr = end({ ra: false, dest: 'llr' });
    expect(tr.raw.result).toBe('ok');
    expect(tr.msgs.some((m) => (m.label || '').startsWith('NS: quem tem'))).toBe(true);
  });
  it('multicast ff02::1: respostas de B e do roteador, com MAC 33:33:00:00:00:01', () => {
    const tr = end({ dest: 'mc' });
    expect(tr.raw.result).toBe('mc');
    expect(tr.msgs.filter((m) => (m.label || '').startsWith('Echo Reply')).length).toBe(2);
  });
  it('ULA sem rota: ICMPv6 1/0', () => {
    expect(end({ dest: 'ula' }).raw.result).toBe('noroute');
  });
});
