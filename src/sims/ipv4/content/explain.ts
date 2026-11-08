// Texto da aba Experimento e do cabeçalho do cenário.
import { esc, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import { routeText, type Route } from '../model';
import type { FwdParams, LookupRec } from '../fwd';
import { NODE_LABEL } from '../fwd';

const DEST_FWD: Record<string, string> = { srv1: 'destino SRV1 (10.2.1.20)', srv2: 'destino SRV2 (10.2.5.20)', nonet: 'destino 10.2.9.9 (sem host)', inet: 'destino da internet (198.51.100.9)' };
const DEST_END: Record<string, string> = {
  b: 'destino no mesmo enlace (192.168.10.20)', srv: 'destino remoto (10.20.0.50)', srv200: 'destino 10.20.0.200', srv31: 'destino no enlace /31 (10.20.1.1)', other: 'destino 192.168.20.7', bcast: 'broadcast da sub-rede (192.168.10.255)', lbcast: 'broadcast limitado (255.255.255.255)', dbcast: 'broadcast dirigido (10.20.0.255)', ll: 'link-local (169.254.10.5)', cgnat: 'espaço do CGNAT (100.64.5.5)', doc: 'endereço de documentação (192.0.2.7)',
};

/** Texto "Configuração do cenário": só o que o cenário define (o restante vem dos padrões). */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as Record<string, unknown>;
  const p: string[] = [];
  if (s.sub === 'end') {
    p.push(DEST_END[(V.edest as string) || 'b']);
    p.push('máscara /' + (V.mask || 24));
    if (V.gw === 'none') p.push('sem gateway');
    if (V.gw === 'outside') p.push('gateway fora da sub-rede');
    if (V.ovl) p.push('sub-rede sobreposta na eth2');
    if (V.dbfw) p.push('broadcast dirigido encaminhado');
    return p.join('; ');
  }
  const F = V as Partial<FwdParams>;
  p.push(DEST_FWD[F.dest || 'srv1']);
  if (F.ttl && F.ttl !== 64) p.push('TTL inicial ' + F.ttl);
  if (F.spoof) p.push('origem forjada');
  if (F.agg === false) p.push('R2 sem a rota agregada');
  if (F.dfl === false) p.push('R2 sem rota padrão');
  if (F.dup === 'ad') p.push('10.2.5.0/24 por duas fontes');
  if (F.dup === 'metric') p.push('10.2.0.0/16 por dois caminhos OSPF');
  if (F.loopf) p.push('R3 com rota padrão para o R2');
  if (F.bh) p.push('blackhole no R3');
  if (F.back === false) p.push('R3 sem rota de volta');
  if (F.urpf && F.urpf !== 'off') p.push('uRPF ' + (F.urpf === 'strict' ? 'estrito' : 'flexível'));
  return p.join('; ');
}

const FWD_RESULT: Record<string, string> = {
  ok: '<li><span class="chk-ok">O ping funcionou:</span> a ida e a volta encontraram rota em todos os roteadores.</li>',
  ttl: '<li><span class="chk-bad">TTL excedido:</span> o pacote foi descartado onde o TTL chegou a 1, e esse roteador avisou a origem com ICMP 11/0.</li>',
  unreach: '<li><span class="chk-bad">Destino inalcançável:</span> um roteador sem rota descartou o pacote e avisou a origem com ICMP 3.</li>',
  borda: '<li><span class="chk-warn">Saiu pela borda:</span> o pacote chegou ao provedor pela rota padrão. Não há resposta neste simulador.</li>',
  spoof: '<li><span class="chk-bad">Origem forjada entregue:</span> o destino recebeu o pedido e respondeu ao endereço forjado, e quem enviou o pacote não recebeu nada.</li>',
  noback: '<li><span class="chk-bad">Ida entregue, volta perdida:</span> o servidor recebeu o pedido, mas a resposta não teve rota de volta.</li>',
  urpf: '<li><span class="chk-ok">Barrado pelo uRPF:</span> o R1 descartou o pacote na entrada, por causa da origem.</li>',
  blackhole: '<li><span class="chk-bad">Descartado em silêncio:</span> a rota blackhole jogou o pacote fora, sem nenhum aviso.</li>',
  timeout: '<li><span class="chk-bad">Sem resposta:</span> nada voltou à origem.</li>',
};

function explainFwd(tr: Trace): string {
  const R = tr.raw;
  const lk = (R.lk || []) as LookupRec[];
  const T = (R.tables || {}) as Record<string, Route[]>;
  let h = '<ul>' + (FWD_RESULT[R.result] || '');
  const multi = lk.filter((l) => l.m.length > 1);
  if (multi.length) {
    const l = multi[0];
    h += '<li>Em <b>' + esc(NODE_LABEL[l.n]) + '</b>, o destino ' + esc(l.d) + ' casou com ' + l.m.length + ' rotas e venceu <b>' + esc(routeText(T[l.n][l.w])) + '</b>.</li>';
  }
  const ida = (R.pk as { src: string; ty: number; ttl: number }[]).filter((p) => p.ty === 8);
  if (ida.length > 1) h += '<li>O TTL do pedido caiu de ' + ida[0].ttl + ' para ' + ida[ida.length - 1].ttl + ' em ' + (ida.length - 1) + ' roteadores' + (R.result === 'ttl' ? ' e depois acabou.' : '.') + '</li>';
  if (R.errFrom) h += '<li>O aviso ICMP veio de <b>' + esc(R.errFrom) + '</b>, o endereço da interface do roteador que descartou o pacote. É assim que o traceroute descobre o caminho.</li>';
  if (R.notes && R.notes.includes('looseDefault')) h += '<li>O uRPF flexível aprovou a origem por causa da <b>rota padrão</b>: com ela, qualquer endereço tem rota.</li>';
  h += '<li>Lição: a decisão é sempre local. Cada roteador olha só a própria tabela e o destino, e a rota mais específica vence, qualquer que seja a ordem em que foi escrita.</li></ul>';
  return h;
}

const END_RESULT: Record<string, string> = {
  ok: '<li><span class="chk-ok">O ping funcionou.</span></li>',
  nonet: '<li><span class="chk-bad">Rede inalcançável no host:</span> sem rota para o destino, o sistema não enviou nenhum pacote.</li>',
  badgw: '<li><span class="chk-bad">Gateway inválido:</span> ele está fora da sub-rede do host, então a rota foi rejeitada e nada foi enviado.</li>',
  arpfail: '<li><span class="chk-bad">Host inalcançável (ARP):</span> a máscara fez o host tratar o destino como vizinho, e ninguém respondeu ao ARP.</li>',
  unreach: '<li><span class="chk-bad">Rede inalcançável (ICMP 3/0):</span> o roteador não tinha rota para o destino.</li>',
  hostunreach: '<li><span class="chk-bad">Host inalcançável (ICMP 3/1):</span> a rede escolhida pelo roteador não tem o host.</li>',
  bcast: '<li><span class="chk-warn">Broadcast da sub-rede:</span> todos do enlace receberam o quadro e ninguém respondeu.</li>',
  lbcast: '<li><span class="chk-warn">Broadcast limitado:</span> ficou no enlace, e o roteador não o encaminhou.</li>',
  dbdrop: '<li><span class="chk-ok">Broadcast dirigido bloqueado:</span> o roteador o descartou, como manda o padrão (RFC 2644).</li>',
  dbfwd: '<li><span class="chk-bad">Broadcast dirigido encaminhado:</span> o roteador o converteu em broadcast na LAN de destino, o que amplifica o tráfego.</li>',
  dropped: '<li><span class="chk-bad">Descartado pelo roteador:</span> link-local nunca é encaminhado.</li>',
};

function explainEnd(tr: Trace): string {
  const R = tr.raw;
  const P = R.P as { mask: number };
  let h = '<ul>' + (END_RESULT[R.result] || '');
  h += '<li>Teste do host: ' + esc(R.dst) + ' E máscara /' + P.mask + ' ' + (R.onLink ? 'dá a rede do próprio host, então é <b>mesmo enlace</b>' : 'não dá a rede do próprio host, então é <b>outra rede</b>') + '.</li>';
  h += '<li>O endereço pertence ao bloco <b>' + esc(R.cls.nome) + '</b> (' + esc(R.cls.rfc) + ').</li>';
  h += '<li>Lição: o host decide pela máscara, e o roteador decide pela tabela. Um erro de máscara ou de gateway no host não aparece como erro de roteamento: aparece como falta de resposta.</li></ul>';
  return h;
}

export function explain(tr: Trace, _P: unknown, scen: ScenarioDef | undefined): string {
  void scen;
  return tr.raw.pk && tr.raw.tables ? explainFwd(tr) : explainEnd(tr);
}
