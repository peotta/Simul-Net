// Fundamentação do simulador TCP, em Markdown: aparece na documentação (docs/simuladores/tcp.md e na wiki), antes de
// "Como ler os diagramas". Explica a conexão, a máquina de estados, a janela e a recuperação de perdas.
export const fundamentacao: string = `
### O problema que o TCP resolve

O IP entrega datagramas sem garantia: eles podem se perder, chegar fora de ordem ou duplicados. O TCP (*Transmission Control Protocol*, RFC 9293) está na camada 4 e constrói, sobre esse serviço, um **fluxo de bytes confiável, ordenado e sem duplicatas** entre dois processos. Para isso, ele usa quatro mecanismos:

- **Conexão:** os dois lados combinam os números de sequência iniciais antes de trocar dados.
- **Confirmação e retransmissão:** o receptor confirma o que recebeu, e o emissor reenvia o que não foi confirmado.
- **Controle de fluxo:** o receptor diz quanto espaço tem (janela anunciada, *rwnd*).
- **Controle de congestionamento:** o emissor limita o próprio ritmo conforme a rede aguenta (janela de congestionamento, *cwnd*).

**O que você aprende com este simulador.**

- Explicar como o TCP abre e encerra uma conexão e o que são os números de sequência e de confirmação.
- Ler o cabeçalho TCP campo a campo, com as flags e as opções.
- Distinguir o controle de fluxo (rwnd) do controle de congestionamento (cwnd, slow start e congestion avoidance).
- Reconhecer como o TCP recupera perdas: timeout (RTO), fast retransmit e SACK.
- Comparar o TCP com o UDP na mesma rede.


### O diagrama da conexão

\`\`\`mermaid
sequenceDiagram
  autonumber
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

O segmento TCP é o cabeçalho seguido dos dados da aplicação. O desenho mostra o cabeçalho de 20 bytes (160 bits), sem opções, em linhas de 32 bits, na ordem de transmissão ([RFC 9293](https://www.rfc-editor.org/rfc/rfc9293), seção 3.1).

\`\`\`mermaid
packet-beta
  0-15: "Porta de origem"
  16-31: "Porta de destino"
  32-63: "Número de sequência"
  64-95: "Número de confirmação"
  96-99: "Desloc."
  100-103: "Rsrv"
  104: "C"
  105: "E"
  106: "U"
  107: "A"
  108: "P"
  109: "R"
  110: "S"
  111: "F"
  112-127: "Janela"
  128-143: "Checksum"
  144-159: "Ponteiro urgente"
  160-191: "Opções e preenchimento (se o deslocamento for maior que 5)"
  192-223: "Dados (carga útil)"
\`\`\`

*Esquema 3 (o segmento TCP).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. As cinco primeiras linhas formam o cabeçalho fixo de 20 bytes; as opções, quando existem, ocupam até 40 bytes a mais (o deslocamento de dados chega a 15, ou 60 bytes). Os oito quadradinhos da quarta linha são as flags, uma por bit: C (CWR), E (ECE), U (URG), A (ACK), P (PSH), R (RST), S (SYN) e F (FIN). A tabela abaixo descreve todos os campos, em ordem.

| Campo | Posição (bits) | Tamanho | Função |
| --- | --- | --- | --- |
| Porta de origem | 0 a 15 | 16 bits | identifica o processo que envia |
| Porta de destino | 16 a 31 | 16 bits | identifica o processo que recebe |
| Número de sequência | 32 a 63 | 32 bits | posição, no fluxo, do primeiro byte do segmento (no SYN, o ISN) |
| Número de confirmação | 64 a 95 | 32 bits | próximo byte esperado, válido quando o bit ACK está ligado |
| Deslocamento de dados | 96 a 99 | 4 bits | tamanho do cabeçalho em palavras de 32 bits (mínimo 5, ou 20 bytes) |
| Reservado | 100 a 103 | 4 bits | zero |
| Flags | 104 a 111 | 8 bits | CWR, ECE, URG, ACK, PSH, RST, SYN e FIN (veja a tabela seguinte) |
| Janela | 112 a 127 | 16 bits | espaço livre no receptor (rwnd), em bytes |
| Checksum | 128 a 143 | 16 bits | cobre cabeçalho, dados e um pseudocabeçalho com os endereços IP |
| Ponteiro urgente | 144 a 159 | 16 bits | posição do dado urgente, válido com URG (uso desaconselhado, RFC 6093) |
| Opções e preenchimento | 160 em diante | 0 a 40 bytes | extensões negociadas, como o MSS e o SACK |

| Flag | Nome | Quando está ligada |
| --- | --- | --- |
| SYN | Synchronize | abre a conexão e sincroniza os números de sequência; consome 1 número |
| ACK | Acknowledgment | o campo de confirmação é válido; fica ligada em quase todos os segmentos depois do SYN inicial |
| FIN | Finish | o remetente não tem mais dados a enviar; consome 1 número |
| RST | Reset | derruba a conexão de imediato, por exemplo ao receber segmento de uma conexão que não existe |
| PSH | Push | pede que o receptor entregue os dados à aplicação sem esperar encher o buffer |
| URG | Urgent | o ponteiro urgente é válido |
| ECE | ECN-Echo | o receptor avisa que a rede marcou congestionamento (RFC 3168) |
| CWR | Congestion Window Reduced | o emissor avisa que já reduziu a janela em resposta ao ECE (RFC 3168) |

As opções mais comuns, todas negociadas no SYN, são estas:

| Tipo (kind) | Opção | Função |
| --- | --- | --- |
| 2 | MSS | maior segmento que o remetente aceita receber (veja a próxima seção) |
| 3 | Window Scale | multiplica a janela por uma potência de 2, para passar do limite de 65.535 bytes (RFC 7323) |
| 4 | SACK Permitted | informa que o remetente entende confirmações seletivas (RFC 2018) |
| 5 | SACK | leva os blocos recebidos fora de ordem (RFC 2018) |
| 8 | Timestamps | mede o RTT e protege contra números de sequência repetidos (RFC 7323) |

### Do fluxo de bytes ao segmento: o MSS

A aplicação escreve um fluxo de bytes, e o TCP o corta em **segmentos**. O tamanho máximo da parte de dados é o **MSS** (*Maximum Segment Size*), que cada lado anuncia no SYN. Em uma rede Ethernet com MTU de 1500 bytes, o MSS é 1500 menos 20 (cabeçalho IPv4) menos 20 (cabeçalho TCP), ou seja, **1460 bytes** ([RFC 9293](https://www.rfc-editor.org/rfc/rfc9293), seção 3.7.1). Um arquivo de 1 MiB (1.048.576 bytes), por exemplo, vira 719 segmentos.

O MSS evita a fragmentação no IP: o segmento já sai do tamanho que cabe no enlace. Quando o caminho tem uma MTU menor, o PMTUD (veja o simulador de ICMP) ajusta o tamanho.

### Janelas: quanto o emissor pode enviar

\`\`\`mermaid
flowchart LR
  A["cwnd<br/>o que a rede aguenta"] --> M["Janela efetiva<br/>é o menor valor"]
  B["rwnd<br/>o que o receptor aguenta"] --> M
  M --> E["Bytes em voo<br/>sem confirmação"]
\`\`\`

*Esquema 4 (janela efetiva).* O emissor mantém em voo, no máximo, o **menor** entre a janela de congestionamento (cwnd) e a janela anunciada pelo receptor (rwnd).

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

*Esquema 5 (fases do controle de congestionamento).* Segue a RFC 5681: o *slow start* cresce depressa até o limiar (*ssthresh*), e depois a *congestion avoidance* cresce devagar. Uma perda é lida como sinal de congestionamento, e a janela é reduzida.

Dois sinais de perda têm custos muito diferentes:

| Sinal | Como o emissor percebe | Reação |
| --- | --- | --- |
| Três ACKs duplicados | segmentos seguintes chegam, mas o ACK não avança | retransmite logo (*fast retransmit*) e reduz a cwnd pela metade |
| Timeout (RTO) | nenhum ACK volta antes do prazo | cwnd volta a 1 segmento e recomeça no slow start |

O prazo de retransmissão (RTO) é calculado a partir do RTT medido (RFC 6298, que a RFC 9293 adota na seção 3.8.1). Com **SACK** (RFC 2018), o receptor informa também os blocos recebidos fora de ordem, e o emissor reenvia só o que falta.

### O que cada modo e aba do simulador mostram

- **Diagrama de sequência:** cada seta é um segmento. A seta com X é um segmento perdido. No modo de download, cada seta representa uma **rodada** (uma janela inteira), para o desenho caber na tela.
- **Estado da conexão (painel lateral):** mostra o estado TCP de cada ponta, e a cwnd, o ssthresh e o RTO no instante atual.
- **Modos:** *TCP: conexão* mostra abertura, crescimento da janela, perdas e encerramento. *TCP: download* mostra um arquivo grande, com a fila do roteador e a vazão. *Comparação TCP x UDP* envia a mesma carga pelos dois protocolos na mesma rede.
- **O relógio:** o tempo avança com o botão Passo ou com a reprodução, e os painéis acompanham o instante atual.

Para treinar a abertura e o encerramento, use o cenário "Handshake e encerramento". Para ver o crescimento da janela, use "Slow start". Para comparar as formas de recuperar perdas, use "Fast retransmit", "Timeout (RTO)", "Várias perdas sem SACK" e "Várias perdas com SACK". Para o controle de fluxo, use "Janela do receptor".

### Limites do modelo e do diagrama

- O simulador mostra o **caminho típico** da máquina de estados e do controle de congestionamento. Ele não simula CUBIC, BBR, *Nagle*, ACK atrasado nem reinício por RST.
- Os tempos, os tamanhos e a fila do roteador são **didáticos**: servem para comparar comportamentos, e não para prever o desempenho de uma rede real.
- O controle de congestionamento segue a RFC 5681 (estilo Reno), com SACK opcional. Implementações reais variam, e o simulador não reproduz um sistema operacional específico.
`;
