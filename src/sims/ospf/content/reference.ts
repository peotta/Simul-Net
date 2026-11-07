// Aba Referência do simulador de OSPF.
export const reference: string = [
  '<h3>Roteamento por estado de enlace</h3><p>No <b>OSPF</b> (Open Shortest Path First, versão 2, RFC 2328), cada roteador descreve os próprios enlaces e os custos em um <b>LSA</b> (Link State Advertisement) e o inunda por toda a área. Quando todos têm a mesma <b>LSDB</b> (base de estado de enlace), cada um calcula sozinho a árvore de menor custo, com raiz em si mesmo, pelo algoritmo de <b>Dijkstra</b> (<b>SPF</b>, seção 16.1). O OSPF é um IGP (Interior Gateway Protocol) e transporta seus pacotes direto sobre o IP, protocolo 89.</p>',
  '<h3>Do Hello à tabela de rotas</h3><ul>' +
    '<li><b>Hello:</b> descobre vizinhos, em 224.0.0.5 (AllSPFRouters). Quando um roteador vê o próprio Router ID na lista de vizinhos do Hello recebido, o estado passa a <b>2-Way</b> (seção 10.5). Os padrões são HelloInterval de 10 s e RouterDeadInterval de 40 s em redes ponto a ponto e broadcast.</li>' +
    '<li><b>Adjacência:</b> os vizinhos trocam <b>DBD</b> (cabeçalhos dos LSAs), <b>LSR</b> (pedido dos LSAs que faltam), <b>LSU</b> (entrega dos LSAs) e <b>LSAck</b> (confirmação) até o estado <b>Full</b> (seção 10.1 e seção 7.2).</li>' +
    '<li><b>Inundação:</b> cada roteador origina o Router-LSA com os enlaces ativos e os custos. Quem recebe um LSA novo ou mais recente o guarda e o reenvia aos demais vizinhos (seção 13). O <b>número de sequência</b> decide qual LSA é o mais novo.</li>' +
    '<li><b>SPF:</b> cada roteador executa o Dijkstra sobre a LSDB e instala o próximo salto de cada destino.</li>' +
    '<li><b>Custo:</b> a RFC trata o custo da interface apenas como parâmetro configurável (quanto menor, mais preferido); vence o menor custo total. A fórmula "largura de banda de referência dividida pela do enlace" é prática de fabricantes, como o Cisco IOS, e não faz parte da RFC.</li></ul>',
  '<h3>Multiárea</h3><p>A <b>área 0</b> é o backbone, e toda área precisa se ligar a ela. Um <b>ABR</b> (Area Border Router) tem interfaces em mais de uma área e mantém uma LSDB por área. Os Router-LSAs não saem da própria área. Para que as áreas se alcancem, o ABR origina <b>Summary LSAs</b> (tipo 3, seção 12.4.3): cada um carrega só o destino e o custo, sem a topologia. O roteador interno soma o custo até o ABR ao custo anunciado e obtém uma rota <b>inter-área</b>. Uma falha dentro de uma área não obriga as outras a refazer o SPF, apenas a atualizar um custo.</p>',
  '<h3>Comparação com o RIP</h3><table class="sc-msgs"><thead><tr><th>Aspecto</th><th>OSPF</th><th>RIPv2</th></tr></thead><tbody>' +
    '<tr><td>Tipo</td><td class="meaning">Estado de enlace</td><td class="meaning">Vetor de distância</td></tr>' +
    '<tr><td>Algoritmo</td><td class="meaning">Dijkstra (SPF)</td><td class="meaning">Bellman-Ford</td></tr>' +
    '<tr><td>Métrica</td><td class="meaning">Custo configurável</td><td class="meaning">Saltos (máximo 15)</td></tr>' +
    '<tr><td>Visão da rede</td><td class="meaning">Mapa completo da área</td><td class="meaning">Só o que os vizinhos anunciam</td></tr>' +
    '<tr><td>Transporte</td><td class="meaning">IP protocolo 89, 224.0.0.5 e 224.0.0.6</td><td class="meaning">UDP 520, 224.0.0.9</td></tr>' +
    '<tr><td>Escala</td><td class="meaning">Grande, com áreas</td><td class="meaning">Pequena</td></tr></tbody></table>',
  '<h3>OSPF e segurança</h3><ul>' +
    '<li><b>Injeção de LSAs e de rotas:</b> um atacante na mesma rede pode anunciar LSAs falsos para desviar tráfego (homem no meio) ou criar um buraco negro. A defesa é a <b>autenticação</b>: no OSPFv2, o HMAC-SHA da RFC 5709 (a autenticação simples e o MD5 original são fracos).</li>' +
    '<li><b>Interfaces passivas:</b> desativar o Hello nas interfaces voltadas para usuários impede que um host participe do roteamento.</li>' +
    '<li><b>Filtragem e resumo de rotas:</b> reduzem o efeito de anúncios indevidos e da instabilidade de enlaces (flapping).</li>' +
    '<li><b>Proteção do plano de controle:</b> limitar quem pode enviar OSPF aos roteadores vizinhos conhecidos e usar o TTL de segurança (GTSM, RFC 5082) quando aplicável.</li></ul>',
  '<h3>O que o simulador simplifica</h3><ul>' +
    '<li>Todos os enlaces são ponto a ponto: não há eleição de <b>DR</b> e <b>BDR</b> (redes de acesso múltiplo), e o endereço 224.0.0.6 (AllDRouters) aparece só nesta referência.</li>' +
    '<li>Cada roteador anuncia um destino: o próprio Router ID. As redes dos PCs não entram em LSAs próprios (não há Network-LSA, Type 5 nem áreas stub).</li>' +
    '<li>A inundação mostra um LSU por enlace e sentido, por rodada, com atraso fixo, e <b>não mostra o LSAck</b> da fase de inundação (só o da adjacência). A ordem real depende de temporizadores.</li>' +
    '<li>Os Summary LSAs são calculados sobre a topologia verdadeira, que é o que a LSDB teria depois de convergir; o simulador não mostra o cálculo de cada ABR passo a passo.</li>' +
    '<li>O custo de cada enlace é fixo no cenário, sem cálculo por largura de banda de referência. OSPFv3 e IPv6 estão fora do escopo.</li>' +
    '<li>A detecção da falha é instantânea no desenho; em redes reais depende do RouterDeadInterval (40 s) ou de BFD.</li></ul>',
  '<h3>Roteiro de exercícios</h3><ol>' +
    '<li>No modo <b>Convergência</b>, anote o caminho de PC-A a PC-B. Todos os caminhos de R1 a R6 têm 3 saltos; por que o OSPF escolheu R1, R2, R3, R6?</li>' +
    '<li>Na aba <b>LSDB</b>, escolha R1 e compare com R6 depois da inundação. O que mudou entre os dois? E na <b>Tabela de roteamento</b>?</li>' +
    '<li>No modo <b>Evento</b>, aumente o custo de <b>L3 (R2 / R3)</b> para 50. Quais roteadores originam novos LSAs, e qual é o novo caminho?</li>' +
    '<li>Derrube o enlace <b>L3</b> e depois <b>L1</b>. Em qual caso o tráfego deixa de passar por R2? Troque o custo de um enlace fora do caminho: o tráfego muda?</li>' +
    '<li>Isole o PC-B derrubando <b>L5</b> e <b>L7</b>. O que acontece com a tabela dos outros roteadores?</li>' +
    '<li>No modo <b>Multiárea</b>, identifique os ABRs. Compare a LSDB de R1, R2 e R4. Por que R1 não tem o Router-LSA de R7?</li>' +
    '<li>Ponha o enlace <b>MA12</b> fora de serviço. O que muda no custo até R7 que R1 enxerga?</li>' +
    '<li><b>Segurança:</b> um host na rede do PC-A passa a enviar LSAs falsos. Que configurações impediriam a injeção?</li></ol>',
].join('');
