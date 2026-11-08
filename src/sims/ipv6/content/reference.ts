// Aba Referência do simulador IPv6.
export const reference: string = [
  '<h3>O que o IPv6 muda em relação ao IPv4</h3><p>O IPv6 (RFC 8200) usa endereços de 128 bits e um cabeçalho fixo de 40 bytes, sem checksum e sem fragmentação em roteadores: só a origem fragmenta (seção 4.5). O Hop Limit substitui o TTL, e o Neighbor Discovery (RFC 4861), sobre ICMPv6, substitui o ARP. O IPv6 não tem broadcast: usa multicast.</p>',
  '<h3>Representação e tipos de endereço</h3><ul>' +
    '<li>Oito grupos de 16 bits em hexadecimal. Zeros à esquerda podem sumir, e uma sequência de grupos zero pode virar "::", uma só vez (RFC 4291, seção 2.2). A forma recomendada para texto é a da RFC 5952: minúsculas e "::" na maior sequência.</li>' +
    '<li><b>Link-local</b> fe80::/10: vale só no enlace; roteadores não o encaminham (RFC 4291, seção 2.5.6).</li>' +
    '<li><b>Local único (ULA)</b> fc00::/7: uso privado, sem rota na internet (RFC 4193).</li>' +
    '<li><b>Multicast</b> ff00::/8: ff02::1 (todos os nós) e ff02::2 (todos os roteadores) são do escopo do enlace; o nó solicitado ff02::1:ff00:0/104 serve ao ND (RFC 4291, seção 2.7).</li>' +
    '<li><b>Unicast global</b>: hoje alocado dentro de 2000::/3. O bloco 2001:db8::/32 é de documentação (RFC 3849) e aparece em todo o simulador.</li></ul>',
  '<h3>Encaminhamento</h3><p>A decisão é a do IPv4: entre as rotas cujo prefixo contém o destino, vence a de maior comprimento; a rota padrão é ::/0. Sem nenhuma rota, o roteador descarta e envia ICMPv6 1/0 (RFC 4443, seção 3.1). Cada roteador decrementa o Hop Limit; ao chegar a zero, o pacote é descartado com ICMPv6 3/0 (seção 3.3). Não se gera erro ICMPv6 sobre outro erro, e o erro leva o máximo do pacote original sem passar do MTU mínimo de 1280 bytes (seção 2.4).</p>',
  '<h3>Neighbor Discovery</h3><ul>' +
    '<li><b>NS e NA</b> (tipos 135 e 136) resolvem o MAC de um vizinho. O NS vai ao endereço de nó solicitado do alvo, e o MAC de destino é 33:33 mais os 32 bits finais (RFC 2464).</li>' +
    '<li><b>RS e RA</b> (tipos 133 e 134): o host pede, e o roteador anuncia prefixo, flags L e A, tempo de vida como roteador padrão e MTU (RFC 4861, seção 4).</li>' +
    '<li>Todas as mensagens saem com Hop Limit 255: um valor menor indicaria que vieram de fora do enlace (seção 7.1).</li>' +
    '<li>Sem resposta ao NS, o roteador desiste e envia ICMPv6 1/3, endereço inalcançável (RFC 4443, seção 3.1).</li></ul>',
  '<h3>Autoconfiguração (SLAAC) e DAD</h3><ol>' +
    '<li>O host forma o endereço de enlace local fe80:: com o identificador de interface (RFC 4862, seção 5.3).</li>' +
    '<li>Antes de usar qualquer endereço unicast, testa-o por <b>DAD</b>: NS com origem :: ao nó solicitado; uma resposta indica duplicidade (seção 5.4).</li>' +
    '<li>Pede e recebe o RA. Com a flag A e prefixo /64, forma o endereço global: prefixo mais identificador de interface (seção 5.5.3).</li>' +
    '<li>O identificador pode ser o EUI-64 modificado do MAC (RFC 4291, apêndice A), um temporário (RFC 8981) ou um estável opaco (RFC 7217).</li></ol>',
  '<h3>Limitações do simulador</h3><p>As rotas são estáticas e não há protocolo de roteamento em execução. Não há cabeçalhos de extensão, fragmentação, Path MTU Discovery, DHCPv6, Redirect, NUD (detecção de inalcançabilidade de vizinho), Router Advertisement periódico, nem as demais opções do ND. A DAD usa uma só tentativa, e os temporizadores são os padrões do RFC 4861, seção 10, mas simplificados. A tabela de vizinhos dos roteadores intermediários é suposta preenchida, e o endereço temporário do modo privado é um valor fixo de exemplo. Os endereços são de documentação (RFC 3849) e locais únicos (RFC 4193). Os tempos são didáticos.</p>',
].join('');
