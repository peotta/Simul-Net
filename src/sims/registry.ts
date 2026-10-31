export type CategoryId = 'camada-de-enlace' | 'camada-de-rede' | 'transporte' | 'protocolos-seguros';

export interface Category {
  id: CategoryId;
  title: string;
  description: string;
}

/**
 * Como o simulador é entregue:
 * - 'legado': página autônoma em public/sims (HTML, CSS e JavaScript em um único arquivo);
 * - 'nativo': componente React com motor de simulação testado (migração gradual, veja docs/arquitetura.md).
 */
export type Engine = 'legado' | 'nativo';

export interface SimMeta {
  id: string;
  category: CategoryId;
  title: string;
  summary: string;
  topics: string[];
  rfcs: string[];
  status: 'available' | 'planned';
  /** Destaque "Novo" na página inicial: marcar no máximo os 3 simuladores publicados mais recentemente. */
  novo?: boolean;
  /** Presentes somente em simuladores disponíveis. */
  engine?: Engine;
  /** Nome do arquivo em public/sims (engine 'legado'). */
  file?: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'camada-de-enlace',
    title: 'Camada de enlace e redes locais',
    description: 'Switching, VLANs, spanning tree e Wi-Fi: como os quadros são encaminhados, como a rede local evita laços e como as redes sem fio operam.',
  },
  {
    id: 'camada-de-rede',
    title: 'Roteamento e serviços de rede',
    description: 'Roteamento, endereçamento automático, diagnóstico e redes de operadora, em diagramas de sequência e topologias animadas.',
  },
  {
    id: 'transporte',
    title: 'Camada de transporte e segurança',
    description: 'TCP e UDP passo a passo e o laboratório defensivo com ataques, mitigações e resposta a incidentes.',
  },
  {
    id: 'protocolos-seguros',
    title: 'Protocolos de rede seguros',
    description: 'SSH, HTTPS e transferência de arquivos por dentro: negociação, troca de chaves, autenticação, certificados e hardening.',
  },
];

// Para adicionar um simulador: coloque o arquivo em public/sims (ou crie um componente em src/sims/<nome>/)
// e acrescente uma entrada aqui. A página inicial, as categorias e os testes usam este registro.
export const SIMS: SimMeta[] = [
  {
    id: 'roteamento',
    category: 'camada-de-rede',
    title: 'Roteamento (OSPF e RIPv2)',
    summary: 'Roteamento dinâmico passo a passo: OSPF em área única e multiárea (Hello, adjacências, LSAs e SPF) e RIPv2 com Bellman-Ford e split horizon, com falhas de enlace e custos editáveis.',
    topics: ['Hello e adjacências', 'LSAs e SPF', 'Bellman-Ford e split horizon', 'Falhas de enlace'],
    rfcs: ['RFC 2328', 'RFC 2453', 'RFC 5709', 'RFC 4822'],
    status: 'available',
    engine: 'legado',
    file: 'router-simulator.html',
  },
  {
    id: 'dhcp',
    category: 'camada-de-rede',
    title: 'DHCP (DORA)',
    summary: 'Simulação interativa do DHCP: Discover, Offer, Request e Acknowledge, com gestão de leases e prevenção de conflitos por ARP.',
    topics: ['DORA', 'Leases e renovação', 'Conflitos de endereço (ARP)'],
    rfcs: ['RFC 2131', 'RFC 2132', 'RFC 5227', 'RFC 3046', 'RFC 1542'],
    status: 'available',
        engine: 'nativo',
  },
  {
    id: 'icmp',
    category: 'camada-de-rede',
    title: 'ICMP (ping e traceroute)',
    summary: 'ping, traceroute, tracert e hping3 em uma rede simulada: Echo, Time Exceeded, Destination Unreachable, fragmentação, PMTUD, ACLs e loops, com captura e hex dump.',
    topics: ['Echo e Time Exceeded', 'Fragmentação e PMTUD', 'ACLs e loops de roteamento', 'Captura e hex dump'],
    rfcs: ['RFC 792', 'RFC 1191', 'RFC 1812', 'RFC 2923', 'RFC 4821'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'bgp',
    category: 'camada-de-rede',
    title: 'BGP (sessões e seleção de caminho)',
    summary: 'BGP-4 entre seis sistemas autônomos: sessões, OPEN, UPDATE e KEEPALIVE, relações comerciais, LOCAL_PREF, AS-path prepend, falhas e reconvergência, mais sequestro de prefixo, vazamento de rota e flapping com as defesas (filtros, RPKI/ROV, flap damping).',
    topics: ['Sessões e mensagens', 'Seleção de caminho', 'Sequestro, vazamento e flapping', 'Defesas (RPKI/ROV, filtros)'],
    rfcs: ['RFC 4271', 'RFC 6811', 'RFC 7908', 'RFC 9319', 'RFC 9582', 'RFC 8212'],
    status: 'available',
    engine: 'legado',
    file: 'bgp-simulator.html',
  },
  {
    id: 'mpls',
    category: 'camada-de-rede',
    title: 'MPLS (LDP e L3VPN)',
    summary: 'Núcleo MPLS com seis LSRs: sessões LDP, LIB e LFIB, push, swap e pop, PHP, modelos de TTL, traceroute com rótulos e L3VPN com pilha de dois rótulos.',
    topics: ['LDP, LIB e LFIB', 'Push, swap e pop', 'PHP e TTL', 'L3VPN com dois rótulos'],
    rfcs: ['RFC 3031', 'RFC 5036', 'RFC 4364', 'RFC 4381'],
    status: 'available',
    engine: 'legado',
    file: 'mpls-simulator.html',
  },
  {
    id: 'tcp-udp',
    category: 'transporte',
    title: 'TCP e UDP',
    summary: 'Camada de transporte em diagrama de sequência: handshake e estados do TCP, ACKs, RTO, fast retransmit, SACK, slow start e gráfico da cwnd, UDP com perdas e DNS, comparação TCP x UDP, download de arquivo por TCP e vídeo em streaming por UDP.',
    topics: ['Handshake e estados', 'Controle de congestionamento e SACK', 'Download TCP e vídeo UDP', 'Comparação TCP x UDP'],
    rfcs: ['RFC 9293', 'RFC 768', 'RFC 5681', 'RFC 2018'],
    status: 'available',
    engine: 'legado',
    file: 'tcp-udp-simulator.html',
  },
  {
    id: 'ataques-tcp-udp',
    category: 'transporte',
    title: 'Ataques e defesas TCP/UDP',
    summary: 'Laboratório defensivo com 12 ataques (SYN flood, Slowloris, RST injection, varreduras, DDoS por botnet, amplificação, DNS water torture e outros), mitigação upstream, falsos positivos e ciclo de resposta a incidente.',
    topics: ['SYN flood e Slowloris', 'Varreduras e amplificação', 'Mitigação e falsos positivos', 'Resposta a incidente'],
    rfcs: ['RFC 4987', 'RFC 5961', 'BCP 38', 'RFC 5925', 'RFC 8955', 'RFC 7999'],
    status: 'available',
    engine: 'legado',
    file: 'tcp-udp-security-simulator.html',
  },
  {
    id: 'ssh',
    category: 'protocolos-seguros',
    title: 'SSH',
    summary: 'SSH-2 por dentro: negociação de versão e algoritmos, troca de chaves, known_hosts, autenticação (senha, chave pública e TOTP), canais, SFTP e túneis (-L, -R, -D e ProxyJump), com nota de hardening.',
    topics: ['Negociação e troca de chaves', 'known_hosts e autenticação', 'Canais e SFTP', 'Túneis e encaminhamento'],
    rfcs: ['RFC 4251', 'RFC 4253', 'RFC 4252', 'RFC 4254', 'RFC 4256', 'RFC 8332', 'RFC 8709', 'RFC 8731', 'RFC 9142'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'https',
    category: 'protocolos-seguros',
    title: 'HTTPS e TLS',
    summary: 'Handshake TLS 1.3 e 1.2, validação de certificados X.509, retomada e 0-RTT, HSTS e a comparação entre HTTP e HTTPS, com nota de hardening.',
    topics: ['Handshake TLS 1.3 e 1.2', 'Certificados e validação', 'Retomada, 0-RTT e HSTS', 'Comparação HTTP x HTTPS'],
    rfcs: ['RFC 9846', 'RFC 6797', 'RFC 5280', 'RFC 5246', 'RFC 9525', 'RFC 8996'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'ftp',
    category: 'protocolos-seguros',
    title: 'FTP, FTPS e SFTP',
    summary: 'Transferência de arquivos por dentro: FTP com canais de controle e de dados (modos ativo e passivo, NAT e firewall), FTPS explícito e implícito, SFTP sobre SSH e a comparação do que um observador na rede enxerga em cada um.',
    topics: ['Canais de controle e de dados', 'Modos ativo e passivo atrás de NAT', 'FTPS: AUTH TLS, PROT P e PROT C', 'SFTP e comparação dos três'],
    rfcs: ['RFC 959', 'RFC 4217', 'RFC 2428', 'RFC 2228', 'RFC 2577'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'dns',
    category: 'protocolos-seguros',
    title: 'DNS e DNSSEC',
    summary: 'Resolução de nomes por dentro: raiz, TLD e autoritativo, cache e TTL, tipos de registro e falhas; DNSSEC com a cadeia de confiança (DS, DNSKEY, RRSIG, NSEC) e a validação; envenenamento de cache, amplificação por resolvedor aberto, DoT e DoH.',
    topics: ['Resolução recursiva e cache', 'DNSSEC e cadeia de confiança', 'Envenenamento e amplificação', 'DoT e DoH'],
    rfcs: ['RFC 1034', 'RFC 1035', 'RFC 2308', 'RFC 4033', 'RFC 4035', 'RFC 5452', 'RFC 5155', 'RFC 7858', 'RFC 8310', 'RFC 8484'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'firewall',
    category: 'protocolos-seguros',
    title: 'Firewall: filtragem e estado',
    summary: 'Filtro sem estado e com estado: regras, ordem de avaliação e negação implícita, tabela de conexões, zonas interna, DMZ e externa, filtro de origem (BCP 38), varredura e limite de taxa, com cenários defensivos.',
    topics: ['Lista de regras e política padrão', 'Tabela de conexões e estados', 'Perímetro com DMZ', 'Filtro de origem e limite de taxa'],
    rfcs: ['RFC 2979', 'RFC 9293', 'BCP 38', 'RFC 5737', 'RFC 6298'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'vpn',
    category: 'protocolos-seguros',
    title: 'VPN (IPsec e WireGuard)',
    summary: 'Túneis cifrados entre redes: IKEv2 e ESP no IPsec, o handshake do WireGuard e a comparação entre os dois.',
    topics: [],
    rfcs: ['RFC 7296', 'RFC 4303'],
    status: 'planned',
  },
  {
    id: 'waf',
    category: 'protocolos-seguros',
    title: 'WAF e firewall de aplicação',
    summary: 'Decisão pelo conteúdo, não pela porta: identificação de aplicação, regras e pontuação de anomalia do WAF, detecção versus bloqueio, inspeção de TLS e limitação de taxa.',
    topics: [],
    rfcs: ['RFC 9110', 'RFC 9846', 'RFC 8404'],
    status: 'planned',
  },
  {
    id: 'smtp',
    category: 'protocolos-seguros',
    title: 'SMTP e segurança de e-mail',
    summary: 'Entrega de e-mail passo a passo: diálogo SMTP, STARTTLS e a autenticação de domínio com SPF, DKIM e DMARC.',
    topics: [],
    rfcs: ['RFC 5321', 'RFC 3207', 'RFC 7208', 'RFC 6376', 'RFC 9989', 'RFC 9990', 'RFC 9991'],
    status: 'planned',
  },
  {
    id: 'is-is',
    category: 'camada-de-rede',
    title: 'IS-IS',
    summary: 'Roteamento por estado de enlace no IS-IS: adjacências, PDUs Hello, LSPs, níveis 1 e 2 e o cálculo SPF.',
    topics: [],
    rfcs: ['RFC 1195', 'ISO/IEC 10589'],
    status: 'planned',
  },
  {
    id: 'snmp',
    category: 'camada-de-rede',
    title: 'SNMP',
    summary: 'Gerência de redes com SNMP: GET, SET, GETNEXT, traps, a MIB e o modelo de segurança SNMPv3.',
    topics: [],
    rfcs: ['RFC 3411', 'RFC 3416', 'RFC 3414'],
    status: 'planned',
  },
  {
    id: 'switching',
    category: 'camada-de-enlace',
    title: 'Switching e aprendizado de MAC',
    summary: 'Encaminhamento de quadros em switches Ethernet: aprendizado do MAC de origem, tabela de endereços e envelhecimento, inundação, filtragem, mudança de porta, broadcast, multicast com IGMP snooping, endereços reservados e a inundação de MAC com a segurança de porta.',
    topics: ['Aprendizado e tabela de endereços', 'Inundação, filtragem e envelhecimento', 'Broadcast, multicast e IGMP snooping', 'Inundação de MAC e segurança de porta'],
    rfcs: ['IEEE 802.1Q-2022 (inclui 802.1D)', 'IEEE 802.3', 'RFC 1112', 'RFC 4541', 'RFC 9776'],
    status: 'available',
    novo: true,
    engine: 'nativo',
  },
  {
    id: 'stp',
    category: 'camada-de-enlace',
    title: 'STP, RSTP e MSTP',
    summary: 'Spanning tree em um triângulo de switches: eleição da ponte raiz, papéis e estados das portas, falhas e reconvergência no STP (30 s) e no RSTP (proposta e acordo), instâncias e balanceamento por VLAN no MSTP, tempestade de broadcast sem STP e as proteções BPDU Guard e Root Guard.',
    topics: ['Eleição da raiz e papéis das portas', 'Estados, falhas e reconvergência', 'RSTP: proposta e acordo', 'MSTP: instâncias por VLAN', 'Laço e tempestade de broadcast', 'BPDU Guard e Root Guard'],
    rfcs: ['IEEE 802.1Q-2022 (inclui 802.1D, 802.1w e 802.1s)', 'RFC 4188', 'RFC 4318'],
    status: 'available',
    novo: true,
    engine: 'nativo',
  },
  {
    id: 'vlan',
    category: 'camada-de-enlace',
    title: 'VLAN e trunking (802.1Q)',
    summary: 'Segmentação da rede local: marcação 802.1Q, portas de acesso e de tronco, VLAN nativa, roteamento entre VLANs e as defesas contra VLAN hopping.',
    topics: ['Marcação 802.1Q: acesso e tronco', 'Isolamento e domínios de broadcast', 'Roteamento entre VLANs (router-on-a-stick)', 'VLAN nativa e divergência entre as pontas', 'VLAN hopping e defesas'],
    rfcs: ['IEEE 802.1Q-2022', 'RFC 9542'],
    status: 'available',
    novo: true,
    engine: 'nativo',
  },
  {
    id: 'wifi',
    category: 'camada-de-enlace',
    title: 'Wi-Fi: operação (802.11)',
    summary: 'Como uma rede local sem fio funciona: canais, beacon e probe, autenticação aberta e associação, acesso ao meio com CSMA/CA, RTS/CTS e nó oculto, roaming e economia de energia.',
    topics: [],
    rfcs: ['IEEE 802.11'],
    status: 'planned',
  },
  {
    id: 'wifi-seguranca',
    category: 'protocolos-seguros',
    title: 'Wi-Fi: segurança (WPA2 e WPA3)',
    summary: 'Autenticação e proteção em redes sem fio: o handshake de quatro vias, PSK e SAE (WPA3), o modo empresarial com 802.1X e EAP, a proteção de quadros de gerência (PMF) e as defesas contra desautenticação e evil twin.',
    topics: [],
    rfcs: ['IEEE 802.11-2020 (inclui 802.11i e 802.11w)', 'IEEE 802.1X', 'RFC 3748'],
    status: 'planned',
  },
  {
    id: 'ntp',
    category: 'camada-de-rede',
    title: 'NTP (sincronização de tempo)',
    summary: 'Sincronização de relógios com NTPv4: os quatro timestamps, o cálculo de offset e delay, estratos, seleção de servidores e a autenticação com NTS.',
    topics: [],
    rfcs: ['RFC 5905', 'RFC 8915', 'RFC 5906'],
    status: 'planned',
  },
  {
    id: 'arp',
    category: 'camada-de-rede',
    title: 'ARP',
    summary: 'Resolução de endereços na rede local: requisição em broadcast e resposta unicast, tabela ARP e seus estados, destino remoto via gateway, proxy ARP, ARP gratuito, detecção e defesa de endereço duplicado, failover de IP e o envenenamento de cache com as defesas.',
    topics: ['Requisição e resposta', 'Tabela ARP (REACHABLE, STALE, FAILED)', 'Gateway e proxy ARP', 'ARP Probe e Announce', 'Conflito de endereço e failover', 'Envenenamento de cache e defesas (DAI, entradas estáticas)'],
    rfcs: ['RFC 826', 'RFC 1027', 'RFC 1122', 'RFC 5227'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'nat',
    category: 'camada-de-rede',
    title: 'NAT (SNAT, DNAT e NAPT)',
    summary: 'Tradução de endereços e portas: Basic NAT estático e dinâmico, NAPT (PAT), SNAT e DNAT, com a tabela de traduções, colisão de portas, esgotamento, expiração, hairpinning, ESP com NAT-T e CGNAT.',
    topics: ['Basic NAT e NAPT (PAT)', 'SNAT e DNAT', 'Tabela de traduções e portas', 'Hairpinning e redirecionamento transparente', 'Esgotamento de portas e expiração', 'ESP, NAT-T e CGNAT'],
    rfcs: ['RFC 2663', 'RFC 3022', 'RFC 4787', 'RFC 5382', 'RFC 5508', 'RFC 6598', 'RFC 6888', 'RFC 7857'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'http-versoes',
    category: 'transporte',
    title: 'HTTP/1.1, HTTP/2 e HTTP/3',
    summary: 'O carregamento de uma página em HTTP/1.1, HTTP/2 e HTTP/3: conexões paralelas e fila de pedidos, multiplexação de fluxos com HPACK, QUIC sobre UDP com handshake de 1 RTT e 0-RTT, perda de pacote (bloqueio de cabeça de fila no TCP) e fallback quando o UDP é bloqueado.',
    topics: ['Conexões e fila no HTTP/1.1', 'Fluxos e HPACK no HTTP/2', 'QUIC, 0-RTT e fallback no HTTP/3', 'Perda de pacote e bloqueio de cabeça de fila'],
    rfcs: ['RFC 9110', 'RFC 9112', 'RFC 9113', 'RFC 9114', 'RFC 9000', 'RFC 7541', 'RFC 9204'],
    status: 'available',
    engine: 'nativo',
  },
  {
    id: 'congestionamento',
    category: 'transporte',
    title: 'Controle de congestionamento (Reno, CUBIC e BBR)',
    summary: 'Como cada algoritmo ajusta a janela de congestionamento diante de perdas e de atraso: Reno, CUBIC e BBR comparados no mesmo cenário. Estende o simulador de TCP.',
    topics: [],
    rfcs: ['RFC 5681', 'RFC 9438', 'RFC 6582'],
    status: 'planned',
  },
  {
    id: '802-1x',
    category: 'protocolos-seguros',
    title: '802.1X e RADIUS (EAP)',
    summary: 'Autenticação de acesso à rede: suplicante, autenticador e servidor RADIUS trocando mensagens EAP até liberar ou bloquear a porta.',
    topics: [],
    rfcs: ['RFC 3748', 'RFC 2865', 'IEEE 802.1X'],
    status: 'planned',
  },
];

export const simsByCategory = (id: CategoryId) => SIMS.filter((s) => s.category === id);
export const findSim = (id: string | undefined) => SIMS.find((s) => s.id === id);
/** Documentação completa de cada simulador (docs/simuladores/<id>.md), versionada junto com o código e gerada por `npm run docs:simuladores`. */
export const DOCS_BASE = 'https://github.com/peotta/Simul-Net/blob/main/docs/simuladores/';
export const docUrl = (sim: SimMeta) => `${DOCS_BASE}${sim.id}.md`;
/** Endereço do arquivo de um simulador legado, respeitando o caminho base da publicação. */
export const simUrl = (sim: SimMeta) => `${import.meta.env.BASE_URL}sims/${sim.file}`;
