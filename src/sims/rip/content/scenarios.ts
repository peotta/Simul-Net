// Cenários e documentação do simulador de RIP.
import type { ScenarioDef, ScenarioDoc } from '../../../sim-core/ui';

export const stageTitles: Record<string, string> = {
  conv: 'Convergência do RIPv2: rodadas de Response (Bellman-Ford)',
  falha: 'Falha de enlace: atualização disparada e contagem ao infinito',
};

const base = { dir: 'PC-A', sh: true, root: 'R1' };

export const scenarios: ScenarioDef[] = [
  { id: 'rip', g: 'Convergência', sub: 'conv', label: 'Convergência do RIPv2', set: { ...base, cost23: 10 }, what: '<p>Cada roteador começa conhecendo só a si mesmo. A cada rodada, todos enviam o <b>vetor de distância</b> aos vizinhos, que somam 1 e adotam a rota se ela for melhor. Na aba <b>Tabela de roteamento</b>, veja a tabela do roteador escolhido crescer rodada a rodada.</p><p>O caminho do PC-A ao PC-B é R1, R2, R3, R6, com 3 saltos.</p>' },
  { id: 'ripcost', g: 'Convergência', sub: 'conv', label: 'O RIP ignora o custo', set: { ...base, cost23: 50 }, what: '<p>O custo do enlace <b>R2 / R3</b> sobe para 50, mas o RIP conta só saltos: o caminho continua R1, R2, R3, R6, que agora custa 70. O resultado mostra, para comparação, o caminho que o OSPF escolheria (R1, R2, R5, R6, custo 45).</p>' },
  { id: 'ripfail', g: 'Falhas', sub: 'falha', label: 'Queda do enlace R2 / R3', set: { ...base, link: 'L3', link2: 'none' }, what: '<p>A rede já convergiu. O enlace <b>L3 (R2 / R3)</b> cai: R2 e R3 marcam com métrica 16 as rotas que passavam por ele e anunciam a mudança na hora (<b>atualização disparada</b>). Em poucas rodadas as tabelas se ajustam e o tráfego passa por R4 e R5.</p>' },
  { id: 'infinity', g: 'Falhas', sub: 'falha', label: 'Contagem ao infinito (sem split horizon)', set: { ...base, sh: false, link: 'L5', link2: 'L7' }, what: '<p>Caem <b>L5 (R3 / R6)</b> e <b>L7 (R5 / R6)</b> e o R6, com o PC-B, fica isolado. Sem split horizon, os roteadores continuam anunciando uns aos outros caminhos para R6 que já não existem, e a métrica sobe de 1 em 1 até 16. Veja a métrica de R6 crescer a cada rodada na aba Tabela de roteamento.</p>' },
  { id: 'ripiso', g: 'Falhas', sub: 'falha', label: 'Isolamento com split horizon', set: { ...base, sh: true, link: 'L5', link2: 'L7' }, what: '<p>A mesma falha, agora com split horizon e poison reverse. Ele evita o laço entre dois vizinhos, mas a topologia tem laços de três ou mais roteadores, e a contagem ao infinito acontece do mesmo jeito: <b>o split horizon não elimina o problema</b>.</p>' },
];

export const groupDoc: Record<string, string> = {
  Convergência: 'Como os roteadores aprendem as rotas só com o que os vizinhos anunciam, e por que a métrica é o número de saltos.',
  Falhas: 'Como o RIP reage a uma falha, e por que a convergência é lenta quando a rede se divide.',
};

export const scenDoc: Record<string, ScenarioDoc> = {
  rip: {
    short: 'Vetores de distância trocados em rodadas até as tabelas estabilizarem.',
    concept: 'O <b>RIPv2</b> (RFC 2453) é um protocolo de <b>vetor de distância</b>: cada roteador anuncia aos vizinhos a lista de destinos que alcança e a métrica (número de saltos). Quem recebe soma 1 e adota a rota se ela for melhor ou se vier do próximo salto atual (<b>Bellman-Ford</b>, seção 3.9.2). O roteador nunca vê o mapa, só o que os vizinhos dizem.',
    observe: ['No diagrama: uma Response por enlace e sentido em cada rodada.', 'Na aba Tabela de roteamento: o roteador escolhido aprende os vizinhos na rodada 1, os vizinhos dos vizinhos na 2, e assim por diante.', 'A última rodada não muda nada: é assim que se sabe que convergiu.'],
    msgs: [['Response', 'anuncia o vetor de distância (UDP 520, 224.0.0.9)', 'todos os roteadores, a cada rodada']],
    why: 'A informação viaja um salto por rodada. Em redes reais, as rodadas são de 30 s, e é por isso que o RIP converge devagar.',
  },
  ripcost: {
    short: 'O RIP escolhe por saltos, mesmo com um enlace caro no caminho.',
    concept: 'A métrica do RIP é o número de saltos (de 1 a 15; 16 é infinito). O custo, a largura de banda ou a latência dos enlaces não entram na conta. Um caminho curto e lento ganha de um caminho um pouco mais longo e rápido.',
    observe: ['O caminho continua R1, R2, R3, R6, igual ao do cenário anterior.', 'No resultado: o custo do caminho do RIP (70) contra o do caminho de menor custo (45).'],
    msgs: [['Response', 'só leva a métrica em saltos, sem custo', 'todos os roteadores']],
    why: 'É a razão principal de o RIP ter dado lugar ao OSPF e ao EIGRP em redes com enlaces de velocidades diferentes.',
  },
  ripfail: {
    short: 'A atualização disparada propaga a falha sem esperar os 30 s.',
    concept: 'Quando um enlace cai, as duas pontas marcam com métrica 16 as rotas que passavam por ele e enviam uma <b>atualização disparada</b> (<b>triggered update</b>, seção 3.4.4), sem esperar o próximo ciclo de 30 s. Os vizinhos aceitam o 16, e as rotas alternativas, quando existem, são aprendidas nas rodadas seguintes.',
    observe: ['O Response sem resposta, em vermelho, no enlace caído.', 'Na aba Tabela de roteamento: rotas em 16 logo após a falha e a rota nova nas rodadas seguintes.', 'O pacote segue por outro caminho, também de 3 saltos.'],
    msgs: [['Response (sem resposta)', 'indica que o vizinho deixou de anunciar', 'as duas pontas do enlace'], ['Response disparado', 'anuncia a mudança de imediato', 'quem teve a tabela alterada']],
    why: 'Sem o triggered update, a falha só seria percebida depois do timeout de 180 s (seção 3.8) e propagada de 30 em 30 segundos.',
  },
  infinity: {
    short: 'Sem split horizon, as métricas sobem até 16, uma por rodada.',
    concept: 'Quando um destino some, os roteadores que ainda têm uma rota para ele via um vizinho confundem o anúncio desse vizinho com um caminho novo. Cada um anuncia ao outro uma rota um salto mais longa, e a métrica sobe a cada rodada até chegar ao <b>infinito</b> (16). É a <b>contagem ao infinito</b> (RFC 2453, seção 3.4.2), e é por isso que o RIP limita a rede a 15 saltos.',
    observe: ['Na aba Tabela de roteamento de R5 ou R2: a métrica de R6 sobe de rodada em rodada.', 'Durante a contagem, os roteadores ainda encaminhariam pacotes para R6 por rotas que já não existem; o pacote de teste só é enviado depois que tudo estabiliza.', 'O número de rodadas até estabilizar, no resumo do Experimento.'],
    msgs: [['Response', 'leva a rota para R6 com métrica cada vez maior', 'R2, R3, R4 e R5']],
    why: 'Durante a contagem a rede perde pacotes. Este é um dos motivos de o RIP ser indicado só para redes pequenas.',
  },
  ripiso: {
    short: 'O split horizon não resolve laços de três ou mais roteadores.',
    concept: 'O <b>split horizon com poison reverse</b> (seção 3.4.3) faz o roteador devolver a rota ao vizinho de quem a aprendeu com métrica 16. Isso rompe o laço entre <b>dois</b> vizinhos. Nesta topologia, porém, os laços passam por três ou mais roteadores (por exemplo R1, R2, R5 e R4), e o split horizon não os enxerga: a contagem ao infinito continua.',
    observe: ['Compare o número de rodadas com o do cenário sem split horizon: é o mesmo.', 'O poison reverse aparece nos campos do Response: rotas aprendidas de um vizinho voltam a ele com 16.'],
    msgs: [['Response', 'com poison reverse para o vizinho de quem a rota foi aprendida', 'todos os roteadores']],
    why: 'Mecanismos como o holddown e o route poisoning (com triggered update) reduzem o problema, mas a solução de fundo é usar outro tipo de protocolo (estado de enlace) em redes maiores.',
  },
};
