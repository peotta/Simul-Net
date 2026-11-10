// Fundamentação do simulador UDP, em Markdown: aparece na documentação (docs/simuladores/udp.md e na wiki), antes de
// "Como ler os diagramas". Explica o datagrama sem conexão e o que a aplicação precisa fazer por conta própria.
export const fundamentacao: string = `
### O problema que o UDP resolve

O IP entrega datagramas entre **hosts**. Falta dizer para **qual processo** do host o dado vai. O UDP (*User Datagram Protocol*, RFC 768) acrescenta ao IP só o mínimo para isso: **portas**, **comprimento** e **checksum**. Ele está na camada 4 e não cria conexão, não confirma, não reordena e não controla a taxa.

Isso não é um defeito: é uma escolha. Cada datagrama é independente, então não há handshake para esperar, nem fila de retransmissão que atrase os dados novos. O UDP serve quando a **rapidez** importa mais que a entrega perfeita, ou quando a própria aplicação quer decidir como recuperar perdas.

**O que você aprende com este simulador.**

- Explicar o que o UDP acrescenta ao IP (portas, comprimento e checksum) e o que ele deixa de fazer.
- Ler o cabeçalho UDP campo a campo e entender o checksum com o pseudocabeçalho.
- Comparar o UDP com o TCP e saber quando cada um é a escolha certa.
- Reconhecer como a aplicação recupera perdas, ordem e taxa por conta própria (DNS, vídeo).
- Entender por que a falta de handshake torna o UDP um alvo de abuso, e quais defesas existem.


### O diagrama do datagrama

\`\`\`mermaid
flowchart LR
  APP["Aplicação<br/>escreve uma mensagem"] --> U["UDP<br/>acrescenta 8 bytes:<br/>portas, comprimento, checksum"]
  U --> IP["IP<br/>acrescenta o cabeçalho IPv4"]
  IP --> NET(("Rede"))
  NET --> IP2["IP<br/>entrega ao protocolo 17"]
  IP2 --> U2["UDP<br/>usa a porta de destino"]
  U2 --> APP2["Aplicação<br/>recebe a mensagem inteira"]
\`\`\`

*Esquema 1 (caminho de um datagrama UDP).* Cada chamada de envio da aplicação vira **um** datagrama, e cada datagrama chega inteiro ou não chega. O UDP preserva as **fronteiras das mensagens**, ao contrário do TCP, que entrega um fluxo contínuo de bytes.

A porta de destino escolhe o processo: o IP entrega ao protocolo 17 (UDP), e o UDP entrega à aplicação que abriu aquela porta.

### O cabeçalho UDP

O datagrama UDP é o cabeçalho de 8 bytes seguido dos dados da aplicação. O desenho mostra o cabeçalho e o início dos dados em linhas de 32 bits, na ordem de transmissão ([RFC 768](https://www.rfc-editor.org/rfc/rfc768)).

\`\`\`mermaid
packet-beta
  0-15: "Porta de origem"
  16-31: "Porta de destino"
  32-47: "Comprimento"
  48-63: "Checksum"
  64-95: "Dados (carga útil)"
\`\`\`

*Esquema 2 (o datagrama UDP).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O cabeçalho ocupa só as duas primeiras linhas (64 bits, ou 8 bytes), contra os 20 bytes do TCP sem opções. A tabela abaixo descreve todos os campos, em ordem.

| Campo | Posição (bits) | Tamanho | Função |
| --- | --- | --- | --- |
| Porta de origem | 0 a 15 | 16 bits | porta de quem enviou (pode ser zero se não há resposta) |
| Porta de destino | 16 a 31 | 16 bits | escolhe o processo no receptor |
| Comprimento | 32 a 47 | 16 bits | cabeçalho mais dados, em bytes (mínimo 8) |
| Checksum | 48 a 63 | 16 bits | cobre o pseudocabeçalho IP, o cabeçalho UDP e os dados |

No IPv4, o checksum pode ser zero, o que significa que o emissor não o calculou. Quando ele existe, o receptor descarta o datagrama que não confere. No IPv6, o checksum é obrigatório (RFC 8200, seção 8.1).

### O checksum e o pseudocabeçalho

O checksum do UDP não protege só o UDP: ele inclui um **pseudocabeçalho** com campos do IP, para que o receptor perceba um datagrama entregue ao host errado ou com o protocolo trocado. Esses campos não viajam de novo, pois já estão no cabeçalho IP; são apenas somados no cálculo.

\`\`\`mermaid
packet-beta
  0-31: "Endereço IP de origem"
  32-63: "Endereço IP de destino"
  64-71: "Zero"
  72-79: "Protocolo (17)"
  80-95: "Comprimento do UDP"
\`\`\`

*Esquema 3 (o pseudocabeçalho IPv4 do checksum).* O cálculo é a soma em complemento de um, em palavras de 16 bits, do pseudocabeçalho, do cabeçalho UDP (com o checksum zerado) e dos dados, com o resultado complementado ([RFC 768](https://www.rfc-editor.org/rfc/rfc768); [RFC 1071](https://www.rfc-editor.org/rfc/rfc1071)). O receptor refaz a soma, e o resultado correto fecha em zero.

### O tamanho do datagrama

O campo de comprimento tem 16 bits, e o IPv4 limita o pacote a 65.535 bytes, então a carga útil máxima teórica é de **65.507 bytes** (65.535 menos 20 do IP e 8 do UDP). Na prática, o limite útil é a MTU: em Ethernet (1500 bytes), cabem **1472 bytes** de dados sem fragmentar (1500 menos 20 e menos 8). Datagramas maiores são fragmentados pelo IP, e a perda de um fragmento descarta o datagrama inteiro, por isso as aplicações costumam manter o UDP abaixo da MTU (RFC 8085, seção 3.2).

### UDP e TCP lado a lado

| Característica | UDP | TCP |
| --- | --- | --- |
| Conexão | nenhuma | abertura em três vias e encerramento |
| Entrega | melhor esforço, sem confirmação | confiável, com confirmação e retransmissão |
| Ordem | não garante | garante, no fluxo de bytes |
| Fronteiras das mensagens | preservadas (um datagrama, uma mensagem) | não existem (fluxo contínuo) |
| Cabeçalho | 8 bytes | 20 bytes ou mais |
| Controle de fluxo e de congestionamento | nenhum (cabe à aplicação) | rwnd e cwnd |
| Usos típicos | DNS, DHCP, NTP, voz, vídeo, QUIC | web, e-mail, SSH, transferência de arquivos |

### O que a aplicação ganha e o que passa a ser dela

\`\`\`mermaid
flowchart TD
  T["UDP entrega o que chegar"] --> P{"A aplicação precisa de...?"}
  P -- "confirmação e reenvio" --> R["Implementa na aplicação<br/>exemplo: repetição de consulta do resolvedor DNS"]
  P -- "ordem" --> O["Numera os pacotes<br/>exemplo: número de sequência do RTP"]
  P -- "controle de taxa" --> C["Adapta a taxa à rede<br/>exemplo: ajuste de qualidade do vídeo"]
  P -- "nada disso" --> N["Aceita a perda<br/>exemplo: um quadro de vídeo a menos"]
\`\`\`

*Esquema 4 (responsabilidades que sobram para a aplicação).* Tudo o que o TCP faz por baixo, no UDP é decisão da aplicação. As diretrizes para usar o UDP com cuidado estão na RFC 8085, em especial a necessidade de a aplicação controlar o congestionamento.

| Uso | Por que UDP | Como lida com a perda |
| --- | --- | --- |
| DNS (RFC 1035) | uma pergunta e uma resposta pequenas, sem custo de conexão | o resolvedor repete a consulta se não houver resposta |
| Vídeo e voz (RTP, RFC 3550) | um dado atrasado perde o valor | número de sequência e *timestamp* no RTP, buffer no player |

Algumas portas conhecidas sobre UDP: **53** (DNS), **67 e 68** (DHCP, servidor e cliente), **123** (NTP) e **443** (QUIC, que acrescenta confiabilidade e controle de congestionamento acima do UDP). O registro oficial está na IANA ("Service Name and Transport Protocol Port Number Registry").

### UDP e segurança: a ausência de handshake

Sem handshake, o UDP não confirma que o remetente é quem diz ser: o endereço de origem de um datagrama pode ser **forjado**. Um servidor que responde a qualquer datagrama pode ser usado para enviar respostas à vítima, e, quando a resposta é maior que a consulta, o tráfego é **amplificado** (RFC 8085, seção 5). Este documento trata do tema no nível defensivo; o simulador de ataques a TCP e UDP mostra o efeito.

As defesas são três: filtrar na borda os pacotes com origem falsificada (BCP 38, RFC 2827), limitar a taxa de respostas e não expor serviços UDP que não precisam ser públicos.

### O que cada modo e aba do simulador mostram

- **Diagrama de sequência:** cada seta é um datagrama, sem handshake antes e sem ACK depois. A seta com X é um datagrama perdido, e o UDP não percebe isso.
- **Modos:** *UDP: fluxo* mostra datagramas de mídia com perda e reordenação. *UDP: DNS* mostra a repetição feita pelo **resolvedor**, e não pelo UDP. *UDP: vídeo* mostra um streaming, com taxa, jitter e buffer do player. *Comparação UDP x TCP* envia a mesma carga pelos dois protocolos na mesma rede.
- **Sem conexão:** o UDP não tem estados de conexão para mostrar, e o que se observa é o destino de cada datagrama: entregue, perdido ou entregue fora de ordem.

Para ver a perda sem recuperação, use o cenário "Fluxo com perdas". Para ver quem repete a consulta, use "DNS com repetição". Para o efeito de taxa, jitter e buffer, use "Vídeo em streaming", "Vídeo com perdas", "Vídeo acima da capacidade" e "Jitter e buffer do player". Para comparar com o TCP, use "TCP x UDP: 10% de perda" e "TCP x UDP: reordenação".

### Limites do modelo e do diagrama

- O simulador não implementa o RTP nem o DNS por completo: usa o comportamento essencial de cada um para mostrar como a aplicação lida com a perda.
- Os tempos, as taxas e o buffer do player são **didáticos**, e não medem uma rede real.
- Fragmentação IP, multicast e QUIC (que usa UDP, mas acrescenta confiabilidade e controle de congestionamento) não são simulados.
`;
