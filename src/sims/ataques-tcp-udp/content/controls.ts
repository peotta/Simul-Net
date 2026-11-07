// Controles do painel do simulador de ataques e defesas TCP/UDP.
import type { ControlDef } from '../../../sim-core/ui';

export const controls: ControlDef[] = [
  {
    "id": "attackTcp",
    "label": "Ataque TCP",
    "type": "select",
    "def": "syn-flood",
    "grp": "Ataque",
    "opts": [
      [
        "syn-flood",
        "TCP SYN flood"
      ],
      [
        "rst-injection",
        "TCP RST injection"
      ],
      [
        "session-hijack",
        "TCP session hijacking"
      ],
      [
        "ack-scan",
        "TCP ACK / port scan"
      ],
      [
        "slowloris",
        "TCP Slowloris (conexões lentas)"
      ],
      [
        "slow-scan",
        "TCP varredura lenta (low and slow)"
      ]
    ],
    "subs": [
      "tcp"
    ],
    "wide": true
  },
  {
    "id": "attackUdp",
    "label": "Ataque UDP",
    "type": "select",
    "def": "udp-flood",
    "grp": "Ataque",
    "opts": [
      [
        "udp-flood",
        "UDP flood"
      ],
      [
        "botnet",
        "UDP DDoS distribuído (botnet)"
      ],
      [
        "amplification",
        "UDP amplification"
      ],
      [
        "reflection",
        "UDP spoofing / reflection"
      ],
      [
        "udp-scan",
        "UDP port scan"
      ],
      [
        "dns-water-torture",
        "UDP DNS water torture"
      ]
    ],
    "subs": [
      "udp"
    ],
    "wide": true
  },
  {
    "id": "intensity",
    "label": "Intensidade do ataque",
    "type": "select",
    "def": 3,
    "grp": "Ataque",
    "opts": [
      [
        1,
        "1 - muito baixa"
      ],
      [
        2,
        "2 - baixa"
      ],
      [
        3,
        "3 - moderada"
      ],
      [
        4,
        "4 - alta"
      ],
      [
        5,
        "5 - muito alta"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Intensidade do ataque",
      "s": "Quantidade de pacotes de ataque por ciclo, de 1 a 5.",
      "p": [
        "Define quantos pacotes de ataque saem por ciclo e o ritmo da simulação.",
        "Ataques de baixo volume (Slowloris, varredura lenta) usam poucos pacotes de propósito; ataques volumétricos crescem com a intensidade.",
        "Suba a intensidade para testar se a mesma defesa continua segurando o ataque."
      ]
    }
  },
  {
    "id": "cycles",
    "label": "Ciclos simulados",
    "type": "select",
    "def": 20,
    "grp": "Ataque",
    "opts": [
      [
        10,
        "10"
      ],
      [
        20,
        "20"
      ],
      [
        30,
        "30"
      ],
      [
        40,
        "40"
      ]
    ],
    "num": true
  },
  {
    "id": "rateLimit",
    "label": "Rate limiting",
    "type": "check",
    "def": false,
    "grp": "Controles defensivos",
    "help": {
      "t": "Rate limiting",
      "s": "Limita pacotes ou conexões por origem.",
      "p": [
        "Descarta o que passa de um limite por endereço de origem, por exemplo 20 SYN por segundo (meter do nftables, hashlimit do iptables ou limites do próprio serviço).",
        "Funciona contra poucas origens; perde força contra ataques distribuídos e origens falsificadas.",
        "<b>Custo:</b> clientes atrás de NAT ou CGNAT compartilham o mesmo IP e podem ser bloqueados (falso positivo)."
      ]
    }
  },
  {
    "id": "stateful",
    "label": "Firewall stateful",
    "type": "check",
    "def": false,
    "grp": "Controles defensivos",
    "help": {
      "t": "Firewall stateful",
      "s": "Valida estado, flags e janela de sequência.",
      "p": [
        "Acompanha cada conexão em uma tabela de estados e só aceita pacotes coerentes com ela: SYN para abrir, ACK de conexão existente, sequência dentro da janela.",
        "Descarta ACK órfão, RST fora da sequência e respostas que ninguém pediu.",
        "<b>Limite:</b> um SYN é sempre um início válido, e a própria tabela de estados pode esgotar em floods."
      ]
    }
  },
  {
    "id": "antiSpoof",
    "label": "Anti-spoofing (BCP 38 / uRPF)",
    "type": "check",
    "def": false,
    "grp": "Controles defensivos",
    "help": {
      "t": "Anti-spoofing (BCP 38 / uRPF)",
      "s": "Descarta pacotes com origem falsificada.",
      "p": [
        "Descarta pacotes cuja origem não poderia chegar por aquela interface: uRPF no roteador, rp_filter no Linux, BCP 38 na borda do provedor.",
        "Contra reflexão e amplificação, só funciona na rede de <b>origem</b> do atacante: na vítima, as respostas vêm de IPs legítimos, os dos refletores.",
        "Não ajuda contra botnets, que usam os próprios IPs."
      ]
    }
  },
  {
    "id": "synCookies",
    "label": "SYN cookies",
    "type": "check",
    "def": false,
    "grp": "Controles defensivos",
    "help": {
      "t": "SYN cookies",
      "s": "Protege a fila de conexões TCP no host.",
      "p": [
        "O servidor responde ao SYN sem reservar memória: o estado vai codificado no número de sequência do SYN-ACK e só é reconstruído quando o ACK final chega (RFC 4987).",
        "Neutraliza o SYN flood contra a fila de conexões semiabertas.",
        "Atua só no handshake TCP: não ajuda depois da conexão aberta nem contra UDP."
      ]
    }
  },
  {
    "id": "ids",
    "label": "IDS/IPS",
    "type": "check",
    "def": false,
    "grp": "Controles defensivos",
    "help": {
      "t": "IDS/IPS",
      "s": "Detecta padrões anômalos e bloqueia origens.",
      "p": [
        "O IDS reconhece padrões (assinaturas e limiares) e gera alertas; no modo IPS, também bloqueia. Exemplos: Suricata, Snort, Zeek.",
        "É o principal meio de <b>detecção</b>: sem ele, ataques de baixo volume passam despercebidos (veja a linha do tempo de resposta a incidente).",
        "<b>Custo:</b> limiares mal calibrados geram falsos positivos contra usuários reais."
      ]
    }
  },
  {
    "id": "tls",
    "label": "TLS / SSH",
    "type": "check",
    "def": false,
    "grp": "Controles defensivos",
    "help": {
      "t": "TLS / SSH",
      "s": "Autentica e cifra o conteúdo da sessão.",
      "p": [
        "Cifra e autentica cada registro da sessão (TLS 1.3, SSH): dados injetados falham na verificação de integridade.",
        "Resolve o sequestro de sessão, mas não protege o TCP abaixo dele: um RST forjado derruba a conexão mesmo com TLS.",
        "Não ajuda contra ataques de volume nem contra varreduras."
      ]
    }
  },
  {
    "id": "hardening",
    "label": "Hardening de serviços",
    "type": "check",
    "def": false,
    "grp": "Controles defensivos",
    "help": {
      "t": "Hardening de serviços",
      "s": "Fecha portas, restringe serviços e ajusta timeouts.",
      "p": [
        "Reduz a superfície de ataque: fecha portas e serviços desnecessários, desativa recursão DNS aberta, NTP monlist e UDP no memcached, ajusta timeouts da aplicação.",
        "É o controle essencial contra Slowloris, varreduras e o uso dos seus serviços como refletores.",
        "Depende de inventário: só se endurece o que se sabe que existe."
      ]
    }
  },
  {
    "id": "upstream",
    "label": "Mitigação upstream",
    "type": "select",
    "def": "off",
    "grp": "Controles defensivos",
    "opts": [
      [
        "off",
        "desligada"
      ],
      [
        "on",
        "ativa desde o início (always-on)"
      ],
      [
        "3",
        "acionada depois do ciclo 3"
      ],
      [
        "6",
        "acionada depois do ciclo 6"
      ],
      [
        "10",
        "acionada depois do ciclo 10"
      ]
    ],
    "wide": true,
    "help": {
      "t": "Mitigação upstream",
      "s": "Scrubbing ou FlowSpec na operadora.",
      "p": [
        "A operadora ou um serviço anti-DDoS filtra o tráfego antes de ele chegar ao seu enlace: FlowSpec (RFC 8955), scrubbing center ou RTBH (RFC 7999).",
        "É o único controle que escala com ataques maiores que o seu enlace.",
        "Escolha \"ativa desde o início\" para o contrato always-on, ou \"acionada depois do ciclo N\" para chamar a operadora com o ataque em andamento: a regra só entra em vigor 6 ciclos depois do chamado. O RTBH descarta todo o tráfego para a vítima, inclusive o legítimo."
      ]
    }
  }
];
