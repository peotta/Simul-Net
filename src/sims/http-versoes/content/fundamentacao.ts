// Fundamentação do simulador de versões do HTTP, em Markdown: aparece na documentação (docs/simuladores/http-versoes.md e na
// wiki), antes de "Como ler os diagramas". Explica o que muda do HTTP/1.1 ao HTTP/3 e por que o transporte importa.
export const fundamentacao: string = `
### O problema que as versões do HTTP resolvem

Uma página web é composta de **dezenas de recursos** (HTML, estilos, scripts, imagens). O desempenho depende de **como esses pedidos são levados pela rede**: quantas conexões, quanto custa abrir cada uma, e o que acontece quando um pacote se perde. A **semântica** do HTTP (RFC 9110) é a mesma nas três versões: métodos como GET e POST, códigos de status, cabeçalhos e corpo. O que muda é **como a mensagem é levada**: o formato na linha, o uso de conexões e o transporte por baixo.

### O diagrama das três pilhas

\`\`\`mermaid
flowchart TB
  subgraph V1["HTTP/1.1, RFC 9112"]
    A1["Mensagens em texto"] --> B1["TLS"] --> C1["TCP"]
  end
  subgraph V2["HTTP/2, RFC 9113"]
    A2["Quadros binários e fluxos"] --> B2["TLS"] --> C2["TCP"]
  end
  subgraph V3["HTTP/3, RFC 9114"]
    A3["Quadros binários e fluxos"] --> B3["QUIC, RFC 9000<br/>inclui o TLS 1.3"] --> C3["UDP"]
  end
\`\`\`

*Esquema 1 (a pilha de cada versão).* O HTTP/1.1 e o HTTP/2 rodam sobre **TCP**, em geral com TLS por cima. O HTTP/3 roda sobre o **QUIC**, que usa **UDP** e traz a criptografia (TLS 1.3) integrada ao transporte.

### HTTP/1.1: texto, uma conexão, um pedido por vez

- **Formato em texto:** linha de requisição, cabeçalhos e corpo, legíveis a olho nu. Os mesmos cabeçalhos (como User-Agent, Accept e Cookie) se repetem em **todo** pedido.
- **Conexões persistentes:** a conexão TCP é reaproveitada para vários pedidos, mas **um de cada vez**: o segundo pedido espera a resposta do primeiro.
- **Várias conexões:** para paralelizar, os navegadores abrem até **6 conexões** por servidor, e cada uma paga o handshake de TCP e de TLS.

### HTTP/2: uma conexão, vários fluxos

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant N as Navegador
  participant S as Servidor
  N->>S: HEADERS fluxo 1: GET /app.js
  N->>S: HEADERS fluxo 3: GET /estilo.css
  N->>S: HEADERS fluxo 5: GET /logo.png
  S->>N: DATA fluxo 3
  S->>N: DATA fluxo 1
  S->>N: DATA fluxo 5
  Note over N,S: os quadros dos fluxos se intercalam na mesma conexão TCP
\`\`\`

*Esquema 2 (multiplexação).* O HTTP/2 divide cada mensagem em **quadros binários** (HEADERS, DATA, SETTINGS e outros) e leva **muitos pedidos e respostas ao mesmo tempo** em uma só conexão, cada um em um **fluxo** com identificador próprio. Os cabeçalhos são comprimidos com o **HPACK** (RFC 7541), que guarda os cabeçalhos repetidos em uma tabela dinâmica: só o primeiro pedido paga o preço integral.

Mas a multiplexação tem um limite: todos os fluxos dividem **uma só conexão TCP**, que entrega os bytes **em ordem**. Se um pacote se perde, o TCP segura **todos** os fluxos até retransmitir: é o **bloqueio de cabeça de fila no nível do TCP**.

### HTTP/3: fluxos independentes sobre o QUIC

\`\`\`mermaid
flowchart LR
  P["Um pacote com dados do fluxo 1 se perde"] --> H2["HTTP/2 sobre TCP:<br/>todos os fluxos esperam a retransmissão"]
  P --> H3["HTTP/3 sobre QUIC:<br/>só o fluxo 1 espera, os outros seguem"]
\`\`\`

*Esquema 3 (efeito de uma perda).* No QUIC, cada fluxo tem a sua própria entrega em ordem, e a perda atrasa **só o fluxo afetado**. O handshake também é mais curto: o QUIC combina o transporte e o TLS 1.3 em **1 RTT** (e em 0-RTT na retomada), enquanto o HTTP/1.1 e o HTTP/2 pagam o handshake do TCP **e depois** o do TLS. A compressão de cabeçalhos do HTTP/3 é o **QPACK** (RFC 9204).

| Aspecto | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| Formato | texto | binário, em quadros | binário, em quadros |
| Conexões por servidor | até 6 | 1 | 1 |
| Pedidos ao mesmo tempo | 1 por conexão | muitos, em fluxos | muitos, em fluxos |
| Compressão de cabeçalhos | não | HPACK | QPACK |
| Transporte | TCP | TCP | QUIC sobre UDP |
| Efeito de uma perda | atrasa a conexão | atrasa **todos** os fluxos | atrasa **só** o fluxo |

### Como ler o diagrama do simulador

- **Topologia:** o navegador, a internet e o servidor.
- **Aba Cascata:** cada recurso da página como uma barra no tempo, no estilo das ferramentas de desenvolvedor do navegador. Ela mostra quando cada pedido começou, esperou e terminou.
- **Aba Comparação:** as versões lado a lado, com o tempo total de carga.
- **Diagrama de sequência:** a legenda distingue pedido (GET), resposta (200), handshake de TLS ou QUIC, TCP, ACK e SETTINGS, e perda ou entrega retida.
- **Modos:** *HTTP/1.1* (as seis conexões), *HTTP/2* (a multiplexação) e *HTTP/3* (o handshake de 1 RTT e a perda).

### Limites do modelo e do diagrama

- O enlace tem **10 Mbit/s** fixos, dividido em partes iguais entre as respostas em andamento. Não há *slow start*, controle de congestionamento nem priorização de fluxos (RFC 9218).
- Os tamanhos de cabeçalho, de handshake e o tempo de processamento do servidor (10 ms) são **ilustrativos**. O HPACK e o QPACK não são codificados de verdade.
- O HTML é pedido primeiro, e os demais recursos só depois de ele chegar por inteiro. Os navegadores reais começam a pedir enquanto o HTML ainda chega.
- Não há cache, cookies reais, redirecionamentos, *server push*, migração de conexão nem retomada de sessão TLS no HTTP/1.1 e no HTTP/2. Nenhuma criptografia real é feita.
`;
