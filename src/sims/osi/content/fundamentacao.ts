// Fundamentação do simulador OSI, em Markdown: aparece na documentação (docs/simuladores/osi.md e na wiki), antes de
// "Como ler os diagramas". Explica o diagrama das sete camadas e como o palco do simulador o representa.
export const fundamentacao: string = `
### O que o modelo OSI descreve

O modelo OSI (*Open Systems Interconnection*, ISO/IEC 7498-1, também publicado como ITU-T X.200) é um **modelo de referência**: divide a comunicação entre dois sistemas em sete camadas, cada uma com uma função bem definida. Ele serve para nomear funções, comparar tecnologias e localizar problemas ("a falha está na camada 2 ou na 3?"). Não descreve um software específico: a internet usa a pilha TCP/IP, que agrupa várias camadas do OSI (veja a seção sobre o OSI e o TCP/IP, abaixo).

Três ideias sustentam o modelo:

- **Serviço:** cada camada presta um serviço à camada de cima e usa o serviço da camada de baixo, sem precisar saber como ele é feito.
- **Protocolo entre pares:** a camada N de um sistema conversa com a camada N do outro, por meio de um cabeçalho próprio que viaja junto com os dados. O cabeçalho é o "idioma" da conversa entre as duas camadas.
- **Encapsulamento:** para enviar, cada camada trata o que recebeu da camada de cima como carga útil e acrescenta o seu cabeçalho (a Ethernet também acrescenta um trailer, o FCS). Para receber, o caminho é o inverso: cada camada confere, retira o seu cabeçalho e entrega o conteúdo à camada de cima.

### O diagrama das sete camadas

\`\`\`mermaid
flowchart TB
  L7["7 Aplicação: o serviço que o programa vê (HTTP)"]
  L6["6 Apresentação: formato, codificação e cifra dos dados"]
  L5["5 Sessão: abertura, controle e fim do diálogo"]
  L4["4 Transporte: entrega entre processos, por portas (TCP)"]
  L3["3 Rede: endereço lógico e roteamento (IPv4)"]
  L2["2 Enlace: entrega no mesmo enlace, por MAC (Ethernet)"]
  L1["1 Física: sinais no meio (bits)"]
  L7 --> L6 --> L5 --> L4 --> L3 --> L2 --> L1
\`\`\`

*Esquema 1 (pilha do modelo).* As sete camadas, da aplicação (topo) ao meio físico (base). Na transmissão, os dados descem do topo até a base; na recepção, sobem da base ao topo.

| Camada | Nome | Unidade de dados (PDU) | Função | Identificador | Neste simulador |
| --- | --- | --- | --- | --- | --- |
| 7 | Aplicação | dados (mensagem) | serviço visto pelo programa | nome e porta do serviço | HTTP/1.1 (RFC 9112) |
| 6 | Apresentação | dados | formato, codificação e cifra | tipo de conteúdo | sem TLS: texto ASCII |
| 5 | Sessão | dados | abertura, controle e fim do diálogo | sessão ou conexão | conexão TCP já estabelecida |
| 4 | Transporte | segmento | entrega entre processos, confiabilidade e controle de fluxo | porta | TCP (RFC 9293) |
| 3 | Rede | pacote | endereçamento lógico e roteamento entre redes | endereço IP | IPv4 (RFC 791) |
| 2 | Enlace | quadro | entrega entre vizinhos do mesmo enlace e detecção de erro | endereço MAC | Ethernet II e 802.1Q (IEEE) |
| 1 | Física | bits | transmissão dos sinais no meio | sem endereço | preâmbulo, SFD e bits |

Os livros costumam agrupar as camadas em dois blocos, o que ajuda a lembrar quem cuida de quê:

- **Camadas 5 a 7 (camadas superiores):** tratam do que o usuário e o programa enxergam. Existem **só nas pontas** (cliente e servidor).
- **Camada 4 (transporte):** é fim a fim, também só nas pontas: os equipamentos do caminho, como o switch e o roteador comuns, não leem o segmento.
- **Camadas 1 a 3 (camadas de rede):** levam os bits de um ponto a outro e existem também nos equipamentos do caminho.

### Como ler o diagrama do simulador

O palco do simulador desenha o diagrama das sete camadas **quatro vezes**, uma para cada dispositivo do caminho, e mostra a unidade de dados em movimento entre elas.

- **Quatro pilhas:** cliente, switch, roteador e servidor, da esquerda para a direita. Em cada pilha, a camada 7 fica no topo e a camada 1 na base.
- **Camadas tracejadas:** quando o dispositivo não implementa a camada, a caixa aparece tracejada e apagada. O switch só tem as camadas 1 e 2, e o roteador, as camadas 1 a 3. Só o cliente e o servidor têm as sete.
- **A PDU em movimento:** um conjunto de tiras coloridas, uma para cada cabeçalho presente. A cor identifica a camada dona: cinza, camada 1 (física); roxo, camada 2 (enlace); azul, camada 3 (rede); verde-azulado, camada 4 (transporte); âmbar, camadas 5 a 7 (dados). As tiras **crescem** quando uma camada acrescenta o seu cabeçalho (descida) e **encolhem** quando a retira (subida).
- **O nome acima da PDU:** muda conforme a camada em que ela está: dados, segmento, pacote, quadro e bits. No cabo, o nome é "bits" e aparecem o preâmbulo (\`10101010\`), o SFD (\`10101011\`) e os primeiros bits do quadro.
- **A camada em ação:** a caixa em destaque, com borda âmbar, é a camada que está trabalhando naquele passo. O botão **Passo** avança de camada em camada, e a PDU desliza até a próxima.
- **Cabos:** ligam as bases das pilhas. Entre o cliente e o switch é a LAN, entre o switch e o roteador é a LAN ou o tronco 802.1Q (quando a opção de VLAN está ligada), e entre o roteador e o servidor é a WAN.

O trajeto de ida segue sempre o mesmo padrão: desce a pilha do cliente (7, 6 e 5, 4, 3, 2, 1), atravessa o cabo, sobe até a camada 2 no switch e desce de novo, sobe até a camada 3 no roteador e desce de novo, atravessa o cabo e sobe a pilha inteira no servidor. A resposta faz o caminho inverso.

### Encapsulamento e desencapsulamento

\`\`\`mermaid
flowchart LR
  D["Dados: mensagem HTTP"] --> S["Segmento: cabeçalho TCP e dados"]
  S --> P["Pacote: cabeçalho IP e segmento"]
  P --> Q["Quadro: cabeçalho Ethernet, pacote e FCS"]
  Q --> B["Bits: preâmbulo, SFD e quadro"]
\`\`\`

*Esquema 2 (encapsulamento).* Na descida, cada camada envolve a PDU da camada de cima. Na subida, cada camada retira o seu envoltório.

A segunda vista do palco, **encapsulamento aninhado**, mostra a mesma ideia como caixas dentro de caixas: a caixa de fora é o quadro (camada 2), que contém o pacote (camada 3), que contém o segmento (camada 4), que contém os dados (camadas 5 a 7). Cada caixa lista os campos que aquela camada acrescentou, com valores reais do quadro em trânsito.

| Camada | O que acrescenta | Tamanho | Como a camada de cima é identificada |
| --- | --- | --- | --- |
| 4 | cabeçalho TCP (RFC 9293, seção 3.1) | 20 bytes sem opções | a porta de destino aponta o processo |
| 3 | cabeçalho IPv4 (RFC 791) | 20 bytes sem opções | o campo Protocolo (6 para TCP) |
| 2 | cabeçalho Ethernet II, etiqueta 802.1Q opcional e FCS (IEEE 802.3) | 14 bytes, 4 do FCS e 4 da etiqueta | o campo Tipo (0x0800 para IPv4) |
| 1 | preâmbulo e SFD | 8 bytes, fora do quadro | não há |

Cada cabeçalho carrega o **identificador da camada seguinte**. É assim que, na subida, a camada 2 sabe que o conteúdo é IPv4, a camada 3 sabe que é TCP e a camada 4 sabe a qual processo entregar.

### O que cada dispositivo faz com as camadas

\`\`\`mermaid
flowchart LR
  C["Cliente: camadas 1 a 7"] -- "quadro" --> SW["Switch: camadas 1 e 2"]
  SW -- "quadro" --> R["Roteador: camadas 1 a 3"]
  R -- "quadro novo" --> S["Servidor: camadas 1 a 7"]
\`\`\`

*Esquema 3 (dispositivos e camadas).* Cada dispositivo só sobe a pilha até a camada de que precisa para decidir.

| Dispositivo | Camadas | O que lê | O que altera |
| --- | --- | --- | --- |
| Cliente e servidor | 1 a 7 | tudo, até a mensagem HTTP | cria e consome todos os cabeçalhos |
| Switch | 1 e 2 | MAC de destino e FCS | aprende o MAC de origem e, se for o caso, acrescenta ou retira a etiqueta 802.1Q (e recalcula o FCS) |
| Roteador | 1 a 3 | MAC de destino, FCS, IP de destino e TTL | decrementa o TTL, recalcula o checksum do IP e monta um quadro novo, com MAC e FCS novos (RFC 1812, seção 5.3.1) |

Por isso, a cada salto, **mudam** os MACs, o TTL, o checksum do IP e o FCS, e **não mudam** os IPs, as portas, os números de sequência e a mensagem HTTP. O endereço físico vale em um enlace, e o endereço IP vale fim a fim.

### O modelo OSI e a pilha TCP/IP

| Camada OSI | Pilha TCP/IP | Exemplos |
| --- | --- | --- |
| 7 Aplicação, 6 Apresentação e 5 Sessão | Aplicação | HTTP, DNS, SSH, TLS |
| 4 Transporte | Transporte | TCP, UDP |
| 3 Rede | Internet | IPv4, IPv6, ICMP |
| 2 Enlace e 1 Física | Acesso à rede | Ethernet, Wi-Fi |

O modelo OSI é mais fino do que a prática: na pilha TCP/IP, as funções das camadas 5 e 6 ficam dentro da aplicação (por exemplo, o TLS cuida da cifra e da sessão segura). Por isso o simulador mostra as camadas 5 e 6 **sem cabeçalho próprio**: elas existem no modelo, mas não acrescentam bytes ao quadro quando não há TLS.

### Limites do modelo e do diagrama

- O OSI é **conceitual**: protocolos reais nem sempre respeitam as fronteiras entre camadas (o TLS, por exemplo, atravessa as camadas 5 e 6, e o ARP fica entre a 2 e a 3).
- O diagrama mostra **uma** requisição HTTP em uma conexão TCP já estabelecida. O handshake, a janela deslizante e o encerramento do TCP, o ARP, o DNS e o TLS têm simuladores próprios.
- O palco do simulador mostra a PDU **inteira** descendo a pilha, mas os tempos e as proporções das tiras são didáticos: o tamanho de cada tira não é proporcional ao número de bytes.
`;
