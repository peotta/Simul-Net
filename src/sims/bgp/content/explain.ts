// Texto da aba Experimento e do cabeçalho do cenário do simulador de BGP.
import { esc, plural, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import { ASES, DEF_BY, DEF_NAMES, HOLD } from '../model';
import type { Fwd } from '../model';
import type { Stats } from '../modes';

const li = (t: string): string => '<li>' + t + '</li>';
const names = (p: string[]): string => p.map((x) => ASES[x].name).join(' → ');
const statText = (s: Stats): string => plural(s.rounds, 'rodada', 'rodadas') + ', ' + plural(s.updates, 'UPDATE', 'UPDATEs') + ' e ' + plural(s.withdraws, 'retirada', 'retiradas');
const ATTACK: Record<string, string> = { hijack: 'o Atacante origina 203.0.113.0/24', 'route-leak': 'o ISP B vaza a rota do Conteúdo ao ISP A', 'route-flap': 'o Cliente oscila o anúncio' };
const EVENT: Record<string, string> = { down: 'queda do enlace', hold: 'vizinho silencioso (hold timer)', retirar: 'o Cliente retira o prefixo', none: 'nenhum' };

/** Texto "Configuração do cenário": só o que o cenário define (o restante vem dos padrões). */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as Record<string, any>;
  if (s.sub === 'seguranca') {
    const d: string[] = [];
    if (V.relLP) d.push('LOCAL_PREF por relação comercial');
    if (V.rov && V.rov !== 'off') d.push('RPKI / ROV ' + DEF_NAMES.rov[V.rov]);
    if (V.cust && V.cust !== 'off') d.push('filtro de prefixos de clientes ' + DEF_NAMES.cust[V.cust]);
    if (V.peer && V.peer !== 'off') d.push('filtro de rotas de peers ' + DEF_NAMES.peer[V.peer]);
    if (V.damp) d.push('flap damping');
    return 'BGP-4, 6 sistemas autônomos; ' + (ATTACK[V.attack] || 'sem ataque') + '; defesas: ' + (d.join('; ') || 'nenhuma');
  }
  const base = 'BGP-4, 6 sistemas autônomos; LOCAL_PREF ' + (V.lpA || 100) + ' para o ISP A; prepend ' + (V.prependB ? V.prependB + 'x para o ISP B' : 'nenhum');
  return base + '; evento: ' + (EVENT[V.ev || 'none'] || 'nenhum') + (V.ev === 'down' || V.ev === 'hold' ? ' (' + V.link + ')' : '');
}

export function explain(tr: Trace): string {
  const R = tr.raw;
  const st = R.stats as Stats;
  const ev = R.evStats as Stats | null;
  const fwd = R.fwd as Fwd;
  let h = '<ul>' + li('Protocolo: <b>BGP-4</b> (RFC 4271), um roteador por sistema autônomo (sem iBGP), com números de AS de documentação (RFC 5398) e prefixos de documentação (RFC 5737).');
  if (R.sub === 'seguranca') h += li('Problema de segurança: ' + (R.attack === 'none' ? 'nenhum' : ATTACK[R.attack]) + '. Defesas: ' + (R.defText || 'nenhuma') + '.');

  h += li('<b>Sessões:</b> ' + plural(R.net.links.length, 'enlace subiu', 'enlaces subiram') + ' pelas fases TCP (porta 179), OPEN (hold time de ' + HOLD + ' s) e KEEPALIVE até Established.');
  h += li('<b>Convergência:</b> a rede trocou ' + statText(st) + (st.flaps ? ' durante ' + plural(st.flaps, 'ciclo de flapping', 'ciclos de flapping') : '') + (st.loops ? ' (' + plural(st.loops, 'anúncio descartado', 'anúncios descartados') + ' por laço de AS_PATH)' : '') + '. Conteúdo → Cliente: ' + esc(R.dc0) + (R.dcWhy0 ? ' (' + R.dcWhy0 + ' no Conteúdo)' : '') + '. Cliente → Conteúdo: ' + esc(R.cd0) + (R.cdWhy0 ? ' (' + R.cdWhy0 + ' no Cliente)' : '') + '.');

  if (ev) {
    const k: Record<string, string> = {
      down: 'Enlace ' + esc(R.evLabel) + ' derrubado: a sessão caiu na hora e as rotas aprendidas por ela foram descartadas.',
      hold: 'Vizinho de ' + esc(R.evLabel) + ' silenciado: sem KEEPALIVE por ' + HOLD + ' s, o hold timer expirou, houve NOTIFICATION (código 4) e as rotas foram retiradas.',
      retirar: 'O Cliente retirou ' + esc(R.evLabel) + ': a retirada se espalhou pela rede.',
    };
    h += li('<b>Evento:</b> ' + k[R.ev] + ' Reconvergência: ' + statText(ev) + '. Conteúdo → Cliente: ' + esc(R.dc) + '. Cliente → Conteúdo: ' + esc(R.cd) + '.');
  }

  const d = esc(ASES[R.src].name + ' → ' + R.dstIp);
  if (fwd.attack === 'blackhole') h += li('<span class="chk-bad">Tráfego desviado:</span> ' + d + ' foi atraído pelo anúncio falso (' + names(fwd.path) + ') e descartado pelo Atacante.');
  else if (fwd.ok) h += li('<span class="chk-ok">Tráfego entregue:</span> ' + d + ' por ' + names(fwd.path) + '.');
  else h += li('<span class="chk-bad">Tráfego descartado:</span> ' + d + ' em ' + ASES[fwd.at as string].name + ', sem rota.');

  const rj = R.rejects as { by: string }[];
  if (rj.length) {
    const by: Record<string, number> = {};
    rj.forEach((r) => (by[r.by] = (by[r.by] || 0) + 1));
    h += li('<b>Defesas:</b> rejeitaram ' + plural(rj.length, 'rota', 'rotas') + ' (' + Object.keys(by).map((k) => by[k] + ' por ' + DEF_BY[k]).join(', ') + '). O detalhe de cada uma está na aba Tabela BGP.');
  }
  if (R.attack === 'hijack') {
    const hj = R.reach as string[];
    h += li('<b>Alcance do sequestro:</b> ' + (hj.length ? hj.map((x) => ASES[x].name).join(', ') + ' usam a rota falsa (' + hj.length + ' de 5 AS legítimos).' : 'nenhum AS legítimo usa a rota falsa.'));
  }
  if (R.defense.damp && R.suppressed) h += li('<b>Flap damping:</b> o prefixo do Cliente foi suprimido em ' + plural(R.suppressed, 'sessão', 'sessões') + '; enquanto durar a supressão, ele fica fora do ar nos AS que dependem dele.');

  const c: string[] = [];
  c.push('<b>AS_PATH e NEXT_HOP:</b> cada AS acrescenta o próprio número ao anunciar e troca o próximo salto pelo próprio endereço.');
  c.push('<b>Exportação valley-free:</b> rotas de clientes vão para todos; rotas de peers e provedores, só para clientes.');
  const why: Record<string, string> = { LOCAL_PREF: 'LOCAL_PREF (política local, avaliada primeiro)', AS_PATH: 'AS_PATH mais curto', 'router ID': 'desempate pelo menor router ID', 'origem local': 'preferência pela rota originada localmente' };
  const rs = (R.reasons as string[]).filter((r) => why[r]);
  if (rs.length) c.push('<b>Processo de decisão:</b> nesta execução decidiram ' + rs.map((r) => why[r]).join(', ') + '.');
  if (R.ev === 'down') c.push('<b>Fast-external-fallover:</b> a queda da interface derruba a sessão na hora.');
  if (R.ev === 'hold') c.push('<b>Hold timer e NOTIFICATION:</b> sem KEEPALIVE por ' + HOLD + ' s, o vizinho é declarado morto.');
  if (R.ev === 'retirar') c.push('<b>Withdraw:</b> deixar de anunciar um prefixo o retira da rede inteira.');
  if (R.lpA !== 100) c.push('<b>LOCAL_PREF:</b> controla a saída e não gera UPDATE, porque não sai do AS.');
  if (R.prependB) c.push('<b>AS-path prepend:</b> alonga o AS_PATH anunciado para influenciar a entrada de tráfego.');
  if (R.attack === 'route-leak') c.push('<b>Vazamento de rota:</b> o ISP B repassou ao ISP A uma rota que aprendeu de um peer, violando valley-free. ' + (R.defense.relLP ? 'Com LOCAL_PREF por relação comercial, o ISP A pode preferir a rota vazada (peer 150) à do provedor (100).' : 'Sem LOCAL_PREF por relação comercial, a rota vazada perde no desempate e o vazamento não muda o tráfego.'));
  if (R.attack === 'route-flap') c.push('<b>Route flapping:</b> anúncios e retiradas repetidos multiplicaram as reconvergências.');
  if (R.defense.rov !== 'off') c.push('<b>RPKI / ROV:</b> compara o AS de origem de cada rota com o ROA e rejeita as inválidas. Protege os AS que validam (' + DEF_NAMES.rov[R.defense.rov] + '); não valida o caminho.');
  if (R.defense.cust !== 'off') c.push('<b>Filtro de prefixos de clientes:</b> o provedor aceita só os prefixos do cone de clientes de cada cliente (' + DEF_NAMES.cust[R.defense.cust] + '). Só protege se estiver no provedor direto de quem anuncia.');
  if (R.defense.peer !== 'off') c.push('<b>Filtro de rotas de peers:</b> de um peer, aceita-se só o cone de clientes dele (' + DEF_NAMES.peer[R.defense.peer] + '). Barra vazamentos, mas não sequestros que partem do próprio cone.');
  c.push('<b>Segurança:</b> o BGP aceita, por padrão, o que o vizinho anuncia, sem validar a origem. As defesas deste simulador atuam na importação de rotas; ficam de fora o limite de prefixos, o atributo OTC (RFC 9234), ASPA e BGPsec.');
  h += li('Conceitos observados:<ul>' + c.map(li).join('') + '</ul>');
  return h + '</ul>';
}
