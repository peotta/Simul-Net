// Aba Referência do simulador IPv4.
export const reference: string = [
  '<h3>O que o IPv4 faz</h3><p>O IP (RFC 791) entrega datagramas de uma origem a um destino pela rede, salto a salto, sem garantia de entrega, de ordem ou de ausência de duplicatas. Cada roteador decide sozinho, olhando só o endereço de destino e a própria tabela de rotas. Confiabilidade e ordem ficam para as camadas de cima (por exemplo, o TCP).</p>',
  '<h3>Decisão do host: mesma rede ou gateway</h3><ul>' +
    '<li>O host faz um E lógico entre o endereço de destino e a máscara e compara com a própria rede (RFC 1122, seção 3.3.1.1; RFC 1812, seção 5.2.4.2).</li>' +
    '<li><b>Igual:</b> entrega direta. O host resolve por ARP o MAC do destino.</li>' +
    '<li><b>Diferente:</b> o quadro vai ao gateway. O MAC de destino é o do gateway e o IP de destino continua sendo o final. O gateway precisa estar na sub-rede do host, porque é alcançado por ARP.</li></ul>',
  '<h3>Decisão do roteador: o prefixo mais específico</h3><ol>' +
    '<li>Seleciona todas as rotas cujo prefixo contém o destino.</li>' +
    '<li>Fica com a de <b>maior comprimento de prefixo</b> (RFC 1812, seção 5.2.4.3). A rota padrão, 0.0.0.0/0, é a de menor prefixo e só vence quando nada mais casa.</li>' +
    '<li>Em empate de prefixo, usa a <b>preferência administrativa</b> (RFC 1812, seção 5.2.4.4), que nas implementações aparece como distância administrativa, e depois a métrica da rota.</li>' +
    '<li>Sem nenhuma rota, descarta o pacote e envia ICMP 3/0 (rede inalcançável).</li></ol>' +
    '<table class="sc-msgs"><thead><tr><th>Origem da rota</th><th>Distância administrativa usual</th></tr></thead><tbody><tr><td>Conectada</td><td class="meaning">0</td></tr><tr><td>Estática</td><td class="meaning">1</td></tr><tr><td>OSPF</td><td class="meaning">110</td></tr></tbody></table><p>Os valores são convenções de fabricantes (os do quadro são os mais comuns), e não de RFC.</p>',
  '<h3>TTL e ICMP</h3><ul>' +
    '<li>Todo roteador que encaminha um pacote decrementa o TTL de ao menos um. Se ele chegaria a zero, o roteador descarta e envia à origem ICMP 11/0, Time Exceeded (RFC 1812, seção 5.3.1).</li>' +
    '<li>Sem rota, o roteador envia ICMP 3/0 (rede inalcançável). Quando a rede é conectada mas o host não responde, envia 3/1 (host inalcançável).</li>' +
    '<li>Nunca se gera um erro ICMP sobre outro erro ICMP (RFC 1812, seção 4.3.2.7).</li>' +
    '<li>O checksum do cabeçalho (RFC 1071) cobre só o cabeçalho e é recalculado a cada salto, porque o TTL muda.</li></ul>',
  '<h3>Defesa na borda: uRPF</h3><ul>' +
    '<li><b>Estrito</b> (RFC 3704, seção 2.2): aceita o pacote só se a rota de volta para a origem sai pela interface de chegada. Barra bem origens forjadas, mas exige rotas simétricas.</li>' +
    '<li><b>Flexível</b> (seção 2.4): aceita se existir qualquer rota para a origem. Com uma rota padrão, isso vale para qualquer endereço, salvo nas implementações que a ignoram nessa conferência (seção 2.5).</li>' +
    '<li>A recomendação de filtrar origens inválidas na entrada da rede é o BCP 38 (RFC 2827).</li></ul>',
  '<h3>Blocos de endereço especiais</h3><table class="sc-msgs"><thead><tr><th>Bloco</th><th>Uso</th><th>Definido em</th></tr></thead><tbody>' +
    '<tr><td>10.0.0.0/8, 172.16.0.0/12 e 192.168.0.0/16</td><td class="meaning">uso privado, não roteado na internet</td><td class="meaning">RFC 1918</td></tr>' +
    '<tr><td>100.64.0.0/10</td><td class="meaning">espaço compartilhado do NAT de operadora</td><td class="meaning">RFC 6598</td></tr>' +
    '<tr><td>127.0.0.0/8</td><td class="meaning">loopback, nunca sai do host (não simulado: nenhum pacote chega à rede)</td><td class="meaning">RFC 1122, seção 3.2.1.3</td></tr>' +
    '<tr><td>169.254.0.0/16</td><td class="meaning">link-local, nunca é encaminhado</td><td class="meaning">RFC 3927</td></tr>' +
    '<tr><td>192.0.2.0/24, 198.51.100.0/24 e 203.0.113.0/24</td><td class="meaning">documentação e exemplos</td><td class="meaning">RFC 5737</td></tr>' +
    '<tr><td>255.255.255.255</td><td class="meaning">broadcast limitado, nunca é encaminhado</td><td class="meaning">RFC 919</td></tr></tbody></table><p>A lista completa e atual está no registro de endereços de uso especial (RFC 6890, atualizada pela RFC 8190).</p>',
  '<h3>Broadcast e /31</h3><ul>' +
    '<li><b>Da sub-rede:</b> o último endereço da rede. O quadro vai a ff:ff:ff:ff:ff:ff e todos do enlace o recebem. Um host pode descartar eco enviado a endereço de broadcast (RFC 1122, seção 3.2.2.6).</li>' +
    '<li><b>Dirigido:</b> o broadcast de uma rede remota. O padrão dos roteadores é <b>não encaminhar</b> (RFC 2644, seção 5.3.5.2), para evitar a amplificação de tráfego.</li>' +
    '<li><b>/31:</b> em enlaces ponto a ponto, os dois endereços são de hosts, sem endereço de rede nem de broadcast (RFC 3021, seção 2.1).</li></ul>',
  '<h3>Limitações do simulador</h3><p>As rotas são estáticas, e as entradas "OSPF" são apenas rotas de outra origem, sem o protocolo em execução (veja os simuladores de OSPF, RIP, BGP e IS-IS). Não há ECMP, roteamento por política, multicast, opções IP, fragmentação (veja o simulador de ICMP para a fragmentação e o PMTUD) nem IPv6. As tabelas ARP já estão preenchidas, exceto no primeiro salto do host A. O ping é só a sonda: os tempos são didáticos e não há tráfego real. A distância administrativa e as métricas seguem convenções comuns de fabricantes. No uRPF flexível, o simulador considera a rota padrão como qualquer outra rota. Os endereços são de uso privado (RFC 1918) e de documentação (RFC 5737).</p>',
].join('');
