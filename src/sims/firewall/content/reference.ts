// Aba Referência do Firewall.
export const reference: string = [
  '<h3>O que um firewall faz</h3><p>Um <b>firewall</b> é um ponto de controle entre redes que decide, segundo uma política, quais pacotes passam. A <b>RFC 2979</b> descreve o comportamento esperado de firewalls na Internet, e o <b>NIST SP 800-41 Rev. 1</b> (2009) traz orientações sobre tipos de firewall e sobre a escrita da política. Este simulador trata do firewall de rede que decide por <b>camadas 3 e 4</b> (endereços, protocolo, portas e estado). O firewall que examina o conteúdo da aplicação é assunto de outro simulador.</p>',
  '<h3>Filtro sem estado (lista de regras)</h3><ul>' +
    '<li>Cada pacote é avaliado <b>isoladamente</b>, só pelo cabeçalho: origem, destino, protocolo, portas e, no TCP, os flags.</li>' +
    '<li>As regras são percorridas <b>de cima para baixo</b>, e a <b>primeira que casa decide</b>. Regras depois dela não são consultadas.</li>' +
    '<li>Se nenhuma regra casa, vale a <b>política padrão</b> do fim da lista. Negar o que não foi permitido (negação implícita) é a postura mais segura.</li>' +
    '<li>Como o filtro não lembra dos pacotes anteriores, o <b>retorno</b> de uma conexão precisa de regra própria, escrita por porta de origem ou por flag ACK. Ambas são palpites sobre o cabeçalho que um pacote de fora pode imitar.</li></ul>',
  '<h3>Filtro com estado e tabela de conexões</h3><p>O firewall com estado registra cada conexão permitida numa <b>tabela</b>. Só o primeiro pacote (o SYN, no TCP) passa pelas regras. Os seguintes são aceitos se pertencem a uma entrada da tabela, nos dois sentidos, e um pacote que não pertence a nenhuma e não é um pedido novo é negado como <b>fora de estado</b>.</p>' +
    '<table class="sc-msgs"><thead><tr><th>Estado</th><th>Significado no simulador</th></tr></thead><tbody>' +
    '<tr><td>SYN_SENT</td><td class="meaning">o firewall viu o SYN</td></tr>' +
    '<tr><td>SYN_RECV</td><td class="meaning">viu o SYN+ACK</td></tr>' +
    '<tr><td>ESTABLISHED</td><td class="meaning">viu o ACK: conexão estabelecida</td></tr>' +
    '<tr><td>FIN_WAIT</td><td class="meaning">viu o primeiro FIN</td></tr>' +
    '<tr><td>TIME_WAIT</td><td class="meaning">viu os dois FIN; a entrada sai ao fim do prazo</td></tr>' +
    '<tr><td>NEW e REPLIED</td><td class="meaning">UDP e ICMP, sem e com resposta</td></tr></tbody></table>' +
    '<p>Os nomes se inspiram nos estados do TCP (RFC 9293, seção 3.3.2, que descreve os estados das pontas) e nos que firewalls com estado costumam exibir, sem serem idênticos: o firewall deduz o estado dos pacotes que observa. Os <b>prazos de expiração</b> do simulador (60 s em SYN_SENT e SYN_RECV, 30 s em FIN_WAIT e em UDP, 10 s em ICMP, 5 s em TIME_WAIT) são <b>ilustrativos</b>: cada produto usa os seus e permite ajustá-los.</p>' +
    '<p>UDP e ICMP não têm conexão. O firewall associa a resposta ao pedido por endereços e portas invertidos (UDP) ou pelo identificador (ICMP Echo), durante um tempo limitado.</p>',
  '<h3>Zonas e DMZ</h3><ul>' +
    '<li>Uma <b>zona</b> é um conjunto de redes tratado da mesma forma. O simulador usa três: <b>interna</b> (192.0.2.0/24), <b>DMZ</b> (198.51.100.0/24) e <b>externa</b> (a Internet). São faixas de documentação (RFC 5737).</li>' +
    '<li>A <b>DMZ</b> abriga o que precisa ser acessível de fora (por exemplo, um servidor web). Se ele for comprometido, a política entre zonas impede que seja ponto de partida para a rede interna.</li>' +
    '<li>A política típica: a Internet alcança só o serviço público da DMZ; a rede interna alcança a DMZ para administração; a DMZ <b>não inicia</b> conexões para a rede interna e, em geral, nem para a Internet.</li>' +
    '<li>O <b>filtro de saída</b> (egresso) é tão importante quanto o de entrada: limita o que um servidor comprometido consegue baixar ou enviar para fora.</li></ul>',
  '<h3>Filtro de origem (anti-spoofing)</h3><p>O endereço de origem de um pacote IP não é autenticado. O <b>BCP 38 (RFC 2827)</b> recomenda o <b>filtro de ingresso</b>: o provedor aceita de cada cliente só pacotes com origem nos prefixos que o cliente de fato usa, e a RFC pede também que administradores de redes corporativas filtrem para que suas redes não sejam origem de tráfego forjado. Este simulador mostra as duas direções: <b>de dentro para fora</b>, negar origem que não pertence à rede interna (o caso do BCP 38, que protege terceiros e por isso depende de cada operador); e <b>de fora para dentro</b>, negar origem que pertence à rede interna, que só pode ser forjada (prática comum de borda, que não é o foco do BCP 38). Firewalls que classificam o tráfego pela <b>interface</b>, e não pelo endereço, já evitam parte do problema.</p>',
  '<h3>Descartar ou rejeitar</h3><ul>' +
    '<li><b>Descartar</b> (<i>drop</i>): não responde. Quem sonda espera o tempo esgotar e conclui que a porta está <b>filtrada</b>.</li>' +
    '<li><b>Rejeitar</b>: responde com RST (TCP) ou com uma mensagem ICMP de destino inalcançável. A porta parece <b>fechada</b>, e a resposta é imediata.</li>' +
    '<li>Nenhuma das duas esconde que há um dispositivo no caminho. A escolha equilibra o que se revela a quem sonda e o comportamento para quem erra a porta.</li></ul>',
  '<h3>Limite de taxa</h3><p>Uma regra pode aceitar um número máximo de novas conexões por segundo por origem. Reduz o efeito de rajadas de pedidos, mas pode atingir usuários legítimos atrás de um mesmo endereço (por exemplo, atrás de um NAT) e não substitui as defesas do servidor.</p>',
  '<h3>O que o simulador não modela</h3><ul>' +
    '<li><b>NAT</b>: os endereços não são traduzidos. O NAT tem simulador próprio.</li>' +
    '<li><b>Fragmentação, IPv6 e opções de IP</b>.</li>' +
    '<li><b>Inspeção de aplicação</b> (IPS, WAF, proxies e inspeção de TLS) e filtragem por URL ou por usuário.</li>' +
    '<li><b>Desempenho, alta disponibilidade e sincronização de tabelas</b> entre firewalls.</li>' +
    '<li><b>Produtos específicos</b>: a notação das regras é genérica, e não a sintaxe de nenhum fabricante ou sistema. Estados, prazos e comportamentos diante de pacotes inválidos variam entre produtos.</li>' +
    '<li><b>Retransmissão do TCP</b>: o SYN é retransmitido uma vez, depois de 1 s (RFC 6298, seção 2, regra 2.1). Os sistemas reais continuam tentando com intervalos crescentes.</li>' +
    '<li><b>Segurança</b>: os cenários de forja, varredura e rajada mostram o ponto de vista do defensor (o que o firewall vê, decide e registra), sem ensinar a executá-los.</li></ul>',
  '<h3>Roteiro de exercícios</h3><ol>' +
    '<li>Em <b>Ida e volta permitidas</b> e <b>Falta a regra de retorno</b>, compare as duas listas. Por que o SYN+ACK é negado no segundo caso, se o SYN foi aceito?</li>' +
    '<li>Em <b>Ordem invertida das regras</b>, explique por que a primeira regra que casa decide. Reordene mentalmente a lista para obter o resultado desejado.</li>' +
    '<li>Compare <b>Negação implícita</b> e <b>Política padrão permitir</b> para a consulta DNS: qual postura é mais segura e que custo operacional ela traz?</li>' +
    '<li>Compare <b>Retorno por porta de origem</b> e <b>Retorno por flag ACK</b> com <b>Saída permitida, retorno pela tabela</b>. Que pacote de fora passa em cada filtro sem estado e por que a tabela de conexões o barra?</li>' +
    '<li>Em <b>Estados até o encerramento</b>, acompanhe a entrada da tabela. Em <b>UDP: resposta depois da validade</b>, explique o que mudou em relação à resposta dentro da validade.</li>' +
    '<li>Em <b>Tabela de conexões cheia</b>, descreva o efeito sobre usuários legítimos e que controle reduz o risco.</li>' +
    '<li>Percorra os cenários de DMZ: que fluxos são permitidos, quais são negados e por que a <b>regra permissiva de DMZ para a rede interna</b> anula a função da DMZ?</li>' +
    '<li>Compare as variantes com e sem filtro de origem (BCP 38). Que endereços de origem são impossíveis de chegar de fora?</li>' +
    '<li>Compare a <b>varredura com descarte silencioso</b> e com <b>rejeição por RST</b>: o que o atacante aprende em cada uma e o que o administrador ganha ou perde ao depurar?</li>' +
    '<li>Em <b>Rajada com limite de 3 por segundo</b>, avalie o equilíbrio entre proteger o servidor e atingir usuários legítimos atrás de um mesmo NAT.</li></ol>',
  '<h3>Para ir além</h3><ul>' +
    '<li>RFC 2979: comportamento e requisitos de firewalls na Internet.</li>' +
    '<li>NIST SP 800-41 Rev. 1: guia de firewalls e de política de firewall.</li>' +
    '<li>RFC 9293: TCP (estados, seção 3.3.2).</li>' +
    '<li>BCP 38 (RFC 2827): filtro de ingresso contra origem forjada.</li>' +
    '<li>RFC 5737: endereços reservados para documentação.</li>' +
    '<li>RFC 6298: temporizador de retransmissão do TCP.</li></ul>',
].join('');
