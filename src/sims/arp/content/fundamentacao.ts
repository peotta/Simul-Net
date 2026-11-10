// Fundamentação do simulador ARP, em Markdown: aparece na documentação (docs/simuladores/arp.md e na wiki), antes de
// "Como ler os diagramas". Explica a resolução IP para MAC, o ARP gratuito e o limite de confiança do protocolo.
export const fundamentacao: string = `
### O problema que o ARP resolve

Em uma rede local, o quadro Ethernet precisa do **endereço MAC** do destino, mas a aplicação só conhece o **endereço IP**. O ARP (*Address Resolution Protocol*, RFC 826) responde à pergunta "quem tem este IP? me diga o seu MAC". Ele fica entre a camada 2 e a camada 3 e vale **só dentro de um enlace**: um ARP nunca atravessa um roteador.

Para falar com um destino de **outra** rede, o host não resolve o MAC do destino final: resolve o MAC do **gateway** (veja o simulador de IPv4 para a decisão entre entrega direta e gateway).

**O que você aprende com este simulador.**

- Explicar por que o IP precisa do MAC e como o ARP faz a ligação entre os dois, só dentro de um enlace.
- Ler o pacote ARP campo a campo e saber como ele viaja dentro de um quadro Ethernet.
- Interpretar a tabela ARP e os estados das entradas (INCOMPLETE, REACHABLE, STALE e FAILED).
- Entender o ARP gratuito, o *probe* e a detecção de endereço duplicado.
- Reconhecer por que o ARP não autentica e quais defesas existem na rede local.


### Quando o host usa o ARP

\`\`\`mermaid
flowchart TD
  I["O host tem um pacote IP<br/>para o destino D"] --> T{"D está na minha<br/>sub-rede?"}
  T -- "sim" --> A1["O próximo salto é o próprio D"]
  T -- "não" --> A2["O próximo salto é o gateway"]
  A1 --> C{"O MAC do próximo salto<br/>está na tabela ARP?"}
  A2 --> C
  C -- "sim" --> S["Monta o quadro e envia"]
  C -- "não" --> R["Envia um ARP Request em broadcast<br/>e guarda o pacote até a resposta"]
  R --> P{"Chegou o ARP Reply?"}
  P -- "sim" --> G["Grava a entrada na tabela<br/>e envia o quadro"]
  P -- "não" --> F["Esgotadas as tentativas: entrada FAILED<br/>e o envio falha com host inalcançável"]
\`\`\`

*Esquema 1 (quando o ARP entra em ação).* O ARP resolve sempre o MAC do **próximo salto**, que é o destino (na mesma sub-rede) ou o gateway (em outra rede). A decisão entre os dois é a do host IPv4 (veja o simulador de IPv4). O host guarda o pacote durante a resolução e só consulta a rede se a tabela não tiver a entrada ([RFC 1122](https://www.rfc-editor.org/rfc/rfc1122), seções 2.3.2.1 e 2.3.2.2).

### O diagrama da resolução

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as Host A
  participant L as Rede local (broadcast)
  participant B as Host B
  A->>L: ARP Request: quem tem 192.168.1.20?
  Note over L: ff:ff:ff:ff:ff:ff, todos recebem
  L->>B: o quadro chega ao Host B
  B->>A: ARP Reply: 192.168.1.20 está em MAC-B
  Note over A: guarda IP e MAC na tabela ARP
  A->>B: quadro IP com MAC-B de destino
\`\`\`

*Esquema 2 (resolução de um endereço).* A pergunta é um **broadcast**, e a resposta é **unicast** direto ao solicitante. O resultado fica na **tabela ARP** (cache) por um tempo, para não perguntar de novo a cada pacote.

O algoritmo da RFC 826 tem uma particularidade: ao receber qualquer pacote ARP, o host **atualiza** a entrada do remetente, se ela já existir, antes mesmo de olhar o código da operação. Só adiciona uma entrada nova se o pacote for dirigido a ele. Isso economiza mensagens, mas é a raiz do problema de confiança descrito mais abaixo.

### O pacote ARP

O pacote ARP tem **28 bytes** quando resolve endereços IPv4 em uma rede Ethernet ([RFC 826](https://www.rfc-editor.org/rfc/rfc826)). O desenho mostra os campos em linhas de 32 bits, na ordem de transmissão.

\`\`\`mermaid
packet-beta
  0-15: "Tipo de hardware (1)"
  16-31: "Tipo de protocolo (0x0800)"
  32-39: "HLEN (6)"
  40-47: "PLEN (4)"
  48-63: "Operação (1 ou 2)"
  64-111: "MAC do remetente (SHA)"
  112-143: "IP do remetente (SPA)"
  144-191: "MAC do alvo (THA)"
  192-223: "IP do alvo (TPA)"
\`\`\`

*Esquema 3 (o pacote ARP).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. Os endereços de hardware (48 bits) atravessam linhas, e os de protocolo (IPv4) ocupam 32 bits. A tabela abaixo descreve todos os campos, em ordem.

| Campo | Posição (bits) | Tamanho | Valor no Ethernet com IPv4 |
| --- | --- | --- | --- |
| Tipo de hardware (HTYPE) | 0 a 15 | 16 bits | 1 (Ethernet) |
| Tipo de protocolo (PTYPE) | 16 a 31 | 16 bits | 0x0800 (IPv4) |
| Tamanho do endereço de hardware (HLEN) | 32 a 39 | 8 bits | 6 |
| Tamanho do endereço de protocolo (PLEN) | 40 a 47 | 8 bits | 4 |
| Operação (OPER) | 48 a 63 | 16 bits | 1 (pedido) ou 2 (resposta) |
| MAC do remetente (SHA) | 64 a 111 | 48 bits | quem envia |
| IP do remetente (SPA) | 112 a 143 | 32 bits | quem envia |
| MAC do alvo (THA) | 144 a 191 | 48 bits | zeros no pedido; MAC de quem perguntou na resposta |
| IP do alvo (TPA) | 192 a 223 | 32 bits | o IP que se procura |

No pedido do Host A (192.168.1.10) pelo Host B (192.168.1.20), o SHA é 00:00:5e:00:53:0a, o SPA é 192.168.1.10, o THA é 00:00:00:00:00:00 e o TPA é 192.168.1.20. Na resposta, o Host B envia o próprio MAC (00:00:5e:00:53:14) no SHA e o IP dele no SPA, e o MAC e o IP do Host A vão no THA e no TPA.

### O pacote dentro do quadro Ethernet

O ARP não usa o IP: o pacote vai **direto no quadro Ethernet**, com o tipo 0x0806. Por isso o ARP é um protocolo de enlace que não passa por roteadores.

\`\`\`mermaid
packet-beta
  0-47: "MAC de destino (ff:ff:ff:ff:ff:ff no pedido)"
  48-95: "MAC de origem"
  96-111: "Tipo 0x0806"
  112-335: "Pacote ARP (28 bytes)"
  336-479: "Preenchimento (18 bytes)"
  480-511: "FCS"
\`\`\`

*Esquema 4 (o quadro Ethernet que carrega o ARP).* O cabeçalho Ethernet tem 14 bytes (destino, origem e tipo). O pedido vai ao endereço de broadcast, e a resposta vai ao MAC de quem perguntou. A carga útil mínima do Ethernet é de 46 bytes (IEEE 802.3), então os 28 bytes do ARP recebem **18 bytes de preenchimento**. Com os 4 bytes do FCS (*Frame Check Sequence*), o quadro tem 64 bytes. A placa de rede costuma acrescentar o preenchimento e o FCS, e por isso eles não aparecem em uma captura comum.

### A tabela ARP e os estados das entradas

Para não perguntar a cada pacote, o host guarda o resultado na **tabela ARP** (cache), com validade limitada ([RFC 1122](https://www.rfc-editor.org/rfc/rfc1122), seção 2.3.2.1). No Linux, ela é vista com \`ip neigh\`, e cada entrada tem um estado.

\`\`\`mermaid
stateDiagram-v2
  [*] --> INCOMPLETE: precisa do MAC, envia o pedido
  INCOMPLETE --> REACHABLE: recebe o ARP Reply
  INCOMPLETE --> FAILED: sem resposta depois das tentativas
  REACHABLE --> STALE: a validade vence
  STALE --> REACHABLE: confirmada por nova resposta
  FAILED --> INCOMPLETE: nova tentativa de envio
\`\`\`

*Esquema 5 (estados de uma entrada ARP no Linux).* O kernel do Linux tem ainda os estados intermediários DELAY e PROBE entre STALE e REACHABLE, e as entradas PERMANENT (estáticas); o diagrama os omite para mostrar só os estados que o simulador exibe. A entrada STALE continua sendo usada e é confirmada com uma nova consulta quando há tráfego. Os tempos variam entre sistemas: no Linux, a validade é de algumas dezenas de segundos, e em roteadores costuma ser de horas.

| Estado | Significado |
| --- | --- |
| INCOMPLETE | o pedido foi enviado, e a resposta ainda não chegou |
| REACHABLE | o vizinho respondeu há pouco, e a entrada é confiável |
| STALE | a validade passou; a entrada ainda é usada, mas será confirmada |
| FAILED | não houve resposta depois das tentativas |

### Fora da sub-rede e proxy ARP

O broadcast do ARP **não atravessa roteadores**. Para um destino em outra rede, o host faz o ARP do **gateway**, e o quadro leva o MAC do gateway com o IP do destino final. No **proxy ARP** ([RFC 1027](https://www.rfc-editor.org/rfc/rfc1027)), o roteador responde ao pedido de um endereço de outra rede usando o próprio MAC. Isso permite a hosts sem gateway configurado alcançar outras redes, mas esconde erros de máscara e de rota.

### ARP gratuito, probe e conflito de endereço

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant N as Host novo
  participant R as Rede local
  participant D as Dono atual do IP
  N->>R: ARP Probe, IP de origem 0.0.0.0, pergunta pelo IP desejado
  alt ninguém responde
    N->>R: ARP Announcement, origem e alvo iguais ao IP
    Note over N,R: o endereço passa a ser usado
  else alguém responde
    D->>N: ARP Reply
    Note over N: conflito: o endereço não deve ser usado
  end
\`\`\`

*Esquema 6 (detecção de conflito).* Segundo a RFC 5227, antes de usar um endereço o host envia **3 sondas** (*probes*) espaçadas de 1 a 2 segundos, com o IP de origem zerado para não contaminar o cache dos outros (seção 2.1.1). Se ninguém reclamar, envia **2 anúncios** com intervalo de 2 segundos (seção 2.3). Depois, continua a vigiar conflitos e defende o endereço (seção 2.4).

O anúncio é feito com um **pedido** (e não com uma resposta), e serve para atualizar os caches dos vizinhos quando um endereço muda de MAC, como acontece na troca de um equipamento ou em um failover de gateway.

### O limite de confiança: o ARP não autentica

O ARP não tem nenhuma forma de verificar quem responde. Qualquer host do enlace pode enviar uma resposta dizendo que um IP está em seu MAC, e os outros hosts a aceitam. É um limite do projeto original, e não um defeito de implementação.

\`\`\`mermaid
flowchart TD
  F["Resposta ARP falsa:<br/>o IP do gateway estaria no MAC de outro host"] --> C["Cache dos vizinhos é atualizado"]
  C --> E["O tráfego para o gateway passa<br/>a ser enviado a esse host"]
  E --> D["Defesas na camada 2"]
  D --> D1["Inspeção dinâmica de ARP<br/>no switch: valida contra a tabela do DHCP"]
  D --> D2["Entradas estáticas para<br/>o gateway em máquinas críticas"]
  D --> D3["Segurança de portas e<br/>segmentação em VLANs"]
  D --> D4["Monitoramento de mudanças<br/>de MAC para um mesmo IP"]
\`\`\`

*Esquema 7 (limite de confiança e defesas).* O diagrama mostra o efeito e as defesas, no nível defensivo. O simulador mostra, no modo **Envenenamento de cache**, como a tabela de um host muda depois de uma resposta não solicitada, e como uma proteção na rede impede essa mudança.

### O que cada modo e aba do simulador mostram

- **Topologia:** hosts, um switch e o gateway, na mesma rede local. O ARP é enviado a todas as portas do switch, e a resposta segue só pelo caminho do solicitante.
- **Diagrama de sequência:** as setas são os pacotes ARP, e o quadro de dados só aparece depois da resolução.
- **Aba Tabela ARP:** mostra o cache de cada host no instante atual, no formato do \`ip neigh\` do Linux, com o estado de cada entrada (INCOMPLETE, REACHABLE, STALE ou FAILED).
- **Modos:** *Resolução*, *ARP gratuito e conflito* e *Envenenamento de cache*.

Para treinar a resolução, use o modo **Resolução** e varie o destino (mesma rede, gateway e proxy ARP). Para treinar o conflito de endereço, use o modo **ARP gratuito e conflito**. Para ver o efeito de uma resposta forjada e das defesas, use o modo **Envenenamento de cache**.

### Limites do modelo e do diagrama

- A RFC 826 não tem seções numeradas, então as citações se referem aos títulos ("Packet Reception"). A RFC 5227 tem seções numeradas, e elas são citadas.
- O simulador trata de **IPv4 sobre Ethernet**. O IPv6 usa outro mecanismo, o *Neighbor Discovery* (RFC 4861), no lugar do ARP.
- Os tempos de validade do cache e os atrasos são **didáticos**: cada sistema operacional usa os seus próprios valores.
`;
