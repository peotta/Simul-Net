// Texto da aba Experimento e do cabeçalho do cenário do simulador de OSPF.
import { esc, plural, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';

const li = (t: string): string => '<li>' + t + '</li>';
const caminho = (p: string[]): string => esc(p.join(', '));

/** Texto "Configuração do cenário": só o que o cenário define (o restante vem dos padrões). */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as Record<string, any>;
  if (s.sub === 'conv') return 'Área única, 6 roteadores; tráfego de ' + V.dir + '';
  if (s.sub === 'multi') return 'Três áreas, 9 roteadores; ' + (V.mlink && V.mlink !== 'none' ? 'enlace ' + V.mlink + ' fora de serviço' : 'rede íntegra');
  const ev = V.ev === 'queda' ? 'cai o enlace ' + V.link + (V.link2 && V.link2 !== 'none' ? ' e o enlace ' + V.link2 : '') : 'o custo de ' + V.link + ' passa a ' + V.custo;
  return 'Área única, 6 roteadores, já convergidos; ' + ev;
}

export function explain(tr: Trace): string {
  const R = tr.raw;
  let h = '<ul>';
  const fp = R.sub === 'evento' ? R.after : R.fp;

  if (R.sub === 'conv') {
    h += li('<b>Hello:</b> cada roteador enviou Hello em todos os enlaces ativos (14 mensagens, uma por enlace e sentido). Quando um roteador vê o próprio Router ID no Hello do vizinho, o vizinho passa a <b>2-Way</b> (RFC 2328, seção 10.5).');
    h += li('<b>Adjacência:</b> os vizinhos sincronizaram as LSDBs por DBD, LSR, LSU e LSAck e chegaram a <b>Full</b>.');
    h += li('<b>Inundação:</b> cada roteador originou o Router-LSA (seq 0x80000001) e a inundação levou ' + plural(R.rounds, 'rodada', 'rodadas') + ' para deixar as seis LSDBs idênticas.');
    h += li('<b>SPF:</b> cada roteador executou o Dijkstra sobre a mesma LSDB, com a raiz em si mesmo (seção 16.1).');
  } else if (R.sub === 'evento') {
    const ch = (R.changed as string[]).join(', ');
    if (R.res === 'same') {
      h += li('O custo informado é igual ao atual: <b>nenhum LSA novo</b> e nenhum SPF. O OSPF só reage a mudanças reais.');
    } else {
      h += li(R.ev === 'queda' ? 'Caiu ' + plural(R.changed.length, 'enlace', 'enlaces') + ' (' + esc(ch) + '): as pontas perderam a adjacência e originaram novos Router-LSAs sem ele.' : 'O custo do enlace ' + esc(ch) + ' mudou: as duas pontas originaram novos Router-LSAs com <b>número de sequência maior</b> (0x80000002), que invalidam os anteriores.');
      h += li('<b>Inundação:</b> o LSA novo chegou a todos em ' + plural(R.rounds, 'rodada', 'rodadas') + ', e as LSDBs voltaram a ser idênticas' + (R.everyone ? '.' : ' (nem todos os roteadores receberam o LSA: a rede foi dividida).'));
      h += li('<b>SPF:</b> cada roteador alcançado refez o cálculo sobre a LSDB atualizada.');
    }
    h += li('Caminho antes: ' + caminho(R.before.path) + ' (custo ' + R.before.cost + ').');
  }

  if (R.sub === 'multi') {
    h += li('<b>Adjacências:</b> Hello e DBD em cada enlace ativo. Os ABRs (R2, R3, R8 e R9) têm adjacências em duas áreas.');
    h += li('<b>Inundação por área:</b> cada Router-LSA ficou dentro da própria área. Um ABR originou um Router-LSA <b>por área</b>.');
    h += li('<b>Summary LSAs:</b> os ABRs originaram ' + R.summaries.length + ' Summary LSAs (tipo 3) com destino e custo, e os inundaram nas áreas onde estão (seção 12.4.3). Assim, R1 conhece R7 só como um custo anunciado por R2 e R3.');
    h += li('<b>SPF:</b> cada roteador calculou o SPF dentro das áreas a que pertence e somou o custo anunciado pelo ABR para as demais.');
  }

  if (fp.reached) {
    h += li('<span class="chk-ok">Pacote entregue:</span> ' + esc(R.src) + ' → ' + caminho(fp.path) + ' → ' + esc(R.dst) + ', custo OSPF ' + fp.cost + '. Cada roteador decidiu só o próximo salto pela própria tabela.');
    if (R.sub === 'evento' && R.res === 'rerouted') h += li('O caminho mudou: ' + caminho(R.before.path) + ' passou a ' + caminho(R.after.path) + '. Nenhum roteador "contou" aos outros o novo caminho: todos chegaram a ele pelo mesmo cálculo sobre a mesma LSDB.');
    if (R.sub === 'evento' && R.res === 'same' && R.changed.length) h += li('O caminho continuou o mesmo, mas os LSAs foram inundados e o SPF refeito mesmo assim: o OSPF não sabe de antemão se a mudança afeta o tráfego.');
    if (R.sub === 'multi' && R.down.length) h += li('Com o enlace ' + esc(R.down[0]) + ' fora de serviço, o caminho passa a incluir R9 e o custo até o destino aumenta.');
  } else {
    h += li('<span class="chk-bad">Pacote descartado:</span> ' + esc(fp.path[fp.path.length - 1]) + ' não tem rota para ' + esc(R.dst) + '. O destino saiu da LSDB e da tabela de rotas, porque nenhum caminho o alcança.');
  }
  if (R.sub === 'multi') h += li('As LSDBs <b>não são iguais</b> entre áreas: troque o roteador na aba LSDB (R1, R2 e R4) para comparar.');
  h += li('Lição: ' + (R.sub === 'conv' ? 'o OSPF escolhe pelo <b>menor custo</b> sobre um mapa completo, não pelo menor número de saltos.' : R.sub === 'evento' ? 'a reação a um evento é <b>inundar um LSA novo e refazer o SPF</b> em todos os roteadores.' : 'as áreas limitam a inundação, e os ABRs trocam topologia detalhada por custos resumidos.'));
  return h + '</ul>';
}
