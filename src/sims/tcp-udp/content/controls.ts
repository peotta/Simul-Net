// Controles do painel do simulador de TCP e UDP.
import type { ControlDef } from '../../../sim-core/ui';

export const controls: ControlDef[] = [
  {
    "id": "N",
    "label": "Segmentos",
    "type": "select",
    "def": 20,
    "grp": "Transferência",
    "subs": [
      "tcp",
      "cmp",
      "stream"
    ],
    "opts": [
      [
        1,
        "1"
      ],
      [
        2,
        "2"
      ],
      [
        3,
        "3"
      ],
      [
        4,
        "4"
      ],
      [
        5,
        "5"
      ],
      [
        6,
        "6"
      ],
      [
        8,
        "8"
      ],
      [
        10,
        "10"
      ],
      [
        12,
        "12"
      ],
      [
        15,
        "15"
      ],
      [
        20,
        "20"
      ],
      [
        25,
        "25"
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
    "num": true,
    "wide": true,
    "help": {
      "t": "Segmentos",
      "s": "Quantos segmentos (TCP) ou datagramas (UDP) de 1000 bytes serão enviados.",
      "p": [
        "Cada segmento carrega 1000 bytes de dados (o MSS). 20 segmentos equivalem a um arquivo de 20 kB.",
        "Com mais segmentos, o crescimento da janela de congestionamento fica mais visível."
      ]
    }
  },
  {
    "id": "rtt",
    "label": "RTT (ms)",
    "type": "select",
    "def": 15,
    "grp": "Rede",
    "opts": [
      [
        5,
        "5"
      ],
      [
        10,
        "10"
      ],
      [
        15,
        "15"
      ],
      [
        20,
        "20"
      ],
      [
        50,
        "50"
      ],
      [
        100,
        "100"
      ],
      [
        200,
        "200"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "RTT (Round-Trip Time)",
      "s": "Tempo de ida e volta na rede, sem contar a transmissão.",
      "p": [
        "Metade do RTT é o atraso de propagação em cada sentido.",
        "Ele define o custo do handshake (1 RTT antes do primeiro dado), o ritmo do slow start (a janela dobra a cada RTT) e o valor do RTO.",
        "Referências: cerca de 1 ms em rede local, 15 ms em uma rede metropolitana e de 100 a 200 ms entre continentes."
      ]
    }
  },
  {
    "id": "bw",
    "label": "Banda (Mbps)",
    "type": "select",
    "def": 1,
    "grp": "Rede",
    "subs": [
      "tcp",
      "cmp",
      "stream",
      "dl",
      "vid"
    ],
    "opts": [
      [
        1,
        "1"
      ],
      [
        2,
        "2"
      ],
      [
        5,
        "5"
      ],
      [
        10,
        "10"
      ],
      [
        20,
        "20"
      ],
      [
        50,
        "50"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Banda",
      "s": "Capacidade do enlace em megabits por segundo.",
      "p": [
        "Define o tempo de transmissão de cada segmento: 1000 bytes levam 8 ms a 1 Mbps e 1,6 ms a 5 Mbps. Por isso as setas saem espaçadas no diagrama. Os valores de 10 a 50 Mbps servem ao download e ao vídeo.",
        "O produto banda × RTT indica quantos dados precisam estar em voo para ocupar o enlace inteiro."
      ]
    }
  },
  {
    "id": "loss",
    "label": "Perda (%)",
    "type": "select",
    "def": 0,
    "grp": "Rede",
    "opts": [
      [
        0,
        "0"
      ],
      [
        1,
        "1"
      ],
      [
        2,
        "2"
      ],
      [
        3,
        "3"
      ],
      [
        5,
        "5"
      ],
      [
        8,
        "8"
      ],
      [
        10,
        "10"
      ],
      [
        15,
        "15"
      ],
      [
        20,
        "20"
      ],
      [
        30,
        "30"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Perda (%)",
      "s": "Probabilidade de cada segmento de dados ser descartado na rede.",
      "p": [
        "O sorteio vale para cada transmissão, inclusive as retransmissões, e é definido pela semente.",
        "No DNS, vale para a consulta e para a resposta.",
        "Exemplo: 1% já é uma perda alta em redes cabeadas; redes sem fio congestionadas podem passar de 5%."
      ]
    }
  },
  {
    "id": "seed",
    "label": "Semente",
    "type": "select",
    "def": 7,
    "grp": "Rede",
    "opts": [
      [
        1,
        "1"
      ],
      [
        2,
        "2"
      ],
      [
        3,
        "3"
      ],
      [
        5,
        "5"
      ],
      [
        7,
        "7"
      ],
      [
        11,
        "11"
      ],
      [
        42,
        "42"
      ],
      [
        99,
        "99"
      ],
      [
        1234,
        "1234"
      ],
      [
        9999,
        "9999"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Semente",
      "s": "Número que define o sorteio das perdas e dos atrasos.",
      "p": [
        "A mesma semente gera sempre as mesmas perdas: a simulação se repete igual em aula.",
        "No modo Comparação, TCP e UDP sofrem exatamente as mesmas perdas.",
        "Troque o valor para ver outra sequência de perdas com a mesma taxa."
      ]
    }
  },
  {
    "id": "file",
    "label": "Tamanho do arquivo",
    "type": "select",
    "def": 5,
    "grp": "Transferência",
    "subs": [
      "dl"
    ],
    "opts": [
      [
        1,
        "1 MB"
      ],
      [
        5,
        "5 MB"
      ],
      [
        20,
        "20 MB"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Tamanho do arquivo",
      "s": "Tamanho do arquivo baixado do servidor.",
      "p": [
        "Cada 1 MB equivale a 1000 segmentos de 1000 bytes.",
        "Arquivos grandes mostram o regime estável (dente de serra da cwnd). Arquivos pequenos são dominados pelo handshake e pelo slow start."
      ]
    }
  },
  {
    "id": "vbr",
    "label": "Taxa do vídeo",
    "type": "select",
    "def": 2500,
    "grp": "Vídeo",
    "subs": [
      "vid"
    ],
    "opts": [
      [
        500,
        "500 kbit/s"
      ],
      [
        1000,
        "1000 kbit/s"
      ],
      [
        2500,
        "2500 kbit/s"
      ],
      [
        4000,
        "4000 kbit/s"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Taxa do vídeo",
      "s": "Quantos kbit/s o codificador produz, em média.",
      "p": [
        "O vídeo tem 25 quadros por segundo. O quadro I (um por segundo) carrega cerca de 6 vezes mais dados que um quadro P.",
        "Se a taxa passar da banda do enlace, o UDP não reduz o envio e o excesso é descartado na fila."
      ]
    }
  },
  {
    "id": "vdur",
    "label": "Duração",
    "type": "select",
    "def": 5,
    "grp": "Vídeo",
    "subs": [
      "vid"
    ],
    "opts": [
      [
        2,
        "2 s"
      ],
      [
        5,
        "5 s"
      ],
      [
        10,
        "10 s"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Duração",
      "s": "Quanto tempo de vídeo é transmitido.",
      "p": [
        "Cada segundo tem 25 quadros: 5 s equivalem a 125 quadros.",
        "Durações maiores mostram mais ciclos de quadros I."
      ]
    }
  },
  {
    "id": "jit",
    "label": "Jitter da rede",
    "type": "select",
    "def": 20,
    "grp": "Vídeo",
    "subs": [
      "vid"
    ],
    "opts": [
      [
        0,
        "0 ms"
      ],
      [
        10,
        "10 ms"
      ],
      [
        20,
        "20 ms"
      ],
      [
        40,
        "40 ms"
      ],
      [
        80,
        "80 ms"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Jitter da rede",
      "s": "Variação aleatória do atraso de cada pacote.",
      "p": [
        "Cada pacote recebe um atraso extra sorteado entre 0 e o valor escolhido, somado ao atraso da fila.",
        "O buffer do player precisa cobrir essa variação. Se não cobrir, os pacotes chegam depois do prazo e são descartados."
      ]
    }
  },
  {
    "id": "jb",
    "label": "Buffer do player",
    "type": "select",
    "def": 100,
    "grp": "Vídeo",
    "subs": [
      "vid"
    ],
    "opts": [
      [
        20,
        "20 ms"
      ],
      [
        60,
        "60 ms"
      ],
      [
        100,
        "100 ms"
      ],
      [
        200,
        "200 ms"
      ],
      [
        400,
        "400 ms"
      ]
    ],
    "num": true,
    "wide": true,
    "help": {
      "t": "Buffer do player",
      "s": "Tempo que o player espera antes de exibir cada quadro.",
      "p": [
        "É o buffer de jitter. Cada quadro é exibido no instante do envio + 40 ms (duração do quadro) + atraso de propagação + buffer.",
        "O pacote que chega depois desse prazo é descartado. Buffer maior perde menos pacotes, mas aumenta o atraso entre a captura e a imagem."
      ]
    }
  },
  {
    "id": "sack",
    "label": "SACK (confirmação seletiva)",
    "type": "check",
    "def": false,
    "grp": "TCP",
    "subs": [
      "tcp",
      "cmp",
      "dl"
    ],
    "help": {
      "t": "SACK (confirmação seletiva)",
      "s": "Liga a opção SACK do TCP (RFC 2018).",
      "p": [
        "Os dois lados negociam a opção no handshake (SACK_PERM). Nos ACKs duplicados, o receptor informa os blocos de bytes que já chegaram além da lacuna (SLE e SRE).",
        "Ligado, o emissor repõe todos os buracos de uma janela em cerca de 1 RTT. Desligado, vale o NewReno: uma lacuna por RTT, descoberta pelos ACKs parciais.",
        "Faz diferença quando há várias perdas na mesma janela. Com uma só perda, os dois se comportam quase igual."
      ]
    }
  },
  {
    "id": "reorder",
    "label": "Reordenação (%)",
    "type": "select",
    "def": 0,
    "grp": "Rede",
    "subs": [
      "tcp",
      "cmp",
      "stream",
      "vid"
    ],
    "opts": [
      [
        0,
        "0"
      ],
      [
        5,
        "5"
      ],
      [
        10,
        "10"
      ],
      [
        15,
        "15"
      ],
      [
        20,
        "20"
      ],
      [
        30,
        "30"
      ]
    ],
    "num": true,
    "adv": true,
    "wide": true,
    "help": {
      "t": "Reordenação (%)",
      "s": "Probabilidade de um pacote atrasar e chegar depois dos seguintes.",
      "p": [
        "Simula pacotes que seguem caminhos diferentes ou ficam mais tempo em uma fila.",
        "No TCP, o receptor guarda o pacote adiantado e repete o ACK do que falta (ACK duplicado). Se a desordem gerar 3 ACKs duplicados, o emissor retransmite sem necessidade.",
        "No UDP, a aplicação recebe os datagramas fora de ordem."
      ]
    }
  },
  {
    "id": "iw",
    "label": "Janela inicial",
    "type": "select",
    "def": 1,
    "grp": "TCP",
    "subs": [
      "tcp",
      "cmp",
      "dl"
    ],
    "opts": [
      [
        1,
        "1 seg."
      ],
      [
        4,
        "4 seg."
      ],
      [
        10,
        "10 seg."
      ]
    ],
    "num": true,
    "adv": true,
    "wide": true,
    "help": {
      "t": "Janela inicial (IW)",
      "s": "Valor da cwnd no início da transferência, em segmentos.",
      "p": [
        "É quantos segmentos o emissor pode enviar antes do primeiro ACK.",
        "O valor original era 1; a RFC 5681 permite de 2 a 4 e o Linux usa 10 (RFC 6928, de status Experimental).",
        "Com 1, o slow start fica bem visível: 1, 2, 4, 8 segmentos por RTT."
      ]
    }
  },
  {
    "id": "rwnd",
    "label": "rwnd (seg.)",
    "type": "select",
    "def": 16,
    "grp": "TCP",
    "subs": [
      "tcp",
      "cmp",
      "dl"
    ],
    "opts": [
      [
        4,
        "4"
      ],
      [
        8,
        "8"
      ],
      [
        16,
        "16"
      ],
      [
        32,
        "32"
      ],
      [
        64,
        "64"
      ],
      [
        256,
        "256"
      ],
      [
        1024,
        "1024"
      ]
    ],
    "num": true,
    "adv": true,
    "wide": true,
    "help": {
      "t": "rwnd (janela do receptor)",
      "s": "Espaço de buffer que o servidor anuncia em cada ACK.",
      "p": [
        "É o controle de fluxo: protege o receptor de receber mais do que consegue guardar. O valor aparece no campo Janela dos ACKs (16 segmentos = 16000 bytes).",
        "O emissor nunca tem mais que o mínimo entre cwnd e rwnd em voo. Com rwnd = 4, a cwnd pode crescer, mas o envio fica limitado a 4 segmentos."
      ]
    }
  },
  {
    "id": "ssth",
    "label": "ssthresh inicial",
    "type": "select",
    "def": 64,
    "grp": "TCP",
    "subs": [
      "tcp",
      "cmp",
      "dl"
    ],
    "opts": [
      [
        64,
        "64 seg."
      ],
      [
        8,
        "8 seg."
      ],
      [
        1000,
        "sem limite"
      ]
    ],
    "num": true,
    "adv": true,
    "wide": true,
    "help": {
      "t": "ssthresh inicial",
      "s": "Limiar entre o slow start e o congestion avoidance.",
      "p": [
        "Abaixo do ssthresh, a cwnd cresce exponencialmente (slow start). Acima, cresce cerca de 1 segmento por RTT (congestion avoidance).",
        "Com 64, o slow start vai até a primeira perda ou até o limite da rwnd. Com 8, a mudança de fase aparece cedo. Com \"sem limite\", só a primeira perda encerra o slow start (útil no download).",
        "Depois de uma perda, o TCP recalcula o ssthresh como metade do que estava em voo."
      ]
    }
  },
  {
    "id": "drops",
    "label": "Descartar na 1ª transmissão (nº)",
    "type": "select",
    "def": "",
    "grp": "Rede",
    "subs": [
      "tcp",
      "cmp",
      "stream",
      "dns",
      "dl"
    ],
    "opts": [
      [
        "",
        "nenhum"
      ],
      [
        "1",
        "#1"
      ],
      [
        "3",
        "#3"
      ],
      [
        "5",
        "#5"
      ],
      [
        "6",
        "#6"
      ],
      [
        "8",
        "#8"
      ],
      [
        "10",
        "#10"
      ],
      [
        "15",
        "#15"
      ],
      [
        "5, 7, 9",
        "#5, #7 e #9"
      ],
      [
        "3, 6, 9",
        "#3, #6 e #9"
      ]
    ],
    "adv": true,
    "wide": true,
    "help": {
      "t": "Descartar na 1ª transmissão",
      "s": "Números dos segmentos que se perdem na primeira vez que são enviados.",
      "p": [
        "Escolha o número do segmento (ou uma combinação pronta). A retransmissão desses segmentos não é descartada, a não ser pela perda aleatória.",
        "Permite criar situações exatas: perder um segmento do meio provoca fast retransmit; perder o último provoca timeout.",
        "No DNS, \"#1\" descarta a primeira consulta."
      ]
    }
  },
  {
    "id": "ackLoss",
    "label": "Perda também nos ACKs",
    "type": "check",
    "def": false,
    "grp": "Rede",
    "subs": [
      "tcp",
      "cmp"
    ],
    "adv": true,
    "help": {
      "t": "Perda também nos ACKs",
      "s": "Aplica a mesma taxa de perda aos ACKs do servidor.",
      "p": [
        "Como o ACK do TCP é cumulativo, o ACK seguinte confirma também o que o ACK perdido confirmaria.",
        "Por isso a perda de ACKs raramente causa retransmissão; na maioria das vezes, só atrasa um pouco o crescimento da janela."
      ]
    }
  }
];
