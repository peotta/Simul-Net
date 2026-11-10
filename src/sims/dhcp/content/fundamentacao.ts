// Fundamentação do simulador de DHCP, em Markdown: aparece na documentação (docs/simuladores/dhcp.md e na wiki), antes de
// "Como ler os diagramas". Explica a concessão (DORA), o lease e o teste do endereço.
export const fundamentacao: string = `
### O problema que o DHCP resolve

Para falar em uma rede IP, um host precisa de **endereço**, **máscara**, **gateway** e **servidores DNS**. Configurar isso à mão em cada dispositivo é trabalhoso e propenso a erro (endereços repetidos, máscaras erradas). O DHCP (*Dynamic Host Configuration Protocol*, RFC 2131) entrega essa configuração **automaticamente**, a partir de um servidor que administra um **pool** de endereços. As opções que carregam cada parâmetro estão na RFC 2132.

O endereço é **emprestado** por um tempo (*lease*) e precisa ser renovado: quando o host sai da rede, o endereço volta ao pool.

**O que você aprende com este simulador.**

- Explicar o que o DHCP entrega ao host (endereço, máscara, gateway, DNS) e por que o endereço é emprestado.
- Acompanhar a concessão DORA e o papel de cada mensagem, com um ou mais servidores.
- Ler a mensagem DHCP campo a campo e as opções mais usadas.
- Interpretar os estados do cliente e os temporizadores T1 e T2 da renovação.
- Reconhecer o conflito de endereço, o DECLINE e o RELEASE, e por que o DHCP não autentica (DHCP snooping).

### O diagrama da concessão: DORA

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente, sem IP
  participant S as Servidor DHCP
  C->>S: DISCOVER, broadcast: 0.0.0.0 para 255.255.255.255
  S->>C: OFFER: endereço oferecido (yiaddr) e opções
  C->>S: REQUEST, broadcast: escolhe esta oferta (opção 54)
  S->>C: ACK: confirma e grava o lease
  Note over C: opcional: ARP Probe para testar o endereço antes de usar
\`\`\`

*Esquema 1 (as quatro mensagens da concessão).* **D**iscover, **O**ffer, **R**equest, **A**cknowledge. O cliente ainda **não tem IP**, então começa com o endereço de origem 0.0.0.0 e usa **broadcast**. O servidor escuta na porta UDP **67** e o cliente, na porta **68** (RFC 2131, seção 4.1). A mensagem REQUEST também é enviada em broadcast, e a opção 54 (*Server Identifier*) avisa os servidores **não escolhidos** para liberarem as suas reservas.

Quando há **mais de um servidor**, cada um responde com uma oferta, e o cliente escolhe uma. O fluxo completo está na RFC 2131, seção 3.1.

### Os estados do cliente

\`\`\`mermaid
stateDiagram-v2
  [*] --> INIT
  INIT --> SELECTING: envia DISCOVER
  SELECTING --> REQUESTING: recebe OFFER, envia REQUEST
  REQUESTING --> BOUND: recebe ACK
  BOUND --> RENEWING: T1 vence
  RENEWING --> BOUND: recebe ACK
  RENEWING --> REBINDING: T2 vence
  REBINDING --> BOUND: recebe ACK
  REBINDING --> INIT: lease expira
\`\`\`

*Esquema 2 (ciclo de vida do lease).* É um recorte da máquina de estados da RFC 2131, seção 4.4 (Figura 5). Quando o endereço está em uso (**BOUND**), dois temporizadores controlam a renovação:

| Temporizador | Valor padrão | O que o cliente faz |
| --- | --- | --- |
| T1 | 50% do lease | entra em RENEWING e pede a renovação, em **unicast**, ao servidor original |
| T2 | 87,5% do lease | sem resposta, entra em REBINDING e pede, em **broadcast**, a qualquer servidor |
| Expiração | 100% do lease | abandona o endereço e volta a INIT |

### A mensagem DHCP

Todas as mensagens do DHCP têm o mesmo formato, herdado do BOOTP. O desenho mostra os campos em linhas de 32 bits, na ordem de transmissão ([RFC 2131](https://www.rfc-editor.org/rfc/rfc2131), seção 2).

\`\`\`mermaid
packet-beta
  0-7: "Op"
  8-15: "Htype"
  16-23: "Hlen"
  24-31: "Hops"
  32-63: "Xid (identificador da transação)"
  64-79: "Secs"
  80-95: "Flags"
  96-127: "Ciaddr (IP do cliente)"
  128-159: "Yiaddr (IP oferecido)"
  160-191: "Siaddr (IP do servidor)"
  192-223: "Giaddr (IP do relay)"
  224-351: "Chaddr (MAC do cliente, 16 bytes)"
  352-383: "Sname (64 bytes), File (128 bytes) e Opções (variável)"
\`\`\`

*Esquema 3 (a mensagem DHCP).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. A parte fixa tem 236 bytes, e as opções vêm depois, com tamanho variável. Para o desenho caber na tela, a última linha **condensa** os campos Sname (64 bytes), File (128 bytes) e as opções, que na mensagem real ocupam várias linhas. A tabela abaixo descreve os campos, em ordem.

| Campo | Tamanho | Função |
| --- | --- | --- |
| Op | 1 byte | 1 para mensagem do cliente (BOOTREQUEST) e 2 para mensagem do servidor (BOOTREPLY) |
| Htype e Hlen | 1 byte cada | tipo e tamanho do endereço de hardware (1 e 6 para Ethernet) |
| Hops | 1 byte | contador usado pelos agentes de retransmissão (relay) |
| Xid | 4 bytes | número escolhido pelo cliente, que casa cada resposta com a sua transação |
| Secs | 2 bytes | segundos desde o início da tentativa do cliente |
| Flags | 2 bytes | o bit mais à esquerda (B) pede que a resposta seja em broadcast |
| Ciaddr | 4 bytes | endereço do cliente, só quando ele já o tem e consegue responder (BOUND, RENEWING, REBINDING) |
| Yiaddr | 4 bytes | o endereço que o servidor oferece ou confirma ("seu endereço") |
| Siaddr | 4 bytes | servidor do próximo passo do boot, quando há |
| Giaddr | 4 bytes | endereço do agente de retransmissão, quando há |
| Chaddr | 16 bytes | endereço de hardware do cliente (6 bytes usados, no Ethernet) |
| Sname e File | 64 e 128 bytes | nome do servidor e do arquivo de boot, quando usados |
| Opções | variável | começam pelo cookie 99.130.83.99 e terminam na opção 255 |

As **opções** carregam quase toda a configuração (RFC 2132). Cada uma tem um código, um tamanho e um valor:

| Código | Opção | O que carrega |
| --- | --- | --- |
| 1 | Máscara de sub-rede | a máscara da rede |
| 3 | Roteador | o gateway padrão |
| 6 | Servidor DNS | os servidores de nomes |
| 50 | Endereço solicitado | o endereço que o cliente quer, no REQUEST |
| 51 | Tempo de lease | a duração do empréstimo, em segundos |
| 53 | Tipo da mensagem | 1 DISCOVER, 2 OFFER, 3 REQUEST, 4 DECLINE, 5 ACK, 6 NAK, 7 RELEASE, 8 INFORM |
| 54 | Identificador do servidor | quem enviou a oferta, e qual servidor o cliente escolheu |
| 58 | T1 | tempo de renovação (padrão: 50% do lease) |
| 59 | T2 | tempo de reassociação (padrão: 87,5% do lease) |

Por isso o DISCOVER, o OFFER, o REQUEST e o ACK têm o **mesmo formato** e só se distinguem pela opção 53.

### Conflito de endereço e DECLINE

Antes de usar o endereço recebido, o cliente pode testá-lo com um **ARP Probe** (RFC 5227; veja o simulador de ARP). Se alguém responder, o endereço já está em uso: o cliente envia **DHCPDECLINE**, e o servidor marca o endereço como indisponível. Quando o cliente sai de propósito, envia **DHCPRELEASE**, e o servidor devolve o endereço ao pool.

### O que o DHCP não faz

O DHCP **não autentica** quem pede nem quem responde. Um servidor falso na mesma rede pode oferecer um gateway ou um DNS errado e desviar o tráfego dos clientes. A defesa está no switch (**DHCP snooping**, uma técnica de fabricantes, que aceita OFFER e ACK só de portas confiáveis), e não no protocolo.

### O que cada modo e aba do simulador mostram

- **Topologia:** o cliente, o switch e os servidores DHCP. A legenda de cores distingue DISCOVER, OFFER, REQUEST, ACK, DECLINE ou falha, e RELEASE ou ARP.
- **Diagrama de sequência:** cada seta é uma mensagem DHCP, e a aba Mensagem abre os campos e as opções de cada uma.
- **Aba Leases:** o pool e os leases concedidos, com o tempo restante, no instante atual.
- **Painel de estados:** o estado do cliente (INIT, SELECTING, REQUESTING, BOUND, RENEWING, REBINDING).
- **Modos:** *Concessão (DORA)*, com um ou mais servidores e os casos de falha, e *Ciclo do lease*, com a renovação, o rebinding e a expiração.

Para treinar o DORA, use "DORA básico" e "Dois servidores". Para o efeito do tempo de lease, use "Lease curto". Para as falhas, use "Conflito de IP" e "Servidor indisponível". Para o ciclo de vida do endereço, use "Renovação (T1)", "Falha na renovação" e "RELEASE".

### Limites do modelo e do diagrama

- Na renovação, **não há retransmissão** em RENEWING e REBINDING (a RFC 2131, seção 4.4.5, manda repetir a cada metade do tempo restante, com mínimo de 60 s).
- O DHCPv6 (RFC 8415, substituída pela RFC 9915) está fora de escopo, assim como o BOOTP puro. O agente de retransmissão (*relay*, RFC 1542 e opção 82 da RFC 3046), o INIT-REBOOT, o DHCPNAK e o atraso aleatório de 1 a 10 s antes do primeiro DISCOVER não são simulados.
- Os tempos de lease são **curtos e didáticos**. Os temporizadores T1 e T2 seguem os valores padrão da RFC 2131.
`;
