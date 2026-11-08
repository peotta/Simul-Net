// Fundamentação do simulador TCP, em Markdown: aparece na documentação (docs/simuladores/tcp.md e na wiki), antes de
// "Como ler os diagramas". Explica a conexão, a máquina de estados, a janela e a recuperação de perdas.
export const fundamentacao: string = `
### O problema que o TCP resolve

O IP entrega datagramas sem garantia: eles podem se perder, chegar fora de ordem ou duplicados. O TCP (*Transmission Control Protocol*, RFC 9293) está na camada 4 e constrói, sobre esse serviço, um **fluxo de bytes confiável, ordenado e sem duplicatas** entre dois processos. Para isso, ele usa quatro mecanismos:

- **Conexão:** os dois lados combinam os números de sequência iniciais antes de trocar dados.
- **Confirmação e retransmissão:** o receptor confirma o que recebeu, e o emissor reenvia o que não foi confirmado.
- **Controle de fluxo:** o receptor diz quanto espaço tem (janela anunciada, *rwnd*).
- **Controle de congestionamento:** o emissor limita o próprio ritmo conforme a rede aguenta (janela de congestionamento, *cwnd*).

### O diagrama da conexão

\`\`\`mermaid
sequenceDiagram
  participant C as Cliente
  participant S as Servidor
  C->>S: SYN, seq = x
  S->>C: SYN e ACK, seq = y, ack = x + 1
  C->>S: ACK, ack = y + 1
  Note over C,S: conexão estabelecida
  C->>S: dados, seq = x + 1
  S->>C: ACK, ack = x + 1 + tamanho
  Note over C,S: encerramento
  C->>S: FIN
  S->>C: ACK
  S->>C: FIN
  C->>S: ACK
\`\`\`

*Esquema 1 (conexão do TCP).* A abertura em três vias (RFC 9293, seção 3.5) sincroniza os números de sequência: cada lado escolhe o seu e o outro o confirma somando 1. O encerramento (seção 3.6) fecha cada sentido separadamente: cada lado envia o seu FIN e recebe o ACK dele.

O número de sequência identifica o **byte**, e não o segmento. O ACK é **cumulativo**: ele diz "recebi tudo até o byte anterior a este número, e espero este" (seção 3.4).

### Os estados da conexão

\`\`\`mermaid
stateDiagram-v2
  [*] --> CLOSED
  CLOSED --> LISTEN: abertura passiva
  CLOSED --> SYN_SENT: abertura ativa, envia SYN
  LISTEN --> SYN_RECEIVED: recebe SYN, envia SYN e ACK
  SYN_SENT --> ESTABLISHED: recebe SYN e ACK, envia ACK
  SYN_RECEIVED --> ESTABLISHED: recebe ACK
  ESTABLISHED --> FIN_WAIT_1: fecha, envia FIN
  ESTABLISHED --> CLOSE_WAIT: recebe FIN
  FIN_WAIT_1 --> FIN_WAIT_2: recebe ACK do FIN
  FIN_WAIT_2 --> TIME_WAIT: recebe FIN, envia ACK
  CLOSE_WAIT --> LAST_ACK: fecha, envia FIN
  LAST_ACK --> CLOSED: recebe ACK do FIN
  TIME_WAIT --> CLOSED: espera 2 MSL
\`\`\`

*Esquema 2 (estados principais).* É o caminho comum da máquina de estados da RFC 9293, seção 3.3.2 (Figura 5). Os casos de fechamento simultâneo (CLOSING) e de reinício (RST) foram omitidos para manter o desenho legível.

O estado **TIME-WAIT** mantém a conexão por um tempo (2 vezes o MSL, *Maximum Segment Lifetime*) para que segmentos atrasados da conexão antiga não sejam confundidos com os de uma nova.

### O cabeçalho TCP

| Campo | Tamanho | Função |
| --- | --- | --- |
| Porta de origem e de destino | 16 bits cada | identificam os processos |
| Número de sequência | 32 bits | posição, no fluxo, do primeiro byte do segmento |
| Número de confirmação | 32 bits | próximo byte esperado, quando o bit ACK está ligado |
| Deslocamento de dados | 4 bits | tamanho do cabeçalho em palavras de 32 bits |
| Flags | 8 bits | CWR, ECE, URG, ACK, PSH, RST, SYN e FIN |
| Janela | 16 bits | espaço livre no receptor (rwnd) |
| Checksum | 16 bits | cobre cabeçalho, dados e um pseudocabeçalho com os endereços IP |
| Ponteiro urgente e opções | variável | por exemplo, SACK (RFC 2018) |

O cabeçalho tem 20 bytes quando não há opções (RFC 9293, seção 3.1).

### Janelas: quanto o emissor pode enviar

\`\`\`mermaid
flowchart LR
  A["cwnd<br/>o que a rede aguenta"] --> M["Janela efetiva<br/>é o menor valor"]
  B["rwnd<br/>o que o receptor aguenta"] --> M
  M --> E["Bytes em voo<br/>sem confirmação"]
\`\`\`

*Esquema 3 (janela efetiva).* O emissor mantém em voo, no máximo, o **menor** entre a janela de congestionamento (cwnd) e a janela anunciada pelo receptor (rwnd).

- A **rwnd** protege o receptor (controle de fluxo, RFC 9293, seção 3.8.6).
- A **cwnd** protege a rede (controle de congestionamento, RFC 5681).

### O controle de congestionamento

\`\`\`mermaid
flowchart TD
  SS["Slow start<br/>cwnd dobra a cada RTT"] -- "cwnd chega a ssthresh" --> CA["Congestion avoidance<br/>cwnd cresce cerca de 1 segmento por RTT"]
  SS -- "perda por timeout" --> T["ssthresh vira metade da carga em voo<br/>cwnd volta a 1 segmento"]
  CA -- "perda por timeout" --> T
  CA -- "3 ACKs duplicados" --> FR["Fast retransmit e fast recovery<br/>ssthresh vira metade da carga em voo"]
  T --> SS
  FR --> CA
\`\`\`

*Esquema 4 (fases do controle de congestionamento).* Segue a RFC 5681: o *slow start* cresce depressa até o limiar (*ssthresh*), e depois a *congestion avoidance* cresce devagar. Uma perda é lida como sinal de congestionamento, e a janela é reduzida.

Dois sinais de perda têm custos muito diferentes:

| Sinal | Como o emissor percebe | Reação |
| --- | --- | --- |
| Três ACKs duplicados | segmentos seguintes chegam, mas o ACK não avança | retransmite logo (*fast retransmit*) e reduz a cwnd pela metade |
| Timeout (RTO) | nenhum ACK volta antes do prazo | cwnd volta a 1 segmento e recomeça no slow start |

O prazo de retransmissão (RTO) é calculado a partir do RTT medido (RFC 6298, que a RFC 9293 adota na seção 3.8.1). Com **SACK** (RFC 2018), o receptor informa também os blocos recebidos fora de ordem, e o emissor reenvia só o que falta.

### Como ler o diagrama do simulador

- **Diagrama de sequência:** cada seta é um segmento. A seta com X é um segmento perdido. No modo de download, cada seta representa uma **rodada** (uma janela inteira), para o desenho caber na tela.
- **Estado da conexão (painel lateral):** mostra o estado TCP de cada ponta, e a cwnd, o ssthresh e o RTO no instante atual.
- **Modos:** *TCP: conexão* mostra abertura, crescimento da janela, perdas e encerramento. *TCP: download* mostra um arquivo grande, com a fila do roteador e a vazão. *Comparação TCP x UDP* envia a mesma carga pelos dois protocolos na mesma rede.
- **O relógio:** o tempo avança com o botão Passo ou com a reprodução, e os painéis acompanham o instante atual.

### Limites do modelo e do diagrama

- O simulador mostra o **caminho típico** da máquina de estados e do controle de congestionamento. Ele não simula CUBIC, BBR, *Nagle*, ACK atrasado nem reinício por RST.
- Os tempos, os tamanhos e a fila do roteador são **didáticos**: servem para comparar comportamentos, e não para prever o desempenho de uma rede real.
- O controle de congestionamento segue a RFC 5681 (estilo Reno), com SACK opcional. Implementações reais variam, e o simulador não reproduz um sistema operacional específico.
`;
