// Cenários e documentação do simulador de OSPF.
import type { ScenarioDef, ScenarioDoc } from '../../../sim-core/ui';

export const stageTitles: Record<string, string> = {
  conv: 'Convergência do OSPF: Hello, adjacência, inundação e SPF',
  evento: 'Reação do OSPF a uma mudança de custo ou a uma falha',
  multi: 'OSPF multiárea: LSAs por área e Summary LSAs dos ABRs',
};

const base = { dir: 'PC-A' };

export const scenarios: ScenarioDef[] = [
  { id: 'ospf', g: 'Convergência', sub: 'conv', label: 'Convergência em área única', set: { ...base, root: 'R1' }, what: '<p>Acompanhe as quatro fases: <b>Hello</b> (vizinhos em 2-Way), <b>adjacência</b> (DBD, LSR, LSU e LSAck até Full), <b>inundação</b> dos Router-LSAs e <b>SPF</b>. Em seguida o PC-A envia um pacote ao PC-B.</p><p>O caminho escolhido é R1, R2, R3 e R6, com custo 30. Todos os caminhos entre R1 e R6 têm 3 saltos; o R1, R4, R5, R6, por exemplo, custa 50. O OSPF escolhe pelo <b>custo</b>, não pelo número de saltos.</p>' },
  { id: 'cost', g: 'Custo e falha', sub: 'evento', label: 'Custo 50 em R2 / R3', set: { ...base, ev: 'custo', link: 'L3', custo: 50, link2: 'none', root: 'R1' }, what: '<p>A rede já convergiu. O custo do enlace <b>L3 (R2 / R3)</b> passa de 10 para 50. Só <b>R2 e R3</b> originam novos Router-LSAs (sequência maior), que são inundados; depois todos recalculam o SPF.</p><p>O novo caminho é R1, R2, R5, R6 com custo 45. Na aba Tabela de roteamento, o roteador escolhido mostra a tabela antes e depois do SPF.</p>' },
  { id: 'ospffail', g: 'Custo e falha', sub: 'evento', label: 'Queda do enlace R2 / R3', set: { ...base, ev: 'queda', link: 'L3', custo: 10, link2: 'none', root: 'R1' }, what: '<p>O enlace <b>L3</b> cai. R2 e R3 perdem a adjacência (por falha da interface ou por RouterDeadInterval) e originam novos LSAs sem o enlace. O destino continua alcançável por outro caminho.</p>' },
  { id: 'ospfiso', g: 'Custo e falha', sub: 'evento', label: 'Isolamento do PC-B', set: { ...base, ev: 'queda', link: 'L5', custo: 10, link2: 'L7', root: 'R1' }, what: '<p>Caem <b>L5 (R3 / R6)</b> e <b>L7 (R5 / R6)</b>: o R6 fica sem vizinhos e o PC-B deixa de ser alcançável. Os outros roteadores removem R6 da LSDB e da tabela; o pacote é descartado ao chegar ao último roteador que tinha rota.</p>' },
  { id: 'multi', g: 'Multiárea', sub: 'multi', label: 'Três áreas e Summary LSAs', set: { ...base, mlink: 'none', rootm: 'R1' }, what: '<p>Nove roteadores em três áreas: 1, 0 (backbone) e 2. Os <b>ABRs</b> R2, R3, R8 e R9 pertencem a duas áreas. Cada área inunda só os próprios LSAs, e depois os ABRs anunciam as outras áreas por <b>Summary LSAs</b> (tipo 3).</p><p>Escolha R1 em <b>Ver a LSDB</b>: ele não tem o Router-LSA de R7, só um Summary LSA com o custo até R7.</p>' },
  { id: 'multifail', g: 'Multiárea', sub: 'multi', label: 'Enlace R4 / R8 fora de serviço', set: { ...base, mlink: 'MA12', rootm: 'R1' }, what: '<p>Com <b>MA12 (R4 / R8)</b> fora de serviço, o tráfego do backbone para a área 2 passa por <b>R6 e R9</b>. O custo anunciado nos Summary LSAs cresce, e o caminho do PC-A ao PC-B muda sem que R1 saiba por onde.</p>' },
];

export const groupDoc: Record<string, string> = {
  Convergência: 'Como roteadores sem nenhuma rota chegam a um mapa comum da rede e calculam o melhor caminho.',
  'Custo e falha': 'Como o OSPF reage depois de convergir: um novo LSA é inundado e cada roteador refaz o SPF.',
  Multiárea: 'Como as áreas limitam a inundação e como os ABRs resumem uma área para as outras.',
};

export const scenDoc: Record<string, ScenarioDoc> = {
  ospf: {
    short: 'Todos os roteadores obtêm a mesma LSDB e calculam o caminho de menor custo.',
    concept: 'O <b>OSPF</b> (RFC 2328) é um protocolo de <b>estado de enlace</b>: cada roteador descreve os próprios enlaces em um <b>Router-LSA</b>, e a inundação entrega todos os LSAs a todos os roteadores da área. Com a mesma <b>LSDB</b>, cada um executa o <b>SPF</b> (Dijkstra, seção 16.1) com raiz em si mesmo e instala o próximo salto de cada destino.',
    observe: ['No diagrama: Hello, adjacência, inundação e SPF, uma fase depois da outra.', 'Na aba LSDB: o conteúdo do roteador escolhido cresce com as rodadas de inundação.', 'Na aba Tabela de roteamento: custo e próximo salto de cada destino, calculados pelo SPF.'],
    msgs: [['Hello', 'descobre vizinhos e mantém a adjacência', 'todos os roteadores'], ['DBD, LSR, LSU e LSAck', 'sincronizam a LSDB entre vizinhos', 'cada par de vizinhos'], ['LSU com Router-LSA', 'inunda o estado dos enlaces', 'todos os roteadores']],
    why: 'Como todos enxergam o mesmo mapa, o resultado é um caminho sem laços e a convergência é rápida. O custo, e não o número de saltos, define a escolha.',
  },
  cost: {
    short: 'Uma mudança de custo gera novos LSAs e um novo SPF.',
    concept: 'Quando o custo de um enlace muda, os <b>dois</b> roteadores do enlace originam um novo Router-LSA com <b>número de sequência maior</b>. Os demais aceitam o LSA mais novo, descartam o antigo e refazem o SPF. A topologia não mudou, mas os custos sim, e o caminho de menor custo pode ser outro.',
    observe: ['Só R2 e R3 originam LSAs novos (sequência 0x80000002).', 'Na aba LSDB: o LSA de R2 e R3 com o custo novo, depois da inundação.', 'Na aba Tabela de roteamento: antes e depois do SPF.'],
    msgs: [['LSU', 'leva o Router-LSA novo', 'R2 e R3, depois todos'], ['SPF', 'recalcula a árvore de menor custo', 'todos os roteadores']],
    why: 'Mostra por que o administrador usa o custo para fazer engenharia de tráfego: o caminho muda sem mexer na topologia.',
  },
  ospffail: {
    short: 'A falha é detectada e o enlace sai dos Router-LSAs.',
    concept: 'A falha é detectada porque a interface cai ou porque o <b>RouterDeadInterval</b> (40 s por padrão) expira sem Hello. As duas pontas originam um novo Router-LSA sem o enlace, o LSA é inundado e todos refazem o SPF. Detecção mais rápida usa BFD, que está fora do escopo do simulador.',
    observe: ['O Hello sem resposta, em vermelho, no enlace caído.', 'Os dois roteadores originam novos LSAs.', 'O pacote segue por outro caminho, com custo maior.'],
    msgs: [['Hello (sem resposta)', 'indica que o vizinho não responde', 'as duas pontas do enlace'], ['LSU', 'leva o Router-LSA sem o enlace', 'as duas pontas, depois todos']],
    why: 'A rapidez da reconvergência depende da detecção da falha e do tempo de inundação e de SPF. Em produção, esses temporizadores são ajustados.',
  },
  ospfiso: {
    short: 'Sem nenhum caminho, o destino sai da tabela e o pacote é descartado.',
    concept: 'Se a falha divide a rede em duas partes, cada parte passa a ter uma LSDB sem a outra. O SPF não encontra mais o destino, que sai da tabela de rotas. O pacote é encaminhado até o último roteador que ainda tinha rota e descartado ali.',
    observe: ['R6 fica sem adjacências.', 'Na aba Tabela de roteamento: R6 aparece sem rota.', 'O último evento é o descarte do pacote.'],
    msgs: [['Hello (sem resposta)', 'detecta a perda dos vizinhos de R6', 'R3, R5 e R6'], ['LSU', 'leva os Router-LSAs sem os enlaces', 'R3 e R5, na parte conectada']],
    why: 'Mostra que o roteamento dinâmico só encontra caminhos que existem: a redundância física precisa ser projetada.',
  },
  multi: {
    short: 'Cada área inunda os próprios LSAs e os ABRs resumem as outras áreas.',
    concept: 'Em redes grandes, o OSPF divide a rede em <b>áreas</b> ligadas à <b>área 0</b> (backbone). Os Router-LSAs ficam dentro da própria área, o que reduz a LSDB e o custo do SPF. Os <b>ABRs</b> (Area Border Routers) pertencem a duas áreas e anunciam cada área às outras por <b>Summary LSAs</b> (tipo 3, RFC 2328 seção 12.4.3), que carregam só o destino e o custo.',
    observe: ['As LSDBs são diferentes entre áreas: R1 não tem o Router-LSA de R7.', 'Os ABRs têm uma LSDB para cada área.', 'Na aba Tabela de roteamento: rotas intra-área e inter-área (via ABR).'],
    msgs: [['LSU com Router-LSA', 'inunda os enlaces dentro de uma área', 'os roteadores da área'], ['LSU com Summary LSA', 'anuncia um destino de outra área e o custo', 'R2, R3, R8 e R9 (ABRs)']],
    why: 'O resumo esconde a topologia interna de cada área: uma falha dentro de uma área não obriga as outras a refazer o SPF, só a atualizar um custo.',
  },
  multifail: {
    short: 'A falha no backbone muda o custo dos Summary LSAs.',
    concept: 'O custo que um ABR anuncia no Summary LSA inclui o caminho dentro do backbone. Quando o enlace MA12 cai, o caminho de R4 até a área 2 passa por R6 e R9, e os custos anunciados aumentam. Os roteadores da área 1 só enxergam esse custo maior.',
    observe: ['O caminho do pacote passa por R9.', 'Na aba Tabela de roteamento de R1: o custo até R7 é maior.', 'R1 não sabe quais enlaces foram usados dentro do backbone.'],
    msgs: [['LSU com Summary LSA', 'leva o custo atualizado até as outras áreas', 'os ABRs']],
    why: 'É a vantagem e o preço do resumo: a rede escala, mas o roteador interno não vê o caminho completo.',
  },
};
