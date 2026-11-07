// Aba Referência do simulador de MPLS.
export const reference: string = [
  '<h3>O que é o MPLS</h3><p>No <b>Multiprotocol Label Switching</b> (RFC 3031), o roteador de entrada classifica o pacote uma única vez em uma <b>FEC</b> (Forwarding Equivalence Class, por exemplo um prefixo de destino) e cola nele um <b>rótulo</b> curto. No núcleo, cada LSR encaminha consultando só o rótulo, sem olhar o cabeçalho IP. O caminho percorrido por uma FEC é o <b>LSP</b> (Label Switched Path), que é <b>unidirecional</b>: ida e volta usam LSPs e rótulos diferentes.</p>' +
    '<ul><li><b>LER / PE (Provider Edge):</b> borda. Faz <b>push</b> (impõe o rótulo) na entrada e remove a pilha na saída.</li>' +
    '<li><b>LSR / P (Provider):</b> núcleo. Faz <b>swap</b> (troca o rótulo do topo) ou <b>pop</b> (remove).</li>' +
    '<li><b>Rótulo de significado local:</b> cada LSR escolhe os próprios rótulos. O mesmo número pode significar FECs diferentes em LSRs diferentes. Neste simulador, cada LSR usa uma faixa própria (PE1 100+, P1 200+...) só para facilitar a leitura.</li></ul>',
  '<h3>Cabeçalho de rótulo (RFC 3032)</h3><p>O rótulo fica entre o cabeçalho de enlace e o IP (EtherType <b>0x8847</b>). Cada entrada da pilha tem 32 bits:</p>' +
    '<pre>| Rótulo (20 bits) | TC (3) | S (1) | TTL (8) |\n  TC: Traffic Class, antes chamado EXP (RFC 5462), usado para QoS\n  S:  1 na última entrada da pilha (fundo)\n  TTL: decrementado a cada LSR, como no IP</pre>' +
    '<table class="sc-msgs"><thead><tr><th>Rótulo</th><th>Nome</th><th>Uso</th></tr></thead><tbody>' +
    '<tr><td>0</td><td class="meaning">IPv4 Explicit NULL</td><td class="meaning">O egresso pede para receber o pacote rotulado (preserva o TC para QoS) e então faz pop</td></tr>' +
    '<tr><td>1</td><td class="meaning">Router Alert</td><td class="meaning">Entrega ao plano de controle do LSR</td></tr>' +
    '<tr><td>2</td><td class="meaning">IPv6 Explicit NULL</td><td class="meaning">Igual ao 0, para IPv6</td></tr>' +
    '<tr><td>3</td><td class="meaning">Implicit NULL</td><td class="meaning">Anunciado pelo egresso, nunca aparece no pacote: o penúltimo salto faz pop (PHP)</td></tr>' +
    '<tr><td>7</td><td class="meaning">Entropy Label Indicator</td><td class="meaning">Balanceamento de carga (RFC 6790)</td></tr>' +
    '<tr><td>13</td><td class="meaning">GAL</td><td class="meaning">Canal de OAM do MPLS-TP (RFC 5586)</td></tr>' +
    '<tr><td>16 em diante</td><td class="meaning">Rótulos livres</td><td class="meaning">Alocados pelos protocolos de distribuição</td></tr></tbody></table>',
  '<h3>LDP (RFC 5036)</h3><ul>' +
    '<li><b>Discovery:</b> Hello em UDP 646 para 224.0.0.2 em cada interface. O LDP ID tem a forma roteador:espaço (ex.: 10.255.255.2:0).</li>' +
    '<li><b>Sessão:</b> TCP 646. O LSR com o maior endereço de transporte assume o papel ativo e abre a conexão. Seguem Initialization e KeepAlive até o estado OPERATIONAL.</li>' +
    '<li><b>Distribuição:</b> mensagens Label Mapping associam FEC e rótulo. O modo típico é <b>Downstream Unsolicited</b> (anuncia sem esperar pedido) com controle <b>independente</b>.</li>' +
    '<li><b>LIB e LFIB:</b> com <b>retenção liberal</b>, a LIB guarda os rótulos de todos os vizinhos. A LFIB usa só o do próximo salto escolhido pelo IGP. Se o IGP mudar de caminho, o rótulo novo já está na LIB e a convergência é rápida.</li>' +
    '<li>Outras mensagens: Address, Label Withdraw, Label Release e Notification.</li></ul>',
  '<h3>PHP e modelos de TTL</h3><p>Com <b>PHP</b> (Penultimate Hop Popping), o egresso anuncia implicit-null (3) e o penúltimo LSR remove o rótulo. Assim, o egresso faz uma única consulta (IP) em vez de duas (rótulo e IP). Com <b>explicit-null</b> (0), o rótulo chega ao egresso, o que preserva o campo TC para QoS. A RFC 3032 só permitia o explicit-null no fundo da pilha; a RFC 4182 removeu essa restrição, o que permite usá-lo também sobre o rótulo VPN.</p>' +
    '<p>No modelo <b>Uniform</b> (RFC 3443), o TTL do IP é copiado para o rótulo na entrada e de volta na saída, e cada LSR do núcleo aparece no traceroute. No modelo <b>Pipe</b> (<code>no mpls ip propagate-ttl</code> no Cisco IOS), o rótulo começa com TTL 255 e o núcleo fica invisível: o traceroute mostra só os PEs.</p>' +
    '<p>Quando o TTL expira dentro do LSP, o LSR gera o ICMP Time Exceeded, copia a pilha de rótulos e o encaminha <b>adiante pelo LSP</b> até o egresso, que o devolve à origem (RFC 3032, seção 2.3.2). Por isso todos os saltos do núcleo mostram quase o mesmo RTT. A extensão ICMP da RFC 4950 informa a pilha recebida, que o traceroute do Linux exibe com <code>-e</code>.</p>',
  '<h3>L3VPN (RFC 4364)</h3><p>Os PEs mantêm uma tabela de roteamento por cliente (<b>VRF</b>) e trocam as rotas dos clientes por <b>MP-BGP</b> (VPNv4, com Route Distinguisher). Junto com cada rota vai um <b>rótulo VPN</b>. O PE de entrada empilha dois rótulos: o <b>rótulo de transporte</b> (LDP, leva até o PE de saída) e, embaixo, o <b>rótulo VPN</b> (diz ao PE de saída em qual VRF procurar). Os roteadores P só olham o rótulo de transporte e não conhecem as rotas dos clientes, por isso endereços privados repetidos entre clientes não conflitam.</p>' +
    '<p>Dois conceitos distintos aparecem nas rotas VPNv4. O <b>Route Distinguisher (RD)</b> é um prefixo de 64 bits acrescentado ao endereço IPv4 só para torná-lo único no MP-BGP: dois clientes podem usar 10.0.0.0/24 sem colisão. Ele não decide quem recebe a rota. Quem decide é o <b>Route Target (RT)</b>, uma extended community: cada VRF exporta suas rotas com um ou mais RT e importa apenas as rotas cujo RT está na sua lista de importação. Assim se montam topologias como full-mesh, hub-and-spoke e extranet. O RD é definido na seção 4.2 da RFC 4364 e o RT, na seção 4.3.1. O simulador mostra o RD (65000:1) nas rotas trocadas, mas não configura nem usa o RT.</p>',
  '<h3>MPLS e segurança</h3><ul>' +
    '<li><b>Modelo de ameaças:</b> a RFC 4381 analisa a segurança das VPNs MPLS/BGP e as compara às VPNs de camada 2.</li>' +
    '<li><b>MPLS não é criptografia:</b> a separação de uma L3VPN é lógica. Quem tem acesso ao núcleo lê o tráfego. Dados sensíveis exigem IPsec ou MACsec.</li>' +
    '<li><b>Pacotes rotulados vindos do cliente:</b> o PE nunca deve aceitar MPLS na interface do cliente. Caso contrário, um rótulo VPN forjado injeta tráfego em outra VRF (label spoofing).</li>' +
    '<li><b>Proteção do LDP e do BGP:</b> autenticação TCP-MD5 ou TCP-AO (RFC 5925) e filtros que aceitem LDP e BGP só de vizinhos conhecidos.</li>' +
    '<li><b>Ocultação da topologia:</b> desativar a propagação de TTL esconde o núcleo no traceroute. As extensões da RFC 4950, por outro lado, revelam os rótulos em uso.</li></ul>',
  '<h3>O que o simulador simplifica</h3><ul>' +
    '<li>Seis LSRs e um único IGP (OSPF simplificado, com Dijkstra e custo igual nos dois sentidos): sem iBGP completo, sem Route Reflector e sem Inter-AS.</li>' +
    '<li>O LDP mostra Hello, sessão e Label Mapping; não simula temporizadores de Hello e KeepAlive, Label Withdraw, Label Release nem a sincronização LDP-IGP.</li>' +
    '<li>A L3VPN usa dois rótulos e um par de PEs; o Route Distinguisher aparece nas rotas, mas o Route Target não é configurado nem trocado via MP-BGP (a RFC 4364 define os dois). Há um só cliente (VRF CLIENTE).</li>' +
    '<li>Os rótulos de cada LSR usam uma faixa própria só para facilitar a leitura (a RFC 5036 deixa a escolha livre).</li>' +
    '<li>Os atrasos dos enlaces e os tempos do ping e do traceroute são ilustrativos e fixos, sem a variação de uma rede real. O custo OSPF de cada enlace é fixo; só a falha de enlace é simulável.</li>' +
    '<li>O plano de controle mostra mensagens por enlace (uma por vizinho e sentido) com atraso uniforme, para o diagrama ficar legível; a ordem entre enlaces diferentes numa mesma fase é a mesma.</li></ul>',
  '<h3>Roteiro de exercícios</h3><ol>' +
    '<li>No modo <b>LDP</b>, acompanhe as quatro fases e a aba <b>LIB / LFIB</b> se preenchendo. Onde aparecem push, swap e pop no modo Plano de dados?</li>' +
    '<li>Na aba <b>LIB / LFIB</b>, escolha P1 e explique por que a LIB tem mais rótulos que a LFIB para a mesma FEC (retenção liberal).</li>' +
    '<li>No modo <b>TTL</b>, rode o traceroute com <b>Propagar TTL</b> ligado e desligado. Quais saltos somem, e por que um provedor faria isso?</li>' +
    '<li>Troque o rótulo do egresso entre <b>implicit-null</b>, <b>explicit-null</b> e <b>sem PHP</b>. Em que roteador o último rótulo é removido em cada caso?</li>' +
    '<li>Mude para <b>L3VPN</b> e rode um ping: que rótulos cada P enxerga, e por que os P não precisam conhecer as rotas dos clientes?</li>' +
    '<li>No modo <b>Falha de enlace</b>, derrube o enlace <b>L4</b> e depois outros: o caminho e os rótulos mudam? Por que não é preciso esperar nova sinalização LDP?</li></ol>',
].join('');
