// Dados do simulador de ataques e defesas TCP/UDP (portados do simulador legado, sem alteração de conteúdo).
// Eficácias, limiares e taxas de falso positivo são valores didáticos, não medições.
import type { Defense, ScenData } from '../model';

export const VICTIM = "203.0.113.10";
export const UPSTREAM_DELAY = 6;
export const PLACE: Record<string, string> = {
  "edge": "borda da origem (ISP)",
  "firewall": "firewall da vítima",
  "server": "host da vítima",
  "reflector": "serviço refletor",
  "upstream": "operadora (upstream)"
};
export const ORDER: Record<string, string[]> = {
  "direct": [
    "upstream",
    "antiSpoof",
    "rateLimit",
    "stateful",
    "ids",
    "hardening",
    "synCookies",
    "tls"
  ],
  "req": [
    "antiSpoof",
    "hardening"
  ],
  "resp": [
    "upstream",
    "stateful",
    "rateLimit",
    "ids"
  ]
};
export const DEFENSES: Record<string, Defense> = {
  "rateLimit": {
    "name": "Rate limiting",
    "at": "firewall",
    "fp": 0.04,
    "fpNote": "clientes atrás de NAT/CGNAT compartilham IP e atingem o limite"
  },
  "stateful": {
    "name": "Firewall stateful",
    "at": "firewall",
    "fp": 0
  },
  "antiSpoof": {
    "name": "Anti-spoofing",
    "at": "firewall",
    "fp": 0
  },
  "synCookies": {
    "name": "SYN cookies",
    "at": "server",
    "fp": 0
  },
  "ids": {
    "name": "IDS/IPS",
    "at": "firewall",
    "fp": 0.06,
    "fpNote": "limiares e assinaturas disparam em picos legítimos de uso"
  },
  "tls": {
    "name": "TLS / SSH",
    "at": "server",
    "fp": 0
  },
  "hardening": {
    "name": "Hardening de serviços",
    "at": "server",
    "fp": 0
  },
  "upstream": {
    "name": "Mitigação upstream",
    "at": "upstream",
    "fp": 0.02,
    "fpNote": "filtros grosseiros na operadora (RTBH, bloqueio por porta) também descartam clientes legítimos"
  }
};
export const DEFAULT_WHY_NOT: Record<string, string> = {
  "synCookies": "Atua somente na fila de conexões TCP semiabertas do host.",
  "tls": "Protege confidencialidade e integridade do conteúdo, não a disponibilidade da camada de transporte.",
  "hardening": "O ataque mira um serviço que precisa continuar exposto.",
  "rateLimit": "Poucos pacotes bem construídos bastam; limitar taxa não impede o ataque.",
  "stateful": "O tráfego parece válido para o rastreamento de estado.",
  "antiSpoof": "O ataque não depende de origem falsificada.",
  "ids": "Sem padrão distinguível do tráfego normal neste cenário.",
  "upstream": "Ataque de baixo volume: filtros da operadora atuam sobre tráfego volumétrico."
};
export const DEFAULT_LOG: Record<string, string> = {
  "rateLimit": "nft: limite por origem excedido, pacote de {src} descartado",
  "stateful": "nft: ct state invalid, segmento de {src} descartado",
  "antiSpoof": "uRPF: origem {src} sem rota de retorno pela interface de entrada, descartado",
  "synCookies": "kernel: TCP: request_sock_TCP: Possible SYN flooding on port 443. Sending cookies.",
  "ids": "suricata: alerta correlacionado, origem {src} bloqueada pelo IPS",
  "tls": "tls: registro com autenticação inválida descartado (bad_record_mac)",
  "hardening": "acl: porta sem serviço publicado, descarte silencioso de {src}",
  "upstream": "operadora: regra FlowSpec descartou tráfego para 203.0.113.10 antes do enlace"
};
export const SCEN: Record<string, ScenData> = {
  "syn-flood": {
    "title": "TCP SYN flood",
    "proto": "TCP",
    "mode": "direct",
    "packet": "SYN",
    "response": "SYN-ACK",
    "factor": 1,
    "key": [
      "synCookies"
    ],
    "description": "Muitas solicitações SYN deixam conexões semiabertas e consomem a fila de backlog do servidor.",
    "indicators": [
      "Grande volume de SYN sem ACK final",
      "Crescimento de conexões em SYN-RECEIVED",
      "Timeouts e recusa de clientes legítimos"
    ],
    "mitigations": [
      "SYN cookies e ajuste do backlog",
      "Rate limiting por origem e por destino",
      "Filtragem upstream para ataques volumétricos"
    ],
    "residual": "Floods acima da capacidade do enlace exigem mitigação upstream (operadora, RTBH ou scrubbing center).",
    "evidence": [
      "tcpdump: IP {src}.{sport} > 203.0.113.10.443: Flags [S], seq {seq}, win 64240, length 0",
      "ss -s: conexões em SYN-RECV crescendo, backlog próximo do limite",
      "cliente: connect() timeout após retransmissões de SYN"
    ],
    "controls": {
      "synCookies": {
        "w": 0.9,
        "why": "O servidor codifica o estado no número de sequência do SYN-ACK e não reserva entrada no backlog. Conexões semiabertas deixam de esgotar a fila.",
        "cfg": "# Linux (host)\nsysctl -w net.ipv4.tcp_syncookies=1\nsysctl -w net.ipv4.tcp_max_syn_backlog=4096\nsysctl -w net.ipv4.tcp_synack_retries=2\n\n# Verificação\nss -n state syn-recv | wc -l\nnstat -az TcpExtSyncookiesSent TcpExtSyncookiesRecv"
      },
      "rateLimit": {
        "w": 0.45,
        "why": "Reduz SYN por origem, mas floods com origens falsificadas e distribuídas escapam de limites por IP.",
        "cfg": "# nftables: limita SYN por origem\ntcp flags & (fin|syn|rst|ack) == syn meter synflood size 65535 { ip saddr limit rate over 20/second burst 40 packets } counter drop",
        "log": "nft: meter synflood descartou SYN de {src} (acima de 20/s)"
      },
      "antiSpoof": {
        "w": 0.25,
        "why": "Descarta origens impossíveis (bogons, prefixos internos vindos de fora), mas não detecta falsificação de endereços públicos válidos.",
        "cfg": "# Cisco IOS: uRPF estrito na interface voltada ao cliente/Internet\ninterface GigabitEthernet0/0\n ip verify unicast source reachable-via rx\n\n# Linux: filtro de caminho reverso estrito\nsysctl -w net.ipv4.conf.all.rp_filter=1\n\n# nftables: origem sem rota de retorno pela interface de entrada\nfib saddr . iif oif missing drop"
      },
      "ids": {
        "w": 0.35,
        "why": "Detecta a taxa anômala de SYN por destino e pode acionar bloqueio ou mitigação upstream.",
        "cfg": "# Suricata: muitos SYN para o mesmo destino\nalert tcp any any -> $HOME_NET any (msg:\"Possivel SYN flood\"; flags:S,12; flow:stateless; threshold: type both, track by_dst, count 200, seconds 1; sid:1000001; rev:1;)",
        "log": "suricata: [1:1000001] Possivel SYN flood {src} -> 203.0.113.10:443"
      },
      "stateful": {
        "w": 0.15,
        "why": "Um SYN é um início legítimo de conexão para o firewall. Sem SYN proxy, o estado só se desloca para a tabela do firewall, que também pode esgotar.",
        "cfg": "# nftables: o SYN abre estado; monitore a tabela\nct state invalid drop\nsysctl net.netfilter.nf_conntrack_count net.netfilter.nf_conntrack_max\n\n# Evolução: SYNPROXY no firewall assume o handshake",
        "log": "conntrack: tabela de estados em {pct}% da capacidade"
      },
      "tls": {
        "w": 0,
        "why": "O TLS só começa depois do handshake TCP; não protege a fila de SYN."
      },
      "upstream": {
        "w": 0.5,
        "why": "Scrubbing filtra SYN de origens anômalas antes do enlace; essencial quando o volume excede a capacidade local.",
        "cfg": "# Mitigação na operadora / serviço anti-DDoS\n\n# 1) FlowSpec (RFC 8955): descarta só o padrão do ataque, antes do enlace\n#    destino 203.0.113.10/32, TCP, flags SYN, taxa acima do perfil -> rate-limit\n\n# 2) RTBH (RFC 7999): anuncia o /32 com a community BLACKHOLE\n#    ATENÇÃO: descarta TODO o tráfego para a vítima, inclusive o legítimo\nip route 203.0.113.10 255.255.255.255 Null0 tag 666\nroute-map RTBH permit 10\n match tag 666\n set community 65535:666 no-export\nrouter bgp 65001\n redistribute static route-map RTBH\n neighbor 192.0.2.1 send-community\n\n# 3) Scrubbing center: desvio por BGP e retorno do tráfego limpo por túnel GRE\n#    Contrato always-on elimina o tempo de acionamento"
      }
    }
  },
  "rst-injection": {
    "title": "TCP RST injection",
    "proto": "TCP",
    "mode": "direct",
    "packet": "RST",
    "response": "DROP",
    "factor": 1,
    "key": [
      "stateful"
    ],
    "description": "Um segmento RST forjado tenta coincidir com uma conexão ativa para provocar seu encerramento (ex.: sessão BGP de longa duração).",
    "indicators": [
      "RST inesperado durante sessão ativa",
      "Reinícios frequentes de conexões",
      "Sequência ou janela incompatível com o fluxo"
    ],
    "mitigations": [
      "Validação rigorosa de sequência (RFC 5961, challenge ACK)",
      "TCP-AO ou IPsec em sessões críticas",
      "Monitoramento de RST anômalos"
    ],
    "residual": "Sessões longas e de portas previsíveis (BGP, VPN) continuam alvos; prefira TCP-AO (RFC 5925) ou IPsec.",
    "evidence": [
      "tcpdump: IP {src}.{sport} > 203.0.113.10.179: Flags [R], seq {seq}, win 0, length 0",
      "bgp: sessão com 192.0.2.1 encerrada por RST inesperado",
      "aplicação: connection reset by peer em sessão ativa"
    ],
    "controls": {
      "stateful": {
        "w": 0.7,
        "why": "A pilha aceita RST apenas com a sequência exata (RFC 5961). Um RST dentro da janela, mas fora do ponto exato, gera challenge ACK em vez de derrubar a sessão; o firewall descarta segmentos fora de estado.",
        "cfg": "# Linux implementa RFC 5961 (challenge ACK) por padrão\nsysctl net.ipv4.tcp_challenge_ack_limit\nnstat -az TcpExtTCPChallengeACK\n\n# nftables\nct state invalid drop",
        "log": "kernel: RST fora da sequência exata, challenge ACK enviado; sessão preservada"
      },
      "antiSpoof": {
        "w": 0.35,
        "why": "Um atacante fora do caminho precisa forjar o IP do par; filtros de origem na borda eliminam parte das tentativas.",
        "cfg": "# Cisco IOS: uRPF estrito na interface voltada ao cliente/Internet\ninterface GigabitEthernet0/0\n ip verify unicast source reachable-via rx\n\n# Linux: filtro de caminho reverso estrito\nsysctl -w net.ipv4.conf.all.rp_filter=1\n\n# nftables: origem sem rota de retorno pela interface de entrada\nfib saddr . iif oif missing drop"
      },
      "ids": {
        "w": 0.3,
        "why": "Correlaciona picos de RST e de challenge ACK, sinalizando tentativas de injeção.",
        "cfg": "# Suricata: pico de RST para a rede protegida\nalert tcp any any -> $HOME_NET any (msg:\"Pico de TCP RST\"; flags:R; threshold: type both, track by_dst, count 50, seconds 10; sid:1000002; rev:1;)"
      },
      "rateLimit": {
        "w": 0.15,
        "why": "Ajuda pouco: um único RST bem posicionado basta."
      },
      "tls": {
        "w": 0,
        "why": "Equívoco comum: TLS e SSH protegem o conteúdo, mas o RST é processado pela pilha TCP abaixo deles. A sessão cai mesmo com criptografia. Para sessões críticas use TCP-AO ou IPsec.",
        "cfg": "# BGP com autenticação de segmentos TCP (Cisco IOS)\n# TCP MD5 (RFC 2385), legado; prefira TCP-AO (RFC 5925) quando suportado\nrouter bgp 65001\n neighbor 192.0.2.1 password <segredo-forte>"
      }
    }
  },
  "session-hijack": {
    "title": "TCP session hijacking",
    "proto": "TCP",
    "mode": "direct",
    "packet": "DATA?",
    "response": "ACK",
    "factor": 1,
    "key": [
      "tls"
    ],
    "description": "Pacotes forjados tentam entrar em uma sessão usando metadados de fluxo e números de sequência plausíveis.",
    "indicators": [
      "Dados fora da janela esperada",
      "ACKs duplicados ou sequência conflitante",
      "Mudança repentina do padrão da sessão"
    ],
    "mitigations": [
      "TLS ou SSH para autenticação e integridade",
      "Números de sequência imprevisíveis",
      "Firewall stateful e segmentação"
    ],
    "residual": "Um atacante no caminho (MITM) vê a sequência correta e vence controles de estado; só criptografia autenticada protege a integridade.",
    "evidence": [
      "tcpdump: IP 192.0.2.50.{sport} > 203.0.113.10.23: Flags [P.], seq {seq}, length 32",
      "sessão: ACK storm entre cliente e servidor após injeção",
      "servidor: comando executado fora do padrão do usuário"
    ],
    "controls": {
      "tls": {
        "w": 0.92,
        "why": "Cada registro TLS/SSH é autenticado (AEAD/MAC). Dados injetados falham na verificação e são descartados; no pior caso a sessão é encerrada, mas o atacante não controla o conteúdo.",
        "cfg": "# nginx\nssl_protocols TLSv1.3;\n\n# OpenSSH (sshd_config)\nCiphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com"
      },
      "stateful": {
        "w": 0.4,
        "why": "Descarta segmentos fora da janela esperada, mas um atacante no caminho enxerga a sequência correta.",
        "cfg": "# nftables: base de um firewall stateful\ntable inet filter {\n  chain input {\n    type filter hook input priority 0; policy drop;\n    ct state established,related accept\n    ct state invalid drop\n    tcp flags & (fin|syn|rst|ack) != syn ct state new drop\n    tcp dport { 22, 443 } ct state new accept\n  }\n}"
      },
      "antiSpoof": {
        "w": 0.35,
        "why": "Bloqueia injeções vindas de fora usando o IP de um par interno.",
        "cfg": "# Cisco IOS: uRPF estrito na interface voltada ao cliente/Internet\ninterface GigabitEthernet0/0\n ip verify unicast source reachable-via rx\n\n# Linux: filtro de caminho reverso estrito\nsysctl -w net.ipv4.conf.all.rp_filter=1\n\n# nftables: origem sem rota de retorno pela interface de entrada\nfib saddr . iif oif missing drop"
      },
      "ids": {
        "w": 0.3,
        "why": "Detecta ACK storms e mudanças bruscas no padrão da sessão."
      },
      "hardening": {
        "w": 0.3,
        "why": "Desativar protocolos em texto claro (Telnet, FTP, HTTP sem TLS) remove os alvos mais fáceis de sequestro.",
        "cfg": "# Desativar serviços em texto claro\nsystemctl disable --now telnet.socket\nsystemctl disable --now vsftpd"
      }
    }
  },
  "ack-scan": {
    "title": "TCP ACK / port scan",
    "proto": "TCP",
    "mode": "scan",
    "packet": "ACK",
    "response": "RST",
    "factor": 1,
    "key": [
      "stateful"
    ],
    "description": "Sondas com flags TCP procuram inferir regras de filtragem e hosts acessíveis pelas respostas recebidas.",
    "indicators": [
      "ACKs sem sessão correspondente",
      "Sondas sequenciais para muitas portas",
      "Respostas RST concentradas em uma origem"
    ],
    "mitigations": [
      "Política padrão de bloqueio",
      "Firewall stateful para descartar ACK órfão",
      "Correlação de varredura no IDS/IPS"
    ],
    "residual": "Varreduras lentas e distribuídas passam abaixo dos limiares; mantenha inventário e exponha o mínimo.",
    "evidence": [
      "tcpdump: IP {src}.{sport} > 203.0.113.10.{dport}: Flags [.], ack {seq}, win 1024, length 0",
      "tcpdump: IP 203.0.113.10.{dport} > {src}.{sport}: Flags [R], seq {seq}, length 0",
      "scanner infere \"unfiltered\" a partir de cada RST recebido"
    ],
    "controls": {
      "stateful": {
        "w": 0.88,
        "why": "ACK sem conexão correspondente é inválido para o rastreamento de estado e é descartado em silêncio: o scanner não recebe RST e não consegue mapear as regras.",
        "cfg": "# nftables: base de um firewall stateful\ntable inet filter {\n  chain input {\n    type filter hook input priority 0; policy drop;\n    ct state established,related accept\n    ct state invalid drop\n    tcp flags & (fin|syn|rst|ack) != syn ct state new drop\n    tcp dport { 22, 443 } ct state new accept\n  }\n}",
        "log": "nft: ACK sem conexão de {src} descartado (ct state invalid), nenhum RST enviado"
      },
      "ids": {
        "w": 0.4,
        "why": "Correlaciona sondas sequenciais de uma mesma origem e bloqueia o scanner.",
        "cfg": "# Suricata: muitos ACK sem fluxo de uma mesma origem\nalert tcp any any -> $HOME_NET any (msg:\"Possivel ACK scan\"; flags:A,12; flow:stateless; threshold: type both, track by_src, count 50, seconds 10; sid:1000003; rev:1;)"
      },
      "rateLimit": {
        "w": 0.3,
        "why": "Torna a varredura lenta e cara, mas varreduras de baixa taxa passam abaixo do limite."
      },
      "hardening": {
        "w": 0.2,
        "why": "Menos portas abertas reduzem o que a varredura consegue revelar."
      },
      "antiSpoof": {
        "w": 0.1,
        "why": "O scanner precisa receber as respostas, então em geral usa o IP real; anti-spoofing só ajuda contra sondas-isca (decoys)."
      }
    }
  },
  "slowloris": {
    "title": "TCP Slowloris (conexões lentas)",
    "short": "Slowloris",
    "proto": "TCP",
    "mode": "direct",
    "packet": "HDR",
    "response": "ACK",
    "factor": 1,
    "scale": 0.5,
    "loadW": 3,
    "key": [
      "hardening"
    ],
    "description": "O atacante abre muitas conexões HTTP completas e envia os cabeçalhos bem devagar, um a cada poucos segundos. Com pouquíssimo tráfego, ocupa todos os workers do servidor.",
    "indicators": [
      "Muitas conexões ESTABLISHED de poucas origens",
      "Requisições que nunca terminam os cabeçalhos",
      "Workers esgotados com o enlace quase ocioso"
    ],
    "mitigations": [
      "Timeouts curtos de cabeçalho e corpo",
      "Limite de conexões simultâneas por IP",
      "Proxy reverso orientado a eventos na frente do servidor"
    ],
    "residual": "Variações (R.U.D.Y., slow read) atacam o corpo da requisição e a leitura da resposta; revise todos os timeouts da aplicação.",
    "evidence": [
      "tcpdump: IP {src}.{sport} > 203.0.113.10.443: Flags [P.], length 14 (um cabeçalho X-a a cada 10 s)",
      "ss -tn state established \"( sport = :443 )\": centenas de conexões abertas de poucas origens",
      "apache: server reached MaxRequestWorkers setting, consider raising the MaxRequestWorkers setting"
    ],
    "controls": {
      "hardening": {
        "w": 0.8,
        "why": "Timeouts de cabeçalho e corpo encerram conexões lentas; um proxy reverso orientado a eventos (nginx) mantém milhares de conexões ociosas sem esgotar workers.",
        "cfg": "# nginx (proxy reverso)\nclient_header_timeout 10s;\nclient_body_timeout 10s;\nkeepalive_timeout 15s;\nlimit_conn_zone $binary_remote_addr zone=perip:10m;\nlimit_conn perip 20;\n\n# Apache: mod_reqtimeout\nRequestReadTimeout header=20-40,MinRate=500 body=20,MinRate=500",
        "log": "nginx: client timed out (110: Connection timed out) while reading client request headers, client: {src}"
      },
      "rateLimit": {
        "w": 0.5,
        "why": "Aqui o limite útil é de conexões simultâneas por IP, não de pacotes por segundo: restringe quantas conexões cada origem consegue segurar.",
        "cfg": "# nftables: no máximo 20 conexões simultâneas por origem\ntcp dport 443 ct state new meter connlim { ip saddr ct count over 20 } counter reject with tcp reset",
        "log": "nft: {src} acima de 20 conexões simultâneas, nova conexão recusada"
      },
      "ids": {
        "w": 0.35,
        "why": "Identifica requisições incompletas e conexões longas sem progresso."
      },
      "stateful": {
        "w": 0.1,
        "why": "As conexões completaram o handshake e são válidas; o firewall não vê nada de errado."
      },
      "synCookies": {
        "w": 0,
        "why": "O handshake é completo; o ataque acontece depois, na aplicação."
      },
      "tls": {
        "w": 0,
        "why": "Slowloris funciona igualmente sobre HTTPS; TLS não limita o tempo de envio dos cabeçalhos."
      },
      "antiSpoof": {
        "w": 0,
        "why": "O ataque exige handshake completo, então usa IPs reais."
      },
      "upstream": {
        "w": 0,
        "why": "Volume baixíssimo: invisível para os filtros volumétricos da operadora."
      }
    }
  },
  "slow-scan": {
    "title": "TCP varredura lenta (low and slow)",
    "short": "varredura lenta",
    "proto": "TCP",
    "mode": "scan",
    "packet": "SYN",
    "response": "RST",
    "factor": 1,
    "every": 3,
    "key": [
      "hardening"
    ],
    "description": "Sondas SYN espaçadas, de origens alternadas, mapeiam portas abertas ao longo de horas sem ultrapassar os limiares de detecção.",
    "indicators": [
      "Poucas conexões incompletas espalhadas ao longo de horas",
      "Mesma origem ou ASN tocando portas diferentes em dias distintos",
      "Só aparece em correlação de longo prazo (SIEM)"
    ],
    "mitigations": [
      "Expor somente as portas necessárias",
      "Correlação de longo prazo no SIEM (horas ou dias)",
      "Portas-armadilha (honeypots) que alertam no primeiro toque"
    ],
    "residual": "Com paciência, o atacante sempre descobre as portas realmente abertas; o objetivo é reduzir a exposição e detectar cedo.",
    "evidence": [
      "tcpdump: IP {src}.{sport} > 203.0.113.10.{dport}: Flags [S], seq {seq}, win 1024, length 0",
      "tcpdump: IP 203.0.113.10.{dport} > {src}.{sport}: Flags [R.], seq 0, ack {seq1}, length 0",
      "IDS: nenhuma origem ultrapassou o limiar de 30 portas em 10 s"
    ],
    "controls": {
      "hardening": {
        "w": 0.7,
        "at": "firewall",
        "why": "Política padrão de descarte e só as portas necessárias publicadas: a varredura, lenta ou rápida, encontra pouco.",
        "cfg": "# nftables: base de um firewall stateful\ntable inet filter {\n  chain input {\n    type filter hook input priority 0; policy drop;\n    ct state established,related accept\n    ct state invalid drop\n    tcp flags & (fin|syn|rst|ack) != syn ct state new drop\n    tcp dport { 22, 443 } ct state new accept\n  }\n}"
      },
      "ids": {
        "w": 0.12,
        "why": "Com janela de 10 s o IDS não enxerga nada. É preciso correlação longa (SIEM) ou portas-armadilha que alertem no primeiro toque.",
        "cfg": "# Suricata: janela longa por origem (1 hora)\nalert tcp any any -> $HOME_NET any (msg:\"Possivel varredura lenta\"; flags:S,12; threshold: type both, track by_src, count 20, seconds 3600; sid:1000007; rev:1;)\n\n# Porta-armadilha: qualquer toque gera alerta\nalert tcp any any -> $HOME_NET 2323 (msg:\"Toque em porta-armadilha\"; flags:S,12; sid:1000008; rev:1;)"
      },
      "stateful": {
        "w": 0.15,
        "why": "SYN para uma porta publicada é início válido de conexão; o firewall permite."
      },
      "rateLimit": {
        "w": 0,
        "why": "A taxa já está muito abaixo de qualquer limite."
      },
      "antiSpoof": {
        "w": 0.05,
        "why": "O scanner precisa das respostas: usa IPs reais, apenas alternando as origens."
      }
    }
  },
  "udp-flood": {
    "title": "UDP flood",
    "proto": "UDP",
    "mode": "direct",
    "linkLoad": 0.25,
    "packet": "UDP",
    "response": "ICMP",
    "factor": 1,
    "key": [
      "rateLimit"
    ],
    "description": "Datagramas em alta taxa consomem banda, CPU e filas de processamento do destino.",
    "indicators": [
      "Pico sustentado de pacotes UDP",
      "Muitas portas ou destinos aleatórios",
      "Perda, latência e CPU elevadas"
    ],
    "mitigations": [
      "Rate limiting e QoS",
      "ACLs para serviços desnecessários",
      "Mitigação upstream e scrubbing"
    ],
    "residual": "Se o volume excede o enlace, nenhum controle local resolve: é preciso mitigação upstream (RTBH, FlowSpec, scrubbing).",
    "evidence": [
      "tcpdump -q: IP {src}.{sport} > 203.0.113.10.{dport}: UDP, length 1400",
      "tcpdump: IP 203.0.113.10 > {src}: ICMP 203.0.113.10 udp port {dport} unreachable, length 36",
      "ifstat: enlace de entrada acima de 90% da capacidade"
    ],
    "controls": {
      "rateLimit": {
        "w": 0.55,
        "why": "Limita datagramas por origem e o envio de ICMP Port Unreachable; perde eficácia contra botnets muito distribuídas.",
        "cfg": "# nftables: limita UDP por origem\nudp dport 53 meter udprate size 65535 { ip saddr limit rate over 200/second burst 400 packets } counter drop\n\n# Linux: limita ICMP de erro gerado pelo host (ms entre mensagens)\nsysctl -w net.ipv4.icmp_ratelimit=1000"
      },
      "hardening": {
        "w": 0.35,
        "at": "firewall",
        "why": "ACL descarta UDP para portas sem serviço antes de chegar ao host e sem gerar ICMP.",
        "cfg": "# nftables: só portas UDP publicadas\nudp dport != { 53, 123 } drop"
      },
      "ids": {
        "w": 0.35,
        "why": "Identifica o pico e as origens dominantes para bloqueio ou acionamento da operadora.",
        "cfg": "# Suricata: volume UDP anômalo por destino\nalert udp any any -> $HOME_NET any (msg:\"Possivel UDP flood\"; threshold: type both, track by_dst, count 5000, seconds 1; sid:1000004; rev:1;)"
      },
      "antiSpoof": {
        "w": 0.25,
        "why": "Remove origens impossíveis, mas floods com IPs públicos válidos passam.",
        "cfg": "# Cisco IOS: uRPF estrito na interface voltada ao cliente/Internet\ninterface GigabitEthernet0/0\n ip verify unicast source reachable-via rx\n\n# Linux: filtro de caminho reverso estrito\nsysctl -w net.ipv4.conf.all.rp_filter=1\n\n# nftables: origem sem rota de retorno pela interface de entrada\nfib saddr . iif oif missing drop"
      },
      "stateful": {
        "w": 0.15,
        "why": "UDP não tem estado real; o firewall só infere pseudo-sessões e sua própria tabela também pode saturar."
      },
      "tls": {
        "w": 0,
        "why": "DTLS e QUIC autenticam o conteúdo, mas o flood consome banda e CPU antes de qualquer verificação."
      },
      "synCookies": {
        "w": 0,
        "why": "Mecanismo exclusivo do handshake TCP."
      },
      "upstream": {
        "w": 0.8,
        "why": "A operadora descarta o flood antes do enlace da vítima; os controles locais só agem depois que o enlace já saturou.",
        "cfg": "# Mitigação na operadora / serviço anti-DDoS\n\n# 1) FlowSpec (RFC 8955): descarta só o padrão do ataque, antes do enlace\n#    destino 203.0.113.10/32, protocolo UDP, portas sem serviço -> discard\n\n# 2) RTBH (RFC 7999): anuncia o /32 com a community BLACKHOLE\n#    ATENÇÃO: descarta TODO o tráfego para a vítima, inclusive o legítimo\nip route 203.0.113.10 255.255.255.255 Null0 tag 666\nroute-map RTBH permit 10\n match tag 666\n set community 65535:666 no-export\nrouter bgp 65001\n redistribute static route-map RTBH\n neighbor 192.0.2.1 send-community\n\n# 3) Scrubbing center: desvio por BGP e retorno do tráfego limpo por túnel GRE\n#    Contrato always-on elimina o tempo de acionamento"
      }
    }
  },
  "botnet": {
    "title": "UDP DDoS distribuído (botnet)",
    "short": "DDoS botnet",
    "proto": "UDP",
    "mode": "direct",
    "multi": true,
    "packet": "UDP",
    "response": "ICMP",
    "factor": 1,
    "scale": 1.6,
    "loadW": 1.3,
    "linkLoad": 0.6,
    "key": [
      "upstream"
    ],
    "description": "Milhares de dispositivos comprometidos (IoT, servidores) enviam tráfego com seus IPs reais. Cada origem envia pouco, mas o volume somado excede o enlace da vítima antes mesmo do firewall.",
    "indicators": [
      "Milhares de origens distintas, cada uma com taxa baixa",
      "Enlace de entrada saturado antes do firewall",
      "Distribuição ampla de países e ASNs"
    ],
    "mitigations": [
      "Mitigação upstream: scrubbing ou FlowSpec",
      "Plano de resposta com a operadora definido antes do incidente",
      "CDN e anycast para diluir o volume"
    ],
    "residual": "Botnets muito grandes podem exceder até a capacidade de scrubbing contratada; anycast e CDN diluem o impacto.",
    "evidence": [
      "NetFlow: 4812 origens distintas para 203.0.113.10 no último minuto",
      "tcpdump -q: IP {src}.{sport} > 203.0.113.10.{dport}: UDP, length 1200",
      "roteador de borda: enlace de entrada em 100%, descartes na fila de saída da operadora"
    ],
    "controls": {
      "upstream": {
        "w": 0.85,
        "why": "A operadora filtra antes de o enlace da vítima saturar; é o único controle que escala com o volume. Sem contrato always-on, leva alguns ciclos para entrar em ação.",
        "cfg": "# Mitigação na operadora / serviço anti-DDoS\n\n# 1) FlowSpec (RFC 8955): descarta só o padrão do ataque, antes do enlace\n#    destino 203.0.113.10/32, protocolo UDP, tamanho > 1000 -> discard\n\n# 2) RTBH (RFC 7999): anuncia o /32 com a community BLACKHOLE\n#    ATENÇÃO: descarta TODO o tráfego para a vítima, inclusive o legítimo\nip route 203.0.113.10 255.255.255.255 Null0 tag 666\nroute-map RTBH permit 10\n match tag 666\n set community 65535:666 no-export\nrouter bgp 65001\n redistribute static route-map RTBH\n neighbor 192.0.2.1 send-community\n\n# 3) Scrubbing center: desvio por BGP e retorno do tráfego limpo por túnel GRE\n#    Contrato always-on elimina o tempo de acionamento"
      },
      "ids": {
        "w": 0.3,
        "why": "Detecta o ataque e fornece os padrões (portas, tamanhos) para a regra FlowSpec, mas não absorve o volume.",
        "cfg": "# Suricata: volume UDP anômalo por destino\nalert udp any any -> $HOME_NET any (msg:\"Possivel DDoS UDP\"; threshold: type both, track by_dst, count 5000, seconds 1; sid:1000010; rev:1;)"
      },
      "hardening": {
        "w": 0.25,
        "at": "firewall",
        "why": "A ACL de portas descarta parte do tráfego no firewall, mas o enlace até ele continua cheio.",
        "cfg": "# nftables: só portas UDP publicadas\nudp dport != { 53, 123 } drop"
      },
      "rateLimit": {
        "w": 0.15,
        "why": "Cada bot envia pouco; milhares de origens ficam abaixo do limite por IP. E o enlace já saturou antes do firewall."
      },
      "stateful": {
        "w": 0.1,
        "why": "Fluxos UDP novos parecem válidos; a tabela de estados também pode esgotar."
      },
      "antiSpoof": {
        "w": 0.05,
        "why": "Os bots usam IPs reais; não há falsificação para filtrar."
      }
    }
  },
  "amplification": {
    "title": "UDP amplification",
    "proto": "UDP",
    "mode": "reflect",
    "linkLoad": 0.3,
    "packet": "REQ",
    "response": "RESPONSE",
    "factor": 4,
    "key": [
      "antiSpoof",
      "hardening"
    ],
    "description": "Uma requisição pequena com origem falsificada provoca uma resposta muito maior de serviços expostos contra a vítima.",
    "indicators": [
      "Respostas UDP sem solicitação local",
      "Assimetria entre bytes de entrada e saída",
      "Tráfego concentrado de vários refletores"
    ],
    "mitigations": [
      "BCP 38 / 84 na rede de origem",
      "Desativar amplificadores abertos",
      "Response Rate Limiting e filtragem upstream"
    ],
    "residual": "O tráfego amplificado pode exceder o enlace da vítima; filtragem por porta de origem e scrubbing na operadora continuam necessários.",
    "evidence": [
      "tcpdump -q: IP 203.0.113.10.{sport} > {refl}.53: UDP, length 40 (origem falsificada)",
      "tcpdump -q: IP {refl}.53 > 203.0.113.10.{sport}: UDP, length 3120",
      "NetFlow: bytes de entrada da porta 53 muito maiores que os de saída"
    ],
    "controls": {
      "antiSpoof": {
        "w": 0.7,
        "why": "BCP 38 na rede de origem impede que o atacante envie requisições com o IP da vítima. Atenção ao local: anti-spoofing no firewall da vítima não ajuda, pois as respostas vêm dos IPs reais dos refletores.",
        "cfg": "# BCP 38 aplicado na borda da rede de ORIGEM (provedor do atacante)\n# Só sai da rede tráfego com origem nos prefixos do próprio cliente\ninterface GigabitEthernet0/1\n description Acesso do cliente 198.51.100.0/24\n ip verify unicast source reachable-via rx\n\n# Alternativa com ACL de egresso\nip access-list extended EGRESSO-CLIENTE\n permit ip 198.51.100.0 0.0.0.255 any\n deny ip any any log",
        "log": "borda ISP (BCP 38): requisição com origem 203.0.113.10 não pertence ao cliente, descartada"
      },
      "hardening": {
        "w": 0.75,
        "why": "Fechar serviços abertos (DNS recursivo público, NTP monlist, memcached UDP) e aplicar Response Rate Limiting elimina o refletor.",
        "cfg": "# BIND (named.conf): sem recursão aberta e com RRL\noptions {\n  recursion no;\n  rate-limit { responses-per-second 5; };\n};\n\n# NTP (ntp.conf)\nrestrict default kod nomodify notrap nopeer noquery\ndisable monitor\n\n# memcached: desabilitar UDP\nmemcached -U 0",
        "log": "refletor: RRL ativo, resposta para 203.0.113.10 suprimida"
      },
      "stateful": {
        "w": 0.35,
        "why": "Descarta respostas sem requisição de saída correspondente, mas o enlace até o firewall já foi consumido.",
        "cfg": "# nftables: respostas DNS sem consulta de saída\nudp sport 53 ct state new drop"
      },
      "rateLimit": {
        "w": 0.35,
        "why": "Limita respostas por refletor na entrada; ajuda contra poucos refletores, não contra milhares."
      },
      "ids": {
        "w": 0.3,
        "why": "Detecta a assimetria e as respostas grandes sem consulta, permitindo acionar a operadora.",
        "cfg": "# Suricata: respostas DNS grandes para a rede protegida\nalert udp $EXTERNAL_NET 53 -> $HOME_NET any (msg:\"Possivel amplificacao DNS\"; dsize:>1000; threshold: type both, track by_dst, count 100, seconds 1; sid:1000005; rev:1;)"
      },
      "upstream": {
        "w": 0.7,
        "why": "FlowSpec descarta UDP com porta de origem 53 e pacotes grandes antes do enlace da vítima.",
        "cfg": "# Mitigação na operadora / serviço anti-DDoS\n\n# 1) FlowSpec (RFC 8955): descarta só o padrão do ataque, antes do enlace\n#    destino 203.0.113.10/32, UDP, porta de origem 53, tamanho > 1000 -> discard\n\n# 2) RTBH (RFC 7999): anuncia o /32 com a community BLACKHOLE\n#    ATENÇÃO: descarta TODO o tráfego para a vítima, inclusive o legítimo\nip route 203.0.113.10 255.255.255.255 Null0 tag 666\nroute-map RTBH permit 10\n match tag 666\n set community 65535:666 no-export\nrouter bgp 65001\n redistribute static route-map RTBH\n neighbor 192.0.2.1 send-community\n\n# 3) Scrubbing center: desvio por BGP e retorno do tráfego limpo por túnel GRE\n#    Contrato always-on elimina o tempo de acionamento"
      }
    }
  },
  "reflection": {
    "title": "UDP spoofing / reflection",
    "proto": "UDP",
    "mode": "reflect",
    "packet": "REQ",
    "response": "REPLY",
    "factor": 2,
    "key": [
      "antiSpoof"
    ],
    "description": "O atacante falsifica o endereço da vítima e faz terceiros enviarem respostas não solicitadas a ela.",
    "indicators": [
      "Respostas originadas por muitos servidores",
      "Ausência das solicitações correspondentes",
      "Endereços de origem impossíveis na borda"
    ],
    "mitigations": [
      "Filtragem de ingresso e egresso (BCP 38 / 84)",
      "Validação de origem na operadora",
      "Rate limiting nos serviços UDP"
    ],
    "residual": "Enquanto houver redes sem BCP 38, a falsificação continua possível; a vítima depende de filtragem e mitigação upstream.",
    "evidence": [
      "tcpdump -q: IP 203.0.113.10.{sport} > {refl}.123: UDP, length 48 (origem falsificada)",
      "tcpdump -q: IP {refl}.123 > 203.0.113.10.{sport}: UDP, length 468",
      "firewall: respostas NTP sem requisição de saída correspondente"
    ],
    "controls": {
      "antiSpoof": {
        "w": 0.75,
        "why": "BCP 38 na rede de origem impede a saída de pacotes com o IP da vítima. Precisa estar na borda do atacante: na vítima, as respostas chegam de IPs legítimos.",
        "cfg": "# BCP 38 aplicado na borda da rede de ORIGEM (provedor do atacante)\n# Só sai da rede tráfego com origem nos prefixos do próprio cliente\ninterface GigabitEthernet0/1\n description Acesso do cliente 198.51.100.0/24\n ip verify unicast source reachable-via rx\n\n# Alternativa com ACL de egresso\nip access-list extended EGRESSO-CLIENTE\n permit ip 198.51.100.0 0.0.0.255 any\n deny ip any any log",
        "log": "borda ISP (BCP 38): requisição com origem 203.0.113.10 não pertence ao cliente, descartada"
      },
      "hardening": {
        "w": 0.5,
        "why": "Restringir quem pode consultar o serviço refletor reduz os terceiros disponíveis para o ataque.",
        "cfg": "# NTP (ntp.conf)\nrestrict default kod nomodify notrap nopeer noquery\nrestrict 192.0.2.0 mask 255.255.255.0 nomodify notrap",
        "log": "refletor: consulta de origem não autorizada ignorada"
      },
      "stateful": {
        "w": 0.4,
        "why": "Descarta respostas UDP sem requisição de saída correspondente.",
        "cfg": "# nftables: respostas NTP sem consulta de saída\nudp sport 123 ct state new drop"
      },
      "rateLimit": {
        "w": 0.35,
        "why": "Limita respostas por refletor na entrada da vítima."
      },
      "ids": {
        "w": 0.3,
        "why": "Correlaciona respostas de muitos servidores sem as solicitações correspondentes."
      },
      "upstream": {
        "w": 0.6,
        "why": "FlowSpec descarta respostas NTP (porta de origem 123) antes do enlace da vítima.",
        "cfg": "# Mitigação na operadora / serviço anti-DDoS\n\n# 1) FlowSpec (RFC 8955): descarta só o padrão do ataque, antes do enlace\n#    destino 203.0.113.10/32, UDP, porta de origem 123 -> discard\n\n# 2) RTBH (RFC 7999): anuncia o /32 com a community BLACKHOLE\n#    ATENÇÃO: descarta TODO o tráfego para a vítima, inclusive o legítimo\nip route 203.0.113.10 255.255.255.255 Null0 tag 666\nroute-map RTBH permit 10\n match tag 666\n set community 65535:666 no-export\nrouter bgp 65001\n redistribute static route-map RTBH\n neighbor 192.0.2.1 send-community\n\n# 3) Scrubbing center: desvio por BGP e retorno do tráfego limpo por túnel GRE\n#    Contrato always-on elimina o tempo de acionamento"
      }
    }
  },
  "udp-scan": {
    "title": "UDP port scan",
    "proto": "UDP",
    "mode": "scan",
    "packet": "PROBE",
    "response": "ICMP",
    "factor": 1,
    "key": [
      "hardening"
    ],
    "description": "Sondas UDP procuram serviços expostos e interpretam respostas da aplicação ou mensagens ICMP.",
    "indicators": [
      "Datagramas para muitas portas",
      "ICMP Port Unreachable em sequência",
      "Sondas de baixa taxa e longa duração"
    ],
    "mitigations": [
      "Expor somente serviços necessários",
      "ACLs e firewall com registro",
      "Detecção por limiar e correlação temporal"
    ],
    "residual": "Serviços realmente expostos continuarão respondendo; mantenha-os atualizados e monitorados.",
    "evidence": [
      "tcpdump -q: IP {src}.{sport} > 203.0.113.10.{dport}: UDP, length 0",
      "tcpdump: IP 203.0.113.10 > {src}: ICMP 203.0.113.10 udp port {dport} unreachable, length 36",
      "firewall: uma origem tocou dezenas de portas UDP em poucos segundos"
    ],
    "controls": {
      "hardening": {
        "w": 0.65,
        "at": "firewall",
        "why": "Política padrão de descarte silencioso: portas fechadas não geram ICMP Port Unreachable, então a varredura não distingue porta fechada de filtrada.",
        "cfg": "# nftables: descarte silencioso por padrão\ntable inet filter {\n  chain input {\n    type filter hook input priority 0; policy drop;\n    ct state established,related accept\n    udp dport { 53, 123 } accept\n    log prefix \"udp-drop \" limit rate 5/second\n  }\n}"
      },
      "ids": {
        "w": 0.5,
        "why": "Detecta uma origem tocando muitas portas em pouco tempo e bloqueia o scanner.",
        "cfg": "# Suricata: muitas portas UDP de uma mesma origem\nalert udp any any -> $HOME_NET any (msg:\"Possivel UDP scan\"; threshold: type both, track by_src, count 30, seconds 10; sid:1000006; rev:1;)"
      },
      "rateLimit": {
        "w": 0.4,
        "why": "Limitar ICMP de erro (o kernel já faz isso) torna varreduras UDP muito lentas.",
        "cfg": "# Linux: intervalo mínimo entre ICMP de erro (ms)\nsysctl -w net.ipv4.icmp_ratelimit=1000"
      },
      "stateful": {
        "w": 0.2,
        "why": "Sondas UDP parecem novos fluxos válidos; o estado ajuda pouco."
      },
      "antiSpoof": {
        "w": 0.1,
        "why": "O scanner precisa receber as respostas e usa seu IP real."
      }
    }
  },
  "dns-water-torture": {
    "title": "UDP DNS water torture",
    "short": "DNS water torture",
    "proto": "UDP",
    "mode": "direct",
    "packet": "QNAME?",
    "response": "NXDOMAIN",
    "factor": 1,
    "key": [
      "ids"
    ],
    "fp": {
      "rateLimit": {
        "p": 0.25,
        "note": "as consultas chegam pelos resolvedores dos provedores, os mesmos que atendem os clientes legítimos"
      }
    },
    "description": "Bots consultam subdomínios aleatórios e inexistentes (a8f3k.example.com) por meio de resolvedores recursivos legítimos. Nenhuma resposta fica em cache e o servidor autoritativo da vítima é sobrecarregado.",
    "indicators": [
      "Explosão de respostas NXDOMAIN",
      "Rótulos aleatórios sob o mesmo domínio",
      "Consultas vindas de resolvedores conhecidos (provedores, DNS públicos)"
    ],
    "mitigations": [
      "Detecção pela proporção de NXDOMAIN e filtragem pelo padrão do nome",
      "RRL com limite de NXDOMAIN no autoritativo",
      "Aggressive NSEC (RFC 8198) nos resolvedores e capacidade anycast"
    ],
    "residual": "Bloquear por IP derruba os resolvedores que também atendem os usuários; a defesa precisa olhar o nome consultado, não a origem.",
    "evidence": [
      "tcpdump: IP {refl}.{sport} > 203.0.113.10.53: 4123+ A? {rand}.example.com. (41)",
      "named: 92% das respostas do último minuto foram NXDOMAIN",
      "resolvedor: SERVFAIL para clientes legítimos de example.com"
    ],
    "controls": {
      "ids": {
        "w": 0.6,
        "why": "Detecta a proporção anômala de NXDOMAIN e filtra pelo padrão do nome (rótulo aleatório sob o domínio atacado), sem bloquear o resolvedor.",
        "cfg": "# Suricata: muitas consultas a nomes sob o domínio atacado\nalert dns any any -> $HOME_NET 53 (msg:\"Possivel DNS water torture\"; dns.query; content:\".example.com\"; endswith; threshold: type both, track by_dst, count 500, seconds 1; sid:1000009; rev:1;)",
        "log": "suricata: [1:1000009] consulta {rand}.example.com descartada pelo IPS"
      },
      "hardening": {
        "w": 0.45,
        "why": "RRL no autoritativo limita NXDOMAIN por bloco de origem; resolvedores com Aggressive NSEC (RFC 8198) respondem do cache sem consultar a vítima.",
        "cfg": "# BIND autoritativo (named.conf)\noptions {\n  rate-limit {\n    responses-per-second 10;\n    nxdomains-per-second 5;\n  };\n};\n\n# Unbound (resolvedor): Aggressive NSEC, RFC 8198\n# requer zona assinada com DNSSEC\naggressive-nsec: yes",
        "log": "named: rate limit drop NXDOMAIN response to 192.0.2.0/24 for example.com"
      },
      "upstream": {
        "w": 0.5,
        "why": "DNS anycast e scrubbing com inspeção de DNS absorvem o volume.",
        "cfg": "# Mitigação na operadora / serviço anti-DDoS\n\n# 1) FlowSpec (RFC 8955): descarta só o padrão do ataque, antes do enlace\n#    destino 203.0.113.10/32, UDP porta 53, acima do perfil -> rate-limit\n\n# 2) RTBH (RFC 7999): anuncia o /32 com a community BLACKHOLE\n#    ATENÇÃO: descarta TODO o tráfego para a vítima, inclusive o legítimo\nip route 203.0.113.10 255.255.255.255 Null0 tag 666\nroute-map RTBH permit 10\n match tag 666\n set community 65535:666 no-export\nrouter bgp 65001\n redistribute static route-map RTBH\n neighbor 192.0.2.1 send-community\n\n# 3) Scrubbing center: desvio por BGP e retorno do tráfego limpo por túnel GRE\n#    Contrato always-on elimina o tempo de acionamento"
      },
      "rateLimit": {
        "w": 0.35,
        "why": "Reduz a carga, mas as origens são resolvedores legítimos: limitar por IP descarta também as consultas de usuários reais.",
        "cfg": "# nftables: limita consultas por origem\nudp dport 53 meter dnsrate size 65535 { ip saddr limit rate over 100/second burst 200 packets } counter drop"
      },
      "stateful": {
        "w": 0.05,
        "why": "Consultas DNS são fluxos UDP novos e válidos."
      },
      "antiSpoof": {
        "w": 0,
        "why": "As consultas chegam pelos resolvedores, com IPs reais."
      },
      "tls": {
        "w": 0,
        "why": "DoT e DoH protegem o canal entre cliente e resolvedor, não o volume de consultas ao autoritativo."
      }
    }
  }
};
