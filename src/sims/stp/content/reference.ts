// Aba Referência do simulador de spanning tree.
export const reference: string = [
  '<h3>Para que serve</h3><p>Uma rede local com enlaces redundantes forma <b>laços</b>. Como o quadro Ethernet não tem TTL, um broadcast preso num laço circula para sempre, e as tabelas MAC dos switches perdem a estabilidade. O <b>spanning tree</b> escolhe, entre as pontes, uma árvore sem laços e deixa em <b>Bloqueio</b> as portas que a formariam. Se um enlace da árvore falha, uma porta bloqueada é reaberta.</p><p>As versões são três: o <b>STP</b> (IEEE 802.1D), o <b>RSTP</b> (IEEE 802.1w, hoje parte do 802.1D-2004) e o <b>MSTP</b> (IEEE 802.1s). Os três foram incorporados ao IEEE 802.1Q, que é a referência vigente. Fabricantes oferecem ainda versões por VLAN (como o PVST+ e o Rapid PVST+), que não são tratadas aqui.</p>',
  '<h3>Identificador da ponte e eleição da raiz</h3><ul>' +
    '<li>O <b>identificador da ponte</b> tem 8 bytes: prioridade (padrão 32768) e MAC. No 802.1D-2004 e no 802.1Q, a prioridade usa os 4 bits mais altos, em múltiplos de 4096, e os 12 bits restantes formam a extensão de identificador de sistema (o número da VLAN ou da instância).</li>' +
    '<li>Todas as pontes começam achando que são a <b>raiz</b>. A de menor identificador vence; o desempate é o MAC.</li>' +
    '<li>Cada ponte escolhe a <b>porta raiz</b>: a de menor <b>custo acumulado</b> até a raiz (desempate: identificador da ponte vizinha e depois o número da porta).</li>' +
    '<li>Em cada enlace, a ponte com o melhor vetor (custo até a raiz e, no empate, identificador) fica com a <b>porta designada</b>. A porta que não é raiz nem designada vira <b>alternativa</b> (bloqueada).</li></ul>',
  '<h3>Custo de porta</h3><table class="sc-msgs"><thead><tr><th>Velocidade</th><th>Custo (tabela longa, 802.1D-2004)</th><th>Custo (tabela curta, 802.1D-1998)</th></tr></thead><tbody>' +
    '<tr><td>10 Mb/s</td><td class="meaning">2000000</td><td class="meaning">100</td></tr>' +
    '<tr><td>100 Mb/s</td><td class="meaning">200000</td><td class="meaning">19</td></tr>' +
    '<tr><td>1 Gb/s</td><td class="meaning">20000</td><td class="meaning">4</td></tr>' +
    '<tr><td>10 Gb/s</td><td class="meaning">2000</td><td class="meaning">2</td></tr></tbody></table><p>O simulador usa a tabela longa. Pontes que usam tabelas diferentes na mesma rede podem escolher caminhos inesperados.</p>',
  '<h3>A BPDU</h3><table class="sc-msgs"><thead><tr><th>Campo</th><th>Valor ou função</th></tr></thead><tbody>' +
    '<tr><td>Destino</td><td class="meaning">01:80:c2:00:00:00, endereço de grupo reservado: a ponte não o encaminha</td></tr>' +
    '<tr><td>LLC</td><td class="meaning">DSAP e SSAP 0x42, controle 0x03</td></tr>' +
    '<tr><td>Versão e tipo</td><td class="meaning">0 e 0x00 (STP); 2 e 0x02 (RSTP); 3 e 0x02 (MSTP); 0x80 é o TCN</td></tr>' +
    '<tr><td>ID da raiz, custo, ID da ponte e ID da porta</td><td class="meaning">o vetor de prioridade que as pontes comparam</td></tr>' +
    '<tr><td>Message Age, Max Age, Hello Time, Forward Delay</td><td class="meaning">idade da informação e os temporizadores da raiz (padrões 0, 20 s, 2 s e 15 s)</td></tr>' +
    '<tr><td>Flags</td><td class="meaning">STP: TC e TCA. RSTP: proposta, papel da porta, aprendizado, encaminhamento e acordo</td></tr></tbody></table>',
  '<h3>Estados e tempos do STP</h3><table class="sc-msgs"><thead><tr><th>Estado</th><th>Aprende MACs</th><th>Encaminha dados</th></tr></thead><tbody>' +
    '<tr><td>Bloqueio</td><td class="meaning">não</td><td class="meaning">não</td></tr>' +
    '<tr><td>Escuta (Forward Delay, 15 s)</td><td class="meaning">não</td><td class="meaning">não</td></tr>' +
    '<tr><td>Aprendizado (Forward Delay, 15 s)</td><td class="meaning">sim</td><td class="meaning">não</td></tr>' +
    '<tr><td>Encaminhamento</td><td class="meaning">sim</td><td class="meaning">sim</td></tr></tbody></table>' +
    '<p>Uma porta que sai do Bloqueio leva <b>30 s</b> para encaminhar. Se as BPDUs deixam de chegar sem que o enlace caia (por exemplo, por um conversor de mídia no meio ou um enlace unidirecional), a informação só expira em <b>Max Age (20 s)</b>, e o total chega a 50 s. Em uma mudança de topologia, um <b>TCN</b> sobe até a raiz, que sinaliza a flag TC por Max Age mais Forward Delay (35 s): as pontes reduzem o envelhecimento da tabela MAC para o Forward Delay.</p>',
  '<h3>RSTP</h3><ul>' +
    '<li>Os estados viram <b>Descarte</b>, <b>Aprendizado</b> e <b>Encaminhamento</b>. Os papéis incluem a porta <b>alternativa</b> (reserva da porta raiz) e a <b>de backup</b> (reserva de uma porta designada na mesma ponte).</li>' +
    '<li><b>Proposta e acordo:</b> a porta designada em descarte envia uma BPDU com a flag de proposta. O vizinho sincroniza (põe as outras portas dele em descarte) e responde com o acordo. A porta raiz do vizinho encaminha na hora, e a designada encaminha ao receber o acordo. O simulador considera que uma porta alternativa, já em descarte, concorda com a proposta.</li>' +
    '<li>Quando a <b>porta raiz falha</b>, a alternativa vira porta raiz e encaminha imediatamente. As portas de borda (de acesso, ligadas a computadores) encaminham sem esperar nada.</li>' +
    '<li>Uma ponte que só fala STP obriga os enlaces com ela a usar o STP clássico e os temporizadores.</li></ul>',
  '<h3>MSTP</h3><ul>' +
    '<li>Uma <b>região</b> é um conjunto de pontes com o mesmo <b>nome</b>, a mesma <b>revisão</b> e o mesmo <b>mapa VLAN-instância</b> (resumido num digest de 16 bytes na BPDU). Se um deles difere, a ponte fica em outra região.</li>' +
    '<li>O <b>CIST</b> (instância 0) liga todas as pontes e regiões; as <b>MSTIs</b> existem só dentro da região, cada uma com a própria raiz e árvore. Uma só BPDU por enlace leva o CIST e os registros de todas as MSTIs (16 bytes cada).</li>' +
    '<li>O ganho é de capacidade: cada instância bloqueia enlaces diferentes e o tráfego das VLANs se distribui entre os enlaces.</li></ul>',
  '<h3>Proteções e segurança (nível defensivo)</h3><ul>' +
    '<li><b>Por que é possível atacar:</b> o spanning tree <b>não autentica as BPDUs</b>. Quem se anuncia com a melhor prioridade passa a ser a raiz, e a rede se reorganiza ao redor dele. O tráfego pode passar a atravessar o equipamento do intruso e há interrupção durante a reconvergência.</li>' +
    '<li><b>Alcance:</b> só dentro do domínio de camada 2 (a rede local ou a VLAN). As BPDUs não atravessam roteadores.</li>' +
    '<li><b>Aviso:</b> este modo explica o mecanismo para fins de defesa. Interferir na rede de terceiros pode configurar crime; pratique apenas em laboratório isolado, com autorização.</li></ul>' +
    '<h3>Defesas</h3><table class="sc-msgs"><thead><tr><th>Defesa</th><th>Onde atua</th><th>Observação</th></tr></thead><tbody>' +
    '<tr><td>BPDU Guard</td><td class="meaning">em portas de acesso (de borda)</td><td class="meaning">desativa a porta que recebe qualquer BPDU; recurso de fabricantes</td></tr>' +
    '<tr><td>Root Guard</td><td class="meaning">em portas voltadas para fora do domínio confiável</td><td class="meaning">bloqueia a porta que receberia uma raiz melhor; recurso de fabricantes</td></tr>' +
    '<tr><td>Prioridade configurada e raiz de reserva</td><td class="meaning">nas pontes do núcleo</td><td class="meaning">torna a raiz previsível e a troca de raiz menos abrupta</td></tr>' +
    '<tr><td>Detecção de enlace unidirecional e Loop Guard</td><td class="meaning">nos enlaces entre pontes</td><td class="meaning">evitam laços quando as BPDUs param de chegar sem queda do enlace; recursos de fabricantes, fora do simulador</td></tr>' +
    '<tr><td>Limite de broadcast (storm control)</td><td class="meaning">nas portas</td><td class="meaning">reduz o estrago de uma tempestade, sem impedir o laço</td></tr></tbody></table>',
  '<h3>Gerência por SNMP</h3><p>O funcionamento do spanning tree é definido pelo IEEE, e não por uma RFC. A <b>RFC 4188</b> (Standards Track, setembro de 2005, substitui a RFC 1493) define o <b>BRIDGE-MIB</b>, o módulo SNMP para pontes IEEE 802.1D, que inclui objetos do spanning tree e da ponte transparente. Os objetos específicos do RSTP estão na <b>RFC 4318</b> (Standards Track, dezembro de 2005); os do MSTP e as edições mais recentes da gerência ficam com o IEEE. Serve para consultar uma ponte real (a raiz, o custo e o estado das portas, por exemplo). O simulador não implementa SNMP.</p>',
  '<h3>Limitações do simulador</h3><p>O simulador mostra um triângulo de três switches (quatro pontes, no modo de proteções). Os endereços são de documentação (RFC 7042 e RFC 9542), os tempos de trânsito são didáticos, e os temporizadores do protocolo (Hello 2 s, Max Age 20 s e Forward Delay 15 s) são os padrões. A eleição é simulada por rodadas de BPDUs, sem os temporizadores de Hello nem o envelhecimento da informação (Max Age). Na falha da raiz, o simulador refaz a eleição entre as pontes que sobraram. Uma porta que já encaminha e muda de papel continua encaminhando. A topologia usa a tabela longa de custos e uma só instância de STP. No RSTP, os papéis de backup e as portas de borda não aparecem, e o MSTP mostra a sincronização só do CIST (as instâncias seguem a mesma lógica). Não foram citadas cláusulas do IEEE 802.1Q-2022 (que incorpora o 802.1D, o 802.1w e o 802.1s) por falta de um texto aberto para conferência. Fora do escopo: PVST+, Rapid PVST+, agregação de enlaces e o spanning tree de camada 3.</p>',
].join('');
