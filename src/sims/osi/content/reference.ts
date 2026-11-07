// Aba Referência do simulador OSI.
export const reference: string = [
  '<h3>O modelo OSI e a pilha TCP/IP</h3><p>O modelo OSI (<i>Open Systems Interconnection</i>, ISO/IEC 7498-1) divide a comunicação em sete camadas. Na prática, a internet usa a pilha TCP/IP, que agrupa as camadas 5 a 7 em uma só (aplicação) e as camadas 1 e 2 em outra (acesso à rede). O modelo OSI é conceitual: serve para nomear funções e localizar problemas, e não descreve um software específico.</p>' +
    '<table class="sc-msgs"><thead><tr><th>Camada</th><th>Função</th><th>PDU</th><th>Neste simulador</th></tr></thead><tbody>' +
    '<tr><td>7 Aplicação</td><td class="meaning">serviço visto pelo programa</td><td class="meaning">dados</td><td class="meaning">HTTP/1.1 (RFC 9110 e RFC 9112)</td></tr>' +
    '<tr><td>6 Apresentação</td><td class="meaning">formato, codificação e cifra dos dados</td><td class="meaning">dados</td><td class="meaning">sem TLS: texto ASCII</td></tr>' +
    '<tr><td>5 Sessão</td><td class="meaning">abertura, controle e fim do diálogo</td><td class="meaning">dados</td><td class="meaning">conexão TCP já estabelecida</td></tr>' +
    '<tr><td>4 Transporte</td><td class="meaning">entrega entre processos, portas e confiabilidade</td><td class="meaning">segmento</td><td class="meaning">TCP (RFC 9293)</td></tr>' +
    '<tr><td>3 Rede</td><td class="meaning">endereçamento lógico e roteamento</td><td class="meaning">pacote</td><td class="meaning">IPv4 (RFC 791)</td></tr>' +
    '<tr><td>2 Enlace</td><td class="meaning">entrega no mesmo enlace, por MAC, com detecção de erro</td><td class="meaning">quadro</td><td class="meaning">Ethernet II (IEEE 802.3) e 802.1Q</td></tr>' +
    '<tr><td>1 Física</td><td class="meaning">sinais no meio</td><td class="meaning">bits</td><td class="meaning">preâmbulo, SFD e bytes em bits</td></tr></tbody></table>',
  '<h3>Encapsulamento e desencapsulamento</h3><ul>' +
    '<li>Na <b>descida</b>, cada camada trata a PDU da camada de cima como carga útil e acrescenta o seu cabeçalho (a Ethernet também acrescenta um trailer, o FCS).</li>' +
    '<li>Na <b>subida</b>, cada camada confere o seu cabeçalho, o retira e entrega o conteúdo à camada de cima, pelo campo que identifica o protocolo: o tipo da Ethernet (0x0800 para IPv4), o campo Protocolo do IP (6 para TCP) e a porta do TCP.</li>' +
    '<li>Um nó intermediário só sobe até a camada de que precisa: o <b>switch</b> até a 2 e o <b>roteador</b> até a 3.</li></ul>',
  '<h3>O que cada camada acrescenta</h3><table class="sc-msgs"><thead><tr><th>Camada</th><th>Campos principais</th><th>Tamanho</th></tr></thead><tbody>' +
    '<tr><td>Ethernet II (IEEE 802.3)</td><td class="meaning">MAC de destino, MAC de origem, tipo; FCS ao final</td><td class="meaning">14 bytes de cabeçalho e 4 de FCS</td></tr>' +
    '<tr><td>802.1Q (IEEE 802.1Q)</td><td class="meaning">TPID 0x8100 e TCI (prioridade, DEI e VLAN), entre o MAC de origem e o tipo</td><td class="meaning">4 bytes</td></tr>' +
    '<tr><td>IPv4 (RFC 791)</td><td class="meaning">versão, IHL, comprimento total, identificação, flags, TTL, protocolo, checksum, IPs de origem e destino</td><td class="meaning">20 bytes sem opções</td></tr>' +
    '<tr><td>TCP (RFC 9293, seção 3.1)</td><td class="meaning">portas, sequência, confirmação, deslocamento, flags, janela, checksum</td><td class="meaning">20 bytes sem opções</td></tr>' +
    '<tr><td>HTTP/1.1 (RFC 9112, seção 2)</td><td class="meaning">linha inicial, campos de cabeçalho, linha em branco e corpo</td><td class="meaning">variável</td></tr></tbody></table>' +
    '<p>O simulador monta os <b>bytes reais</b> de cada quadro e calcula os três verificadores: o checksum do cabeçalho IPv4 (soma de complemento de um, RFC 1071), o checksum do TCP com o pseudo-cabeçalho IP e o FCS (CRC-32 do IEEE 802.3). Um quadro Ethernet tem no mínimo 64 bytes com o FCS: quadros menores recebem preenchimento.</p>',
  '<h3>O que muda a cada salto</h3><ul>' +
    '<li><b>Muda:</b> MAC de origem e MAC de destino (o roteador monta um quadro novo para cada enlace), TTL (decrementado em cada roteador, RFC 1812, seção 5.3.1), checksum do IP (porque o TTL mudou) e FCS (porque os bytes mudaram).</li>' +
    '<li><b>Não muda:</b> IP de origem, IP de destino, portas, números de sequência e a mensagem HTTP.</li>' +
    '<li>O endereço físico vale em um enlace e o endereço IP vale fim a fim.</li></ul>',
  '<h3>Limitações do simulador</h3><p>O percurso tem um cliente, um switch, um roteador e um servidor, em uma única requisição HTTP. A conexão TCP já está estabelecida (não há handshake, ACK puro, janela deslizante nem encerramento), as tabelas ARP e de MAC já estão preenchidas, não há TLS (as camadas 5 e 6 não acrescentam bytes), nem fragmentação, nem NAT, nem opções IP ou TCP. Os endereços são de documentação (RFC 5737 para IPv4 e RFC 7042 para MAC) e os números de sequência e as identificações são valores ilustrativos. A camada física é representada pelo preâmbulo, pelo SFD e pelos bits, sem codificação de linha real nem sinal elétrico. O FCS é calculado com o CRC-32 do IEEE 802.3, e os bytes do FCS aparecem na ordem de uma captura de pacotes. Os tempos são didáticos. O modelo OSI é conceitual e as camadas 5 e 6 não existem como software separado na pilha TCP/IP. Para o handshake, o ARP, o ICMP, o TLS, o DNS e o HTTP em detalhe, veja os simuladores específicos. Defeitos por camada não são simulados aqui.</p>',
].join('');
