// Fundamentação do simulador de controle de congestionamento, em Markdown: aparece na documentação
// (docs/simuladores/congestionamento.md e na wiki), antes de "Como ler os diagramas".
import { graficoVazao } from './charts';

const CURVA_LONGO = graficoVazao('Caminho longo e largo: 50 Mbit/s, RTT de 200 ms, fila rasa', { bw: 50, rtt: 200, buf: 0.25, dur: 40 });
const CURVA_DOBRA = graficoVazao('A capacidade dobra aos 15 s: 20 para 40 Mbit/s, RTT de 50 ms', { dur: 30, shift: 'up' });
const CURVA_PERDA = graficoVazao('Perda aleatória de 1%: 20 Mbit/s, RTT de 50 ms', { loss: 1 });

export const fundamentacao: string = `
### O problema que o controle de congestionamento resolve

O emissor TCP não sabe qual é a capacidade do caminho nem quantos outros fluxos o dividem. Se enviar de menos, desperdiça banda. Se enviar de mais, enche a **fila do roteador do gargalo**, aumenta o atraso e, quando a fila estoura, perde segmentos. O **controle de congestionamento** é o conjunto de regras com que o emissor ajusta, a cada RTT, **quantos dados mantém em voo** (a janela de congestionamento, *cwnd*), usando só o que observa: ACKs, perdas e atrasos. Ele é independente do controle de fluxo (a janela do receptor, *rwnd*): o emissor respeita o **menor** dos dois limites.

**O que você aprende com este simulador.**

- Explicar o **BDP** (produto banda x atraso) e por que a janela ideal é o BDP.
- Descrever o ciclo do **Reno e do NewReno**: slow start, congestion avoidance, fast retransmit e fast recovery (RFC 5681 e RFC 6582).
- Calcular a janela do **CUBIC** com a função cúbica e as regiões côncava, convexa e Reno-friendly (RFC 9438).
- Descrever o **BBR** como um controle por modelo (banda e RTT mínimo) e as suas fases, sabendo que ainda é um Internet-Draft.
- Relacionar o tamanho da fila (**bufferbloat**), a perda aleatória e a mudança de capacidade ao comportamento de cada algoritmo.

### O caminho modelado

\`\`\`mermaid
flowchart LR
  E["Emissor<br/>(cwnd)"] -->|"segmentos"| G["Gargalo<br/>enlace de C Mbit/s<br/>fila de B segmentos"]
  G -->|"segmentos"| R["Receptor"]
  R -->|"ACKs"| E
\`\`\`

*Esquema 1 (o caminho).* O emissor envia uma janela de segmentos por RTT. O **gargalo** serve C Mbit/s; o que passa disso espera na **fila**, e o que passa da fila é **descartado** (descarte no fim da fila, *tail drop*). O RTT medido é o RTT de base mais o atraso de fila.

| Grandeza | Definição | Exemplo (20 Mbit/s e 50 ms) |
| --- | --- | --- |
| Segmento | unidade do simulador: 1500 bytes (MSS de 1460 mais 40 de cabeçalhos) | 1500 bytes |
| BDP | capacidade x RTT de base: quanto cabe em voo sem formar fila | cerca de 83 segmentos |
| Fila | segmentos que o gargalo guarda antes de descartar (em múltiplos do BDP) | 1 BDP: cerca de 83 segmentos |
| Janela ideal | o BDP: enlace cheio e fila vazia | cerca de 83 segmentos |
| Janela máxima sem perda | BDP mais fila | cerca de 166 segmentos |

Se a janela é menor que o BDP, o enlace fica ocioso. Entre o BDP e BDP mais fila, a vazão é a máxima, mas o excesso vira fila (atraso). Acima disso, há perda.

### Reno e NewReno: soma aditiva e redução multiplicativa

\`\`\`mermaid
stateDiagram-v2
  [*] --> SlowStart
  SlowStart --> CongestionAvoidance: cwnd chega ao ssthresh
  SlowStart --> FastRecovery: 3 ACKs duplicados
  CongestionAvoidance --> FastRecovery: 3 ACKs duplicados
  FastRecovery --> CongestionAvoidance: ACK novo (recuperou)
  SlowStart --> SlowStart: timeout (cwnd = 1)
  CongestionAvoidance --> SlowStart: timeout (cwnd = 1)
  FastRecovery --> SlowStart: timeout (cwnd = 1)
\`\`\`

*Esquema 2 (estados do Reno).* No **slow start**, a cwnd dobra a cada RTT (+1 segmento por ACK). Na **congestion avoidance**, cresce 1 segmento por RTT. Três ACKs duplicados disparam o **fast retransmit**: o emissor repõe o segmento e divide ssthresh e cwnd por 2 (**fast recovery**). Sem ACKs suficientes, o **timeout** (RTO) leva a cwnd a 1 segmento e repete o slow start. É o ciclo **AIMD** (*additive increase, multiplicative decrease*).

- **ssthresh:** limite entre slow start e congestion avoidance; vira metade dos dados em voo na perda (RFC 5681, seção 3.1).
- **NewReno (RFC 6582):** continua a recuperação com ACKs parciais, repondo um segmento por RTT quando não há SACK.
- **SACK (RFC 2018):** o receptor informa os blocos recebidos; o emissor repõe só o que falta, em um RTT.
- **Janela inicial (RFC 6928):** até 10 segmentos.

### CUBIC: crescimento em função do tempo

O CUBIC (RFC 9438), padrão do Linux, não conta RTTs: a janela depende do **tempo t desde a última redução**.

| Fórmula | Significado |
| --- | --- |
| W(t) = C (t - K)^3 + Wmax | janela alvo; C = 0,4 |
| K = raiz cúbica de ((Wmax - cwnd_epoch) / C) | tempo para voltar ao Wmax depois da redução |
| na perda: ssthresh = cwnd = 0,7 x dados em voo | β = 0,7 (redução de 30%) |
| W_est cresce α por RTT, com α = 3 (1 - β) / (1 + β) | estimativa do que um Reno faria (cerca de 0,53 segmento por RTT) |
| alvo = W(t + RTT), limitado a 1,5 x cwnd | por RTT, a cwnd vai até o alvo |

\`\`\`mermaid
flowchart LR
  P["Perda: Wmax = cwnd<br/>cwnd = 0,7 x cwnd"] --> A["Região côncava<br/>cwnd < Wmax: sobe rápido e desacelera"]
  A --> M["Patamar perto de Wmax<br/>(t perto de K)"]
  M --> V["Região convexa<br/>cwnd > Wmax: sonda, acelerando"]
  V --> P
  A -.->|"W(t) < W_est"| F["Região Reno-friendly<br/>cresce como o Reno"]
\`\`\`

*Esquema 3 (regiões do CUBIC).* Depois da perda, a janela volta depressa ao Wmax (região côncava), achata (o CUBIC "desconfia" de que a capacidade está ali) e só então acelera (região convexa) para descobrir banda nova. Em caminhos curtos e de baixa capacidade, a função cúbica pode ser mais lenta que o Reno: aí vale a estimativa W_est (região **Reno-friendly**).

### BBR: controle por modelo

O BBR deixa de usar a perda como sinal principal. Ele mantém duas estimativas: **BtlBw** (banda do gargalo: o máximo da vazão entregue recente) e **RTprop** (RTT mínimo recente). Envia a ritmo de *ganho x BtlBw* e limita os dados em voo a cerca de **2 x BDP estimado**. O texto de referência é o Internet-Draft **draft-ietf-ccwg-bbr** (ainda não é RFC); o simulador usa os valores da versão -07 do draft (BBRv3).

\`\`\`mermaid
stateDiagram-v2
  [*] --> Startup
  Startup --> Drain: banda parou de crescer (3 rodadas) ou perda alta
  Drain --> ProbeBW_DOWN: fila esvaziada
  ProbeBW_DOWN --> ProbeBW_CRUISE: dados em voo no BDP
  ProbeBW_CRUISE --> ProbeBW_REFILL: após 2 a 3 s
  ProbeBW_REFILL --> ProbeBW_UP: 1 rodada
  ProbeBW_UP --> ProbeBW_DOWN: sondagem terminou
  ProbeBW_CRUISE --> ProbeRTT: 10 s sem renovar o RTT mínimo
  ProbeRTT --> ProbeBW_CRUISE: 200 ms e 1 rodada
\`\`\`

*Esquema 4 (fases do BBR).*

| Fase | Ganho de ritmo (pacing) | Ganho de janela | O que faz |
| --- | --- | --- | --- |
| Startup | 2,77 (4 ln 2) | 2 | dobra a taxa a cada rodada até a banda parar de crescer |
| Drain | 0,5 | 2 | esvazia a fila criada no Startup |
| ProbeBW_DOWN | 0,9 | 2 | reduz o ritmo para esvaziar a fila da sondagem |
| ProbeBW_CRUISE | 1,0 | 2 | mantém a banda estimada por 2 a 3 s |
| ProbeBW_REFILL | 1,0 | 2 | uma rodada para encher o tubo antes de sondar |
| ProbeBW_UP | 1,25 | 2,25 | sonda por mais banda; perda acima de 2% a interrompe |
| ProbeRTT | 1,0 | 0,5 | a cada 10 s, janela de 0,5 BDP por 200 ms, para renovar o RTT mínimo |

### Comparação dos algoritmos

| | Reno/NewReno | CUBIC | BBR |
| --- | --- | --- | --- |
| Sinal principal | perda | perda | modelo (banda e RTT mínimo) |
| Crescimento | +1 segmento por RTT | cúbico no tempo | ganho de ritmo, com sondagem periódica |
| Redução | 50% | 30% (β = 0,7) | limite de dados em voo só se perda acima de 2% |
| Fila no gargalo | enche até estourar | enche até estourar | curta, perto do BDP |
| Perda aleatória | derruba a vazão | derruba a vazão | pouco afetado até 2% |
| Padrão em | referência didática | Linux, Windows e macOS | uso em serviços e no QUIC |

### A curva do uso da banda

Os gráficos abaixo mostram quanto da banda do enlace cada algoritmo usa ao longo do tempo (vazão média por janela de tempo). Os valores vêm do **próprio motor do simulador**, o mesmo dos modos e dos cenários. Em todos, as linhas são, na ordem: **Reno** (vermelho), **CUBIC** (azul), **BBR** (verde) e a **capacidade** do enlace (preta). Quanto mais perto da linha preta, melhor a ocupação da banda.

${CURVA_LONGO}

*Esquema 5 (caminho longo e largo).* Com RTT de 200 ms, o Reno soma 1 segmento por RTT e leva **dezenas de segundos** para ocupar um enlace de 50 Mbit/s: a rampa quase reta do gráfico. O CUBIC cresce pelo tempo, e não por RTT, e chega perto da capacidade em poucos segundos. O BBR ocupa mais de 90% do enlace, abaixo da capacidade por causa das fases de ProbeBW e ProbeRTT. O mesmo cenário está nos modos Reno e CUBIC.

${CURVA_DOBRA}

*Esquema 6 (capacidade dobra).* Aos 15 s o enlace passa de 20 para 40 Mbit/s. Cada algoritmo descobre a banda nova de um jeito: o **Reno** sobe 1 segmento por RTT, o **CUBIC** acelera pela região convexa e o **BBR** só percebe a banda nova na próxima sondagem (ProbeBW_UP), quando o ritmo maior revela a capacidade. Todos chegam perto dos 40 Mbit/s em poucos segundos; o Reno e o BBR ainda oscilam depois, porque o excesso de envio estoura a fila.

${CURVA_PERDA}

*Esquema 7 (perda aleatória de 1%).* O Reno e o CUBIC leem cada perda como congestionamento e **mantêm a janela pequena**: usam uma fração mínima do enlace, na ordem de grandeza prevista por Mathis et al. (1997). O BBR, que não usa a perda como sinal principal enquanto ela fica abaixo de 2%, **continua perto da capacidade**. É a diferença entre um controle guiado por perda e um guiado por modelo.

### O que cada modo e aba do simulador mostram

- **Modos:** Reno/NewReno, CUBIC, BBR e Comparação (os três, cada um em uma cópia do mesmo caminho).
- **Aba Cenário:** parâmetros do caminho e do teste. **Captura:** uma amostra das rodadas (segmentos e ACKs). **Mensagem:** os valores da rodada (janela, fila, RTT, vazão, estado do algoritmo).
- **Aba Janela e fila:** a cwnd (ou o limite de dados em voo do BBR) contra o BDP e o limite da fila. **Vazão e atraso:** a vazão e o RTT de cada algoritmo. **Resultados:** vazão média, utilização, RTT, perdas e tempo até 90% da capacidade, para os três algoritmos com os mesmos parâmetros.

### Cenários recomendados

1. **Reno, dente de serra**, e depois **fila rasa** e **fila funda**: a relação entre tamanho de buffer, utilização e atraso.
2. **Reno, perda aleatória de 1%**, e depois **BBR, perda aleatória de 1%**: o sinal "perda" falha.
3. **CUBIC, caminho longo e largo**, contra o **Reno** no mesmo caminho.
4. **BBR, fases**: Startup, Drain, ProbeBW e ProbeRTT.
5. **Comparação, capacidade dobra**: três maneiras de descobrir banda nova.

### Limites do modelo e do diagrama

- O modelo é **por rodadas**: uma por RTT, com dados em voo e fila calculados em conjunto (fluido). Não há ACK individual, relógio de ACKs, estouro de fila dentro da rodada nem variação do RTT.
- Há **um fluxo por vez** no gargalo. A competição e a justiça entre fluxos (por exemplo, BBR contra CUBIC) **não** são modeladas.
- O diagrama mostra uma **amostra** das rodadas: as primeiras, as que têm evento e algumas intermediárias. Os gráficos usam todas.
- O simulador não representa HyStart++ (RFC 9406), RACK-TLP (RFC 8985), ECN (RFC 3168) nem AQM; a estimativa de RTO é simplificada. O BBR omite o limite de curto prazo (*inflight_shortterm*) e o tratamento de tráfego limitado pela aplicação.
`;
