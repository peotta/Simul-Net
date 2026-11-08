// Cenários e documentação do simulador de TCP e UDP.
import type { ScenarioDef, ScenarioDoc } from '../../../sim-core/ui';

export const stageTitles: Record<string, string> = {
  tcp: 'Diagrama de sequência: TCP (transferência de arquivo)',
  dl: 'Diagrama de sequência: download de arquivo por TCP (uma seta por rodada)',
  stream: 'Diagrama de sequência: UDP (fluxo de datagramas)',
  dns: 'Diagrama de sequência: UDP (DNS)',
  vid: 'Diagrama de sequência: vídeo em streaming por UDP (uma seta por quadro)',
  cmp: 'Diagrama de sequência: TCP e UDP na mesma rede',
};

export const scenarios: ScenarioDef[] = [
  { id: "hs", g: "TCP", sub: "tcp", label: "Handshake e encerramento", set: { N: 3, loss: 0, drops: '', iw: 1, rwnd: 16, ssth: 64, reorder: 0 }, what: "<p>Três segmentos na abertura (SYN, SYN-ACK, ACK), três de dados e quatro no encerramento (FIN e ACK em cada sentido).</p><p>Acompanhe os estados no painel. O primeiro byte de dados só sai depois de 1 RTT, e o cliente termina em TIME_WAIT.</p>" },
  { id: "ss", g: "TCP", sub: "tcp", label: "Slow start", set: { N: 30, loss: 0, drops: '', iw: 1, rwnd: 32, ssth: 8, reorder: 0 }, what: "<p>A cwnd começa em 1 e cresce 1 segmento por ACK: as rajadas dobram a cada RTT (1, 2, 4, 8). Ao atingir o ssthresh (8), passa a crescer cerca de 1 segmento por RTT.</p><p>Veja a aba Janela (cwnd). Repare também que os ACKs voltam espaçados e cadenciam os próximos envios (ACK clocking).</p>" },
  { id: "fr", g: "TCP", sub: "tcp", label: "Fast retransmit", set: { N: 20, loss: 0, drops: '8', iw: 4, rwnd: 16, ssth: 64, reorder: 0 }, what: "<p>O segmento #8 se perde. Os seguintes chegam fora de ordem e o receptor repete o ACK do que falta. No terceiro ACK duplicado, o emissor retransmite sem esperar o timeout e reduz a janela à metade (fast recovery).</p><p>No gráfico, a cwnd cai à metade em vez de voltar a 1.</p>" },
  { id: "rto", g: "TCP", sub: "tcp", label: "Timeout (RTO)", set: { N: 6, loss: 0, drops: '6', iw: 4, rwnd: 16, ssth: 64, reorder: 0 }, what: "<p>O último segmento (#6) se perde. Sem segmentos depois dele, não surgem ACKs duplicados: só o temporizador RTO percebe a perda.</p><p>Depois do timeout, a cwnd volta a 1 e o RTO dobra. Compare o tempo gasto com o do fast retransmit.</p>" },
  { id: "rwnd", g: "TCP", sub: "tcp", label: "Janela do receptor", set: { N: 20, loss: 0, drops: '', iw: 10, rwnd: 4, ssth: 64, reorder: 0 }, what: "<p>A cwnd começa em 10, mas o receptor anuncia rwnd = 4 segmentos. O emissor nunca tem mais de 4 segmentos em voo: é o controle de fluxo, que protege o buffer do receptor.</p><p>Compare com rwnd = 16 e veja a diferença no tempo total.</p>" },
  { id: "rand", g: "TCP", sub: "tcp", label: "Perdas aleatórias", set: { N: 30, loss: 8, drops: '', iw: 4, rwnd: 16, ssth: 64, reorder: 0 }, what: "<p>8% de perda nos dados, sorteada pela semente. O TCP combina fast retransmit, ACKs parciais e, às vezes, timeouts.</p><p>Troque a semente para ver outras sequências de perdas com a mesma taxa.</p>" },
  { id: "nosack", g: "TCP", sub: "tcp", label: "Várias perdas sem SACK", set: { N: 20, loss: 0, drops: '5, 7, 9', iw: 10, rwnd: 16, ssth: 64, reorder: 0, sack: false, rtt: 100, bw: 5 }, what: "<p>Os segmentos #5, #7 e #9 da primeira janela se perdem. Sem SACK, o emissor só enxerga o ACK cumulativo: descobre uma lacuna por vez.</p><p>O fast retransmit repõe o #5; o ACK parcial revela o #7, que leva mais um RTT; depois o #9. Três perdas custam três RTTs de recuperação (NewReno).</p>" },
  { id: "sack", g: "TCP", sub: "tcp", label: "Várias perdas com SACK", set: { N: 20, loss: 0, drops: '5, 7, 9', iw: 10, rwnd: 16, ssth: 64, reorder: 0, sack: true, rtt: 100, bw: 5 }, what: "<p>As mesmas três perdas (#5, #7 e #9), agora com SACK negociado no handshake. Cada ACK duplicado informa os blocos que já chegaram (SLE e SRE).</p><p>O emissor sabe exatamente o que falta e repõe os três buracos juntos, em cerca de 1 RTT. Compare o tempo total e a cwnd com o cenário sem SACK.</p>" },
  { id: "ustream", g: "UDP", sub: "stream", label: "Fluxo com perdas", set: { N: 20, loss: 10, drops: '', reorder: 10 }, what: "<p>Vinte datagramas de mídia saem sem handshake e sem esperar confirmação. Os perdidos não são recuperados e os atrasados chegam fora de ordem.</p><p>Para voz e vídeo, isso é aceitável: um áudio atrasado já não serve.</p>" },
  { id: "udns", g: "UDP", sub: "dns", label: "DNS com repetição", set: { loss: 0, drops: '1', reorder: 0 }, what: "<p>A primeira consulta se perde. O UDP não percebe; quem percebe é o resolvedor, que espera 1 s (valor didático; a RFC 1035, seção 7.2, sugere intervalo mínimo de 2 a 5 s) e repete a consulta.</p><p>É o padrão de quem usa UDP: a confiabilidade, quando necessária, fica com a aplicação.</p>" },
  { id: "closs", g: "Comparação", sub: "cmp", label: "TCP x UDP: 10% de perda", set: { N: 20, loss: 10, drops: '', iw: 4, rwnd: 16, ssth: 64, reorder: 0 }, what: "<p>Os dois protocolos enviam 20 segmentos pela mesma rede, com as mesmas perdas. O UDP termina antes e entrega o que chegou; o TCP leva mais tempo e entrega tudo, em ordem.</p><p>Veja a aba Resultados.</p>" },
  { id: "cord", g: "Comparação", sub: "cmp", label: "TCP x UDP: reordenação", set: { N: 20, loss: 0, drops: '', iw: 4, rwnd: 16, ssth: 64, reorder: 15 }, what: "<p>Sem perdas, mas com 15% dos pacotes atrasados na rede. O UDP entrega fora de ordem. O TCP reordena no buffer do receptor e pode até retransmitir sem necessidade, se a desordem gerar três ACKs duplicados.</p>" },
  { id: "dlok", g: "Download", sub: "dl", label: "Download de arquivo", set: { file: 5, rtt: 20, bw: 10, loss: 0, drops: '', iw: 10, rwnd: 1024, ssth: 1000, reorder: 0, sack: true }, what: "<p>Um arquivo de 5 MB é baixado por um enlace de 10 Mbps com RTT de 20 ms. A janela começa em 10 segmentos e dobra a cada RTT (slow start).</p><p>Não há perda aleatória: a perda vem da própria rede. Quando a janela passa do que o enlace e a fila do roteador comportam, o excesso é descartado, o TCP corta a janela e o ciclo recomeça (dente de serra).</p>" },
  { id: "dlloss", g: "Download", sub: "dl", label: "Download com perdas", set: { file: 5, rtt: 50, bw: 20, loss: 1, drops: '', iw: 10, rwnd: 1024, ssth: 1000, reorder: 0, sack: true }, what: "<p>O mesmo tipo de download, agora com 1% de perda aleatória, RTT de 50 ms e enlace de 20 Mbps.</p><p>Cada perda corta a janela, que nunca chega a encher o enlace. A vazão fica muito abaixo dos 20 Mbps, e trocar a semente muda as perdas, mas não a ordem de grandeza.</p>" },
  { id: "dlrwnd", g: "Download", sub: "dl", label: "Download limitado pela janela", set: { file: 1, rtt: 100, bw: 20, loss: 0, drops: '', iw: 10, rwnd: 16, ssth: 1000, reorder: 0, sack: true }, what: "<p>Um arquivo de 1 MB por um enlace livre de 20 Mbps, mas o receptor anuncia só 16 segmentos (16 kB) de janela e o RTT é de 100 ms.</p><p>No máximo 16 kB chegam por RTT: cerca de 1,3 Mbps. A rede está quase ociosa, e o limite é o buffer do receptor.</p>" },
  { id: "dlsat", g: "Download", sub: "dl", label: "Download com RTT alto", set: { file: 1, rtt: 200, bw: 10, loss: 0, drops: '', iw: 10, rwnd: 1024, ssth: 1000, reorder: 0, sack: true }, what: "<p>Um arquivo de 1 MB por um enlace de longa distância (RTT de 200 ms, 10 Mbps).</p><p>O primeiro byte só chega 400 ms depois do início, e o slow start ainda precisa de vários RTTs para encher o enlace. A maior parte do tempo é espera, não transmissão.</p>" },
  { id: "vidok", g: "Vídeo", sub: "vid", label: "Vídeo em streaming", set: { vbr: 2500, vdur: 5, rtt: 50, bw: 5, loss: 0, drops: '', reorder: 0, jit: 20, jb: 100 }, what: "<p>Cinco segundos de vídeo a 2500 kbit/s, 25 quadros por segundo, num enlace de 5 Mbps com jitter de até 20 ms e buffer de 100 ms no player.</p><p>O quadro I, bem maior, cria um pico de envio a cada segundo e uma fila momentânea, mas o buffer absorve a variação e todos os quadros saem sem defeito.</p>" },
  { id: "vidloss", g: "Vídeo", sub: "vid", label: "Vídeo com perdas", set: { vbr: 2500, vdur: 5, rtt: 50, bw: 5, loss: 3, drops: '', reorder: 0, jit: 20, jb: 100 }, what: "<p>O mesmo vídeo, agora com 3% de perda aleatória. Nada é retransmitido.</p><p>Pacotes perdidos deixam quadros incompletos: os P viram artefatos que se propagam até o próximo I, e um I incompleto congela a imagem. Troque a semente para ver onde caem as perdas.</p>" },
  { id: "vidcong", g: "Vídeo", sub: "vid", label: "Vídeo acima da capacidade", set: { vbr: 4000, vdur: 5, rtt: 50, bw: 2, loss: 0, drops: '', reorder: 0, jit: 20, jb: 100 }, what: "<p>O vídeo precisa de 4000 kbit/s, mas o enlace entrega 2 Mbps. O UDP não reduz o envio.</p><p>A fila do roteador enche, passa de 100 ms e o excesso é descartado em todos os quadros. O resultado é uma imagem quase sempre congelada ou com artefatos.</p>" },
  { id: "vidjit", g: "Vídeo", sub: "vid", label: "Jitter e buffer do player", set: { vbr: 2500, vdur: 5, rtt: 50, bw: 5, loss: 0, drops: '', reorder: 0, jit: 80, jb: 20 }, what: "<p>A rede agora acrescenta até 80 ms de jitter a cada pacote, mas o buffer do player tem só 20 ms.</p><p>Muitos pacotes chegam depois do prazo de exibição e são descartados. Aumente o buffer para 200 ms e compare: menos defeitos, porém mais atraso até a imagem.</p>" },
];

export const groupDoc: Record<string, string> = {
  "TCP": "Conexão confiável: abertura e encerramento, controle de congestionamento, controle de fluxo e recuperação de perdas.",
  "UDP": "Datagramas sem conexão: o que a aplicação ganha em rapidez e o que precisa fazer por conta própria.",
  "Comparação": "Os dois protocolos lado a lado, na mesma rede e com as mesmas perdas.",
  "Download": "Um arquivo grande por TCP: abertura, crescimento da janela, fila do roteador, perdas e limites de vazão.",
  "Vídeo": "Vídeo ao vivo por UDP (RTP): quadros I e P, perdas sem retransmissão, jitter e buffer do player."
};

export const scenDoc: Record<string, ScenarioDoc> = {
  "hs": {
    "short": "Abertura em três vias, transferência e encerramento.",
    "concept": "O TCP é orientado a conexão. Antes de enviar dados, cliente e servidor trocam <b>SYN</b>, <b>SYN-ACK</b> e <b>ACK</b> (three-way handshake), combinando os números de sequência iniciais (ISN). No fim, cada lado fecha o próprio sentido com <b>FIN</b> e recebe um ACK; o lado que fecha primeiro espera em <b>TIME_WAIT</b> antes de liberar a conexão.",
    "observe": [
      "No diagrama: o primeiro byte de dados só sai depois de 1 RTT, o custo do handshake.",
      "Na aba Mensagem: os números de sequência e de confirmação; o SYN e o FIN consomem um número de sequência cada.",
      "No quadro de estados: a troca de estados do cliente e do servidor até TIME_WAIT."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "SYN",
        "pede a abertura e anuncia o ISN do cliente",
        "cliente"
      ],
      [
        "SYN-ACK",
        "aceita e anuncia o ISN do servidor",
        "servidor"
      ],
      [
        "ACK",
        "confirma; a conexão fica estabelecida",
        "cliente"
      ],
      [
        "FIN e ACK",
        "encerram cada sentido da conexão",
        "os dois lados"
      ]
    ],
    "why": "O handshake garante que os dois lados estão prontos e sincronizados, mas custa 1 RTT antes do primeiro byte. Também é o alvo do SYN flood, que deixa conexões presas na metade (veja o simulador de Ataques e defesas TCP/UDP)."
  },
  "ss": {
    "short": "A janela de congestionamento dobra a cada RTT até o ssthresh.",
    "concept": "O <b>slow start</b> é como o TCP descobre quanto a rede aguenta. A janela de congestionamento (<b>cwnd</b>) começa pequena e cresce 1 segmento a cada ACK, o que a dobra a cada RTT. Ao alcançar o limiar <b>ssthresh</b>, o TCP passa para o <b>congestion avoidance</b> e cresce só cerca de 1 segmento por RTT.",
    "observe": [
      "Na aba Janela (cwnd): o crescimento 1, 2, 4, 8 e a mudança de inclinação no ssthresh (8).",
      "No diagrama: rajadas cada vez maiores, cadenciadas pelos ACKs (ACK clocking).",
      "Na aba Resultados: o tempo total da transferência."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Dados",
        "segmentos de 1000 bytes",
        "cliente"
      ],
      [
        "ACK",
        "confirma e libera novos envios",
        "servidor"
      ]
    ],
    "why": "Evita que um emissor recém-chegado inunde a rede (RFC 5681). O Linux começa com janela 10 (RFC 6928, de status Experimental) para acelerar transferências curtas."
  },
  "fr": {
    "short": "Três ACKs duplicados disparam a retransmissão sem esperar o timeout.",
    "concept": "Quando um segmento se perde e os seguintes chegam, o receptor repete o ACK do primeiro byte que falta (<b>ACK duplicado</b>). Três ACKs duplicados indicam uma perda isolada: o emissor faz o <b>fast retransmit</b>, retransmite na hora e entra em <b>fast recovery</b>, cortando a janela à metade em vez de voltar a 1.",
    "observe": [
      "No diagrama: o #8 se perde e os ACKs seguintes repetem o mesmo número.",
      "No terceiro ACK duplicado, a retransmissão do #8 sai sem esperar o RTO.",
      "Na aba Janela (cwnd): a queda à metade, não a 1."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Dados #8",
        "perdido na rede",
        "cliente"
      ],
      [
        "ACK duplicado",
        "pede de novo o #8",
        "servidor"
      ],
      [
        "Retransmissão",
        "reenvia o #8",
        "cliente"
      ]
    ],
    "why": "Recupera perdas isoladas em cerca de 1 RTT e preserva boa parte da vazão. É o caso mais comum de perda em redes congestionadas."
  },
  "rto": {
    "short": "Sem ACKs duplicados, só o temporizador percebe a perda.",
    "concept": "O <b>RTO</b> (Retransmission Timeout) é quanto o emissor espera por um ACK antes de concluir que o segmento se perdeu. Ele é calculado a partir do RTT medido (RFC 6298) e dobra a cada timeout seguido. Depois de um timeout, o TCP trata a rede como muito congestionada: a cwnd volta a 1 e o slow start recomeça.",
    "observe": [
      "O #6 é o último segmento: não há segmentos depois dele para gerar ACKs duplicados.",
      "No diagrama: a espera longa até o temporizador estourar.",
      "Na aba Janela (cwnd): a queda para 1. Compare o tempo total com o cenário Fast retransmit."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Dados #6",
        "perdido na rede",
        "cliente"
      ],
      [
        "Retransmissão",
        "sai depois do RTO",
        "cliente"
      ],
      [
        "ACK",
        "confirma tudo",
        "servidor"
      ]
    ],
    "why": "Timeouts custam caro: a conexão fica parada e a janela recomeça do zero. Por isso perdas no fim de transferências curtas pesam tanto no carregamento de páginas web."
  },
  "rwnd": {
    "short": "O receptor limita quanto o emissor pode ter em voo.",
    "concept": "O <b>controle de fluxo</b> protege o receptor: em cada ACK, ele anuncia no campo Janela quanto espaço livre tem no buffer (<b>rwnd</b>). O emissor nunca mantém em voo mais que o mínimo entre a cwnd (limite da rede) e a rwnd (limite do receptor).",
    "observe": [
      "A cwnd começa em 10, mas nunca há mais de 4 segmentos em voo.",
      "Na aba Mensagem: o campo Janela dos ACKs (4 segmentos = 4000 bytes).",
      "Na aba Janela (cwnd): a cwnd cresce, mas o envio fica preso à rwnd."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "ACK",
        "anuncia rwnd = 4 segmentos",
        "servidor"
      ],
      [
        "Dados",
        "no máximo 4 em voo",
        "cliente"
      ]
    ],
    "why": "Controle de fluxo (receptor) e controle de congestionamento (rede) são mecanismos diferentes. Uma janela anunciada pequena limita a vazão mesmo em uma rede rápida."
  },
  "rand": {
    "short": "Perdas sorteadas: o TCP combina todos os mecanismos de recuperação.",
    "concept": "Com <b>8% de perda aleatória</b>, aparecem ao mesmo tempo perdas isoladas (fast retransmit), várias perdas na mesma janela (ACKs parciais do NewReno, RFC 6582) e, às vezes, timeouts. A <b>semente</b> define o sorteio: a mesma semente repete exatamente as mesmas perdas.",
    "observe": [
      "No diagrama: quais segmentos se perderam e como cada um foi recuperado.",
      "Na aba Janela (cwnd): o formato em dente de serra, típico do TCP sob perda.",
      "Troque a semente e compare o tempo total com a mesma taxa de perda."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Dados",
        "8% se perdem",
        "cliente"
      ],
      [
        "ACK duplicado ou parcial",
        "indica o que falta",
        "servidor"
      ],
      [
        "Retransmissão",
        "por fast retransmit ou depois do RTO",
        "cliente"
      ]
    ],
    "why": "Mostra por que a vazão do TCP cai rápido com a perda: cada perda corta a janela. Em redes sem fio, perdas que não vêm de congestionamento também reduzem a janela."
  },
  "ustream": {
    "short": "Datagramas sem conexão: perdas e desordem chegam à aplicação.",
    "concept": "O <b>UDP</b> não tem conexão, confirmação nem retransmissão: cada datagrama é independente. O que se perde não volta, e o que atrasa chega fora de ordem. Para mídia em tempo real (RTP sobre UDP), isso é melhor do que esperar: um áudio atrasado já não serve.",
    "observe": [
      "No diagrama: nenhum handshake e nenhum ACK; o envio segue no ritmo do enlace.",
      "Os datagramas perdidos não são reenviados.",
      "Na aba Resultados: quantos chegaram e quantos chegaram fora de ordem."
    ],
    "cols": [
      "Datagrama",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "UDP",
        "mídia para a porta 5004 (RTP)",
        "cliente"
      ]
    ],
    "why": "Como não confirma nada, o UDP também não verifica a origem: é a base da falsificação, da reflexão e da amplificação (veja o simulador de Ataques e defesas TCP/UDP)."
  },
  "udns": {
    "short": "A aplicação, não o UDP, percebe a perda e repete a consulta.",
    "concept": "O <b>DNS</b> usa UDP na porta 53, com uma consulta e uma resposta. Se a resposta não chega no tempo limite, o UDP não faz nada: é o <b>resolvedor</b> (a aplicação) que repete a consulta.",
    "observe": [
      "No diagrama: a primeira consulta se perde e nada volta.",
      "Depois de 1 s, a aplicação envia a mesma consulta de novo.",
      "O tempo total inclui essa espera."
    ],
    "cols": [
      "Datagrama",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Consulta DNS",
        "UDP para a porta 53",
        "cliente"
      ],
      [
        "Resposta DNS",
        "UDP a partir da porta 53",
        "servidor"
      ]
    ],
    "why": "Quem usa UDP assume a confiabilidade de que precisa. O DNS sobre UDP também é alvo de amplificação e de respostas forjadas; o identificador da consulta e a porta de origem aleatória dificultam o envenenamento de cache."
  },
  "closs": {
    "short": "Mesmas perdas, lado a lado: a rapidez do UDP contra a garantia do TCP.",
    "concept": "No modo <b>Comparação</b>, TCP e UDP enviam o mesmo volume pela mesma rede, com <b>as mesmas perdas</b> (mesma semente). O UDP termina antes e entrega o que chegou; o TCP demora mais, mas entrega tudo, em ordem.",
    "observe": [
      "Na aba Resultados: tempo total e quantidade entregue por cada protocolo.",
      "No diagrama: as retransmissões do TCP e as lacunas do UDP.",
      "Na aba Experimento: a comparação explicada a partir da execução."
    ],
    "cols": [
      "Unidade",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Segmento TCP",
        "com ACK e retransmissão",
        "cliente"
      ],
      [
        "Datagrama UDP",
        "sem confirmação",
        "cliente"
      ]
    ],
    "why": "Não existe protocolo melhor em geral: transferência de arquivos precisa do TCP; voz e vídeo em tempo real preferem o UDP."
  },
  "cord": {
    "short": "Pacotes atrasados: o TCP reordena, o UDP entrega fora de ordem.",
    "concept": "A <b>reordenação</b> acontece quando pacotes seguem caminhos diferentes ou esperam mais em alguma fila. O TCP guarda no buffer o que chega adiantado e entrega à aplicação na ordem certa; o UDP entrega na ordem em que os datagramas chegaram.",
    "observe": [
      "Na aba Resultados: quantos datagramas UDP chegaram fora de ordem.",
      "No TCP: ACKs duplicados causados só pela desordem, sem nenhuma perda.",
      "Se surgirem três ACKs duplicados, o TCP retransmite sem necessidade (retransmissão espúria)."
    ],
    "cols": [
      "Evento",
      "Função",
      "Origem"
    ],
    "msgs": [
      [
        "Segmento atrasado",
        "chega depois dos seguintes",
        "rede"
      ],
      [
        "ACK duplicado",
        "causado pela desordem",
        "servidor"
      ]
    ],
    "why": "Mostra que ACK duplicado nem sempre significa perda. Pilhas modernas detectam retransmissões espúrias e desfazem a redução da janela."
  },
  "nosack": {
    "short": "Com várias perdas na mesma janela, o ACK cumulativo revela uma lacuna por RTT.",
    "concept": "O ACK do TCP é <b>cumulativo</b>: informa só até onde os dados chegaram em ordem. Quando várias perdas ocorrem na mesma janela, o emissor só descobre uma lacuna de cada vez. O <b>NewReno</b> (RFC 6582) usa o <b>ACK parcial</b>, que avança até o próximo buraco, para retransmitir um segmento por RTT, ainda dentro do fast recovery.",
    "observe": [
      "No diagrama: a retransmissão do #5 e, um RTT depois, a do #7, e depois a do #9.",
      "Os ACKs duplicados repetem sempre o mesmo número (5001), sem dizer o que já chegou.",
      "Na aba Resultados: o tempo total, para comparar com o cenário com SACK."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Dados #5, #7, #9",
        "perdidos na rede",
        "cliente"
      ],
      [
        "ACK duplicado",
        "repete o ACK do primeiro buraco",
        "servidor"
      ],
      [
        "ACK parcial",
        "confirma até o buraco seguinte",
        "servidor"
      ],
      [
        "Retransmissões",
        "uma por RTT",
        "cliente"
      ]
    ],
    "why": "Com perdas em rajada (comuns em filas cheias e em redes sem fio), a recuperação sem SACK é lenta: a conexão passa vários RTTs presa na recuperação, com a janela reduzida."
  },
  "sack": {
    "short": "SACK informa o que já chegou e permite repor todos os buracos de uma vez.",
    "concept": "O <b>SACK</b> (RFC 2018) é uma opção TCP negociada no handshake (<b>SACK_PERM</b>). Nos ACKs duplicados, o receptor acrescenta até 3 <b>blocos</b> com os intervalos de bytes que já chegaram além da lacuna (<b>SLE</b>, borda esquerda, e <b>SRE</b>, borda direita). O emissor monta um placar do que o receptor tem e repõe só os buracos, todos de uma vez, sem retransmitir o que já chegou.",
    "observe": [
      "No handshake: a opção SACK_PERM no SYN e no SYN-ACK (aba Mensagem).",
      "Nos ACKs duplicados: os blocos SLE e SRE, com os segmentos recebidos além dos buracos (aba Mensagem).",
      "No diagrama: #5, #7 e #9 retransmitidos juntos, em cerca de 1 RTT; compare o tempo com o cenário sem SACK."
    ],
    "cols": [
      "Segmento",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "SYN e SYN-ACK com SACK_PERM",
        "negociam o uso do SACK",
        "os dois lados"
      ],
      [
        "ACK duplicado com SACK",
        "informa os blocos recebidos além da lacuna",
        "servidor"
      ],
      [
        "Retransmissões",
        "só os buracos, em paralelo",
        "cliente"
      ]
    ],
    "why": "O SACK é padrão em todos os sistemas atuais. Ele faz o TCP recuperar várias perdas por janela em cerca de 1 RTT e é a base de técnicas como o RACK e a sonda de cauda (TLP)."
  },
  "dlok": {
    "short": "Slow start, fila do roteador estourando e o dente de serra da cwnd.",
    "concept": "Num <b>download</b>, o servidor envia o arquivo e o cliente só confirma. O TCP começa com a janela pequena e a <b>dobra a cada RTT</b> (slow start) até a rede perder um segmento. Como não enxerga a fila do roteador, só percebe que passou do limite quando a fila enche e o excesso é descartado. Então reduz a janela à metade e passa a crescer devagar, até estourar de novo: o <b>dente de serra</b> da cwnd. O limite é o <b>produto banda × RTT</b> (o que cabe no enlace) mais a fila do roteador.",
    "observe": [
      "No diagrama: cada seta é uma rodada (uma janela inteira por RTT). Veja as rajadas dobrando: 10, 20, 40, 80.",
      "Na aba Janela (cwnd): a primeira queda, quando a fila enche, e depois o dente de serra.",
      "Na aba Resultados: a vazão útil perto da capacidade do enlace e o tempo ideal para comparar."
    ],
    "cols": [
      "Seta",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "SYN, SYN-ACK, ACK + GET",
        "abertura e pedido do arquivo (2 RTT até o primeiro byte)",
        "os dois lados"
      ],
      [
        "Rajada de dados",
        "uma janela de segmentos por rodada",
        "servidor"
      ],
      [
        "ACK ou ACKs duplicados (SACK)",
        "confirmam e informam lacunas",
        "cliente"
      ],
      [
        "FIN e ACK",
        "encerramento da conexão",
        "os dois lados"
      ]
    ],
    "why": "É o comportamento de qualquer download ou envio de arquivo: a vazão do TCP se ajusta sozinha à capacidade do caminho, mas só descobre o limite perdendo pacotes. Por isso o tamanho da fila do roteador (bufferbloat) e o RTT pesam tanto na experiência."
  },
  "dlloss": {
    "short": "Com perda aleatória, a vazão fica muito abaixo da capacidade do enlace.",
    "concept": "O TCP trata cada perda como sinal de congestionamento e corta a janela à metade. Com perda aleatória (por exemplo, em um enlace sem fio), a janela nunca chega a encher o enlace. A vazão média fica perto de <b>MSS / (RTT × √perda)</b> (aproximação de Mathis), qualquer que seja a banda disponível.",
    "observe": [
      "Na aba Janela (cwnd): a janela fica baixa e irregular, com muitos cortes.",
      "Na aba Resultados: a vazão útil muito abaixo dos 20 Mbps do enlace.",
      "Aumente a banda para 50 Mbps e veja que quase nada muda: a perda é o fator limitante."
    ],
    "cols": [
      "Seta",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Rajada de dados",
        "uma janela por rodada, com perdas",
        "servidor"
      ],
      [
        "ACKs duplicados (SACK)",
        "indicam quais segmentos faltam",
        "cliente"
      ],
      [
        "Retransmissões",
        "repõem os segmentos perdidos",
        "servidor"
      ]
    ],
    "why": "Explica por que enlaces com perda que não vem de congestionamento (Wi-Fi fraco, rádio, satélite) rendem pouco com o TCP clássico, e por que algoritmos como CUBIC e BBR reagem de formas diferentes à perda."
  },
  "dlrwnd": {
    "short": "A janela do receptor limita a vazão, mesmo com o enlace livre.",
    "concept": "O emissor nunca mantém em voo mais que o mínimo entre a cwnd e a <b>rwnd</b>. Com rwnd = 16 segmentos (16 kB) e RTT de 100 ms, no máximo 16 kB chegam por RTT: <b>rwnd / RTT</b>, cerca de 1,3 Mbps, num enlace de 20 Mbps. O limite não vem da rede, e sim do buffer do receptor.",
    "observe": [
      "No diagrama: toda rodada tem 16 segmentos e a janela não cresce mais.",
      "Na aba Resultados: a vazão útil perto de 1,3 Mbps, com o enlace quase ocioso.",
      "Troque a rwnd para 256 e compare o tempo total."
    ],
    "cols": [
      "Seta",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "ACK",
        "anuncia a janela do receptor (rwnd)",
        "cliente"
      ],
      [
        "Rajada de dados",
        "no máximo rwnd segmentos por rodada",
        "servidor"
      ]
    ],
    "why": "Por isso existe a escala de janela (window scale, RFC 7323): sem ela, a janela máxima de 64 kB limita a vazão em caminhos de RTT alto."
  },
  "dlsat": {
    "short": "Em RTT alto, o handshake e o slow start dominam o tempo de um arquivo pequeno.",
    "concept": "Com RTT de 200 ms, cada passo do TCP custa caro: o primeiro byte só chega depois de 2 RTT (400 ms) e o slow start ainda leva vários RTTs para encher o enlace. Para um arquivo de 1 MB, a maior parte do tempo é espera, e não transmissão.",
    "observe": [
      "No diagrama: o handshake e o pedido ocupam boa parte da linha do tempo.",
      "Na aba Resultados: compare o tempo ideal (enlace cheio desde o início) com o tempo real.",
      "Reduza o RTT para 20 ms e compare a eficiência."
    ],
    "cols": [
      "Seta",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "SYN, SYN-ACK, ACK + GET",
        "2 RTT até o primeiro byte",
        "os dois lados"
      ],
      [
        "Rajadas de dados",
        "crescem a cada RTT",
        "servidor"
      ]
    ],
    "why": "É a razão de HTTP/2, conexões persistentes, TLS 1.3, TCP Fast Open e QUIC: evitar pagar novos RTTs de handshake e partir de uma janela maior."
  },
  "vidok": {
    "short": "25 quadros por segundo sobre UDP, sem handshake, com buffer no player.",
    "concept": "O <b>streaming de vídeo ao vivo</b> envia os quadros em pacotes <b>RTP</b> sobre UDP. Há um quadro <b>I</b> por segundo (completo e grande) e quadros <b>P</b> (só a diferença para o anterior). O servidor espaça os pacotes ao longo de cada quadro, e o <b>player</b> mantém um pequeno buffer (aqui, 100 ms) para absorver as variações de atraso (jitter).",
    "observe": [
      "No diagrama: uma seta por quadro. Os quadros I (rotulados) são maiores e demoram mais para chegar.",
      "Na aba Vazão e qualidade: o pico de envio a cada segundo (quadro I) e a faixa de quadros toda verde.",
      "Na aba Resultados: jitter, atraso até a exibição e nenhum quadro com defeito."
    ],
    "cols": [
      "Unidade",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Quadro I",
        "imagem completa, a cada 25 quadros (1 s)",
        "servidor"
      ],
      [
        "Quadro P",
        "diferença em relação ao quadro anterior",
        "servidor"
      ],
      [
        "Pacote RTP (UDP)",
        "até 1200 bytes, com sequência e marca de tempo",
        "servidor"
      ]
    ],
    "why": "Em vídeo ao vivo, é melhor perder um pacote do que esperar a retransmissão: o quadro atrasado já não pode ser exibido. Por isso voz, vídeo e videoconferência preferem o UDP."
  },
  "vidloss": {
    "short": "Cada pacote perdido deixa um quadro incompleto, e o erro se propaga.",
    "concept": "Com 3% de perda aleatória, alguns pacotes não chegam e <b>ninguém os repõe</b>. Se faltar pacote de um quadro P, o player o exibe com artefatos e os quadros seguintes herdam o erro até o próximo I. Se faltar pacote de um quadro I, a imagem congela até o próximo I (até 1 s). Os quadros I pesam mais porque têm mais pacotes (maior chance de perder algum) e porque os outros dependem deles.",
    "observe": [
      "No diagrama: setas vermelhas nos quadros com problema.",
      "Na aba Vazão e qualidade: trechos âmbar (artefatos) e vermelhos (congelados) na faixa inferior.",
      "Na aba Resultados: quantos quadros ficaram sem defeito apesar de poucos pacotes perdidos."
    ],
    "cols": [
      "Unidade",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Quadro I",
        "perdas aqui congelam a imagem até o próximo I",
        "servidor"
      ],
      [
        "Quadro P",
        "perdas aqui geram artefatos que se propagam",
        "servidor"
      ]
    ],
    "why": "Mostra por que redes de vídeo usam FEC (redundância), retransmissão seletiva e quadros I mais frequentes, e por que 3% de perda já degrada muito a experiência."
  },
  "vidcong": {
    "short": "O UDP não reduz a taxa: o excesso de vídeo é descartado na fila.",
    "concept": "O vídeo precisa de 4000 kbit/s, mas o enlace entrega 2000. O UDP não tem <b>controle de congestionamento</b> e continua enviando na mesma taxa. A fila do roteador enche, passa de 100 ms e os pacotes excedentes são descartados em todos os quadros, inclusive nos I. A imagem fica quase sempre congelada ou com artefatos.",
    "observe": [
      "Na aba Resultados: os pacotes descartados na fila e a taxa entregue, limitada a cerca de 2000 kbit/s.",
      "Na aba Vazão e qualidade: a taxa enviada acima da linha tracejada (capacidade do enlace).",
      "Compare com o download: o TCP reduziria a janela e dividiria o enlace; o UDP não."
    ],
    "cols": [
      "Unidade",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Quadros I e P",
        "enviados na taxa do vídeo, sem adaptação",
        "servidor"
      ],
      [
        "Pacotes excedentes",
        "descartados na fila do roteador",
        "rede"
      ]
    ],
    "why": "Aplicações de mídia sobre UDP precisam implementar a própria adaptação (taxa adaptativa, RTCP, controle de congestionamento do WebRTC). Sem isso, um fluxo UDP pode sufocar os fluxos TCP que dividem o enlace."
  },
  "vidjit": {
    "short": "Se o atraso varia mais do que o buffer cobre, pacotes chegam tarde demais.",
    "concept": "<b>Jitter</b> é a variação do atraso entre pacotes. O player compensa com um <b>buffer de reprodução</b>: cada quadro só é exibido depois de um intervalo fixo, esperando os pacotes atrasados. Um pacote que chega depois do seu prazo é descartado. Aqui o jitter da rede chega a 80 ms e o buffer é de apenas 20 ms, então muitos pacotes chegam tarde.",
    "observe": [
      "Na aba Resultados: os pacotes fora do prazo e o jitter medido (RFC 3550).",
      "Aumente o buffer para 200 ms e veja os atrasos deixarem de causar defeitos.",
      "Compare o atraso até a exibição nos dois casos: o buffer maior custa tempo."
    ],
    "cols": [
      "Unidade",
      "Função",
      "Quem envia"
    ],
    "msgs": [
      [
        "Pacote RTP",
        "chega com atraso variável",
        "servidor"
      ],
      [
        "Buffer do player",
        "segura os quadros até o prazo de exibição",
        "cliente"
      ]
    ],
    "why": "Em vídeo ao vivo e em chamadas, o tamanho do buffer é um compromisso entre fluidez e latência. Chamadas de voz toleram poucos milissegundos; transmissões gravadas toleram segundos."
  }
};
