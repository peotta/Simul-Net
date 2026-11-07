// Texto da aba Experimento e do cabeçalho do cenário do simulador de RIP.
import { esc, plural, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';

const li = (t: string): string => '<li>' + t + '</li>';
const caminho = (p: string[]): string => esc(p.join(', '));

/** Texto "Configuração do cenário": só o que o cenário define (o restante vem dos padrões). */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as Record<string, any>;
  const sh = V.sh ? 'split horizon com poison reverse' : 'sem split horizon';
  if (s.sub === 'conv') return 'RIPv2, 6 roteadores; ' + sh + '; custo de R2 / R3 igual a ' + V.cost23 + ' (ignorado pelo RIP)';
  return 'RIPv2, 6 roteadores, já convergidos; ' + sh + '; cai o enlace ' + V.link + (V.link2 && V.link2 !== 'none' ? ' e o enlace ' + V.link2 : '');
}

export function explain(tr: Trace): string {
  const R = tr.raw;
  const fp = R.sub === 'falha' ? R.after : R.fp;
  let h = '<ul>' + li('Protocolo: <b>RIPv2</b> (RFC 2453), ' + (R.sh ? 'com split horizon e poison reverse' : 'sem split horizon') + '. A métrica é o número de saltos e 16 é o infinito.');

  if (R.sub === 'conv') {
    h += li('<b>Response:</b> a cada rodada, cada roteador enviou o vetor aos vizinhos ativos (' + plural(R.links.length * 2, 'mensagem', 'mensagens') + ' por rodada, uma por enlace e sentido).');
    h += li('<b>Convergência:</b> as tabelas mudaram em ' + plural(R.roundsChanged, 'rodada', 'rodadas') + '; a rodada seguinte não mudou nada e confirmou que estabilizaram. A informação avança <b>um salto por rodada</b>.');
  } else {
    h += li('Caminho antes da falha: ' + caminho(R.before.path) + ' (' + plural(R.before.metric, 'salto', 'saltos') + ').');
    h += li('Caiu ' + plural(R.down.length, 'enlace', 'enlaces') + ' (' + esc(R.down.join(', ')) + '): as pontas marcaram com métrica 16 as rotas que passavam por ele e enviaram <b>atualizações disparadas</b>.');
    h += li('As tabelas mudaram em ' + plural(R.roundsChanged, 'rodada', 'rodadas') + (R.capHit ? ', e o limite de ' + R.rounds + ' rodadas foi atingido' : '') + ' até estabilizar.' + (R.res === 'partition' ? ' Como a rede ficou dividida, esse tempo é a <b>contagem ao infinito</b>: as métricas das rotas para o destino isolado sobem de 1 em 1 até 16 (seção 3.4.2).' : ''));
    if (R.res === 'partition') h += li(R.sh ? 'Mesmo com <b>split horizon</b> e poison reverse a contagem acontece: ele só rompe laços entre dois vizinhos, e esta topologia tem laços maiores.' : 'Sem split horizon, os roteadores trocam entre si rotas cada vez mais longas para o destino que já não existe.');
  }

  if (fp.reached) {
    h += li('<span class="chk-ok">Pacote entregue:</span> ' + esc(R.src) + ' → ' + caminho(fp.path) + ' → ' + esc(R.dst) + ', ' + plural(fp.metric, 'salto', 'saltos') + ' de roteador (métrica RIP).');
    if (R.sub === 'conv' && R.cmp) {
      const igual = R.cmp.path.join('>') === fp.path.join('>');
      h += li(igual ? 'O caminho de menor custo é o mesmo.' : 'O RIP ignorou o custo: o caminho escolhido custa <b>' + R.ripCost + '</b>, enquanto o de menor custo (' + caminho(R.cmp.path) + ') custa <b>' + R.cmp.cost + '</b>. Um protocolo de estado de enlace escolheria este.');
    }
    if (R.sub === 'falha' && R.res === 'rerouted') h += li('O caminho mudou de ' + caminho(R.before.path) + ' para ' + caminho(R.after.path) + '.');
    if (R.sub === 'falha' && R.res === 'same') h += li('O caminho continuou o mesmo: a falha atingiu rotas de outros destinos, mas não a deste.');
  } else {
    h += li('<span class="chk-bad">Pacote descartado:</span> ' + esc(fp.path[fp.path.length - 1]) + ' não tem rota para ' + esc(R.dst) + ' (métrica 16).');
  }
  h += li('Lição: ' + (R.sub === 'conv' ? 'o RIP conhece só o que os vizinhos anunciam e escolhe por <b>saltos</b>, sem enxergar custo nem mapa.' : 'o RIP reage a falhas por rodadas de anúncios, e quando a rede se divide a convergência é <b>lenta</b>.'));
  return h + '</ul>';
}
