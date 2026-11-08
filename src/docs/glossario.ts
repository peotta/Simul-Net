// Glossário de siglas: fonte única do significado e da finalidade de cada sigla usada nos documentos e nos simuladores.
// Uso: seção "Glossário" no fim de cada documento gerado. A cobertura é verificada por tests/glossario.test.ts.
// Redação: português do Brasil, sem travessão longo nem meia-risca. As expansões seguem os nomes oficiais em inglês.

export interface Sigla {
  /** A sigla como aparece no texto (ex.: "CSMA/CA"). */
  sigla: string;
  /** Expansão oficial, em geral em inglês. */
  expansao: string;
  /** Nome em português, quando existe um uso corrente. */
  pt?: string;
  /** Uma frase: para que serve. */
  serve: string;
  /** Ids dos simuladores em que o sentido vale. Sem este campo, a entrada vale em todos. */
  escopo?: string[];
  /** Siglas que compõem esta (ex.: CSMA/CA tem CSMA e CA). */
  partes?: string[];
}

export const GLOSSARIO: Sigla[] = [
  // ---- projeto e normas ----
  { sigla: 'IA', expansao: 'Inteligência Artificial', serve: 'no rodapé do projeto, indica que o conteúdo foi elaborado com apoio de IA generativa, sob revisão do autor' },
  { sigla: 'MIT', expansao: 'Massachusetts Institute of Technology (licença MIT)', pt: 'licença MIT', serve: 'licença de código aberto permissiva sob a qual o Simul-Net é distribuído' },
  { sigla: 'RFC', expansao: 'Request for Comments', pt: 'pedido de comentários', serve: 'documento numerado do IETF que define ou descreve um protocolo da Internet; cada documento do projeto cita as RFCs com link para o RFC Editor' },
  { sigla: 'IETF', expansao: 'Internet Engineering Task Force', serve: 'organização aberta que desenvolve e publica os padrões da Internet, as RFCs' },
  { sigla: 'IEEE', expansao: "Institute of Electrical and Electronics Engineers", serve: 'entidade que publica padrões de redes locais, como o 802.3 (Ethernet), o 802.1 (comutação) e o 802.11 (Wi-Fi)' },
  { sigla: 'ISO', expansao: 'International Organization for Standardization', pt: 'Organização Internacional de Normalização', serve: 'entidade que publica normas técnicas internacionais, como a ISO/IEC 7498-1, que define o modelo OSI', escopo: ['osi'] },
  { sigla: 'IEC', expansao: 'International Electrotechnical Commission', pt: 'Comissão Eletrotécnica Internacional', serve: 'entidade que publica normas de eletrotecnia e, em conjunto com a ISO, as normas de tecnologia da informação (ISO/IEC)', escopo: ['osi'] },
  { sigla: 'ITU-T', expansao: 'International Telecommunication Union, Telecommunication Standardization Sector', pt: 'setor de normalização de telecomunicações da UIT', serve: 'publica recomendações de telecomunicações; a X.200 é o texto do modelo OSI equivalente à ISO/IEC 7498-1', escopo: ['osi'] },
  { sigla: 'OSI', expansao: 'Open Systems Interconnection', pt: 'interconexão de sistemas abertos', serve: 'modelo de referência que divide a comunicação em sete camadas, usado para nomear funções e localizar problemas', escopo: ['osi'] },
  { sigla: 'PDU', expansao: 'Protocol Data Unit', pt: 'unidade de dados de protocolo', serve: 'a unidade de dados de cada camada: dados, segmento, pacote, quadro e bits', escopo: ['osi'] },
  { sigla: 'SFD', expansao: 'Start Frame Delimiter', pt: 'delimitador de início de quadro', serve: 'byte que, depois do preâmbulo, marca o início do quadro Ethernet', escopo: ['osi'] },
  { sigla: 'ASCII', expansao: 'American Standard Code for Information Interchange', serve: 'codificação de caracteres em texto simples, usada aqui nas mensagens HTTP sem cifra', escopo: ['osi'] },
  { sigla: 'BCP', expansao: 'Best Current Practice', pt: 'melhor prática atual', serve: 'série de RFCs com práticas recomendadas de operação, como a BCP 38 (filtragem de endereços de origem forjados)' },
  // ---- internet e transporte ----
  { sigla: 'IP', expansao: 'Internet Protocol', pt: 'protocolo de internet', serve: 'endereça e encaminha pacotes entre redes, de origem a destino' },
  { sigla: 'TCP', expansao: 'Transmission Control Protocol', pt: 'protocolo de controle de transmissão', serve: 'entrega dados de forma ordenada e confiável, com conexão, confirmação e controle de congestionamento' },
  { sigla: 'UDP', expansao: 'User Datagram Protocol', serve: 'entrega datagramas sem conexão nem confirmação, com baixo custo; usado em consultas curtas e em tempo real' },
  { sigla: 'TCP/UDP', expansao: 'Transmission Control Protocol e User Datagram Protocol', serve: 'refere-se aos dois protocolos de transporte da pilha da Internet', partes: ['TCP', 'UDP'] },
  { sigla: 'TCP/IP', expansao: 'Transmission Control Protocol e Internet Protocol', serve: 'refere-se à pilha de protocolos da Internet, nomeada pelos seus dois protocolos mais conhecidos', partes: ['TCP', 'IP'] },
  { sigla: 'TCP-AO', expansao: 'TCP Authentication Option', pt: 'opção de autenticação do TCP', serve: 'autentica cada segmento TCP por chave compartilhada; sucede a opção TCP MD5 e protege sessões como as do BGP' },
  { sigla: 'SYN', expansao: 'Synchronize', serve: 'flag do TCP que inicia uma conexão e sincroniza os números de sequência' },
  { sigla: 'SYN-ACK', expansao: 'Synchronize-Acknowledge', serve: 'resposta do servidor ao SYN no handshake de três vias: aceita a conexão e envia o próprio número de sequência' },
  { sigla: 'ACK', expansao: 'Acknowledgment', pt: 'confirmação', serve: 'flag que confirma o recebimento de dados anteriores' },
  { sigla: 'FIN', expansao: 'Finish', serve: 'flag do TCP que encerra a conexão de forma ordenada' },
  { sigla: 'RST', expansao: 'Reset', serve: 'flag do TCP que derruba a conexão de imediato, por exemplo ao receber segmento de uma conexão que não existe' },
  { sigla: 'RTT', expansao: 'Round-Trip Time', pt: 'tempo de ida e volta', serve: 'mede o tempo entre enviar um pacote e receber a resposta; base dos temporizadores e da latência' },
  { sigla: 'TTL', expansao: 'Time To Live', pt: 'tempo de vida', serve: 'limita quantos saltos um pacote pode dar; cada roteador o reduz de 1, e ao chegar a zero o pacote é descartado' },
  { sigla: 'ICMP', expansao: 'Internet Control Message Protocol', serve: 'leva mensagens de controle e de erro da camada IP, como o eco do ping e o aviso de destino inalcançável' },
  { sigla: 'QUIC', expansao: 'nome do protocolo, que não é uma sigla oficial', serve: 'transporte sobre UDP com criptografia embutida e múltiplos fluxos independentes; base do HTTP/3' },
  { sigla: 'NTP', expansao: 'Network Time Protocol', serve: 'sincroniza o relógio dos equipamentos com uma fonte de tempo confiável' },
  { sigla: 'CDN', expansao: 'Content Delivery Network', pt: 'rede de distribuição de conteúdo', serve: 'serviço com servidores espalhados que entregam o conteúdo perto do usuário e absorvem volume de tráfego' },
  // ---- enlace e comutação ----
  { sigla: 'MAC', expansao: 'Media Access Control', serve: 'camada de enlace que controla o acesso ao meio; também nomeia o endereço físico de 48 bits de uma interface' },
  { sigla: 'FCS', expansao: 'Frame Check Sequence', pt: 'sequência de verificação do frame', serve: 'código (CRC) no fim do frame que permite ao receptor descartar frames corrompidos' },
  { sigla: 'L2', expansao: 'Layer 2', pt: 'camada 2 (enlace)', serve: 'indica que o equipamento encaminha por endereço MAC, como um switch' },
  { sigla: 'ARP', expansao: 'Address Resolution Protocol', pt: 'protocolo de resolução de endereços', serve: 'descobre o endereço MAC que corresponde a um endereço IPv4 na rede local' },
  { sigla: 'VLAN', expansao: 'Virtual Local Area Network', pt: 'rede local virtual', serve: 'separa logicamente uma rede em domínios de broadcast isolados no mesmo equipamento físico' },
  { sigla: 'STP', expansao: 'Spanning Tree Protocol', pt: 'protocolo de árvore de abrangência', serve: 'evita laços em redes comutadas, bloqueando enlaces redundantes até que sejam necessários' },
  { sigla: 'ACL', expansao: 'Access Control List', pt: 'lista de controle de acesso', serve: 'conjunto ordenado de regras que permite ou nega tráfego conforme endereços, portas e protocolos' },
  { sigla: 'VPN', expansao: 'Virtual Private Network', pt: 'rede privada virtual', serve: 'cria um canal protegido, em geral cifrado, sobre uma rede pública' },
  { sigla: 'NAT', expansao: 'Network Address Translation', pt: 'tradução de endereços de rede', serve: 'troca endereços e portas dos pacotes, para que uma rede privada compartilhe poucos endereços públicos' },
  { sigla: 'DHCP', expansao: 'Dynamic Host Configuration Protocol', pt: 'protocolo de configuração dinâmica de hosts', serve: 'entrega ao cliente endereço IP, máscara, gateway e DNS, por empréstimo (lease)' },
  { sigla: 'DHCPDISCOVER', expansao: 'DHCP Discover', serve: 'primeira mensagem do DORA: o cliente, ainda sem endereço, pergunta em broadcast se há servidor DHCP', escopo: ['dhcp'] },
  // ---- roteamento ----
  { sigla: 'BGP', expansao: 'Border Gateway Protocol', pt: 'protocolo de roteador de borda', serve: 'troca rotas entre sistemas autônomos e sustenta o roteamento entre operadoras na Internet' },
  { sigla: 'OSPF', expansao: 'Open Shortest Path First', serve: 'protocolo de roteamento interno que calcula o menor caminho a partir do mapa completo da rede' },
  // ---- nomes e aplicação ----
  { sigla: 'DNS', expansao: 'Domain Name System', pt: 'sistema de nomes de domínio', serve: 'traduz nomes (www.exemplo.org) em endereços IP e guarda outros registros do domínio' },
  { sigla: 'FTP', expansao: 'File Transfer Protocol', pt: 'protocolo de transferência de arquivos', serve: 'transfere arquivos entre cliente e servidor, com canal de controle e canal de dados separados' },
  { sigla: 'HTTP', expansao: 'Hypertext Transfer Protocol', pt: 'protocolo de transferência de hipertexto', serve: 'transporta páginas e dados entre navegador e servidor web' },
  { sigla: 'HTTP/1', expansao: 'HTTP versão 1.1', serve: 'versão textual do HTTP, com uma requisição por vez em cada conexão' },
  { sigla: 'HTTP/2', expansao: 'HTTP versão 2', serve: 'versão binária do HTTP que multiplexa vários fluxos em uma só conexão TCP' },
  { sigla: 'HTTP/3', expansao: 'HTTP versão 3', serve: 'versão do HTTP sobre QUIC e UDP, que evita o bloqueio de um fluxo por perda em outro' },
  { sigla: 'HTTPS', expansao: 'HTTP Secure', serve: 'HTTP protegido por TLS: cifra o conteúdo e autentica o servidor' },
  { sigla: 'TLS', expansao: 'Transport Layer Security', pt: 'segurança da camada de transporte', serve: 'estabelece um canal cifrado e autenticado entre dois pontos, a base do HTTPS' },
  { sigla: 'SSH', expansao: 'Secure Shell', serve: 'acesso remoto e transferência de arquivos por um canal cifrado, com autenticação do servidor e do usuário' },
  // ---- segurança ----
  { sigla: 'CA', expansao: 'Certification Authority', pt: 'autoridade certificadora', serve: 'entidade que assina certificados digitais e é a âncora de confiança de quem os valida', escopo: ['802-1x', 'https'] },
  { sigla: 'ID', expansao: 'Identifier', pt: 'identificador', serve: 'valor que distingue uma entidade ou uma consulta, como o router ID do BGP e o ID da consulta DNS' },
  // ---- lote A: siglas de dois documentos ----
  { sigla: 'LAN', expansao: 'Local Area Network', pt: 'rede local', serve: 'rede de alcance restrito, como a de um prédio ou laboratório, ligada por switches ou por Wi-Fi' },
  { sigla: 'ISP', expansao: 'Internet Service Provider', pt: 'provedor de acesso à Internet', serve: 'operadora que liga o cliente à Internet e anuncia os prefixos dele a outras redes' },
  { sigla: 'URL', expansao: 'Uniform Resource Locator', pt: 'localizador uniforme de recursos', serve: 'endereço completo de um recurso, com protocolo, nome do servidor e caminho' },
  { sigla: 'IGP', expansao: 'Interior Gateway Protocol', pt: 'protocolo de roteamento interno', serve: 'roteamento dentro de um sistema autônomo, como o OSPF; contrasta com o BGP, que liga sistemas autônomos' },
  { sigla: 'LSR', expansao: 'Label Switching Router', pt: 'roteador de comutação por rótulos', serve: 'roteador MPLS que encaminha pacotes pelo rótulo, sem consultar o endereço IP de destino' },
  { sigla: 'FEC', expansao: 'Forwarding Equivalence Class', pt: 'classe de equivalência de encaminhamento', serve: 'conjunto de pacotes que recebe o mesmo rótulo e o mesmo caminho no MPLS', escopo: ['mpls'] },
  { sigla: 'FEC', expansao: 'Forward Error Correction', pt: 'correção antecipada de erros', serve: 'envia redundância junto com os dados para o receptor recuperar perdas sem retransmissão', escopo: ['tcp', 'udp'] },
  { sigla: 'BFD', expansao: 'Bidirectional Forwarding Detection', serve: 'detecta em milissegundos a falha de um enlace ou vizinho, para o roteamento reagir depressa' },
  { sigla: 'MSS', expansao: 'Maximum Segment Size', pt: 'tamanho máximo de segmento', serve: 'maior quantidade de dados que o TCP aceita por segmento; negociada no SYN' },
  { sigla: 'SACK', expansao: 'Selective Acknowledgment', pt: 'confirmação seletiva', serve: 'o receptor informa quais blocos chegaram fora de ordem, e o emissor reenvia só o que faltou' },
  { sigla: 'PMTUD', expansao: 'Path MTU Discovery', pt: 'descoberta da MTU do caminho', serve: 'descobre o maior pacote que passa pelo caminho sem fragmentar, usando mensagens ICMP' },
  { sigla: 'RSTP', expansao: 'Rapid Spanning Tree Protocol', serve: 'versão do STP que converge em segundos, pela negociação direta entre as pontes' },
  { sigla: 'MSTP', expansao: 'Multiple Spanning Tree Protocol', serve: 'versão do STP com várias árvores, cada uma para um grupo de VLANs' },
  { sigla: 'BPDU', expansao: 'Bridge Protocol Data Unit', serve: 'frame que as pontes trocam no STP para eleger a raiz e calcular as portas' },
  { sigla: 'EAPOL', expansao: 'Extensible Authentication Protocol over LAN', serve: 'leva o EAP entre o cliente e o switch ou AP no 802.1X, antes de a porta liberar tráfego' },
  { sigla: 'DS', expansao: 'Delegation Signer', pt: 'assinante da delegação', serve: 'registro na zona pai que guarda o hash da chave da zona filha e liga a cadeia de confiança do DNSSEC', escopo: ['dns'] },
  { sigla: 'DS', expansao: 'Distribution System', pt: 'sistema de distribuição', serve: 'rede, em geral cabeada, que liga os APs entre si e ao restante da infraestrutura', escopo: ['wifi'] },
  { sigla: 'RA', expansao: 'Recursion Available', pt: 'recursão disponível', serve: 'flag da resposta DNS que informa que o servidor faz consultas recursivas', escopo: ['dns'] },
  { sigla: 'RA', expansao: 'Receiver Address', pt: 'endereço do receptor', serve: 'primeiro endereço do cabeçalho 802.11: quem deve receber o frame', escopo: ['wifi'] },
  { sigla: 'RD', expansao: 'Recursion Desired', pt: 'recursão desejada', serve: 'flag da consulta DNS em que o cliente pede ao servidor que resolva o nome por inteiro', escopo: ['dns'] },
  { sigla: 'RD', expansao: 'Route Distinguisher', pt: 'distinguidor de rota', serve: 'prefixo de 64 bits que torna únicos prefixos IP repetidos de clientes diferentes numa VPN MPLS', escopo: ['mpls'] },
  { sigla: 'NSEC', expansao: 'Next Secure', serve: 'registro DNSSEC que prova que um nome não existe, apontando o próximo nome da zona' },
  { sigla: 'DNSSEC', expansao: 'DNS Security Extensions', pt: 'extensões de segurança do DNS', serve: 'assina as respostas DNS para que o resolvedor confira a autenticidade e a integridade' },
  { sigla: 'NXDOMAIN', expansao: 'Non-Existent Domain', pt: 'domínio inexistente', serve: 'código de resposta do DNS que informa que o nome consultado não existe' },
  { sigla: 'RRL', expansao: 'Response Rate Limiting', pt: 'limitação da taxa de respostas', serve: 'limita respostas DNS idênticas para o servidor não servir de amplificador de ataques' },
  { sigla: 'SPF', expansao: 'Sender Policy Framework', serve: 'registro DNS que lista os servidores autorizados a enviar e-mail por um domínio' },
  { sigla: 'SNMP', expansao: 'Simple Network Management Protocol', pt: 'protocolo simples de gerência de rede', serve: 'consulta e configura equipamentos de rede, e recebe alertas deles' },
  { sigla: 'SFTP', expansao: 'SSH File Transfer Protocol', serve: 'transfere arquivos dentro de um canal SSH, não relacionado ao FTP' },
  { sigla: 'SNI', expansao: 'Server Name Indication', pt: 'indicação do nome do servidor', serve: 'extensão do TLS em que o cliente informa o nome do site, para o servidor escolher o certificado; costuma ir em claro' },
  { sigla: 'ALPN', expansao: 'Application-Layer Protocol Negotiation', serve: 'extensão do TLS que negocia o protocolo de aplicação, como HTTP/2 ou HTTP/3, no próprio handshake' },
  { sigla: 'HSTS', expansao: 'HTTP Strict Transport Security', serve: 'cabeçalho com que o servidor manda o navegador usar sempre HTTPS, dificultando o rebaixamento para HTTP' },
  { sigla: 'SSL', expansao: 'Secure Sockets Layer', serve: 'antecessor do TLS, com versões obsoletas e inseguras; o nome ainda é usado, de forma imprecisa, para o TLS' },
  { sigla: 'MITM', expansao: 'Man-in-the-Middle', pt: 'homem no meio', serve: 'ataque em que alguém se interpõe entre duas partes para ler ou alterar a comunicação; a autenticação e a cifra o defendem' },
  { sigla: 'AEAD', expansao: 'Authenticated Encryption with Associated Data', pt: 'cifra autenticada com dados associados', serve: 'cifra os dados e garante a integridade num só passo, como o AES-GCM' },
  { sigla: 'AES-GCM', expansao: 'Advanced Encryption Standard, Galois/Counter Mode', serve: 'cifra autenticada (AEAD) muito usada no TLS e no SSH', partes: ['AEAD'] },
  { sigla: 'CBC', expansao: 'Cipher Block Chaining', pt: 'encadeamento de blocos', serve: 'modo de cifra de blocos mais antigo, sem autenticação própria, hoje desaconselhado' },
  { sigla: 'MD5', expansao: 'Message Digest 5', serve: 'função de hash antiga, considerada insegura para assinaturas; ainda aparece em protocolos legados' },
  { sigla: 'RSA', expansao: 'Rivest, Shamir e Adleman', serve: 'algoritmo de chave pública usado para assinaturas e troca de chaves' },
  { sigla: 'NIST', expansao: 'National Institute of Standards and Technology', serve: 'instituto dos Estados Unidos que publica padrões e guias de segurança, como a série SP 800' },
  { sigla: 'SP', expansao: 'Special Publication', pt: 'publicação especial', serve: 'série de guias técnicos do NIST, como a SP 800-41, sobre firewalls', escopo: ['ataques-tcp-udp', 'firewall'] },
  { sigla: 'ALG', expansao: 'Application Layer Gateway', serve: 'componente do NAT ou do firewall que entende um protocolo, como o FTP, e reescreve endereços dentro dos dados' },
  { sigla: 'IPS', expansao: 'Intrusion Prevention System', pt: 'sistema de prevenção de intrusão', serve: 'inspeciona o tráfego e bloqueia o que casa com ataques conhecidos; o IDS apenas alerta' },
  { sigla: 'CGNAT', expansao: 'Carrier-Grade NAT', serve: 'NAT em grande escala feito pela operadora, que compartilha um endereço público entre muitos clientes' },
  { sigla: 'RTBH', expansao: 'Remotely Triggered Black Hole', pt: 'buraco negro acionado remotamente', serve: 'descarta, perto da origem, todo o tráfego para um alvo atacado, pelo anúncio de uma rota (RFC 7999)' },
  { sigla: 'AP', expansao: 'Access Point', pt: 'ponto de acesso', serve: 'liga os clientes sem fio à rede cabeada e faz a ponte entre o 802.11 e o Ethernet' },
  { sigla: 'EAP', expansao: 'Extensible Authentication Protocol', pt: 'protocolo de autenticação extensível', serve: 'arcabouço que transporta métodos de autenticação, como EAP-TLS, entre o cliente e o servidor de autenticação' },
  { sigla: 'IDS', expansao: 'Intrusion Detection System', pt: 'sistema de detecção de intrusão', serve: 'inspeciona o tráfego e gera alertas sobre padrões de ataque, sem bloquear' },
  { sigla: 'MTU', expansao: 'Maximum Transmission Unit', pt: 'unidade máxima de transmissão', serve: 'maior pacote que um enlace transporta sem fragmentar' },
  { sigla: 'MPLS', expansao: 'Multiprotocol Label Switching', pt: 'comutação multiprotocolo por rótulos', serve: 'encaminha pacotes por rótulos curtos, usado em redes de operadora e em VPNs' },
  { sigla: 'CRC', expansao: 'Cyclic Redundancy Check', pt: 'verificação de redundância cíclica', serve: 'código que detecta erros de transmissão, como o do FCS dos frames Ethernet e 802.11' },
  // ---- sentidos específicos de um simulador ----
  { sigla: 'TC', expansao: 'Truncated', pt: 'truncada', serve: 'flag da resposta DNS que avisa não ter cabido no limite do UDP; o resolvedor repete por TCP', escopo: ['dns'] },
  { sigla: 'TC', expansao: 'Traffic Class', pt: 'classe de tráfego', serve: 'campo de 3 bits do rótulo MPLS usado para qualidade de serviço (antigo EXP)', escopo: ['mpls'] },
  { sigla: 'IOS', expansao: 'Internetwork Operating System', serve: 'sistema operacional dos equipamentos Cisco; os valores padrão citados nos exemplos vêm dele' },
  { sigla: 'CPU', expansao: 'Central Processing Unit', pt: 'unidade central de processamento', serve: 'processador do equipamento; nos exemplos, o recurso que um ataque ou uma consulta pesada esgota' },
  // ---- Wi-Fi (IEEE 802.11) ----
  { sigla: 'SSID', expansao: 'Service Set Identifier', pt: 'identificador do conjunto de serviço', serve: 'nome da rede sem fio, de até 32 bytes; vários APs com o mesmo SSID formam uma só rede onde o cliente pode circular' },
  { sigla: 'STA', expansao: 'Station', pt: 'estação', serve: 'qualquer dispositivo com rádio 802.11 que se associa a uma rede, como notebook ou celular', escopo: ['wifi'] },
  { sigla: 'BSS', expansao: 'Basic Service Set', pt: 'conjunto básico de serviço', serve: 'um AP e os clientes associados a ele; é a célula básica de uma rede Wi-Fi', escopo: ['wifi'] },
  { sigla: 'BSSID', expansao: 'Basic Service Set Identifier', pt: 'identificador do conjunto básico de serviço', serve: 'endereço MAC do AP, que identifica o BSS nos frames e distingue APs com o mesmo SSID', escopo: ['wifi'] },
  { sigla: 'ESS', expansao: 'Extended Service Set', pt: 'conjunto estendido de serviço', serve: 'vários BSSs com o mesmo SSID ligados por um sistema de distribuição, o que permite o roaming', escopo: ['wifi'] },
  { sigla: 'IBSS', expansao: 'Independent Basic Service Set', serve: 'rede ad hoc, sem AP, em que as estações se comunicam diretamente; o simulador não a representa', escopo: ['wifi'] },
  { sigla: 'AID', expansao: 'Association ID', pt: 'identificador de associação', serve: 'número que o AP atribui ao cliente na associação e que o TIM usa para indicar quem tem frames guardados', escopo: ['wifi'] },
  { sigla: 'CSMA/CA', expansao: 'Carrier Sense Multiple Access with Collision Avoidance', pt: 'acesso múltiplo com escuta de portadora e prevenção de colisão', serve: 'método do Wi-Fi para disputar o meio: escuta o canal, espera um tempo aleatório e confirma cada frame com ACK, porque o rádio não detecta colisões' },
  { sigla: 'DCF', expansao: 'Distributed Coordination Function', pt: 'função de coordenação distribuída', serve: 'modo básico de acesso ao meio do 802.11, que aplica o CSMA/CA com backoff exponencial', escopo: ['wifi'] },
  { sigla: 'EDCA', expansao: 'Enhanced Distributed Channel Access', pt: 'acesso ao canal distribuído aprimorado', serve: 'extensão do DCF que dá prioridade a categorias de tráfego, como voz e vídeo (QoS); o simulador não a representa', escopo: ['wifi'] },
  { sigla: 'NAV', expansao: 'Network Allocation Vector', pt: 'vetor de alocação de rede', serve: 'temporizador de escuta virtual: o cliente que ouve o campo Duration de outro frame espera esse tempo antes de transmitir', escopo: ['wifi'] },
  { sigla: 'SIFS', expansao: 'Short Interframe Space', pt: 'intervalo curto entre frames', serve: 'menor espera do 802.11, usada entre um frame e a resposta imediata, como CTS e ACK', escopo: ['wifi'] },
  { sigla: 'DIFS', expansao: 'DCF Interframe Space', pt: 'intervalo entre frames do DCF', serve: 'espera com o meio livre antes de a estação iniciar a disputa pelo canal', escopo: ['wifi'] },
  { sigla: 'CW', expansao: 'Contention Window', pt: 'janela de contenção', serve: 'limite superior do sorteio do backoff; começa pequena e dobra a cada falha, o que espalha as tentativas', escopo: ['wifi'] },
  { sigla: 'RTS/CTS', expansao: 'Request to Send / Clear to Send', pt: 'pedido para enviar e liberado para enviar', serve: 'troca de dois frames curtos que reserva o meio antes dos dados e ajuda contra o nó oculto', escopo: ['wifi'], partes: ['RTS', 'CTS'] },
  { sigla: 'RTS', expansao: 'Request to Send', pt: 'pedido para enviar', serve: 'frame de controle com que a estação reserva o meio, informando por quanto tempo vai transmitir', escopo: ['wifi'] },
  { sigla: 'CTS', expansao: 'Clear to Send', pt: 'liberado para enviar', serve: 'frame de controle com que o AP autoriza o envio e faz os demais clientes esperarem', escopo: ['wifi'] },
  { sigla: 'TU', expansao: 'Time Unit', pt: 'unidade de tempo', serve: 'unidade de 1024 microssegundos usada nos temporizadores do 802.11, como o intervalo do beacon (100 TU)', escopo: ['wifi'] },
  { sigla: 'TA', expansao: 'Transmitter Address', pt: 'endereço do transmissor', serve: 'endereço MAC de quem transmitiu o frame, no cabeçalho 802.11; o RA é o de quem deve receber', escopo: ['wifi'] },
  { sigla: 'TIM', expansao: 'Traffic Indication Map', pt: 'mapa de indicação de tráfego', serve: 'campo do beacon que indica, por AID, quais clientes em economia de energia têm frames guardados no AP', escopo: ['wifi'] },
  { sigla: 'DTIM', expansao: 'Delivery Traffic Indication Message', pt: 'mensagem de indicação de entrega de tráfego', serve: 'TIM especial, a cada alguns beacons, depois do qual o AP envia os frames multicast e broadcast guardados', escopo: ['wifi'] },
  { sigla: 'PS', expansao: 'Power Save', pt: 'economia de energia', serve: 'modo em que o cliente dorme entre beacons e o AP guarda os frames dele; o PS-Poll pede o frame guardado', escopo: ['wifi'] },
  { sigla: 'PM', expansao: 'Power Management', pt: 'gerenciamento de energia', serve: 'flag do Frame Control com que o cliente avisa ao AP que vai dormir (1) ou que está acordado (0)', escopo: ['wifi'] },
  { sigla: 'OFDM', expansao: 'Orthogonal Frequency-Division Multiplexing', pt: 'multiplexação por divisão de frequência ortogonal', serve: 'técnica de modulação do Wi-Fi que divide o canal em muitas subportadoras; define os tempos usados no simulador' },
  { sigla: 'OFDMA', expansao: 'Orthogonal Frequency-Division Multiple Access', serve: 'divide o canal entre vários clientes ao mesmo tempo no Wi-Fi 6; o simulador não a representa', escopo: ['wifi'], partes: ['OFDM'] },
  { sigla: 'MU-MIMO', expansao: 'Multi-User Multiple Input Multiple Output', serve: 'o AP usa várias antenas para atender vários clientes ao mesmo tempo; o simulador não a representa', escopo: ['wifi'] },
  { sigla: 'TWT', expansao: 'Target Wake Time', pt: 'hora de acordar combinada', serve: 'mecanismo do Wi-Fi 6 em que o AP e o cliente combinam quando o cliente acorda, para economizar energia; o simulador não o representa', escopo: ['wifi'] },
  { sigla: 'MLME', expansao: 'MAC Sublayer Management Entity', pt: 'entidade de gerenciamento da subcamada MAC', serve: 'parte do 802.11 que controla a varredura, a autenticação, a associação e os três estados do cliente', escopo: ['wifi'] },
  { sigla: 'CRC-32', expansao: 'Cyclic Redundancy Check de 32 bits', serve: 'código de 32 bits usado como FCS no fim dos frames 802.11 e Ethernet', partes: ['CRC', 'FCS'] },
  { sigla: 'PSK', expansao: 'Pre-Shared Key', pt: 'chave pré-compartilhada', serve: 'senha única conhecida por todos os participantes, da qual se derivam as chaves da sessão; é o modo pessoal do WPA2' },
  { sigla: 'WPA2', expansao: 'Wi-Fi Protected Access 2', serve: 'segurança de redes Wi-Fi com PSK ou 802.1X e cifra AES; é a geração anterior ao WPA3' },
  { sigla: 'WPA3', expansao: 'Wi-Fi Protected Access 3', serve: 'segurança atual do Wi-Fi: usa SAE no lugar da senha compartilhada simples e exige a proteção dos frames de gerência (PMF)', partes: ['SAE', 'PMF'] },
  { sigla: 'RSN', expansao: 'Robust Security Network', pt: 'rede de segurança robusta', serve: 'conjunto de regras de segurança do 802.11i (cifras, autenticação e handshake de quatro vias), anunciado no elemento RSN do beacon' },
  { sigla: 'SAE', expansao: 'Simultaneous Authentication of Equals', pt: 'autenticação simultânea de iguais', serve: 'troca de chaves do WPA3 a partir de uma senha, que resiste a tentativas de adivinhar a senha offline' },
  { sigla: 'OWE', expansao: 'Opportunistic Wireless Encryption', pt: 'cifra sem fio oportunista', serve: 'cifra o tráfego de redes abertas sem exigir senha (Enhanced Open, RFC 8110)' },
  { sigla: 'PMF', expansao: 'Protected Management Frames', pt: 'frames de gerência protegidos', serve: 'proteção do 802.11w contra Deauthentication e Disassociation forjados; obrigatória no WPA3' },
  { sigla: 'PMK-R1', expansao: 'Pairwise Master Key, nível R1', serve: 'chave de nível 1 da hierarquia do 802.11r, que o AP novo recebe para o cliente trocar de AP sem refazer a autenticação completa', escopo: ['wifi'] },
  { sigla: 'FT', expansao: 'Fast BSS Transition', pt: 'transição rápida de BSS', serve: 'roaming rápido do 802.11r, que embute a derivação das chaves na autenticação e na reassociação', escopo: ['wifi'] },
  { sigla: 'BTM', expansao: 'BSS Transition Management', pt: 'gerenciamento de transição de BSS', serve: 'recurso do 802.11v em que o AP sugere ao cliente trocar de AP, por exemplo por carga ou sinal fraco', escopo: ['wifi'] },
  // ---- 802.1X e RADIUS ----
  { sigla: 'RADIUS', expansao: 'Remote Authentication Dial-In User Service', pt: 'serviço de autenticação remota de usuários', serve: 'protocolo (RFC 2865) em que o switch ou o AP consulta um servidor central para autenticar o usuário e autorizar o acesso' },
  { sigla: 'EAP-TLS', expansao: 'Extensible Authentication Protocol, Transport Layer Security', serve: 'método EAP com autenticação mútua por certificados digitais, do cliente e do servidor; é o mais robusto', partes: ['EAP'] },
  { sigla: 'PEAP', expansao: 'Protected Extensible Authentication Protocol', serve: 'método EAP que abre um túnel TLS, validado pelo certificado do servidor, e autentica o usuário por senha dentro dele', partes: ['EAP'] },
  { sigla: 'EAP-MD5', expansao: 'Extensible Authentication Protocol, Message Digest 5', serve: 'método EAP simples, por desafio e hash, sem autenticar o servidor e sem cifra; considerado inseguro', partes: ['EAP', 'MD5'] },
  { sigla: 'NAS', expansao: 'Network Access Server', pt: 'servidor de acesso à rede', serve: 'equipamento que controla a porta e fala RADIUS com o servidor: o switch ou o AP', escopo: ['802-1x'] },
  { sigla: 'CHAP', expansao: 'Challenge-Handshake Authentication Protocol', serve: 'autenticação por desafio e resposta com hash, sem enviar a senha em claro; base do MSCHAPv2', escopo: ['802-1x'] },
  { sigla: 'PAE', expansao: 'Port Access Entity', pt: 'entidade de acesso à porta', serve: 'parte do 802.1X que, no suplicante e no autenticador, controla o estado autorizado ou não autorizado da porta', escopo: ['802-1x'] },
  { sigla: 'IANA', expansao: 'Internet Assigned Numbers Authority', serve: 'mantém os registros de números e nomes usados nos protocolos, como portas, tipos de mensagem e números de sistema autônomo' },
  { sigla: 'MSK', expansao: 'Master Session Key', pt: 'chave mestra da sessão', serve: 'chave derivada do método EAP e entregue ao autenticador para gerar as chaves da sessão', escopo: ['802-1x'] },
  { sigla: 'EMSK', expansao: 'Extended Master Session Key', pt: 'chave mestra estendida da sessão', serve: 'chave derivada junto com o MSK, que fica só com o suplicante e o servidor e não é entregue ao autenticador', escopo: ['802-1x'] },
  // ---- ARP ----
  { sigla: 'DAI', expansao: 'Dynamic ARP Inspection', pt: 'inspeção dinâmica de ARP', serve: 'recurso do switch que confere as respostas ARP com a tabela do DHCP snooping e descarta as forjadas' },
  { sigla: 'NDP', expansao: 'Neighbor Discovery Protocol', pt: 'protocolo de descoberta de vizinhos', serve: 'equivalente do ARP no IPv6 (RFC 4861), feito por mensagens ICMPv6' },
  { sigla: 'VRRP', expansao: 'Virtual Router Redundancy Protocol', serve: 'permite que dois roteadores compartilhem um endereço IP virtual de gateway, para haver reserva' },
  { sigla: 'SHA', expansao: 'Sender Hardware Address', pt: 'endereço de hardware do remetente', serve: 'campo do pacote ARP com o MAC de quem o enviou', escopo: ['arp'] },
  { sigla: 'SPA', expansao: 'Sender Protocol Address', pt: 'endereço de protocolo do remetente', serve: 'campo do pacote ARP com o IP de quem o enviou', escopo: ['arp'] },
  { sigla: 'THA', expansao: 'Target Hardware Address', pt: 'endereço de hardware do alvo', serve: 'campo do pacote ARP com o MAC procurado; na requisição vai zerado', escopo: ['arp'] },
  { sigla: 'TPA', expansao: 'Target Protocol Address', pt: 'endereço de protocolo do alvo', serve: 'campo do pacote ARP com o IP cujo MAC se procura', escopo: ['arp'] },
  // ---- ataques a TCP e UDP ----
  { sigla: 'SIEM', expansao: 'Security Information and Event Management', serve: 'reúne e correlaciona os logs de vários equipamentos para detectar e investigar incidentes' },
  { sigla: 'MTTD', expansao: 'Mean Time To Detect', pt: 'tempo médio até detectar', serve: 'indicador do tempo, em ciclos no simulador, entre o início do ataque e a sua detecção', escopo: ['ataques-tcp-udp'] },
  { sigla: 'MTTC', expansao: 'Mean Time To Contain', pt: 'tempo médio até conter', serve: 'indicador do tempo, em ciclos no simulador, entre o início do ataque e a sua contenção', escopo: ['ataques-tcp-udp'] },
  { sigla: 'ASN', expansao: 'Autonomous System Number', pt: 'número de sistema autônomo', serve: 'identifica uma rede administrada de forma independente no roteamento da Internet' },
  { sigla: 'CSF', expansao: 'Cybersecurity Framework', serve: 'guia do NIST para organizar a gestão do risco de segurança cibernética', escopo: ['ataques-tcp-udp'] },
  // ---- BGP ----
  { sigla: 'AS', expansao: 'Autonomous System', pt: 'sistema autônomo', serve: 'conjunto de redes sob uma política de roteamento única, identificado por um número (ASN)', escopo: ['bgp'] },
  { sigla: 'MED', expansao: 'Multi-Exit Discriminator', pt: 'discriminador de saídas múltiplas', serve: 'atributo com que um AS sugere a um vizinho qual das várias ligações usar para chegar até ele; o menor valor é preferido', escopo: ['bgp'] },
  { sigla: 'ROV', expansao: 'Route Origin Validation', pt: 'validação da origem da rota', serve: 'confere se o AS que originou um prefixo está autorizado por um ROA e descarta os anúncios inválidos' },
  { sigla: 'RPKI', expansao: 'Resource Public Key Infrastructure', pt: 'infraestrutura de chaves públicas de recursos', serve: 'infraestrutura de certificados que prova quem é o dono de um bloco de endereços e de um número de AS' },
  { sigla: 'ROA', expansao: 'Route Origin Authorization', pt: 'autorização de origem de rota', serve: 'objeto assinado na RPKI que autoriza um AS a originar um prefixo, com o tamanho máximo permitido' },
  { sigla: 'IRR', expansao: 'Internet Routing Registry', pt: 'registro de roteamento da Internet', serve: 'base pública, sem garantia criptográfica, em que as redes declaram suas rotas e políticas; serve para gerar filtros' },
  { sigla: 'ASPA', expansao: 'Autonomous System Provider Authorization', pt: 'autorização de provedor de sistema autônomo', serve: 'objeto da RPKI com que um AS lista seus provedores autorizados, para detectar vazamentos de rota' },
  { sigla: 'OTC', expansao: 'Only to Customer', serve: 'atributo BGP (RFC 9234) que marca rotas recebidas de um provedor ou par para não serem repassadas a outros, evitando vazamentos', escopo: ['bgp'] },
  { sigla: 'NLRI', expansao: 'Network Layer Reachability Information', pt: 'informação de alcançabilidade da camada de rede', serve: 'lista de prefixos que uma mensagem UPDATE anuncia' },
  { sigla: 'EGP', expansao: 'Exterior Gateway Protocol', pt: 'protocolo de roteamento externo', serve: 'roteamento entre sistemas autônomos, como o BGP; contrasta com o IGP' },
  { sigla: 'RIPE', expansao: 'Réseaux IP Européens Network Coordination Centre', serve: 'registro regional de endereços da Europa, do Oriente Médio e de parte da Ásia Central, que publica boas práticas de roteamento' },
  { sigla: 'GTSM', expansao: 'Generalized TTL Security Mechanism', pt: 'mecanismo generalizado de segurança por TTL', serve: 'faz o roteador aceitar pacotes BGP só com TTL 255, o que protege sessões entre vizinhos diretamente ligados (RFC 5082)' },
  // ---- DHCP ----
  { sigla: 'T1', expansao: 'Renewal Time', pt: 'tempo de renovação', serve: 'momento (por padrão, metade do lease) em que o cliente tenta renovar o endereço com o servidor que o concedeu', escopo: ['dhcp'] },
  { sigla: 'T2', expansao: 'Rebinding Time', pt: 'tempo de reassociação', serve: 'momento (por padrão, 87,5% do lease) em que o cliente, sem resposta, procura qualquer servidor', escopo: ['dhcp'] },
  { sigla: 'DORA', expansao: 'Discover, Offer, Request, Acknowledge', serve: 'as quatro mensagens da obtenção de um endereço: DISCOVER, OFFER, REQUEST e ACK', escopo: ['dhcp'] },
  { sigla: 'APIPA', expansao: 'Automatic Private IP Addressing', pt: 'endereçamento IP privado automático', serve: 'endereço 169.254.0.0/16 que o cliente atribui a si mesmo quando não acha servidor DHCP (RFC 3927)' },
  { sigla: 'BOOTP', expansao: 'Bootstrap Protocol', serve: 'antecessor do DHCP, cujo formato de mensagem o DHCP aproveitou' },
  // ---- DNS ----
  { sigla: 'CNAME', expansao: 'Canonical Name', pt: 'nome canônico', serve: 'registro que faz um nome ser apelido de outro' },
  { sigla: 'AAAA', expansao: 'IPv6 Address', pt: 'registro de endereço IPv6 (quatro vezes o A)', serve: 'registro que associa um nome a um endereço IPv6' },
  { sigla: 'MX', expansao: 'Mail Exchange', pt: 'troca de correio', serve: 'registro que indica os servidores de e-mail do domínio', escopo: ['dns'] },
  { sigla: 'TXT', expansao: 'Text', pt: 'texto', serve: 'registro de texto livre, muito usado para SPF, DKIM e DMARC' },
  { sigla: 'SOA', expansao: 'Start of Authority', pt: 'início de autoridade', serve: 'registro no topo da zona com o servidor primário, o número de série e os temporizadores' },
  { sigla: 'NS', expansao: 'Name Server', pt: 'servidor de nomes', serve: 'registro que indica os servidores de nomes autoritativos da zona', escopo: ['dns'] },
  { sigla: 'RRSIG', expansao: 'Resource Record Signature', pt: 'assinatura de registro de recurso', serve: 'assinatura digital de um conjunto de registros no DNSSEC' },
  { sigla: 'DNSKEY', expansao: 'DNS Public Key', pt: 'chave pública do DNS', serve: 'chave pública da zona, usada para conferir as assinaturas RRSIG' },
  { sigla: 'KSK', expansao: 'Key Signing Key', pt: 'chave de assinatura de chaves', serve: 'chave que assina o conjunto DNSKEY e cujo hash fica no registro DS da zona pai' },
  { sigla: 'ZSK', expansao: 'Zone Signing Key', pt: 'chave de assinatura de zona', serve: 'chave que assina os demais registros da zona; é trocada com mais frequência que a KSK' },
  { sigla: 'NSEC3', expansao: 'Next Secure, versão 3', serve: 'como o NSEC, mas usa hashes dos nomes para dificultar a enumeração da zona' },
  { sigla: 'RCODE', expansao: 'Response Code', pt: 'código de resposta', serve: 'campo da resposta DNS que informa o resultado, como NOERROR, NXDOMAIN ou SERVFAIL' },
  { sigla: 'TLD', expansao: 'Top-Level Domain', pt: 'domínio de topo', serve: 'último rótulo de um nome, como .br ou .com' },
  { sigla: 'DKIM', expansao: 'DomainKeys Identified Mail', serve: 'assina as mensagens de e-mail e publica a chave pública no DNS, para o destinatário conferir a origem' },
  { sigla: 'DMARC', expansao: 'Domain-based Message Authentication, Reporting and Conformance', serve: 'política publicada no DNS que diz o que fazer com e-mail que falha no SPF e no DKIM' },
  { sigla: 'EDNS', expansao: 'Extension Mechanisms for DNS', pt: 'mecanismos de extensão do DNS', serve: 'permite mensagens UDP maiores e novas opções, como o bit DO do DNSSEC' },
  { sigla: 'DGA', expansao: 'Domain Generation Algorithm', pt: 'algoritmo de geração de domínios', serve: 'algoritmo de malware que gera nomes de domínio em série para achar o seu controle; a defesa observa muitos NXDOMAIN' },
  { sigla: 'EDE', expansao: 'Extended DNS Errors', pt: 'erros estendidos do DNS', serve: 'opção do EDNS que explica por que uma resposta falhou (RFC 8914)' },
  { sigla: 'AD', expansao: 'Authenticated Data', pt: 'dados autenticados', serve: 'flag da resposta que informa que o resolvedor validou as assinaturas DNSSEC', escopo: ['dns'] },
  { sigla: 'AA', expansao: 'Authoritative Answer', pt: 'resposta autoritativa', serve: 'flag da resposta que indica que ela veio do servidor autoritativo da zona', escopo: ['dns'] },
  { sigla: 'DO', expansao: 'DNSSEC OK', serve: 'flag do EDNS com que o cliente pede os registros DNSSEC na resposta', escopo: ['dns'] },
  { sigla: 'CD', expansao: 'Checking Disabled', pt: 'verificação desligada', serve: 'flag com que o cliente pede ao resolvedor que não valide o DNSSEC', escopo: ['dns'] },
  { sigla: 'QR', expansao: 'Query/Response', pt: 'consulta ou resposta', serve: 'flag que distingue a consulta (0) da resposta (1)', escopo: ['dns'] },
  { sigla: 'SERVFAIL', expansao: 'Server Failure', pt: 'falha do servidor', serve: 'código de resposta que indica falha do servidor, comum quando a validação DNSSEC não é bem-sucedida' },
  { sigla: 'NOERROR', expansao: 'No Error', pt: 'sem erro', serve: 'código de resposta de sucesso; com resposta vazia, indica que o nome existe mas não tem o tipo de registro pedido' },
  // ---- firewall ----
  { sigla: 'DMZ', expansao: 'Demilitarized Zone', pt: 'zona desmilitarizada', serve: 'segmento intermediário, entre a Internet e a rede interna, onde ficam os servidores públicos' },
  { sigla: 'WAF', expansao: 'Web Application Firewall', serve: 'filtra o tráfego HTTP para bloquear ataques à aplicação, como a injeção de SQL' },
  { sigla: 'SQL', expansao: 'Structured Query Language', pt: 'linguagem de consulta estruturada', serve: 'linguagem de consulta a bancos de dados; o uso indevido de entradas nela é a injeção de SQL' },
  // ---- FTP ----
  { sigla: 'FTPS', expansao: 'File Transfer Protocol Secure', serve: 'FTP protegido por TLS (RFC 4217), no modo explícito (AUTH TLS) ou implícito' },
  // ---- versões do HTTP ----
  { sigla: 'HTML', expansao: 'HyperText Markup Language', pt: 'linguagem de marcação de hipertexto', serve: 'linguagem em que as páginas da web são escritas' },
  { sigla: 'CSS', expansao: 'Cascading Style Sheets', pt: 'folhas de estilo em cascata', serve: 'define a aparência de uma página, em arquivo separado do HTML' },
  { sigla: 'TTFB', expansao: 'Time To First Byte', pt: 'tempo até o primeiro byte', serve: 'tempo entre o pedido e a chegada do primeiro byte da resposta' },
  { sigla: 'HPACK', expansao: 'nome do formato, que não é uma sigla oficial', serve: 'compressão de cabeçalhos do HTTP/2 (RFC 7541), com uma tabela dinâmica compartilhada' },
  { sigla: 'QPACK', expansao: 'nome do formato, que não é uma sigla oficial', serve: 'compressão de cabeçalhos do HTTP/3 (RFC 9204), que evita o bloqueio entre fluxos' },
  // ---- HTTPS e TLS ----
  { sigla: 'OCSP', expansao: 'Online Certificate Status Protocol', pt: 'protocolo de status de certificado online', serve: 'consulta online se um certificado foi revogado' },
  { sigla: 'SAN', expansao: 'Subject Alternative Name', pt: 'nome alternativo do assunto', serve: 'lista de nomes para os quais o certificado vale e que o navegador confere' },
  { sigla: 'ECDHE', expansao: 'Elliptic Curve Diffie-Hellman Ephemeral', serve: 'troca de chaves efêmera em curvas elípticas, que dá sigilo perfeito de encaminhamento' },
  { sigla: 'DHE', expansao: 'Diffie-Hellman Ephemeral', serve: 'troca de chaves efêmera de Diffie-Hellman, que dá sigilo perfeito de encaminhamento' },
  { sigla: 'ECDSA', expansao: 'Elliptic Curve Digital Signature Algorithm', serve: 'assinatura digital em curvas elípticas, usada em certificados e na autenticação do servidor' },
  { sigla: 'HKDF', expansao: 'HMAC-based Key Derivation Function', pt: 'função de derivação de chaves baseada em HMAC', serve: 'deriva as várias chaves do TLS 1.3 a partir de um segredo' },
  { sigla: 'ACME', expansao: 'Automatic Certificate Management Environment', serve: 'protocolo (RFC 8555) que automatiza a emissão e a renovação de certificados, como no Let\'s Encrypt' },
  { sigla: 'ECH', expansao: 'Encrypted Client Hello', pt: 'ClientHello cifrado', serve: 'cifra o ClientHello, inclusive o SNI, para esconder o nome do site de quem observa a rede' },
  { sigla: 'SCT', expansao: 'Signed Certificate Timestamp', serve: 'prova de que o certificado foi registrado em logs públicos de Certificate Transparency' },
  { sigla: 'EKU', expansao: 'Extended Key Usage', pt: 'uso estendido da chave', serve: 'campo do certificado que limita para que ele serve, como autenticar servidores' },
  { sigla: 'CN', expansao: 'Common Name', pt: 'nome comum', serve: 'campo do assunto do certificado que antes trazia o nome do site; hoje vale o SAN', escopo: ['https'] },
  { sigla: 'CRL', expansao: 'Certificate Revocation List', pt: 'lista de certificados revogados', serve: 'lista publicada pela CA com os certificados revogados' },
  { sigla: 'RC4', expansao: 'Rivest Cipher 4', serve: 'cifra de fluxo antiga, proibida no TLS por ser insegura' },
  { sigla: 'POODLE', expansao: 'Padding Oracle On Downgraded Legacy Encryption', serve: 'ataque ao SSL 3.0 e ao CBC, que levou ao abandono do SSL 3.0' },
  { sigla: 'BEAST', expansao: 'Browser Exploit Against SSL/TLS', serve: 'ataque ao CBC do TLS 1.0, que levou ao uso do TLS 1.1 ou superior' },
  { sigla: 'AIA', expansao: 'Authority Information Access', pt: 'acesso à informação da autoridade', serve: 'extensão do certificado que indica onde obter o certificado do emissor e o serviço OCSP' },
  { sigla: 'PRF', expansao: 'Pseudo-Random Function', pt: 'função pseudoaleatória', serve: 'função do TLS 1.2 que gera as chaves a partir do segredo e dos números aleatórios; o TLS 1.3 usa o HKDF' },
  { sigla: 'DTLS', expansao: 'Datagram Transport Layer Security', serve: 'TLS adaptado ao UDP (RFC 9147)' },
  // ---- ICMP ----
  { sigla: 'DF', expansao: 'Don\'t Fragment', pt: 'não fragmentar', serve: 'flag do cabeçalho IPv4 que proíbe a fragmentação do pacote; é a base do PMTUD', escopo: ['icmp'] },
  { sigla: 'MF', expansao: 'More Fragments', pt: 'mais fragmentos', serve: 'flag do cabeçalho IPv4 que indica que ainda há fragmentos depois deste', escopo: ['icmp'] },
  { sigla: 'IHL', expansao: 'Internet Header Length', pt: 'comprimento do cabeçalho IP', serve: 'campo do cabeçalho IPv4 com o tamanho do cabeçalho em palavras de 32 bits (mínimo 5, ou 20 bytes)' },
  { sigla: 'uRPF', expansao: 'Unicast Reverse Path Forwarding', pt: 'encaminhamento por caminho reverso unicast', serve: 'confere, pela tabela de rotas, se a origem de um pacote é plausível na interface de chegada, para barrar endereços de origem forjados (RFC 3704)', escopo: ['ipv4'] },
  { sigla: 'PMTU', expansao: 'Path MTU', pt: 'MTU do caminho', serve: 'menor MTU entre os enlaces do caminho; limita o tamanho do pacote sem fragmentar' },
  { sigla: 'WAN', expansao: 'Wide Area Network', pt: 'rede de longa distância', serve: 'rede que liga locais distantes, como as filiais de uma empresa, em geral por operadoras' },
  { sigla: 'PLPMTUD', expansao: 'Packetization Layer Path MTU Discovery', pt: 'descoberta da MTU do caminho pela camada de empacotamento', serve: 'descobre a MTU do caminho pela própria camada que monta os dados, sem depender das mensagens ICMP (RFC 4821)' },
  // ---- MPLS ----
  { sigla: 'PE', expansao: 'Provider Edge', pt: 'borda do provedor', serve: 'roteador do provedor que se liga ao cliente e aplica ou retira o rótulo e a VRF', escopo: ['mpls'] },
  { sigla: 'LDP', expansao: 'Label Distribution Protocol', pt: 'protocolo de distribuição de rótulos', serve: 'protocolo que distribui rótulos entre roteadores vizinhos (RFC 5036)' },
  { sigla: 'PHP', expansao: 'Penultimate Hop Popping', pt: 'retirada do rótulo no penúltimo salto', serve: 'o penúltimo roteador retira o rótulo, para o último fazer só uma consulta', escopo: ['mpls'] },
  { sigla: 'LIB', expansao: 'Label Information Base', pt: 'base de informação de rótulos', serve: 'tabela com todos os rótulos aprendidos dos vizinhos', escopo: ['mpls'] },
  { sigla: 'LFIB', expansao: 'Label Forwarding Information Base', pt: 'base de encaminhamento de rótulos', serve: 'tabela usada no encaminhamento: rótulo de entrada, ação e rótulo de saída' },
  { sigla: 'LSP', expansao: 'Label Switched Path', pt: 'caminho comutado por rótulos', serve: 'caminho que o pacote percorre pelos rótulos, de um LER até outro' },
  { sigla: 'L3VPN', expansao: 'Layer 3 Virtual Private Network', pt: 'rede privada virtual de camada 3', serve: 'VPN do provedor que isola clientes com VRFs e BGP (RFC 4364)' },
  { sigla: 'VRF', expansao: 'Virtual Routing and Forwarding', pt: 'roteamento e encaminhamento virtuais', serve: 'tabela de roteamento separada por cliente no mesmo roteador' },
  { sigla: 'MP-BGP', expansao: 'Multiprotocol BGP', serve: 'extensão do BGP que anuncia outras famílias de rotas, como as VPNs (RFC 4760)', partes: ['BGP'] },
  { sigla: 'RT', expansao: 'Route Target', pt: 'alvo de rota', serve: 'comunidade BGP que decide em quais VRFs uma rota é importada', escopo: ['mpls'] },
  { sigla: 'EXP', expansao: 'Experimental', serve: 'nome antigo dos 3 bits de classe de serviço do rótulo, hoje chamados Traffic Class (TC)', escopo: ['mpls'] },
  { sigla: 'LER', expansao: 'Label Edge Router', pt: 'roteador de borda de rótulos', serve: 'roteador de borda do MPLS, que insere ou remove o rótulo' },
  { sigla: 'GAL', expansao: 'Generic Associated Channel Label', serve: 'rótulo reservado (13) que indica um canal de gerência no MPLS-TP', escopo: ['mpls'] },
  { sigla: 'OAM', expansao: 'Operations, Administration and Maintenance', pt: 'operação, administração e manutenção', serve: 'mecanismos de teste e monitoramento de um enlace ou caminho' },
  { sigla: 'MPLS-TP', expansao: 'MPLS Transport Profile', pt: 'perfil de transporte do MPLS', serve: 'perfil do MPLS para redes de transporte, sem exigir plano de controle IP', partes: ['MPLS'] },
  // ---- NAT, IPsec e travessia ----
  { sigla: 'NAPT', expansao: 'Network Address and Port Translation', pt: 'tradução de endereço e porta de rede', serve: 'NAT que traduz também as portas, para muitos hosts internos compartilharem um endereço público' },
  { sigla: 'PAT', expansao: 'Port Address Translation', pt: 'tradução de endereço de porta', serve: 'nome, comum em equipamentos de fornecedores, para o NAPT' },
  { sigla: 'DNAT', expansao: 'Destination NAT', serve: 'traduz o endereço de destino; serve para publicar um serviço interno' },
  { sigla: 'SNAT', expansao: 'Source NAT', serve: 'traduz o endereço de origem; serve para a rede interna sair para a Internet' },
  { sigla: 'CGN', expansao: 'Carrier-Grade NAT', serve: 'o mesmo que CGNAT: NAT em grande escala feito pela operadora' },
  { sigla: 'NAT-T', expansao: 'NAT Traversal', pt: 'travessia de NAT', serve: 'encapsula o IPsec ESP em UDP 4500 para atravessar um NAT (RFC 3948)' },
  { sigla: 'CPE', expansao: 'Customer Premises Equipment', pt: 'equipamento nas instalações do cliente', serve: 'roteador ou modem que fica na casa ou na empresa do cliente' },
  { sigla: 'EIM', expansao: 'Endpoint-Independent Mapping', pt: 'mapeamento independente do destino', serve: 'a mesma tradução para todos os destinos externos, o que facilita aplicações P2P (RFC 4787)' },
  { sigla: 'APDM', expansao: 'Address and Port-Dependent Mapping', pt: 'mapeamento dependente de endereço e porta', serve: 'uma tradução diferente para cada destino; é o NAT mais restritivo (simétrico)' },
  { sigla: 'ESP', expansao: 'Encapsulating Security Payload', serve: 'protocolo IPsec que cifra e autentica os pacotes (RFC 4303)' },
  { sigla: 'AH', expansao: 'Authentication Header', pt: 'cabeçalho de autenticação', serve: 'protocolo IPsec que autentica o pacote sem cifrar; por incluir o endereço IP, não atravessa o NAT' },
  { sigla: 'IKE', expansao: 'Internet Key Exchange', serve: 'negocia as chaves e os parâmetros de uma associação IPsec' },
  { sigla: 'SPI', expansao: 'Security Parameter Index', pt: 'índice de parâmetros de segurança', serve: 'identifica a associação IPsec no ESP e no AH' },
  { sigla: 'CLI', expansao: 'Command-Line Interface', pt: 'interface de linha de comando', serve: 'interface de texto para configurar equipamentos', escopo: ['nat'] },
  { sigla: 'SIP', expansao: 'Session Initiation Protocol', serve: 'sinaliza chamadas de voz e vídeo; leva endereços dentro da mensagem, o que exige um ALG no NAT', escopo: ['nat'] },
  { sigla: 'STUN', expansao: 'Session Traversal Utilities for NAT', serve: 'permite ao host descobrir o endereço e a porta públicos que o NAT lhe deu' },
  { sigla: 'ICE', expansao: 'Interactive Connectivity Establishment', pt: 'estabelecimento interativo de conectividade', serve: 'testa os caminhos possíveis entre dois hosts atrás de NAT para achar o que funciona' },
  { sigla: 'NAT64', expansao: 'nome do mecanismo de tradução de IPv6 para IPv4, que não é uma sigla oficial', serve: 'permite que hosts só IPv6 acessem servidores IPv4 (RFC 6146)' },
  // ---- roteamento ----
  { sigla: 'LSDB', expansao: 'Link-State Database', pt: 'base de estado de enlaces', serve: 'base com o mapa da topologia que cada roteador OSPF mantém' },
  { sigla: 'RIP', expansao: 'Routing Information Protocol', pt: 'protocolo de informação de roteamento', serve: 'protocolo de vetor de distância que usa a contagem de saltos (máximo de 15)' },
  { sigla: 'ABR', expansao: 'Area Border Router', pt: 'roteador de borda de área', serve: 'roteador OSPF ligado a mais de uma área, que resume as rotas entre elas' },
  { sigla: 'LSA', expansao: 'Link State Advertisement', pt: 'anúncio de estado de enlace', serve: 'anúncio do estado dos enlaces trocado no OSPF' },
  { sigla: 'DBD', expansao: 'Database Description', pt: 'descrição de base de dados', serve: 'mensagem OSPF que resume a LSDB na sincronização entre vizinhos', escopo: ['ospf'] },
  { sigla: 'LSU', expansao: 'Link State Update', pt: 'atualização de estado de enlace', serve: 'mensagem OSPF que leva os LSAs', escopo: ['ospf'] },
  { sigla: 'HMAC-SHA', expansao: 'keyed-Hash Message Authentication Code com SHA', serve: 'autentica as mensagens de roteamento com uma chave compartilhada, como no OSPF (RFC 5709)' },
  { sigla: 'DR', expansao: 'Designated Router', pt: 'roteador designado', serve: 'roteador eleito num segmento multiacesso para trocar LSAs com todos os demais', escopo: ['ospf'] },
  { sigla: 'BDR', expansao: 'Backup Designated Router', pt: 'roteador designado de reserva', serve: 'assume no lugar do DR se ele falhar', escopo: ['ospf'] },
  // ---- SSH ----
  { sigla: 'TOTP', expansao: 'Time-based One-Time Password', pt: 'senha de uso único baseada em tempo', serve: 'código que muda a cada 30 segundos (RFC 6238), usado como segundo fator' },
  { sigla: 'TOFU', expansao: 'Trust On First Use', pt: 'confiar no primeiro uso', serve: 'aceita a chave do servidor na primeira conexão e avisa se ela mudar depois' },
  { sigla: 'SOCKS', expansao: 'Socket Secure', serve: 'protocolo de proxy usado no encaminhamento dinâmico de portas do SSH' },
  { sigla: 'SOCKS5', expansao: 'Socket Secure, versão 5', serve: 'versão atual do protocolo de proxy SOCKS, que aceita autenticação e vários tipos de endereço', partes: ['SOCKS'] },
  { sigla: 'SHA-1', expansao: 'Secure Hash Algorithm 1', serve: 'hash antigo, com colisões demonstradas; evitado em assinaturas' },
  { sigla: 'DH', expansao: 'Diffie-Hellman', serve: 'troca de chaves em que as duas partes chegam ao mesmo segredo sem enviá-lo pela rede' },
  { sigla: 'DSA', expansao: 'Digital Signature Algorithm', pt: 'algoritmo de assinatura digital', serve: 'algoritmo de assinatura antigo, desaconselhado no SSH' },
  { sigla: 'SSHFP', expansao: 'SSH Fingerprint', pt: 'impressão digital do SSH', serve: 'registro DNS com a impressão digital da chave do servidor SSH (RFC 4255)' },
  { sigla: 'PAM', expansao: 'Pluggable Authentication Modules', pt: 'módulos de autenticação plugáveis', serve: 'camada do Linux que permite configurar como o usuário se autentica' },
  { sigla: 'KEX', expansao: 'Key Exchange', pt: 'troca de chaves', serve: 'fase do SSH em que cliente e servidor negociam os algoritmos e acordam as chaves' },
  // ---- STP ----
  { sigla: 'MSTI', expansao: 'Multiple Spanning Tree Instance', pt: 'instância de árvore geradora múltipla', serve: 'cada árvore independente do MSTP, que cuida de um grupo de VLANs' },
  { sigla: 'CIST', expansao: 'Common and Internal Spanning Tree', pt: 'árvore geradora comum e interna', serve: 'árvore do MSTP que liga todas as regiões e serve de instância zero' },
  { sigla: 'TCN', expansao: 'Topology Change Notification', pt: 'notificação de mudança de topologia', serve: 'BPDU que avisa a raiz de que a topologia mudou, para as tabelas de endereços envelhecerem logo' },
  { sigla: 'TCA', expansao: 'Topology Change Acknowledgment', pt: 'confirmação de mudança de topologia', serve: 'flag da BPDU que confirma o recebimento de um TCN', escopo: ['stp'] },
  { sigla: 'PVST', expansao: 'Per-VLAN Spanning Tree', pt: 'árvore geradora por VLAN', serve: 'variante proprietária da Cisco, com uma árvore por VLAN' },
  { sigla: 'MST', expansao: 'Multiple Spanning Tree', pt: 'árvore geradora múltipla', serve: 'o mesmo que o MSTP: várias árvores, cada uma para um grupo de VLANs', escopo: ['stp'] },
  { sigla: 'LLC', expansao: 'Logical Link Control', pt: 'controle de enlace lógico', serve: 'subcamada IEEE 802.2 que identifica o protocolo transportado no frame, usada pelas BPDUs' },
  { sigla: 'DSAP', expansao: 'Destination Service Access Point', pt: 'ponto de acesso ao serviço de destino', serve: 'campo do cabeçalho LLC que identifica o protocolo de destino', escopo: ['stp'] },
  { sigla: 'SSAP', expansao: 'Source Service Access Point', pt: 'ponto de acesso ao serviço de origem', serve: 'campo do cabeçalho LLC que identifica o protocolo de origem', escopo: ['stp'] },
  // ---- switching ----
  { sigla: 'IGMP', expansao: 'Internet Group Management Protocol', pt: 'protocolo de gerência de grupos da Internet', serve: 'o host avisa à rede quais grupos multicast IPv4 quer receber' },
  { sigla: 'LLDP', expansao: 'Link Layer Discovery Protocol', pt: 'protocolo de descoberta da camada de enlace', serve: 'os equipamentos anunciam sua identidade e suas portas aos vizinhos diretos (IEEE 802.1AB)' },
  { sigla: 'MLD', expansao: 'Multicast Listener Discovery', pt: 'descoberta de receptores multicast', serve: 'equivalente do IGMP para o IPv6' },
  // ---- TCP, UDP e tempo real ----
  { sigla: 'RTO', expansao: 'Retransmission Timeout', pt: 'tempo limite de retransmissão', serve: 'tempo que o TCP espera por um ACK antes de retransmitir', escopo: ['tcp', 'udp'] },
  { sigla: 'RTP', expansao: 'Real-time Transport Protocol', pt: 'protocolo de transporte em tempo real', serve: 'leva voz e vídeo sobre UDP, com numeração e marcas de tempo' },
  { sigla: 'RTCP', expansao: 'RTP Control Protocol', pt: 'protocolo de controle do RTP', serve: 'leva estatísticas de qualidade da sessão RTP', partes: ['RTP'] },
  { sigla: 'SRTP', expansao: 'Secure Real-time Transport Protocol', serve: 'RTP com cifra e autenticação dos pacotes', partes: ['RTP'] },
  { sigla: 'ISN', expansao: 'Initial Sequence Number', pt: 'número de sequência inicial', serve: 'primeiro número de sequência de uma conexão TCP, escolhido de forma imprevisível', escopo: ['tcp', 'udp'] },
  { sigla: 'SLE', expansao: 'SACK Left Edge', pt: 'borda esquerda do bloco SACK', serve: 'início de um bloco de bytes recebidos fora de ordem, na notação de ferramentas como o Wireshark', escopo: ['tcp', 'udp'] },
  { sigla: 'SRE', expansao: 'SACK Right Edge', pt: 'borda direita do bloco SACK', serve: 'fim de um bloco de bytes recebidos fora de ordem, na notação de ferramentas como o Wireshark', escopo: ['tcp', 'udp'] },
  { sigla: 'TLP', expansao: 'Tail Loss Probe', pt: 'sonda de perda na cauda', serve: 'envia um segmento de teste quando o ACK demora, para recuperar perdas no fim da transmissão sem esperar o RTO', escopo: ['tcp', 'udp'] },
  { sigla: 'MSL', expansao: 'Maximum Segment Lifetime', pt: 'tempo máximo de vida do segmento', serve: 'tempo máximo que um segmento pode existir na rede; define a espera do estado TIME-WAIT', escopo: ['tcp', 'udp'] },
  { sigla: 'DSACK', expansao: 'Duplicate SACK', pt: 'SACK de duplicata', serve: 'extensão do SACK em que o receptor avisa que recebeu dados em duplicidade', partes: ['SACK'] },
  { sigla: 'RACK', expansao: 'Recent Acknowledgment', pt: 'confirmação recente', serve: 'detecta perdas pelo tempo de chegada dos ACKs, no lugar de contar ACKs duplicados', escopo: ['tcp', 'udp'] },
  { sigla: 'BBR', expansao: 'Bottleneck Bandwidth and Round-trip propagation time', serve: 'controle de congestionamento que estima a banda e o RTT do caminho, em vez de reagir só à perda de pacotes', escopo: ['tcp', 'udp'] },
  { sigla: 'SRTT', expansao: 'Smoothed Round-Trip Time', pt: 'RTT suavizado', serve: 'média móvel do RTT medido, usada para calcular o RTO', escopo: ['tcp', 'udp'] },
  { sigla: 'RTTVAR', expansao: 'Round-Trip Time Variation', pt: 'variação do RTT', serve: 'estimativa da variação do RTT, somada ao SRTT no cálculo do RTO', escopo: ['tcp', 'udp'] },
  { sigla: 'FACK', expansao: 'Forward Acknowledgment', pt: 'confirmação adiante', serve: 'algoritmo antigo de recuperação de perdas que usa o SACK para estimar os dados em trânsito', escopo: ['tcp', 'udp'] },
  { sigla: 'DASH', expansao: 'Dynamic Adaptive Streaming over HTTP', serve: 'vídeo sob demanda em pedaços sobre HTTP, com a qualidade ajustada à banda disponível', escopo: ['tcp', 'udp'] },
  { sigla: 'HLS', expansao: 'HTTP Live Streaming', serve: 'transmissão de vídeo em pedaços sobre HTTP, criada pela Apple', escopo: ['tcp', 'udp'] },
  { sigla: 'GCC', expansao: 'Google Congestion Control', pt: 'controle de congestionamento do Google', serve: 'algoritmo do WebRTC que ajusta a taxa de envio de voz e vídeo conforme o atraso e a perda', escopo: ['tcp', 'udp'] },
  { sigla: 'NACK', expansao: 'Negative Acknowledgment', pt: 'confirmação negativa', serve: 'o receptor pede o reenvio de um pacote específico que não chegou', escopo: ['tcp', 'udp'] },
  { sigla: 'ECN', expansao: 'Explicit Congestion Notification', pt: 'notificação explícita de congestionamento', serve: 'os roteadores marcam os pacotes quando há congestionamento, e o TCP reduz a taxa sem precisar de perda' },
  // ---- VLAN ----
  { sigla: 'TPID', expansao: 'Tag Protocol Identifier', pt: 'identificador de protocolo da etiqueta', serve: 'campo de 16 bits da etiqueta 802.1Q; vale 0x8100 e indica que o frame tem etiqueta', escopo: ['vlan'] },
  { sigla: 'PCP', expansao: 'Priority Code Point', pt: 'ponto de código de prioridade', serve: 'três bits da etiqueta 802.1Q que dão a prioridade do frame (classe de serviço)', escopo: ['vlan'] },
  { sigla: 'DEI', expansao: 'Drop Eligible Indicator', pt: 'indicador de descarte permitido', serve: 'bit da etiqueta 802.1Q que marca o frame como descartável em caso de congestionamento', escopo: ['vlan'] },
  { sigla: 'VID', expansao: 'VLAN Identifier', pt: 'identificador de VLAN', serve: 'número de 12 bits da etiqueta 802.1Q que diz a qual VLAN o frame pertence', escopo: ['vlan'] },
  { sigla: 'PVID', expansao: 'Port VLAN ID', pt: 'VLAN padrão da porta', serve: 'VLAN que a porta atribui aos frames sem etiqueta que recebe; na porta de tronco é a VLAN nativa', escopo: ['vlan'] },
  { sigla: 'SVI', expansao: 'Switch Virtual Interface', pt: 'interface virtual do switch', serve: 'interface de camada 3 de um switch para uma VLAN, que faz o roteamento entre VLANs', escopo: ['vlan'] },
  { sigla: 'GVRP/MVRP', expansao: 'GARP VLAN Registration Protocol / Multiple VLAN Registration Protocol', serve: 'protocolos que anunciam e registram as VLANs entre switches; o MVRP substitui o GVRP', escopo: ['vlan'] },
  { sigla: 'VTP', expansao: 'VLAN Trunking Protocol', pt: 'protocolo de tronco de VLAN', serve: 'protocolo proprietário da Cisco que replica o cadastro de VLANs entre switches', escopo: ['vlan'] },
  { sigla: 'DTP', expansao: 'Dynamic Trunking Protocol', pt: 'protocolo de tronco dinâmico', serve: 'protocolo proprietário da Cisco que negocia automaticamente o modo de tronco de uma porta', escopo: ['vlan'] },
];

/** Siglas que aparecem nos documentos mas não são siglas de glossário: métodos, estados, nomes de equipamentos de exemplo. */
export const NAO_SIGLAS = new Set([
  'GET', 'POST', 'OK', 'DATA', 'ESTABLISHED',
  'SW1', 'SW2', 'PC-A', 'PC-B', 'R1', 'R2', 'R3', 'SW1-SW2', 'SRV', 'AP-01', 'AP-02',
  // identificadores de enlaces nos simuladores de OSPF e RIP
  'L1', 'L3', 'L5', 'L6', 'L7', 'L8',
  // nomes de mensagens e de estados dos protocolos: ficam para um glossário de mensagens
  'INIT', 'OPEN', 'READ', 'KEXINIT', 'NEWKEYS', 'REFUSED', 'DHCPDECLINE',
  // nomes de equipamentos e de fluxos de exemplo
  'PC1', 'PC2', 'WEB', 'SW', 'DHCP-1', 'DHCP-2', 'SW3', 'SW1-SW3', 'SW2-SW3', 'PE1', 'PE2', 'P1', 'P2', 'P3', 'P4', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9',
  'PREROUTING', 'POSTROUTING', 'REQ-1', 'REQ-4', 'REQ-5', 'REQ-8', 'REQ-9', 'AS64496', 'AS64500', 'AS64501', 'AS64510', 'AS64511', 'AS64666',
  // nomes de comandos, mensagens, estados, flags de estado e campos: ficam para um glossário de mensagens
  'UPDATE', 'KEEPALIVE', 'NOTIFICATION', 'ORIGIN', 'DISCOVER', 'OFFER', 'REQUEST', 'RELEASE', 'BOUND', 'REBINDING', 'RENEWING', 'SELECTING', 'REQUESTING', 'INIT-REBOOT',
  'DHCPREQUEST', 'DHCPRELEASE', 'DHCPOFFER', 'DHCPACK', 'DHCPNAK', 'DHCPINFORM', 'STALE', 'FAILED', 'REACHABLE', 'INCOMPLETE', 'PERMANENT', 'DELAY',
  'NEW', 'REPLIED', 'SYN-RECEIVED', 'LISTEN', 'ANY', 'NULL', 'OPERATIONAL', 'HEADERS', 'SETTINGS', 'DOWNGRD',
  'PROT', 'AUTH', 'PORT', 'LIST', 'STOR', 'PASV', 'PASS', 'RETR', 'USER', 'USERAUTH', 'EPSV', 'PBSZ', 'EPRT', 'WRITE', 'OPENDIR', 'READDIR', 'DADOS', 'STATUS', 'NAME',
  'DISCONNECT', 'REPLY', 'WARNING', 'REMOTE', 'HOST', 'IDENTIFICATION', 'HAS', 'CHANGED', 'ROOT', 'LOGIN', 'CONNECT', 'RESPONSE', 'CLOSE',
  // nomes de produtos, documentos, versões, unidades e combinações cujas partes já têm entrada
  'BIND', 'CUBIC', 'X11', 'KB', 'MB', 'II', 'L4', 'SC', 'CA/B', 'SSH-1', 'SSH-2', 'BGP-4', 'RIPE-580', 'CVE-2023-48795', 'BRIDGE-MIB', 'NAS-IP', 'RADIUS/1',
  'IDS/IPS', 'RPKI/ROV', 'SYN/ACK', 'R2/R3', 'ECDHE-ECDSA', 'ECDHE/DHE', 'TCP-MD5', 'LDP-IGP', 'MPLS/BGP', 'RACK-TLP', 'DTLS-SRTP', 'DSA/RSA', 'RSA/DSA', 'HMAC-SHA2-512-ETM',
]);

/** Siglas citadas em um texto, com o número de ocorrências. Ignora blocos e trechos de código, links e números de RFC. */
export function siglasDoTexto(texto: string): Map<string, number> {
  const rx = /(?<![\w/#.-])([A-Z][A-Z0-9]+(?:[/-][A-Z0-9]+)*)(?!\w)/g;
  const limpo = texto
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\]\([^)]*\)/g, '](')
    .replace(/RFC \d+/g, '');
  const out = new Map<string, number>();
  for (const m of limpo.matchAll(rx)) out.set(m[1], (out.get(m[1]) || 0) + 1);
  return out;
}

/** Entrada do glossário para uma sigla, preferindo a do simulador informado e, na falta, a de escopo geral. */
export function buscarSigla(sigla: string, simId?: string): Sigla | undefined {
  const todas = GLOSSARIO.filter((e) => e.sigla === sigla);
  return todas.find((e) => simId && e.escopo?.includes(simId)) || todas.find((e) => !e.escopo) || todas[0];
}

/** Entrada para uma sigla num simulador: a de escopo próprio ou a geral. Sem a de outro simulador (sentido errado). */
export function siglaNoSimulador(sigla: string, simId: string): Sigla | undefined {
  const todas = GLOSSARIO.filter((e) => e.sigla === sigla);
  return todas.find((e) => e.escopo?.includes(simId)) || todas.find((e) => !e.escopo);
}

const significado = (e: Sigla): string => e.expansao + (e.pt ? ', ' + e.pt : '');
const FIM_DOC = '\n\n---\n\n*';

/**
 * Acrescenta ao documento gerado a seção "Glossário", com o significado e a finalidade de cada sigla do
 * glossário que aparece no texto (no sentido do simulador). O texto corrido não é alterado e o rodapé de crédito fica no fim.
 */
export function comSecaoDeSiglas(texto: string, simId: string): string {
  const fim = texto.lastIndexOf(FIM_DOC);
  const corpo = fim >= 0 ? texto.slice(0, fim) : texto.replace(/\s+$/, '');
  const rodape = fim >= 0 ? texto.slice(fim) : '\n';
  const presentes = [...siglasDoTexto(corpo).keys()]
    .map((s) => siglaNoSimulador(s, simId))
    .filter((e): e is Sigla => !!e)
    .sort((a, b) => a.sigla.localeCompare(b.sigla, 'en'));
  if (!presentes.length) return corpo + rodape;
  const numerada = [...corpo.matchAll(/^## (\d+)\. /gm)].pop();
  const titulo = numerada ? `## ${Number(numerada[1]) + 1}. Glossário` : '## Glossário';
  const cel = (s: string) => s.replace(/\|/g, '\|');
  const tabela = presentes.map((e) => `| **${cel(e.sigla)}** | ${cel(significado(e))} | ${cel(e.serve)} |`);
  const secao = [titulo, '', 'Significado e finalidade das siglas usadas neste documento.', '', '| Sigla | Significado | Para que serve |', '| --- | --- | --- |', ...tabela].join('\n');
  return corpo + '\n\n' + secao + '\n' + rodape;
}
