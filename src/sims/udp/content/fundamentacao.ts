// Fundamentação do simulador UDP, em Markdown: aparece na documentação (docs/simuladores/udp.md e na wiki), antes de
// "Como ler os diagramas". Explica o datagrama sem conexão e o que a aplicação precisa fazer por conta própria.
export const fundamentacao: string = `
### O problema que o UDP resolve

O IP entrega datagramas entre **hosts**. Falta dizer para **qual processo** do host o dado vai. O UDP (*User Datagram Protocol*, RFC 768) acrescenta ao IP só o mínimo para isso: **portas**, **comprimento** e **checksum**. Ele está na camada 4 e não cria conexão, não confirma, não reordena e não controla a taxa.

Isso não é um defeito: é uma escolha. Cada datagrama é independente, então não há handshake para esperar, nem fila de retransmissão que atrase os dados novos. O UDP serve quando a **rapidez** importa mais que a entrega perfeita, ou quando a própria aplicação quer decidir como recuperar perdas.

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

| Campo | Tamanho | Função |
| --- | --- | --- |
| Porta de origem | 16 bits | porta de quem enviou (pode ser zero se não há resposta) |
| Porta de destino | 16 bits | escolhe o processo no receptor |
| Comprimento | 16 bits | cabeçalho mais dados, em bytes (mínimo 8) |
| Checksum | 16 bits | cobre o pseudocabeçalho IP, o cabeçalho UDP e os dados |

O cabeçalho tem **8 bytes** (RFC 768), contra os 20 do TCP sem opções. No IPv4, o checksum pode ser zero, o que significa que o emissor não o calculou. Quando ele existe, o receptor descarta o datagrama que não confere.

### O que a aplicação ganha e o que passa a ser dela

\`\`\`mermaid
flowchart TD
  T["UDP entrega o que chegar"] --> P{"A aplicação precisa de...?"}
  P -- "confirmação e reenvio" --> R["Implementa na aplicação<br/>exemplo: repetição de consulta do resolvedor DNS"]
  P -- "ordem" --> O["Numera os pacotes<br/>exemplo: número de sequência do RTP"]
  P -- "controle de taxa" --> C["Adapta a taxa à rede<br/>exemplo: ajuste de qualidade do vídeo"]
  P -- "nada disso" --> N["Aceita a perda<br/>exemplo: um quadro de vídeo a menos"]
\`\`\`

*Esquema 2 (responsabilidades que sobram para a aplicação).* Tudo o que o TCP faz por baixo, no UDP é decisão da aplicação. As diretrizes para usar o UDP com cuidado estão na RFC 8085, em especial a necessidade de a aplicação controlar o congestionamento.

| Uso | Por que UDP | Como lida com a perda |
| --- | --- | --- |
| DNS (RFC 1035) | uma pergunta e uma resposta pequenas, sem custo de conexão | o resolvedor repete a consulta se não houver resposta |
| Vídeo e voz (RTP, RFC 3550) | um dado atrasado perde o valor | número de sequência e *timestamp* no RTP, buffer no player |

### Como ler o diagrama do simulador

- **Diagrama de sequência:** cada seta é um datagrama, sem handshake antes e sem ACK depois. A seta com X é um datagrama perdido, e o UDP não percebe isso.
- **Modos:** *UDP: fluxo* mostra datagramas de mídia com perda e reordenação. *UDP: DNS* mostra a repetição feita pelo **resolvedor**, e não pelo UDP. *UDP: vídeo* mostra um streaming, com taxa, jitter e buffer do player. *Comparação UDP x TCP* envia a mesma carga pelos dois protocolos na mesma rede.
- **Sem conexão:** o UDP não tem estados de conexão para mostrar, e o que se observa é o destino de cada datagrama: entregue, perdido ou entregue fora de ordem.

### Limites do modelo e do diagrama

- O simulador não implementa o RTP nem o DNS por completo: usa o comportamento essencial de cada um para mostrar como a aplicação lida com a perda.
- Os tempos, as taxas e o buffer do player são **didáticos**, e não medem uma rede real.
- Fragmentação IP, multicast e QUIC (que usa UDP, mas acrescenta confiabilidade e controle de congestionamento) não são simulados.
`;
