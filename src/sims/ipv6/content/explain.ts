// Texto da aba Experimento e do cabeçalho do cenário do IPv6.
import { esc, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import { routeText6, type Route6 } from '../model';
import { DEST_IP, NODE_LABEL, type FwdParams, type LookupRec } from '../fwd';
import { E_DEST, type EndParams } from '../end';

const DEST_FWD: Record<string, string> = { srv1: 'destino SRV1 (' + DEST_IP.srv1 + ')', srv2: 'destino SRV2 (' + DEST_IP.srv2 + ')', ghost: 'destino ' + DEST_IP.ghost + ' (sem host)', nonet: 'destino ' + DEST_IP.nonet + ' (sem rota no R3)', ext: 'destino da internet (' + DEST_IP.ext + ')' };
const DEST_END: Record<string, string> = { b: 'destino no mesmo enlace (' + E_DEST.b + ')', llr: 'enlace local do roteador (' + E_DEST.llr + ')', srv: 'destino remoto (' + E_DEST.srv + ')', mc: 'multicast de todos os nós (ff02::1)', ula: 'endereço local único (' + E_DEST.ula + ')' };

/** Texto "Configuração do cenário": só o que o cenário define (o restante vem dos padrões). */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as Record<string, unknown>;
  const p: string[] = [];
  if (s.sub === 'end') {
    const E = V as Partial<EndParams> & { edest?: string };
    p.push(DEST_END[E.edest || 'b']);
    p.push(E.iid === 'priv' ? 'identificador temporário' : 'identificador EUI-64');
    if (E.ra === false) p.push('sem Router Advertisement');
    if (E.pfx && E.pfx !== 64) p.push('prefixo anunciado /' + E.pfx);
    if (E.aflag === false) p.push('flag A desligada');
    if (E.dad === 'conflict') p.push('endereço duplicado no enlace');
    return p.join('; ');
  }
  const F = V as Partial<FwdParams>;
  p.push(DEST_FWD[F.dest || 'srv1']);
  if (F.hl && F.hl !== 64) p.push('Hop Limit inicial ' + F.hl);
  if (F.agg === false) p.push('R2 sem a rota agregada');
  if (F.dfl === false) p.push('R2 sem rota padrão');
  if (F.back === false) p.push('R3 sem rota de volta');
  return p.join('; ');
}

const FWD_RESULT: Record<string, string> = {
  ok: '<li><span class="chk-ok">O ping funcionou:</span> a ida e a volta encontraram rota em todos os roteadores.</li>',
  hl: '<li><span class="chk-bad">Hop Limit excedido:</span> o pacote foi descartado onde o Hop Limit chegou com 1, e esse roteador avisou a origem com ICMPv6 3/0.</li>',
  addr: '<li><span class="chk-bad">Endereço inalcançável (ICMPv6 1/3):</span> a rota existe, mas o Neighbor Discovery não achou o MAC do destino.</li>',
  unreach: '<li><span class="chk-bad">Destino inalcançável (ICMPv6 1/0):</span> um roteador sem rota descartou o pacote e avisou a origem.</li>',
  borda: '<li><span class="chk-warn">Saiu pela borda:</span> o pacote chegou ao provedor pela rota padrão. Não há resposta neste simulador.</li>',
  noback: '<li><span class="chk-bad">Ida entregue, volta perdida:</span> o servidor recebeu o pedido, mas a resposta não teve rota de volta.</li>',
  timeout: '<li><span class="chk-bad">Sem resposta:</span> nada voltou à origem.</li>',
};

function explainFwd(tr: Trace): string {
  const R = tr.raw;
  const lk = (R.lk || []) as LookupRec[];
  const T = (R.tables || {}) as Record<string, Route6[]>;
  let h = '<ul>' + (FWD_RESULT[R.result] || '');
  const multi = lk.filter((l) => l.m.length > 1);
  if (multi.length) {
    const l = multi[0];
    h += '<li>Em <b>' + esc(NODE_LABEL[l.n]) + '</b>, o destino ' + esc(l.d) + ' casou com ' + l.m.length + ' rotas e venceu <b>' + esc(routeText6(T[l.n][l.w])) + '</b>.</li>';
  }
  const ida = (R.pk as { ty: number; hl: number }[]).filter((p) => p.ty === 128);
  if (ida.length > 1) h += '<li>O Hop Limit do pedido caiu de ' + ida[0].hl + ' para ' + ida[ida.length - 1].hl + ' em ' + (ida.length - 1) + ' roteadores' + (R.result === 'hl' ? ' e depois acabou.' : '.') + ' Nenhum checksum de cabeçalho precisou ser recalculado, porque o IPv6 não tem esse campo.</li>';
  if (R.errFrom) h += '<li>O aviso ICMPv6 veio de <b>' + esc(R.errFrom) + '</b>, o endereço da interface do roteador que descartou o pacote.</li>';
  if ((R.nd || []).length) h += '<li>O Neighbor Discovery (NS e NA) fez o papel do ARP: ' + (R.nd as unknown[]).length + ' resolução(ões) de vizinho no caminho.</li>';
  h += '<li>Lição: a decisão é local e a mesma do IPv4. Cada roteador olha só a própria tabela e o destino, e o prefixo mais específico vence. Mudam o tamanho do endereço (128 bits), o Hop Limit e o ND no lugar do ARP.</li></ul>';
  return h;
}

const END_RESULT: Record<string, string> = {
  ok: '<li><span class="chk-ok">O ping funcionou.</span></li>',
  mc: '<li><span class="chk-ok">Respostas de todos os nós:</span> o multicast ff02::1 chegou ao host B e ao roteador, e cada um respondeu do próprio endereço unicast.</li>',
  nonet: '<li><span class="chk-bad">Rede inalcançável no host:</span> sem prefixo e sem roteador padrão, o sistema não enviou nenhum pacote.</li>',
  noroute: '<li><span class="chk-bad">Sem rota no roteador (ICMPv6 1/0):</span> o roteador não tinha rota para o destino.</li>',
  scope: '<li><span class="chk-bad">Além do escopo da origem (ICMPv6 1/2):</span> a origem era de enlace local, e o roteador não encaminha esse tráfego para fora do enlace.</li>',
};

const SLAAC_TXT: Record<string, string> = {
  ok: 'O SLAAC formou o endereço global e a DAD confirmou que ele é único.',
  aflag: 'O SLAAC não ocorreu: a flag A do prefixo está desligada.',
  plen: 'O SLAAC não ocorreu: com identificador de 64 bits, só um prefixo /64 serve.',
  dup: 'O endereço formado já era usado por outro host: a DAD o recusou.',
  nora: 'Não houve Router Advertisement: o host ficou só com o endereço de enlace local.',
};

function explainEnd(tr: Trace): string {
  const R = tr.raw;
  let h = '<ul>' + (END_RESULT[R.result] || '');
  h += '<li>' + esc(SLAAC_TXT[R.slaac] || '') + (R.why ? ' Motivo: ' + esc(R.why) + '.' : '') + '</li>';
  h += '<li>O destino ' + esc(R.dst) + ' pertence ao bloco <b>' + esc(R.dstType.nome) + '</b> (' + esc(R.dstType.rfc) + ').</li>';
  h += '<li>Origem usada no ping: <b>' + esc(R.src) + '</b>' + (R.gua ? ' (endereço global)' : ' (enlace local)') + '.</li>';
  h += '<li>Lição: o host só tem endereço global se o roteador anunciar um prefixo /64 com a flag A e se a DAD aprovar. Um endereço de enlace local nunca atravessa o roteador.</li></ul>';
  return h;
}

export function explain(tr: Trace, _P: unknown, scen: ScenarioDef | undefined): string {
  void scen;
  return tr.raw.pk && tr.raw.tables ? explainFwd(tr) : explainEnd(tr);
}
