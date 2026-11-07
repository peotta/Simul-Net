// Aba Referência do simulador de RIP.
export const reference: string = [
  '<h3>Roteamento por vetor de distância</h3><p>No <b>RIP</b> (Routing Information Protocol, versão 2, RFC 2453), cada roteador conhece só o que os vizinhos anunciam: uma lista de destinos com a distância até cada um. Não há mapa da rede. O roteador soma a distância até o vizinho à que ele anuncia e adota o melhor resultado, pelo algoritmo de <b>Bellman-Ford</b> distribuído. O RIP é um IGP (Interior Gateway Protocol), e a versão 2 acrescenta máscara de sub-rede, próximo salto, etiqueta de rota e autenticação à versão 1.</p>',
  '<h3>Como funciona</h3><ul>' +
    '<li><b>Métrica:</b> número de saltos. O valor 16 significa inalcançável, o que limita a rede a 15 saltos (seção 3.1).</li>' +
    '<li><b>Mensagens:</b> Request e <b>Response</b>, em UDP porta 520. O RIPv2 envia por multicast 224.0.0.9 (seção 4.5). Cada mensagem leva até 25 rotas (seção 3.6).</li>' +
    '<li><b>Atualização periódica:</b> a cada 30 s, cada roteador envia a tabela inteira aos vizinhos. Uma rota sem atualização por 180 s expira, e é removida depois de mais 120 s (seção 3.8).</li>' +
    '<li><b>Regra de atualização:</b> o roteador soma 1 à métrica recebida e adota a rota se ela for melhor que a atual ou se vier do próximo salto atual, o que permite aceitar também notícias ruins (seção 3.9.2).</li>' +
    '<li><b>Atualização disparada:</b> depois de uma mudança, o roteador anuncia a alteração imediatamente (seção 3.4.4).</li></ul>',
  '<h3>Contagem ao infinito e split horizon</h3><p>Se um destino some, roteadores que ainda têm uma rota para ele via o vizinho podem aceitar do próprio vizinho um caminho que depende deles. Cada um anuncia ao outro uma rota mais longa, e a métrica sobe a cada rodada até 16: é a <b>contagem ao infinito</b> (seção 3.4.2), e é por ela que o infinito é tão pequeno. Enquanto isso o tráfego é perdido.</p>' +
    '<p>O <b>split horizon</b> não anuncia a um vizinho as rotas aprendidas dele. Com <b>poison reverse</b>, as anuncia com métrica 16 (seção 3.4.3). Isso evita o laço entre dois vizinhos, mas não os laços com três ou mais roteadores, que a topologia deste simulador contém: por isso a contagem ao infinito ainda acontece mesmo com ele ligado. Outras técnicas, como o <i>holddown</i>, são práticas de fabricantes e não são simuladas.</p>',
  '<h3>Comparação com o OSPF</h3><table class="sc-msgs"><thead><tr><th>Aspecto</th><th>RIPv2</th><th>OSPF</th></tr></thead><tbody>' +
    '<tr><td>Tipo</td><td class="meaning">Vetor de distância</td><td class="meaning">Estado de enlace</td></tr>' +
    '<tr><td>Algoritmo</td><td class="meaning">Bellman-Ford</td><td class="meaning">Dijkstra (SPF)</td></tr>' +
    '<tr><td>Métrica</td><td class="meaning">Saltos (máximo 15)</td><td class="meaning">Custo configurável</td></tr>' +
    '<tr><td>Visão da rede</td><td class="meaning">Só o que os vizinhos anunciam</td><td class="meaning">Mapa completo da área</td></tr>' +
    '<tr><td>Convergência</td><td class="meaning">Lenta, em rodadas</td><td class="meaning">Rápida</td></tr>' +
    '<tr><td>Transporte</td><td class="meaning">UDP 520, 224.0.0.9</td><td class="meaning">IP protocolo 89, 224.0.0.5 e 224.0.0.6</td></tr>' +
    '<tr><td>Escala</td><td class="meaning">Pequena</td><td class="meaning">Grande, com áreas</td></tr></tbody></table>',
  '<h3>RIP e segurança</h3><ul>' +
    '<li><b>Injeção de rotas:</b> qualquer host na rede pode enviar Response e anunciar rotas falsas para desviar tráfego ou criar um buraco negro. A defesa é a <b>autenticação</b> do RIPv2: a senha simples (seção 4.1) é fraca; o MD5 e o HMAC-SHA da RFC 4822 são os indicados.</li>' +
    '<li><b>Interfaces passivas:</b> desativar o envio e a recepção de atualizações nas interfaces voltadas para usuários impede que um host participe do roteamento.</li>' +
    '<li><b>Filtragem de rotas:</b> aceitar só os prefixos esperados reduz o efeito de anúncios indevidos.</li>' +
    '<li><b>Limite de saltos:</b> o infinito em 16 impede que uma rota falsa viaje indefinidamente.</li></ul>',
  '<h3>O que o simulador simplifica</h3><ul>' +
    '<li>As rodadas são síncronas: todos enviam e recebem ao mesmo tempo. Em uma rede real, cada roteador tem seu relógio de 30 s, e a atualização disparada tem atraso aleatório de 1 a 5 s (seção 3.10.1).</li>' +
    '<li>Não há timeout de 180 s nem garbage collection de 120 s: a falha é detectada de imediato, e as rotas inalcançáveis ficam na tabela com métrica 16.</li>' +
    '<li>Cada roteador anuncia um destino: o próprio Router ID, e não as redes dos PCs. Não há Request, etiqueta de rota, rotas externas nem autenticação.</li>' +
    '<li>Os atrasos dos enlaces são fixos e iguais. RIPng e IPv6 estão fora do escopo.</li></ul>',
  '<h3>Roteiro de exercícios</h3><ol>' +
    '<li>No modo <b>Convergência</b>, escolha R1 e acompanhe a tabela rodada a rodada. Em que rodada R1 aprende R6? Por quê?</li>' +
    '<li>Aumente o custo de <b>R2 / R3</b> para 50. O caminho muda? Compare o custo dele com o do caminho de menor custo.</li>' +
    '<li>No modo <b>Falha</b>, derrube <b>L3</b>. Quantas rodadas até estabilizar? Qual é o novo caminho?</li>' +
    '<li>Isole o PC-B derrubando <b>L5</b> e <b>L7</b>, sem split horizon. Veja a métrica de R6 em R2 crescer. Por que ela para em 16?</li>' +
    '<li>Repita com split horizon. O número de rodadas muda? Por que a contagem ao infinito acontece mesmo assim nesta topologia?</li>' +
    '<li><b>Segurança:</b> um host na rede do PC-A passa a enviar Response com rotas falsas. Que configurações impediriam a injeção?</li></ol>',
].join('');
