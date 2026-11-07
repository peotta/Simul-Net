// Texto da aba Experimento e do cabeçalho do cenário.
import { esc, plural, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import { host, otherHost, type Net } from '../model';

const PHP: Record<string, string> = { implicit: 'implicit-null', explicit: 'explicit-null', none: 'sem PHP' };

/** Texto "Configuração do cenário": só o que o cenário define (o restante vem dos padrões). */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as Record<string, any>;
  let t = (V.service === 'vpn' ? 'L3VPN' : 'IP sobre MPLS') + '; egresso ' + PHP[V.php] + '; TTL ' + (V.prop ? 'Uniform' : 'Pipe');
  if (s.sub === 'dados' && V.ctl === 'semldp') t += '; sem LDP (só o IGP)';
  if (s.sub === 'falha') t += '; cai o enlace ' + V.fail;
  return t;
}

const phpTxt = (v: string): string =>
  v === 'implicit' ? 'implicit-null (3): o penúltimo salto remove o rótulo (PHP)' : v === 'explicit' ? 'explicit-null (0): o rótulo chega ao egresso, preservando o campo de QoS (TC)' : 'sem PHP: o egresso anuncia um rótulo próprio e faz o pop';
const ttlTxt = (v: boolean): string => (v ? 'Uniform (propagate-ttl): o TTL do IP é copiado para o rótulo e cada LSR do núcleo decrementa' : 'Pipe (no propagate-ttl): o rótulo começa com TTL 255 e o núcleo fica invisível para o TTL do IP');

const li = (t: string) => '<li>' + t + '</li>';
const cfgLine = (net: Net): string => li('Configuração: <b>' + (net.cfg.service === 'vpn' ? 'L3VPN' : 'IP sobre MPLS') + '</b>; egresso com ' + phpTxt(net.cfg.php) + '; TTL no modelo ' + ttlTxt(net.cfg.propagate) + '.');
const opsList = (ops: string[]): string => (ops.length ? esc(ops.join('; ')) : 'nenhuma operação de LSR');

export function explain(tr: Trace): string {
  const R = tr.raw;
  const net = R.net as Net;
  let h = '<ul>' + cfgLine(net);

  if (R.sub === 'ldp') {
    h += li('<b>Discovery:</b> LDP Hello (UDP 646, para 224.0.0.2) em ' + plural(net.links.length, 'enlace ativo', 'enlaces ativos') + '. Cada LSR descobriu seus vizinhos diretos.');
    h += li('<b>Sessão:</b> ' + plural(net.links.length, 'sessão LDP', 'sessões LDP') + ' sobre TCP 646 chegaram a OPERATIONAL. Em cada par, o LSR com a maior loopback abre a conexão (RFC 5036).');
    h += li('<b>Mapping:</b> cada LSR alocou um rótulo local para cada uma das ' + R.fecN + ' FECs e o anunciou a todos os vizinhos. Para a loopback do PE2: ' + esc(R.sample) + '.' + (net.cfg.service === 'vpn' ? ' Em paralelo, PE1 e PE2 trocaram por MP-BGP as rotas VPNv4 da VRF CLIENTE, com os rótulos VPN 190 (PE1) e 690 (PE2).' : ''));
    h += li('<b>LSP:</b> cada LSR combinou a LIB com o próximo salto do IGP e instalou a LFIB. LSP de ida: ' + esc(R.ab) + '. LSP de volta: ' + esc(R.ba) + '.');
    h += li('Os rótulos têm significado <b>local</b>: cada LSR escolhe os seus. Com <b>Downstream Unsolicited</b> e <b>retenção liberal</b>, a LIB guarda os rótulos de todos os vizinhos, mas só o do próximo salto do IGP vai para a LFIB.');
    h += li('Lição: o LDP só funciona sobre um IGP convergido e só cria rótulos para destinos que o IGP conhece.');
  } else if (R.sub === 'dados') {
    const src = host(R.dir);
    const dst = otherHost(R.dir);
    if (R.res === 'ok') {
      h += li('<span class="chk-ok">ping de ' + src.id + ' para ' + dst.id + ' respondido:</span> RTT de ' + R.rtt.toFixed(2).replace('.', ',') + ' ms e TTL recebido ' + R.ttlRecv + ' (' + plural(64 - R.ttlRecv, 'decremento', 'decrementos') + ').' + (net.cfg.propagate ? ' No modelo Uniform, cada LSR do caminho decrementou o TTL.' : ' No modelo Pipe, só os PEs decrementam o TTL do IP; o núcleo não aparece.'));
    } else if (R.res === 'ttl') {
      h += li('<span class="chk-bad">O TTL expirou em ' + R.expiredAt + '.</span>');
    } else {
      h += li('<span class="chk-bad">O pacote foi descartado' + (R.at ? ' em ' + R.at : '') + '</span>: ' + (net.cfg.service === 'vpn' && R.ctl === 'semldp' ? 'sem LDP e sem MP-BGP, o PE não tem rota VPN nem LSP, e os P não conhecem as redes dos clientes.' : 'não havia caminho rotulado até o destino.'));
    }
    h += li('Ida: ' + opsList(R.ida) + '.');
    if (R.volta.length) h += li('Volta: ' + opsList(R.volta) + '.');
    if (R.ctl === 'semldp') h += li('Sem rótulos, ' + (net.cfg.service === 'ip' ? 'cada roteador consultou o IP (maior prefixo): o MPLS roda sobre o IGP e, sem o LDP, o núcleo se comporta como uma rede IP comum.' : 'o MPLS L3VPN não tem alternativa: o serviço do cliente depende do LDP e do MP-BGP.'));
    else {
      h += li('LSPs são <b>unidirecionais</b>: a volta usa outro LSP, com outros rótulos.');
      if (net.cfg.php === 'implicit') h += li('Com <b>implicit-null</b>, o penúltimo salto removeu o rótulo (PHP) e o PE de saída fez uma só consulta (' + (net.cfg.service === 'vpn' ? 'na VRF' : 'IP') + ').');
      else if (net.cfg.php === 'explicit') h += li('Com <b>explicit-null</b>, o rótulo 0 chegou ao egresso para preservar a marcação de QoS (TC).');
      else h += li('Sem PHP, o egresso fez duas consultas: removeu o próprio rótulo e depois consultou ' + (net.cfg.service === 'vpn' ? 'a VRF' : 'o IP') + '.');
      if (net.cfg.service === 'vpn') h += li('Na <b>L3VPN</b> (RFC 4364), o rótulo externo leva o pacote até o PE de saída e o interno (VPN, aprendido por MP-BGP) indica a VRF. Os P não conhecem as rotas dos clientes.');
    }
    h += li('Lição: o PE de entrada faz <b>push</b>, os P fazem <b>swap</b> olhando só o rótulo do topo, e a pilha é removida com <b>pop</b> no fim do LSP.');
  } else if (R.sub === 'ttl') {
    const src = host(R.dir);
    const dst = otherHost(R.dir);
    h += li('<b>traceroute</b> de ' + src.id + ' para ' + dst.id + ' (TTL ' + (net.cfg.propagate ? 'propagado' : 'não propagado') + '):');
    h += '<li><ul>' + R.hops.map((x: any) => {
      if (x.status === 'expired') return li('TTL ' + x.ttl + ': ' + esc(x.from) + ' (' + x.at + ')' + (x.mode === 'label' ? ', com a pilha [' + x.labels.map((e: any) => e.label).join(' | ') + '] devolvida no ICMP (RFC 4950)' : ''));
      if (x.status === 'delivered') return li('TTL ' + x.ttl + ': ' + dst.ip + ' (' + dst.id + ', destino alcançado)');
      return li('TTL ' + x.ttl + ': *');
    }).join('') + '</ul></li>';
    h += li(net.cfg.propagate ? 'No modelo <b>Uniform</b>, o TTL do rótulo expira em cada P e o ICMP Time Exceeded leva a pilha recebida (RFC 4950). Aparecem ' + plural(R.seen.length, 'roteador', 'roteadores') + ' antes do destino.' : 'No modelo <b>Pipe</b>, o TTL do rótulo começa em 255 e o núcleo é um salto só para o cliente. Aparecem apenas os PEs: ' + esc(R.seen.join(', ')) + '.');
    h += li('Quando o TTL expira dentro do LSP, o LSR não devolve o ICMP direto: ele o encaminha <b>adiante pelo LSP</b> até o egresso, que o devolve à origem (RFC 3032, seção 2.3.2). Por isso os saltos do núcleo mostram RTTs parecidos.');
    h += li('Lição: a propagação do TTL decide se o cliente enxerga a topologia interna do provedor.');
  } else {
    h += li('Antes da falha, o LSP de ida era: ' + esc(R.lspBefore) + '. O primeiro ping ' + (R.okBefore ? '<span class="chk-ok">foi respondido</span>' : '<span class="chk-bad">falhou</span>') + '.');
    h += li('O enlace <b>' + R.fail + '</b> (' + R.failLink.a + ' / ' + R.failLink.b + ') caiu: a adjacência e a sessão LDP terminaram e o OSPF reconvergiu.');
    if (R.okAfter) {
      h += li('Depois da falha, o LSP de ida passou a ser: ' + esc(R.lspAfter) + '. O segundo ping <span class="chk-ok">foi respondido</span>.');
      h += li(R.changed ? 'O caminho e os rótulos mudaram <b>sem nova sinalização LDP</b>: a <b>retenção liberal</b> já havia guardado na LIB os rótulos dos outros vizinhos.' : 'O enlace que caiu <b>não fazia parte do LSP</b>, então o caminho e os rótulos continuaram os mesmos. Escolha um enlace do caminho para ver a troca.');
    } else h += li('<span class="chk-bad">O segundo ping falhou:</span> não restou caminho rotulado até o destino.');
    h += li('Lição: a convergência do MPLS depende do IGP; em produção, a sincronização LDP-IGP e o Fast Reroute reduzem a perda durante a troca.');
  }
  return h + '</ul>';
}
