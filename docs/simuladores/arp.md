# ARP

Resolução de endereços na rede local: requisição em broadcast e resposta unicast, tabela ARP e seus estados, destino remoto via gateway, proxy ARP, ARP gratuito, detecção e defesa de endereço duplicado, failover de IP e o envenenamento de cache com as defesas.

- **Categoria:** Roteamento e serviços de rede
- **Motor:** nativo (TypeScript puro, apresentado pela bancada genérica)
- **Código-fonte:** `src/sims/arp/`
- **RFCs e padrões:** [RFC 826](https://www.rfc-editor.org/rfc/rfc826) (ARP), [RFC 1027](https://www.rfc-editor.org/rfc/rfc1027) (Proxy ARP), [RFC 1122](https://www.rfc-editor.org/rfc/rfc1122) (Requisitos de hosts), [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227) (Conflito de endereço)
- **Tópicos:** Requisição e resposta; Pacote ARP e quadro Ethernet; Tabela ARP (REACHABLE, STALE, FAILED); Gateway e proxy ARP; ARP Probe e Announce; Conflito de endereço e failover; Envenenamento de cache e defesas (DAI, entradas estáticas)

## 1. Modos

| Modo | Cenário inicial | Cenários |
| --- | --- | --- |
| Resolução | Primeira resolução | 7.1.1 a 7.1.9 |
| ARP gratuito e conflito | Endereço novo: Probe e Announce | 7.2.1 a 7.2.7 |
| Envenenamento de cache | Sem ataque (referência) | 7.3.1 a 7.3.7 |

## 2. Fundamentação

### 2.1 O problema que o ARP resolve

Em uma rede local, o quadro Ethernet precisa do **endereço MAC** do destino, mas a aplicação só conhece o **endereço IP**. O ARP (*Address Resolution Protocol*, [RFC 826](https://www.rfc-editor.org/rfc/rfc826)) responde à pergunta "quem tem este IP? me diga o seu MAC". Ele fica entre a camada 2 e a camada 3 e vale **só dentro de um enlace**: um ARP nunca atravessa um roteador.

Para falar com um destino de **outra** rede, o host não resolve o MAC do destino final: resolve o MAC do **gateway** (veja o simulador de IPv4 para a decisão entre entrega direta e gateway).

**O que você aprende com este simulador.**

- Explicar por que o IP precisa do MAC e como o ARP faz a ligação entre os dois, só dentro de um enlace.
- Ler o pacote ARP campo a campo e saber como ele viaja dentro de um quadro Ethernet.
- Interpretar a tabela ARP e os estados das entradas (INCOMPLETE, REACHABLE, STALE e FAILED).
- Entender o ARP gratuito, o *probe* e a detecção de endereço duplicado.
- Reconhecer por que o ARP não autentica e quais defesas existem na rede local.


### 2.2 Quando o host usa o ARP

```mermaid
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
```

*Esquema 1 (quando o ARP entra em ação).* O ARP resolve sempre o MAC do **próximo salto**, que é o destino (na mesma sub-rede) ou o gateway (em outra rede). A decisão entre os dois é a do host IPv4 (veja o simulador de IPv4). O host guarda o pacote durante a resolução e só consulta a rede se a tabela não tiver a entrada ([RFC 1122](https://www.rfc-editor.org/rfc/rfc1122), seções 2.3.2.1 e 2.3.2.2).

### 2.3 O diagrama da resolução

```mermaid
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
```

*Esquema 2 (resolução de um endereço).* A pergunta é um **broadcast**, e a resposta é **unicast** direto ao solicitante. O resultado fica na **tabela ARP** (cache) por um tempo, para não perguntar de novo a cada pacote.

O algoritmo da [RFC 826](https://www.rfc-editor.org/rfc/rfc826) tem uma particularidade: ao receber qualquer pacote ARP, o host **atualiza** a entrada do remetente, se ela já existir, antes mesmo de olhar o código da operação. Só adiciona uma entrada nova se o pacote for dirigido a ele. Isso economiza mensagens, mas é a raiz do problema de confiança descrito mais abaixo.

### 2.4 O pacote ARP

O pacote ARP tem **28 bytes** quando resolve endereços IPv4 em uma rede Ethernet ([RFC 826](https://www.rfc-editor.org/rfc/rfc826)). O desenho mostra os campos em linhas de 32 bits, na ordem de transmissão.

```mermaid
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
```

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

### 2.5 O pacote dentro do quadro Ethernet

O ARP não usa o IP: o pacote vai **direto no quadro Ethernet**, com o tipo 0x0806. Por isso o ARP é um protocolo de enlace que não passa por roteadores.

```mermaid
packet-beta
  0-47: "MAC de destino (ff:ff:ff:ff:ff:ff no pedido)"
  48-95: "MAC de origem"
  96-111: "Tipo 0x0806"
  112-335: "Pacote ARP (28 bytes)"
  336-479: "Preenchimento (18 bytes)"
  480-511: "FCS"
```

*Esquema 4 (o quadro Ethernet que carrega o ARP).* O cabeçalho Ethernet tem 14 bytes (destino, origem e tipo). O pedido vai ao endereço de broadcast, e a resposta vai ao MAC de quem perguntou. A carga útil mínima do Ethernet é de 46 bytes (IEEE 802.3), então os 28 bytes do ARP recebem **18 bytes de preenchimento**. Com os 4 bytes do FCS (*Frame Check Sequence*), o quadro tem 64 bytes. A placa de rede costuma acrescentar o preenchimento e o FCS, e por isso eles não aparecem em uma captura comum.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| MAC de destino | 0 a 47 | 6 bytes | ff:ff:ff:ff:ff:ff no pedido (broadcast); o MAC de quem perguntou na resposta |
| MAC de origem | 48 a 95 | 6 bytes | MAC de quem envia o quadro |
| Tipo | 96 a 111 | 2 bytes | 0x0806, que indica ARP na carga |
| Pacote ARP | 112 a 335 | 28 bytes | os campos do esquema 3 |
| Preenchimento | 336 a 479 | 18 bytes | zeros que completam os 46 bytes mínimos da carga do Ethernet |
| FCS | 480 a 511 | 4 bytes | verificação do quadro, um CRC de 32 bits |

### 2.6 A tabela ARP e os estados das entradas

Para não perguntar a cada pacote, o host guarda o resultado na **tabela ARP** (cache), com validade limitada ([RFC 1122](https://www.rfc-editor.org/rfc/rfc1122), seção 2.3.2.1). No Linux, ela é vista com `ip neigh`, e cada entrada tem um estado.

```mermaid
stateDiagram-v2
  [*] --> INCOMPLETE: precisa do MAC, envia o pedido
  INCOMPLETE --> REACHABLE: recebe o ARP Reply
  INCOMPLETE --> FAILED: sem resposta depois das tentativas
  REACHABLE --> STALE: a validade vence
  STALE --> REACHABLE: confirmada por nova resposta
  FAILED --> INCOMPLETE: nova tentativa de envio
```

*Esquema 5 (estados de uma entrada ARP no Linux).* O kernel do Linux tem ainda os estados intermediários DELAY e PROBE entre STALE e REACHABLE, e as entradas PERMANENT (estáticas); o diagrama os omite para mostrar só os estados que o simulador exibe. A entrada STALE continua sendo usada e é confirmada com uma nova consulta quando há tráfego. Os tempos variam entre sistemas: no Linux, a validade é de algumas dezenas de segundos, e em roteadores costuma ser de horas.

| Estado | Significado |
| --- | --- |
| INCOMPLETE | o pedido foi enviado, e a resposta ainda não chegou |
| REACHABLE | o vizinho respondeu há pouco, e a entrada é confiável |
| STALE | a validade passou; a entrada ainda é usada, mas será confirmada |
| FAILED | não houve resposta depois das tentativas |

### 2.7 Fora da sub-rede e proxy ARP

O broadcast do ARP **não atravessa roteadores**. Para um destino em outra rede, o host faz o ARP do **gateway**, e o quadro leva o MAC do gateway com o IP do destino final. No **proxy ARP** ([RFC 1027](https://www.rfc-editor.org/rfc/rfc1027)), o roteador responde ao pedido de um endereço de outra rede usando o próprio MAC. Isso permite a hosts sem gateway configurado alcançar outras redes, mas esconde erros de máscara e de rota.

### 2.8 ARP gratuito, probe e conflito de endereço

```mermaid
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
```

*Esquema 6 (detecção de conflito).* Segundo a [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227), antes de usar um endereço o host envia **3 sondas** (*probes*) espaçadas de 1 a 2 segundos, com o IP de origem zerado para não contaminar o cache dos outros (seção 2.1.1). Se ninguém reclamar, envia **2 anúncios** com intervalo de 2 segundos (seção 2.3). Depois, continua a vigiar conflitos e defende o endereço (seção 2.4).

O anúncio é feito com um **pedido** (e não com uma resposta), e serve para atualizar os caches dos vizinhos quando um endereço muda de MAC, como acontece na troca de um equipamento ou em um failover de gateway.

### 2.9 O limite de confiança: o ARP não autentica

O ARP não tem nenhuma forma de verificar quem responde. Qualquer host do enlace pode enviar uma resposta dizendo que um IP está em seu MAC, e os outros hosts a aceitam. É um limite do projeto original, e não um defeito de implementação.

```mermaid
flowchart TD
  F["Resposta ARP falsa:<br/>o IP do gateway estaria no MAC de outro host"] --> C["Cache dos vizinhos é atualizado"]
  C --> E["O tráfego para o gateway passa<br/>a ser enviado a esse host"]
  E --> D["Defesas na camada 2"]
  D --> D1["Inspeção dinâmica de ARP<br/>no switch: valida contra a tabela do DHCP"]
  D --> D2["Entradas estáticas para<br/>o gateway em máquinas críticas"]
  D --> D3["Segurança de portas e<br/>segmentação em VLANs"]
  D --> D4["Monitoramento de mudanças<br/>de MAC para um mesmo IP"]
```

*Esquema 7 (limite de confiança e defesas).* O diagrama mostra o efeito e as defesas, no nível defensivo. O simulador mostra, no modo **Envenenamento de cache**, como a tabela de um host muda depois de uma resposta não solicitada, e como uma proteção na rede impede essa mudança.

### 2.10 O que cada modo e aba do simulador mostram

- **Topologia:** hosts, um switch e o gateway, na mesma rede local. O ARP é enviado a todas as portas do switch, e a resposta segue só pelo caminho do solicitante.
- **Diagrama de sequência:** as setas são os pacotes ARP, e o quadro de dados só aparece depois da resolução.
- **Aba Tabela ARP:** mostra o cache de cada host no instante atual, no formato do `ip neigh` do Linux, com o estado de cada entrada (INCOMPLETE, REACHABLE, STALE ou FAILED).
- **Modos:** *Resolução*, *ARP gratuito e conflito* e *Envenenamento de cache*.

Para treinar a resolução, use o modo **Resolução** e varie o destino (mesma rede, gateway e proxy ARP). Para treinar o conflito de endereço, use o modo **ARP gratuito e conflito**. Para ver o efeito de uma resposta forjada e das defesas, use o modo **Envenenamento de cache**.

### 2.11 Limites do modelo e do diagrama

- A [RFC 826](https://www.rfc-editor.org/rfc/rfc826) não tem seções numeradas, então as citações se referem aos títulos ("Packet Reception"). A [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227) tem seções numeradas, e elas são citadas.
- O simulador trata de **IPv4 sobre Ethernet**. O IPv6 usa outro mecanismo, o *Neighbor Discovery* ([RFC 4861](https://www.rfc-editor.org/rfc/rfc4861)), no lugar do ARP.
- Os tempos de validade do cache e os atrasos são **didáticos**: cada sistema operacional usa os seus próprios valores.

## 3. Como ler os diagramas

Este documento usa até dois tipos de diagrama. Cada figura traz uma legenda com o tipo, o que mostra e a que modo ou cenário se refere.

| Tipo | O que é | Vale para | Equivale, no simulador, a |
| --- | --- | --- | --- |
| A, topologia | Os elementos da rede e os enlaces que os ligam. É estático. | Um modo inteiro | A visão "Topologia" do painel principal |
| B, sequência | As mensagens na ordem do tempo, entre os participantes. É dinâmico. | Um único cenário, com a configuração indicada | Ao diagrama de sequência e à aba Captura |

### 3.1 Legenda dos diagramas

**Tipo A (topologia)**

- Retângulo: host (computador ou servidor final).
- Hexágono: switch.
- Retângulo arredondado: roteador, ou dispositivo que encaminha ou traduz.
- Estádio (cantos bem arredondados): servidor ou rede externa.
- Retângulo vermelho: atacante (quando existe no modo).
- Linha contínua: enlace. Linha tracejada: enlace alternativo, forjado ou caído, ou ainda relação de peering (no BGP), conforme o rótulo e o cenário.
- O Mermaid posiciona os elementos automaticamente: o layout difere do simulador, as ligações não.

**Tipo B (sequência)**

- Cada coluna é um participante (cliente, servidor, roteador ou outro). O tempo corre de cima para baixo.
- Seta cheia: mensagem enviada. Seta com X: mensagem perdida.
- `[cifrado]` no início do rótulo: a mensagem viaja cifrada.
- Faixa horizontal com texto: início de uma fase do cenário.
- A ordem é a da aba Captura; os intervalos de tempo não são desenhados em escala.

### 3.2 Lista de figuras

**Tipo A (topologia)**

- [Figura 4.1](#41-resolução): topologia do modo "Resolução"
- [Figura 4.2a](#42-arp-gratuito-e-conflito): topologia do modo "ARP gratuito e conflito", variante a
- [Figura 4.2b](#42-arp-gratuito-e-conflito): topologia do modo "ARP gratuito e conflito", variante b
- [Figura 4.2c](#42-arp-gratuito-e-conflito): topologia do modo "ARP gratuito e conflito", variante c
- [Figura 4.2d](#42-arp-gratuito-e-conflito): topologia do modo "ARP gratuito e conflito", variante d
- [Figura 4.3](#43-envenenamento-de-cache): topologia do modo "Envenenamento de cache"

**Tipo B (sequência)**

- [Figura 7.1.1](#711-primeira-resolução): sequência de "Primeira resolução"
- [Figura 7.1.2](#712-entrada-já-em-cache): sequência de "Entrada já em cache"
- [Figura 7.1.3](#713-entrada-antiga-revalidação): sequência de "Entrada antiga (revalidação)"
- [Figura 7.1.4](#714-destino-remoto-via-gateway): sequência de "Destino remoto via gateway"
- [Figura 7.1.5](#715-proxy-arp-sem-gateway): sequência de "Proxy ARP (sem gateway)"
- [Figura 7.1.6](#716-sem-gateway-e-sem-proxy-arp): sequência de "Sem gateway e sem proxy ARP"
- [Figura 7.1.7](#717-destino-desligado): sequência de "Destino desligado"
- [Figura 7.1.8](#718-requisição-perdida-e-retransmitida): sequência de "Requisição perdida e retransmitida"
- [Figura 7.1.9](#719-entrada-recente-host-desligado): sequência de "Entrada recente, host desligado"
- [Figura 7.2.1](#721-endereço-novo-probe-e-announce): sequência de "Endereço novo: Probe e Announce"
- [Figura 7.2.2](#722-anúncio-sem-entradas-antigas): sequência de "Anúncio sem entradas antigas"
- [Figura 7.2.3](#723-endereço-já-em-uso-probe): sequência de "Endereço já em uso (Probe)"
- [Figura 7.2.4](#724-disputa-o-recém-chegado-cede): sequência de "Disputa: o recém-chegado cede"
- [Figura 7.2.5](#725-disputa-os-dois-defendem): sequência de "Disputa: os dois defendem"
- [Figura 7.2.6](#726-failover-com-arp-gratuito): sequência de "Failover com ARP gratuito"
- [Figura 7.2.7](#727-failover-sem-arp-gratuito): sequência de "Failover sem ARP gratuito"
- [Figura 7.3.1](#731-sem-ataque-referência): sequência de "Sem ataque (referência)"
- [Figura 7.3.2](#732-cache-envenenado-http): sequência de "Cache envenenado (HTTP)"
- [Figura 7.3.3](#733-só-a-vítima-é-enganada): sequência de "Só a vítima é enganada"
- [Figura 7.3.4](#734-mesmo-desvio-tráfego-https): sequência de "Mesmo desvio, tráfego HTTPS"
- [Figura 7.3.5](#735-defesa-entradas-estáticas): sequência de "Defesa: entradas estáticas"
- [Figura 7.3.6](#736-defesa-dai-no-switch): sequência de "Defesa: DAI no switch"
- [Figura 7.3.7](#737-detecção-mac-do-gateway-mudou): sequência de "Detecção: MAC do gateway mudou"

## 4. Topologia

Figuras do Tipo A, uma por modo (e uma por variante do desenho, quando a rede muda entre cenários). Foram geradas a partir da mesma definição de topologia que a bancada usa.

### 4.1 Resolução

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.10"]
  n_sw{{"Switch<br/>camada 2"}}
  n_g("Gateway<br/>192.168.1.1")
  n_b["Host B<br/>192.168.1.20"]
  n_net(["Outras redes<br/>192.0.2.0/24"])
  n_a --- n_sw
  n_sw --- n_g
  n_sw --- n_b
  n_g --- n_net
```

*Figura 4.1 (Tipo A, topologia).* Elementos do modo "Resolução": Host A (192.168.1.10); Switch (camada 2); Gateway (192.168.1.1); Host B (192.168.1.20); Outras redes (192.0.2.0/24). Vale para todos os cenários do modo (7.1.1 a 7.1.9).

### 4.2 ARP gratuito e conflito

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.50"]
  n_sw{{"Switch<br/>camada 2"}}
  n_g("Gateway<br/>192.168.1.1")
  n_b["Host B<br/>192.168.1.20"]
  n_net(["Outras redes<br/>192.0.2.0/24"])
  n_a --- n_sw
  n_sw --- n_g
  n_sw --- n_b
  n_g --- n_net
```

*Figura 4.2a (Tipo A, topologia).* Elementos do modo "ARP gratuito e conflito": Host A (192.168.1.50); Switch (camada 2); Gateway (192.168.1.1); Host B (192.168.1.20); Outras redes (192.0.2.0/24). Vale para os cenários (7.2.1 e 7.2.2).

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.20 (pretendido)"]
  n_sw{{"Switch<br/>camada 2"}}
  n_g("Gateway<br/>192.168.1.1")
  n_b["Host B<br/>192.168.1.20"]
  n_net(["Outras redes<br/>192.0.2.0/24"])
  n_a --- n_sw
  n_sw --- n_g
  n_sw --- n_b
  n_g --- n_net
```

*Figura 4.2b (Tipo A, topologia).* Elementos do modo "ARP gratuito e conflito": Host A (192.168.1.20 (pretendido)); Switch (camada 2); Gateway (192.168.1.1); Host B (192.168.1.20); Outras redes (192.0.2.0/24). Vale para os cenários (7.2.3).

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.50"]
  n_sw{{"Switch<br/>camada 2"}}
  n_g("Gateway<br/>192.168.1.1")
  n_b["Host B<br/>192.168.1.50"]
  n_net(["Outras redes<br/>192.0.2.0/24"])
  n_a --- n_sw
  n_sw --- n_g
  n_sw --- n_b
  n_g --- n_net
```

*Figura 4.2c (Tipo A, topologia).* Elementos do modo "ARP gratuito e conflito": Host A (192.168.1.50); Switch (camada 2); Gateway (192.168.1.1); Host B (192.168.1.50); Outras redes (192.0.2.0/24). Vale para os cenários (7.2.4 e 7.2.5).

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.20 (assume)"]
  n_sw{{"Switch<br/>camada 2"}}
  n_g("Gateway<br/>192.168.1.1")
  n_b["Host B<br/>192.168.1.20"]
  n_net(["Outras redes<br/>192.0.2.0/24"])
  n_a --- n_sw
  n_sw --- n_g
  n_sw --- n_b
  n_g --- n_net
```

*Figura 4.2d (Tipo A, topologia).* Elementos do modo "ARP gratuito e conflito": Host A (192.168.1.20 (assume)); Switch (camada 2); Gateway (192.168.1.1); Host B (192.168.1.20); Outras redes (192.0.2.0/24). Vale para os cenários (7.2.6 e 7.2.7).

### 4.3 Envenenamento de cache

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.10"]
  n_sw{{"Switch<br/>camada 2"}}
  n_g("Gateway<br/>192.168.1.1")
  n_m["Host M<br/>192.168.1.66"]
  n_net(["Servidor<br/>192.0.2.50"])
  n_a --- n_sw
  n_sw --- n_g
  n_sw --- n_m
  n_g --- n_net
  classDef atacante fill:#fde2e2,stroke:#b42318,color:#111
  class n_m atacante
```

*Figura 4.3 (Tipo A, topologia).* Elementos do modo "Envenenamento de cache": Host A (192.168.1.10); Switch (camada 2); Gateway (192.168.1.1); Host M (192.168.1.66); Servidor (192.0.2.50). Vale para todos os cenários do modo (7.3.1 a 7.3.7).

## 5. Abas da bancada

Cenário, Captura, Mensagem, Tabela ARP, Experimento, Referência e Log.

## 6. Configurações (campos do painel)

### 6.1 Rede

- **RTT (ms)**. Valores: 1; 2; 5; 20; 100. Padrão: 2. Modos: todos.
  - Tempo de ida e volta na rede local.
  - Numa rede local Ethernet o RTT costuma ser de poucos milissegundos. Valores altos servem para ver o diagrama mais espaçado.
  - Não muda o que o ARP faz, só os tempos mostrados.

### 6.2 Destino

- **Para onde o host A envia**. Valores: Host B (mesma sub-rede); Destino remoto, via gateway; Destino remoto, sem gateway (máscara errada). Padrão: Host B (mesma sub-rede). Modos: Resolução.
  - Define por qual IP o ARP vai perguntar.
  - **Mesma sub-rede:** o ARP pergunta pelo IP do próprio destino.
  - **Destino remoto via gateway:** o ARP pergunta pelo IP do **gateway**, nunca pelo IP remoto. O frame vai ao MAC do gateway, e o IP de destino continua o remoto.
  - **Sem gateway:** a máscara errada faz o host achar que o destino remoto é local e perguntar por ele. Só um roteador com proxy ARP responde.

### 6.3 Tabela ARP do host A

- **Estado inicial da entrada**. Valores: Sem entrada (primeira vez); Entrada recente (REACHABLE); Entrada antiga (STALE). Padrão: Sem entrada (primeira vez). Modos: Resolução.
  - O que o host A já sabe antes do ping.
  - **Sem entrada:** o host cria uma entrada INCOMPLETE e envia a requisição em broadcast.
  - **Recente:** acerto na tabela, nenhuma mensagem ARP.
  - **Antiga (STALE):** o host ainda usa o endereço, mas o confirma com uma requisição unicast.

### 6.4 Falhas

- **O próximo salto está ligado**. Valores: caixa de seleção. Padrão: sim. Modos: Resolução.
  - Vizinho (host B) ou gateway, conforme o destino.
  - Desmarcado, ninguém responde à requisição ARP: depois de 3 tentativas, 1 s entre elas, a entrada vira FAILED e o sistema informa "Destination Host Unreachable".
  - Com uma entrada recente na tabela, o ARP nem é consultado, e o ping falha sem resposta.
- **Proxy ARP ligado no gateway**. Valores: caixa de seleção. Padrão: não. Modos: Resolução.
  - O roteador responde no lugar de hosts de outras redes ([RFC 1027](https://www.rfc-editor.org/rfc/rfc1027)).
  - Só importa no destino remoto sem gateway. Ligado, o roteador responde ao ARP com o próprio MAC e encaminha o tráfego. Desligado, ninguém responde.
  - É um recurso de compatibilidade: esconde erros de configuração e aumenta a tabela ARP.
- **A primeira requisição se perde**. Valores: caixa de seleção. Padrão: não. Modos: Resolução.
  - Simula uma perda na rede local.
  - Se não há resposta em cerca de 1 s, o sistema retransmite a requisição. O ping demora mais, mas funciona.

### 6.5 Situação

- **O que acontece**. Valores: Endereço novo: verificação e anúncio; Endereço já em uso por outro host; Dois hosts com o mesmo endereço; Failover: o reserva assume o IP. Padrão: Endereço novo: verificação e anúncio. Modos: ARP gratuito e conflito.
  - Qual das quatro histórias do ARP gratuito será simulada.
  - **Endereço novo:** o host faz 3 Probes e 2 Announces antes de usar o endereço.
  - **Já em uso:** o dono responde ao Probe e o host desiste.
  - **Mesmo endereço:** o dono defende o endereço e a disputa se resolve (ou não).
  - **Failover:** o reserva assume o IP do principal que caiu.

### 6.6 Tabelas

- **Os vizinhos guardam um MAC antigo do endereço**. Valores: caixa de seleção. Padrão: sim. Modos: ARP gratuito e conflito.
  - Vale para o endereço novo.
  - Marcado, o gateway e o host B ainda têm uma entrada com o MAC de um dono anterior do IP, e o Announce a atualiza.
  - Desmarcado, ninguém tinha entrada e o Announce não muda nenhuma tabela.

### 6.7 Disputa

- **O host recém-chegado cede ao conflito**. Valores: caixa de seleção. Padrão: sim. Modos: ARP gratuito e conflito.
  - Vale para a disputa de endereço.
  - Marcado, o host B abandona o endereço assim que o dono o defende.
  - Desmarcado, B também defende. A recebe um segundo conflito em menos de 10 s e abandona o endereço ([RFC 5227](https://www.rfc-editor.org/rfc/rfc5227)).

### 6.8 Failover

- **Enviar ARP gratuito ao assumir o IP**. Valores: caixa de seleção. Padrão: sim. Modos: ARP gratuito e conflito.
  - Vale para o failover.
  - Marcado, o novo dono avisa a rede e o gateway atualiza a tabela na hora.
  - Desmarcado, o gateway continua enviando ao MAC do host que caiu até a entrada expirar e ser revalidada.

### 6.9 Cenário

- **Há um host malicioso na rede local**. Valores: caixa de seleção. Padrão: sim. Modos: Envenenamento de cache.
  - Liga ou desliga o ataque, para comparar com a situação normal.
  - O ataque só funciona dentro da mesma rede local (o mesmo domínio de broadcast): o ARP não atravessa roteadores.
- **Os dois lados são enganados (vítima e gateway)**. Valores: caixa de seleção. Padrão: sim. Modos: Envenenamento de cache.
  - Quem recebe respostas forjadas.
  - Marcado, o host A e o gateway são enganados: o tráfego passa pelo host M nos dois sentidos.
  - Desmarcado, só A é enganado: M vê o que A envia, mas a resposta do servidor volta direto para A.

### 6.10 Tráfego

- **Tráfego da vítima**. Valores: HTTP (texto puro); HTTPS (TLS, cifrado). Padrão: HTTP (texto puro). Modos: Envenenamento de cache.
  - O que A envia ao servidor.
  - **HTTP:** quem fica no meio do caminho lê o conteúdo, inclusive cookies de sessão.
  - **HTTPS:** o conteúdo está cifrado entre as pontas. O desvio continua acontecendo, mas M vê só tamanhos e momentos dos registros.

### 6.11 Defesa

- **Defesa na rede local**. Valores: Nenhuma; Entradas ARP estáticas (host e gateway); DAI no switch (com DHCP snooping); Monitoramento da tabela ARP (só alerta). Padrão: Nenhuma. Modos: Envenenamento de cache.
  - Como a rede reage às respostas forjadas.
  - **Entradas estáticas:** a tabela não aceita alteração, mas é trabalhosa de manter em muitos hosts.
  - **DAI (Dynamic ARP Inspection):** o switch descarta respostas ARP cujo par IP e MAC não confere com a tabela do DHCP snooping.
  - **Monitoramento:** detecta a mudança de MAC e alerta, mas não impede o desvio.

## 7. Cenários

### 7.1 Modo: Resolução

> **Grupo:** Resolução básica

O ARP traduz um endereço IP no endereço físico (MAC) do mesmo segmento. A tabela ARP guarda o resultado para que a pergunta não se repita a cada pacote.

#### 7.1.1 Primeira resolução

*Pergunta em broadcast, resposta unicast.*

**Configuração aplicada:** Para onde o host A envia = local; Estado inicial da entrada = empty; O próximo salto está ligado = sim; Proxy ARP ligado no gateway = não; A primeira requisição se perde = não

O host A quer fazer um ping no host B, na mesma rede, e **não tem o endereço físico** de B. Ele pergunta a todos (broadcast) e B responde só para A.

**Conceito.** O host A não tem o MAC de B. Ele envia uma requisição para o endereço de broadcast (ff:ff:ff:ff:ff:ff): todos recebem, mas só o dono do IP perguntado responde, e responde diretamente a A.

**O que observar**

- A requisição vai para ff:ff:ff:ff:ff:ff e o campo do MAC do alvo vai zerado.
- O gateway também recebe a pergunta e a descarta.
- B guarda o MAC de A ao receber a requisição, por isso o Echo Reply não precisa de outra consulta.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 2. Requisição em broadcast e resposta
  n_a ->> n_g: ARP Request
  n_a ->> n_b: ARP Request
  n_b ->> n_a: ARP Reply
  Note over n_a,n_g: 3. Envio do pacote IP
  n_a ->> n_b: Echo Request
  n_b ->> n_a: Echo Reply
```

*Figura 7.1.1 (Tipo B, sequência).* Mensagens do cenário "Primeira resolução", na ordem do tempo, entre Host A, Host B, Gateway: 5 mensagens, numeradas de 1 a 5 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | quem tem 192.168.1.20? | A para todos |
| ARP Reply | 192.168.1.20 está em 00:00:5e:00:53:14 | B para A |
| Echo Request e Reply | o ping que motivou a consulta | A e B |

**Por que importa.** É o caso mais comum: todo primeiro contato numa rede local passa por aqui, e o resultado fica guardado na tabela ARP.

#### 7.1.2 Entrada já em cache

*Acerto na tabela: nenhum ARP.*

**Configuração aplicada:** Para onde o host A envia = local; Estado inicial da entrada = fresh; O próximo salto está ligado = sim; Proxy ARP ligado no gateway = não; A primeira requisição se perde = não

A tabela ARP de A já tem o endereço de B. **Nenhuma mensagem ARP** é enviada: o ping sai direto.

**Conceito.** Enquanto a entrada é válida, o host usa o MAC guardado. O ARP é consultado só quando a tabela não tem a resposta.

**O que observar**

- Não há mensagem ARP no diagrama.
- O primeiro frame é o próprio Echo Request.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 3. Envio do pacote IP
  n_a ->> n_b: Echo Request
  n_b ->> n_a: Echo Reply
```

*Figura 7.1.2 (Tipo B, sequência).* Mensagens do cenário "Entrada já em cache", na ordem do tempo, entre Host A, Host B, Gateway: 2 mensagens, numeradas de 1 a 2 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request e Reply | ping direto | A e B |

**Por que importa.** A tabela ARP evita uma pergunta por pacote. É também o que torna o envenenamento da tabela tão eficaz: o host confia no que já guardou.

#### 7.1.3 Entrada antiga (revalidação)

*A entrada antiga é confirmada por unicast.*

**Configuração aplicada:** Para onde o host A envia = local; Estado inicial da entrada = stale; O próximo salto está ligado = sim; Proxy ARP ligado no gateway = não; A primeira requisição se perde = não

A entrada de B está **STALE**: o host ainda a usa, mas a confirma perguntando **diretamente a B** (unicast), sem incomodar a rede toda.

**Conceito.** Uma entrada que passou do tempo de validade fica STALE. O host continua a usá-la, mas confirma em segundo plano com uma requisição unicast, direta ao dono do endereço, sem fazer broadcast.

**O que observar**

- A requisição vai para o MAC de B, e não para ff:ff:ff:ff:ff:ff.
- A resposta devolve a entrada a REACHABLE.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 2. Revalidação da entrada (unicast)
  n_a ->> n_b: ARP Request (unicast)
  n_b ->> n_a: ARP Reply
  Note over n_a,n_g: 3. Envio do pacote IP
  n_a ->> n_b: Echo Request
  n_b ->> n_a: Echo Reply
```

*Figura 7.1.3 (Tipo B, sequência).* Mensagens do cenário "Entrada antiga (revalidação)", na ordem do tempo, entre Host A, Host B, Gateway: 4 mensagens, numeradas de 1 a 4 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request (unicast) | confirma o endereço conhecido | A para B |
| ARP Reply | confirma | B para A |

**Por que importa.** A confirmação unicast mantém a tabela correta sem sobrecarregar a rede com broadcasts.

> **Grupo:** Fora da sub-rede

O ARP só vale dentro da rede local. Para chegar a outra rede, o host resolve o endereço físico do gateway, e não o do destino remoto.

#### 7.1.4 Destino remoto via gateway

*O ARP pergunta pelo gateway, não pelo destino remoto.*

**Configuração aplicada:** Para onde o host A envia = gateway; Estado inicial da entrada = empty; O próximo salto está ligado = sim; Proxy ARP ligado no gateway = não; A primeira requisição se perde = não

O destino está em outra rede. O host A **não pergunta pelo IP remoto**: pergunta pelo IP do gateway e envia o frame ao MAC dele.

**Conceito.** O broadcast não atravessa roteadores. Para uma rede diferente, o host envia o frame ao gateway: o MAC de destino é o do gateway, e o IP de destino continua sendo o remoto.

**O que observar**

- O Who has pergunta por 192.168.1.1, e não por 192.0.2.50.
- No Echo Request, o MAC de destino é o do gateway e o IP de destino é o remoto.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 2. Requisição em broadcast e resposta
  n_a ->> n_b: ARP Request
  n_a ->> n_g: ARP Request
  n_g ->> n_a: ARP Reply
  Note over n_a,n_g: 3. Envio do pacote IP
  n_a ->> n_g: Echo Request
  n_g ->> n_a: Echo Reply
```

*Figura 7.1.4 (Tipo B, sequência).* Mensagens do cenário "Destino remoto via gateway", na ordem do tempo, entre Host A, Host B, Gateway: 5 mensagens, numeradas de 1 a 5 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | quem tem 192.168.1.1 (o gateway)? | A para todos |
| ARP Reply | o MAC do gateway | gateway para A |
| Echo Request | MAC do gateway, IP remoto | A para o gateway |

**Por que importa.** É o que o aluno costuma errar: o ARP nunca resolve o endereço de um host de outra rede.

#### 7.1.5 Proxy ARP (sem gateway)

*O roteador responde no lugar do destino remoto.*

**Configuração aplicada:** Para onde o host A envia = direto; Estado inicial da entrada = empty; O próximo salto está ligado = sim; Proxy ARP ligado no gateway = sim; A primeira requisição se perde = não

A máscara de A está errada e ele acha que o destino remoto é local. O roteador, com **proxy ARP**, responde com o próprio MAC e a comunicação funciona por acaso.

**Conceito.** Com a máscara errada, o host acredita que o destino está na rede local e pergunta diretamente por ele. O roteador, com proxy ARP, responde com o próprio MAC e passa a encaminhar o tráfego ([RFC 1027](https://www.rfc-editor.org/rfc/rfc1027)).

**O que observar**

- O Who has pergunta por 192.0.2.50, que não está nesta rede.
- A resposta traz o MAC do gateway, e não o do destino.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 2. Requisição em broadcast e resposta
  n_a ->> n_b: ARP Request
  n_a ->> n_g: ARP Request
  n_g ->> n_a: ARP Reply
  Note over n_a,n_g: 3. Envio do pacote IP
  n_a ->> n_g: Echo Request
  n_g ->> n_a: Echo Reply
```

*Figura 7.1.5 (Tipo B, sequência).* Mensagens do cenário "Proxy ARP (sem gateway)", na ordem do tempo, entre Host A, Host B, Gateway: 5 mensagens, numeradas de 1 a 5 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | quem tem 192.0.2.50? | A para todos |
| ARP Reply | o gateway responde com o próprio MAC | gateway para A |

**Por que importa.** O proxy ARP faz um erro de configuração parecer funcionar, o que dificulta achar o problema e aumenta a tabela ARP.

#### 7.1.6 Sem gateway e sem proxy ARP

*Ninguém responde: o ping falha.*

**Configuração aplicada:** Para onde o host A envia = direto; Estado inicial da entrada = empty; O próximo salto está ligado = sim; Proxy ARP ligado no gateway = não; A primeira requisição se perde = não

Mesma máscara errada, mas o roteador **não faz proxy ARP**. Ninguém responde e o ping falha.

**Conceito.** Sem gateway configurado e sem proxy ARP, a pergunta por um endereço de outra rede fica sem resposta. O host repete três vezes e desiste.

**O que observar**

- As três requisições seguem sem resposta.
- A entrada de A vira FAILED.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 2. Requisição em broadcast e resposta
  n_a ->> n_b: ARP Request
  n_a ->> n_g: ARP Request
  n_a ->> n_b: ARP Request
  n_a ->> n_g: ARP Request
  n_a ->> n_b: ARP Request
  n_a ->> n_g: ARP Request
```

*Figura 7.1.6 (Tipo B, sequência).* Mensagens do cenário "Sem gateway e sem proxy ARP", na ordem do tempo, entre Host A, Host B, Gateway: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | repetida 3 vezes | A para todos |

**Por que importa.** O sintoma, "Destination Host Unreachable", aponta para uma falha no ARP, e não na rota. Conferir a máscara resolve.

> **Grupo:** Falhas

Sem resposta ARP o pacote IP nem chega a ser montado. A perda, o host desligado e a entrada desatualizada têm sintomas diferentes.

#### 7.1.7 Destino desligado

*Três tentativas e a entrada vira FAILED.*

**Configuração aplicada:** Para onde o host A envia = local; Estado inicial da entrada = empty; O próximo salto está ligado = não; Proxy ARP ligado no gateway = não; A primeira requisição se perde = não

B está desligado. A repete a requisição **3 vezes**, com 1 s entre elas, e desiste: a entrada vira FAILED.

**Conceito.** Se o dono do endereço não responde, o sistema repete a requisição e desiste. O pacote IP é descartado e o próprio sistema de A informa que o host está inalcançável.

**O que observar**

- São 3 requisições, 1 s entre elas.
- Nenhum ICMP circula na rede: o aviso é gerado em A.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 2. Requisição em broadcast e resposta
  n_a ->> n_g: ARP Request
  n_a -x n_b: ARP Request
  n_a ->> n_g: ARP Request
  n_a -x n_b: ARP Request
  n_a ->> n_g: ARP Request
  n_a -x n_b: ARP Request
```

*Figura 7.1.7 (Tipo B, sequência).* Mensagens do cenário "Destino desligado", na ordem do tempo, entre Host A, Host B, Gateway: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 3 fases; 3 perdidas). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | sem resposta, 3 vezes | A para todos |

**Por que importa.** "Destination Host Unreachable" vindo do próprio host indica falha de resolução ARP, e não uma mensagem de um roteador.

#### 7.1.8 Requisição perdida e retransmitida

*A retransmissão resolve a perda.*

**Configuração aplicada:** Para onde o host A envia = local; Estado inicial da entrada = empty; O próximo salto está ligado = sim; Proxy ARP ligado no gateway = não; A primeira requisição se perde = sim

A primeira requisição se perde. Sem resposta em 1 s, o host **retransmite** e o ping funciona, só que mais devagar.

**Conceito.** Se a requisição se perde, a resposta nunca vem. Passado cerca de 1 s, o sistema retransmite, e a segunda tentativa funciona.

**O que observar**

- A primeira requisição aparece com ✕.
- O ping demora cerca de 1 s a mais.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 2. Requisição em broadcast e resposta
  n_a -x n_g: ARP Request
  n_a -x n_b: ARP Request
  n_a ->> n_g: ARP Request
  n_a ->> n_b: ARP Request
  n_b ->> n_a: ARP Reply
  Note over n_a,n_g: 3. Envio do pacote IP
  n_a ->> n_b: Echo Request
  n_b ->> n_a: Echo Reply
```

*Figura 7.1.8 (Tipo B, sequência).* Mensagens do cenário "Requisição perdida e retransmitida", na ordem do tempo, entre Host A, Host B, Gateway: 7 mensagens, numeradas de 1 a 7 na ordem da comunicação (em 3 fases; 2 perdidas). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | perdida | A |
| ARP Request | retransmitida | A |
| ARP Reply | chega | B para A |

**Por que importa.** Perdas esporádicas viram atrasos de 1 s no primeiro pacote, uma assinatura típica de problemas na camada 2.

#### 7.1.9 Entrada recente, host desligado

*A tabela guardava um host que já não responde.*

**Configuração aplicada:** Para onde o host A envia = local; Estado inicial da entrada = fresh; O próximo salto está ligado = não; Proxy ARP ligado no gateway = não; A primeira requisição se perde = não

A tabela ainda guarda o endereço de B, que foi desligado. O ping sai sem consultar o ARP e **fica sem resposta**: a tabela não prova que o host está ligado.

**Conceito.** Uma entrada REACHABLE só diz que o host respondeu há pouco. Se ele sair do ar, o ping sai sem consultar o ARP e fica sem resposta, até a entrada ser revalidada.

**O que observar**

- Não há mensagem ARP.
- O Echo Request aparece com ✕.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>origem
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Consulta à tabela ARP
  Note over n_a,n_g: 3. Envio do pacote IP
  n_a -x n_b: Echo Request
```

*Figura 7.1.9 (Tipo B, sequência).* Mensagens do cenário "Entrada recente, host desligado", na ordem do tempo, entre Host A, Host B, Gateway: 1 mensagem, numeradas de 1 a 1 na ordem da comunicação (em 2 fases; 1 perdida). Corresponde ao diagrama de sequência e à aba Captura, no modo "Resolução", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | sem resposta | A |

**Por que importa.** A tabela ARP não é um teste de vida: um ping sem resposta pode ter a entrada ainda "boa".

### 7.2 Modo: ARP gratuito e conflito

> **Grupo:** Anúncio de endereço

Antes de usar um endereço, o host verifica se há conflito (ARP Probe) e depois o anuncia (ARP Announce), como define a [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227). Os dois usam pacotes ARP comuns, com o IP do remetente e o do alvo escolhidos de propósito.

#### 7.2.1 Endereço novo: Probe e Announce

*Três Probes e dois Announces antes de usar o endereço.*

**Configuração aplicada:** O que acontece = announce; Os vizinhos guardam um MAC antigo do endereço = sim; O host recém-chegado cede ao conflito = sim; Enviar ARP gratuito ao assumir o IP = sim

O host A vai usar um endereço novo. Antes, faz **3 Probes** para saber se alguém o usa. Sem resposta, faz **2 Announces** e os vizinhos atualizam suas tabelas.

**Conceito.** Antes de configurar um endereço, o host faz 3 ARP Probes (com o IP do remetente zerado) para saber se alguém o usa. Sem resposta, espera e faz 2 ARP Announces, em que remetente e alvo têm o mesmo IP. Os vizinhos que já tinham uma entrada para o endereço a atualizam.

**O que observar**

- O Probe leva 0.0.0.0 como IP do remetente.
- O Announce leva o mesmo IP como remetente e como alvo.
- No gateway, a entrada do endereço passa do MAC antigo para o MAC de A.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>configura o endereço
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Verificação de conflito (ARP Probe)
  n_a ->> n_b: ARP Probe
  n_a ->> n_g: ARP Probe
  n_a ->> n_b: ARP Probe
  n_a ->> n_g: ARP Probe
  n_a ->> n_b: ARP Probe
  n_a ->> n_g: ARP Probe
  Note over n_a,n_g: 2. Anúncio (ARP Announce)
  n_a ->> n_b: ARP Announce
  n_a ->> n_g: ARP Announce
  n_a ->> n_b: ARP Announce
  n_a ->> n_g: ARP Announce
```

*Figura 7.2.1 (Tipo B, sequência).* Mensagens do cenário "Endereço novo: Probe e Announce", na ordem do tempo, entre Host A, Host B, Gateway: 10 mensagens, numeradas de 1 a 10 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "ARP gratuito e conflito", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Probe | quem tem o endereço? (3 vezes) | A para todos |
| ARP Announce | o endereço agora é meu (2 vezes) | A para todos |

**Por que importa.** O Probe evita configurar um endereço duplicado, e o Announce faz a rede esquecer o dono anterior sem esperar as tabelas expirarem.

#### 7.2.2 Anúncio sem entradas antigas

*Se ninguém tinha entrada, o Announce não muda nenhuma tabela.*

**Configuração aplicada:** O que acontece = announce; Os vizinhos guardam um MAC antigo do endereço = não; O host recém-chegado cede ao conflito = sim; Enviar ARP gratuito ao assumir o IP = sim

Mesma sequência, mas nenhum vizinho tinha entrada para o endereço: o Announce **não muda nenhuma tabela**, e só serve para avisar.

**Conceito.** O ARP só atualiza entradas que já existem, e não cria uma por causa de um Announce. Num endereço realmente novo, o anúncio só avisa os vizinhos, que aprendem o MAC quando precisarem falar com o host.

**O que observar**

- Os vizinhos mostram "sem entrada: nada a atualizar".
- A tabela do gateway continua vazia.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>configura o endereço
  participant n_b as Host B<br/>vizinho
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Verificação de conflito (ARP Probe)
  n_a ->> n_b: ARP Probe
  n_a ->> n_g: ARP Probe
  n_a ->> n_b: ARP Probe
  n_a ->> n_g: ARP Probe
  n_a ->> n_b: ARP Probe
  n_a ->> n_g: ARP Probe
  Note over n_a,n_g: 2. Anúncio (ARP Announce)
  n_a ->> n_b: ARP Announce
  n_a ->> n_g: ARP Announce
  n_a ->> n_b: ARP Announce
  n_a ->> n_g: ARP Announce
```

*Figura 7.2.2 (Tipo B, sequência).* Mensagens do cenário "Anúncio sem entradas antigas", na ordem do tempo, entre Host A, Host B, Gateway: 10 mensagens, numeradas de 1 a 10 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "ARP gratuito e conflito", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Probe | verificação | A para todos |
| ARP Announce | anúncio | A para todos |

**Por que importa.** O anúncio é útil sobretudo quando o endereço já foi de outro host, caso comum com DHCP.

> **Grupo:** Conflito de endereço

Dois hosts com o mesmo IP quebram a comunicação dos dois. O ARP é o meio de descobrir e de defender o endereço.

#### 7.2.3 Endereço já em uso (Probe)

*O dono do endereço responde ao Probe e o host desiste.*

**Configuração aplicada:** O que acontece = inuse; Os vizinhos guardam um MAC antigo do endereço = sim; O host recém-chegado cede ao conflito = sim; Enviar ARP gratuito ao assumir o IP = sim

O endereço que A quer **já pertence ao host B**. B responde ao primeiro Probe e A desiste, antes de usar o endereço.

**Conceito.** Se alguém já usa o endereço, responde ao Probe com uma resposta ARP normal. O host que testava vê o conflito e não usa o endereço (com DHCP, recusa a oferta com DHCPDECLINE).

**O que observar**

- A resposta de B diz que o endereço está nele.
- O host A não chega a mandar nenhum Announce.
- O endereço de A continua sem uso.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>quer o endereço
  participant n_b as Host B<br/>dono do endereço
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Verificação de conflito (ARP Probe)
  n_a ->> n_b: ARP Probe
  n_a ->> n_g: ARP Probe
  n_b ->> n_a: ARP Reply
```

*Figura 7.2.3 (Tipo B, sequência).* Mensagens do cenário "Endereço já em uso (Probe)", na ordem do tempo, entre Host A, Host B, Gateway: 3 mensagens, numeradas de 1 a 3 na ordem da comunicação (em 1 fase). Corresponde ao diagrama de sequência e à aba Captura, no modo "ARP gratuito e conflito", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Probe | quem tem o endereço? | A para todos |
| ARP Reply | o endereço já é meu | B para A |

**Por que importa.** Sem a verificação, o endereço duplicado derrubaria as conexões do host original.

#### 7.2.4 Disputa: o recém-chegado cede

*O dono defende o endereço e o outro cede.*

**Configuração aplicada:** O que acontece = dispute; Os vizinhos guardam um MAC antigo do endereço = sim; O host recém-chegado cede ao conflito = sim; Enviar ARP gratuito ao assumir o IP = sim

B é configurado à mão com o endereço de A, sem verificar conflito. A **defende o endereço** com um Announce e B cede.

**Conceito.** Um host configurado à mão sem verificar conflito anuncia um endereço que já pertence a outro. O dono percebe o conflito e o defende com um Announce, no máximo uma vez por intervalo de 10 s ([RFC 5227](https://www.rfc-editor.org/rfc/rfc5227)). O outro host reconhece o conflito e abandona o endereço.

**O que observar**

- O gateway troca a entrada para o MAC de B e depois a devolve para o MAC de A.
- Entre as duas mensagens, o tráfego do gateway iria para o host errado.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>dono do endereço
  participant n_b as Host B<br/>configurou o mesmo endereço
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Um segundo host configura o mesmo endereço
  n_b ->> n_a: ARP Announce
  n_b ->> n_g: ARP Announce
  Note over n_a,n_g: 2. Defesa do endereço
  n_a ->> n_b: ARP Announce (defesa)
  n_a ->> n_g: ARP Announce (defesa)
```

*Figura 7.2.4 (Tipo B, sequência).* Mensagens do cenário "Disputa: o recém-chegado cede", na ordem do tempo, entre Host A, Host B, Gateway: 4 mensagens, numeradas de 1 a 4 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "ARP gratuito e conflito", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Announce | B afirma ter o endereço | B para todos |
| ARP Announce (defesa) | A reafirma o endereço | A para todos |

**Por que importa.** Endereços duplicados por configuração manual são comuns, e a tabela do gateway oscila enquanto a disputa dura.

#### 7.2.5 Disputa: os dois defendem

*Se os dois defendem, o dono desiste no segundo conflito.*

**Configuração aplicada:** O que acontece = dispute; Os vizinhos guardam um MAC antigo do endereço = sim; O host recém-chegado cede ao conflito = não; Enviar ARP gratuito ao assumir o IP = sim

B também defende o endereço. A recebe um **segundo conflito em menos de 10 s** e abandona o endereço.

**Conceito.** Pela [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227), o host defende o endereço uma vez. Se B também defende, A recebe um segundo conflito em menos de 10 s e abandona o endereço. O resultado é o oposto do esperado: o dono perde para quem não cedeu.

**O que observar**

- O gateway termina apontando para o MAC de B.
- O estado final é "B ficou com o endereço".

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>dono do endereço
  participant n_b as Host B<br/>configurou o mesmo endereço
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Um segundo host configura o mesmo endereço
  n_b ->> n_a: ARP Announce
  n_b ->> n_g: ARP Announce
  Note over n_a,n_g: 2. Defesa do endereço
  n_a ->> n_b: ARP Announce (defesa)
  n_a ->> n_g: ARP Announce (defesa)
  Note over n_a,n_g: 3. Os dois defendem o endereço
  n_b ->> n_a: ARP Announce (defesa)
  n_b ->> n_g: ARP Announce (defesa)
```

*Figura 7.2.5 (Tipo B, sequência).* Mensagens do cenário "Disputa: os dois defendem", na ordem do tempo, entre Host A, Host B, Gateway: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "ARP gratuito e conflito", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Announce | B afirma ter o endereço | B para todos |
| ARP Announce (defesa) | A defende | A para todos |
| ARP Announce (defesa) | B defende de volta | B para todos |

**Por que importa.** A regra de desistir no segundo conflito evita uma disputa sem fim, mas pode tirar o endereço de quem o tinha primeiro.

> **Grupo:** Failover de IP

Quando um host reserva assume o IP do principal, os vizinhos ainda guardam o MAC do host antigo. O ARP gratuito corrige as tabelas na hora.

#### 7.2.6 Failover com ARP gratuito

*O ARP gratuito atualiza o gateway na hora.*

**Configuração aplicada:** O que acontece = failover; Os vizinhos guardam um MAC antigo do endereço = sim; O host recém-chegado cede ao conflito = sim; Enviar ARP gratuito ao assumir o IP = sim

O principal cai e o reserva assume o IP. O reserva envia um **ARP gratuito**, o gateway atualiza a tabela e o serviço volta em cerca de um RTT.

**Conceito.** O reserva assume o IP e envia uma resposta ARP que ninguém pediu, em broadcast: remetente e alvo têm o mesmo IP. O gateway, que tinha o MAC do host que caiu, passa a apontar para o novo dono, e o ping já é respondido.

**O que observar**

- O ARP gratuito chega ao gateway, mas não a B, que está fora do ar.
- A tabela do gateway muda para o MAC de A.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>reserva
  participant n_b as Host B<br/>principal (caiu)
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. O principal cai e o reserva assume o IP
  Note over n_a,n_g: 2. ARP gratuito
  n_a -x n_b: Gratuitous ARP (Reply)
  n_a ->> n_g: Gratuitous ARP (Reply)
  Note over n_a,n_g: 3. O tráfego volta
  n_g ->> n_a: Echo Request
  n_a ->> n_g: Echo Reply
```

*Figura 7.2.6 (Tipo B, sequência).* Mensagens do cenário "Failover com ARP gratuito", na ordem do tempo, entre Host A, Host B, Gateway: 4 mensagens, numeradas de 1 a 4 na ordem da comunicação (em 3 fases; 1 perdida). Corresponde ao diagrama de sequência e à aba Captura, no modo "ARP gratuito e conflito", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Gratuitous ARP (Reply) | o IP agora está em A | A para todos |
| Echo Request e Reply | o serviço volta | gateway e A |

**Por que importa.** É o que protocolos de redundância como VRRP e clusters fazem ao trocar o responsável por um IP.

#### 7.2.7 Failover sem ARP gratuito

*Sem aviso, o gateway só corrige quando a entrada expira.*

**Configuração aplicada:** O que acontece = failover; Os vizinhos guardam um MAC antigo do endereço = sim; O host recém-chegado cede ao conflito = sim; Enviar ARP gratuito ao assumir o IP = não

O reserva assume o IP e **não avisa ninguém**. O gateway continua mandando ao MAC do host que caiu, até a entrada expirar e ser revalidada.

**Conceito.** Sem ARP gratuito, o gateway continua enviando ao MAC de B. Só quando a entrada expira e a revalidação falha ele pergunta em broadcast e descobre o novo dono. O tempo de espera depende do equipamento.

**O que observar**

- O primeiro ping fica sem resposta.
- As sondas unicast para B também ficam sem resposta e a entrada vira FAILED.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>reserva
  participant n_b as Host B<br/>principal (caiu)
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. O principal cai e o reserva assume o IP
  Note over n_a,n_g: 2. Sem ARP gratuito
  n_g -x n_b: Echo Request
  Note over n_a,n_g: 3. A entrada expira e é revalidada
  n_g -x n_b: ARP Request (unicast)
  n_g -x n_b: ARP Request (unicast)
  n_g -x n_b: ARP Request (unicast)
  n_g ->> n_a: ARP Request
  n_g -x n_b: ARP Request
  n_a ->> n_g: ARP Reply
  n_g ->> n_a: Echo Request
  n_a ->> n_g: Echo Reply
```

*Figura 7.2.7 (Tipo B, sequência).* Mensagens do cenário "Failover sem ARP gratuito", na ordem do tempo, entre Host A, Host B, Gateway: 9 mensagens, numeradas de 1 a 9 na ordem da comunicação (em 3 fases; 5 perdidas). Corresponde ao diagrama de sequência e à aba Captura, no modo "ARP gratuito e conflito", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | sem resposta | gateway |
| ARP Request (unicast) | revalidação, 3 vezes | gateway |
| ARP Request e Reply | o novo dono responde | gateway e A |

**Por que importa.** Sem o ARP gratuito, o failover pode levar de dezenas de segundos a horas para chegar a todos os vizinhos.

### 7.3 Modo: Envenenamento de cache

> **Grupo:** Referência

Antes de olhar o ataque, convém ver o fluxo normal, com as duas tabelas ARP corretas.

#### 7.3.1 Sem ataque (referência)

*As duas tabelas estão corretas e o tráfego vai direto.*

**Configuração aplicada:** Há um host malicioso na rede local = não; Os dois lados são enganados (vítima e gateway) = sim; Tráfego da vítima = http; Defesa na rede local = none

A situação normal: as tabelas de A e do gateway estão corretas e o tráfego vai direto, sem passar pelo host M.

**Conceito.** Em condições normais, cada host associa o IP do outro ao MAC correto, e o tráfego entre A e o gateway não passa por mais ninguém.

**O que observar**

- O MAC de destino dos frames é sempre o do gateway ou o de A.
- O host M não aparece no caminho.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>vítima
  participant n_m as Host M<br/>host malicioso
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Situação normal
  Note over n_a,n_g: 3. Tráfego da vítima para o servidor
  n_a ->> n_g: HTTP GET
  n_g ->> n_a: HTTP 200
```

*Figura 7.3.1 (Tipo B, sequência).* Mensagens do cenário "Sem ataque (referência)", na ordem do tempo, entre Host A, Host M, Gateway: 2 mensagens, numeradas de 1 a 2 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Envenenamento de cache", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| HTTP GET e HTTP 200 | requisição e resposta | A e gateway |

**Por que importa.** É a referência para comparar com os cenários de ataque e de defesa.

> **Grupo:** O ataque e seu efeito

O ARP aceita respostas sem verificar quem as enviou. Dentro da rede local, isso permite que um host se coloque no caminho do tráfego de outros. O que ele consegue ler depende do protocolo usado.

#### 7.3.2 Cache envenenado (HTTP)

*Respostas forjadas colocam M no caminho do tráfego.*

**Configuração aplicada:** Há um host malicioso na rede local = sim; Os dois lados são enganados (vítima e gateway) = sim; Tráfego da vítima = http; Defesa na rede local = none

O host M envia respostas ARP que ninguém pediu. A e o gateway as aceitam, e o tráfego **HTTP** passa a atravessar M, que lê o conteúdo.

**Conceito.** O ARP não autentica quem responde. O host M envia a A uma resposta que ninguém pediu, dizendo que o IP do gateway está no MAC dele, e envia ao gateway uma resposta equivalente sobre A. Quem aceita passa a enviar a M o tráfego do outro, e M o repassa ao destino verdadeiro, de modo que nada parece errado.

**O que observar**

- A resposta forjada traz o MAC de M como remetente e o IP do gateway como endereço declarado.
- A tabela de A passa a associar o IP do gateway ao MAC de M.
- M repassa os frames, e por isso a comunicação continua funcionando.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>vítima
  participant n_m as Host M<br/>host malicioso
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Situação normal
  Note over n_a,n_g: 2. Respostas ARP forjadas
  n_m ->> n_a: ARP Reply (forjada)
  n_m ->> n_g: ARP Reply (forjada)
  Note over n_a,n_g: 3. Tráfego da vítima para o servidor
  n_a ->> n_m: HTTP GET
  n_m ->> n_g: HTTP GET (repassado)
  n_g ->> n_m: HTTP 200
  n_m ->> n_a: HTTP 200 (repassado)
```

*Figura 7.3.2 (Tipo B, sequência).* Mensagens do cenário "Cache envenenado (HTTP)", na ordem do tempo, entre Host A, Host M, Gateway: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Envenenamento de cache", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Reply (forjada) | o IP do gateway estaria no MAC de M | M para A e gateway |
| HTTP GET e HTTP 200 | o tráfego passa por M, que o lê | A, M e gateway |

**Por que importa.** Em HTTP, quem fica no meio do caminho lê tudo, inclusive cookies de sessão. É um risco de redes locais compartilhadas, como Wi-Fi público.

#### 7.3.3 Só a vítima é enganada

*Com só a vítima enganada, M vê só um sentido.*

**Configuração aplicada:** Há um host malicioso na rede local = sim; Os dois lados são enganados (vítima e gateway) = não; Tráfego da vítima = http; Defesa na rede local = none

Só A recebe a resposta forjada. M vê **só a requisição**; a resposta do servidor volta direto para A.

**Conceito.** Se só A é enganado, os frames de A passam por M, mas a resposta do gateway volta direto para A, que continua com o MAC correto na tabela do gateway.

**O que observar**

- A resposta do servidor não passa por M.
- O estado diz "ida por M, volta direta".

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>vítima
  participant n_m as Host M<br/>host malicioso
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Situação normal
  Note over n_a,n_g: 2. Respostas ARP forjadas
  n_m ->> n_a: ARP Reply (forjada)
  Note over n_a,n_g: 3. Tráfego da vítima para o servidor
  n_a ->> n_m: HTTP GET
  n_m ->> n_g: HTTP GET (repassado)
  n_g ->> n_a: HTTP 200
```

*Figura 7.3.3 (Tipo B, sequência).* Mensagens do cenário "Só a vítima é enganada", na ordem do tempo, entre Host A, Host M, Gateway: 4 mensagens, numeradas de 1 a 4 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Envenenamento de cache", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Reply (forjada) | só para A | M para A |
| HTTP GET | passa por M | A, M e gateway |
| HTTP 200 | volta direto | gateway para A |

**Por que importa.** Mostra que o desvio pode ser parcial: nem sempre o intermediário vê a conversa inteira.

#### 7.3.4 Mesmo desvio, tráfego HTTPS

*O desvio ocorre, mas o conteúdo cifrado continua protegido.*

**Configuração aplicada:** Há um host malicioso na rede local = sim; Os dois lados são enganados (vítima e gateway) = sim; Tráfego da vítima = https; Defesa na rede local = none

O desvio acontece do mesmo jeito, mas o tráfego é **HTTPS**: M recebe os frames e não consegue ler o conteúdo.

**Conceito.** O envenenamento atua na camada 2 e não depende do protocolo de cima. Com HTTPS, o conteúdo é cifrado entre A e o servidor: M recebe os frames, mas só enxerga tamanhos e momentos dos registros. Ele ainda poderia atrasar ou descartar o tráfego.

**O que observar**

- A tabela de A continua envenenada.
- M vê só dados cifrados (TLS).

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>vítima
  participant n_m as Host M<br/>host malicioso
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Situação normal
  Note over n_a,n_g: 2. Respostas ARP forjadas
  n_m ->> n_a: ARP Reply (forjada)
  n_m ->> n_g: ARP Reply (forjada)
  Note over n_a,n_g: 3. Tráfego da vítima para o servidor
  n_a ->> n_m: [cifrado] TLS dados
  n_m ->> n_g: [cifrado] TLS dados (repassado)
  n_g ->> n_m: [cifrado] TLS dados
  n_m ->> n_a: [cifrado] TLS dados (repassado)
```

*Figura 7.3.4 (Tipo B, sequência).* Mensagens do cenário "Mesmo desvio, tráfego HTTPS", na ordem do tempo, entre Host A, Host M, Gateway: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 3 fases; 4 cifradas). Corresponde ao diagrama de sequência e à aba Captura, no modo "Envenenamento de cache", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Reply (forjada) | mesmo ataque | M para A e gateway |
| TLS dados | cifrado de ponta a ponta | A, M e gateway |

**Por que importa.** A cifra de ponta a ponta (HTTPS, SSH) limita o dano de um desvio na camada 2, o que liga este simulador ao de HTTPS e ao de SSH.

> **Grupo:** Defesas

As defesas atuam em pontos diferentes: no host (entrada estática), no switch (DAI) e na observação da rede (monitoramento). Nenhuma substitui a cifra de ponta a ponta.

#### 7.3.5 Defesa: entradas estáticas

*A entrada estática não aceita a resposta forjada.*

**Configuração aplicada:** Há um host malicioso na rede local = sim; Os dois lados são enganados (vítima e gateway) = sim; Tráfego da vítima = http; Defesa na rede local = static

Com **entradas ARP estáticas** no host e no gateway, as respostas forjadas são ignoradas e as tabelas não mudam.

**Conceito.** Uma entrada estática (PERMANENT no Linux) não é alterada por respostas ARP. É uma defesa simples e eficaz, mas trabalhosa de manter em muitos hosts.

**O que observar**

- Os dois hosts ignoram a resposta forjada.
- As tabelas ficam como estavam.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>vítima
  participant n_m as Host M<br/>host malicioso
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Situação normal
  Note over n_a,n_g: 2. Respostas ARP forjadas
  n_m ->> n_a: ARP Reply (forjada)
  n_m ->> n_g: ARP Reply (forjada)
  Note over n_a,n_g: 3. Tráfego da vítima para o servidor
  n_a ->> n_g: HTTP GET
  n_g ->> n_a: HTTP 200
```

*Figura 7.3.5 (Tipo B, sequência).* Mensagens do cenário "Defesa: entradas estáticas", na ordem do tempo, entre Host A, Host M, Gateway: 4 mensagens, numeradas de 1 a 4 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Envenenamento de cache", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Reply (forjada) | ignorada | M para A e gateway |
| HTTP GET e HTTP 200 | tráfego direto | A e gateway |

**Por que importa.** Faz sentido em poucos hosts críticos, como servidores e gateways, em que o endereço físico quase não muda.

#### 7.3.6 Defesa: DAI no switch

*O switch descarta a resposta antes de chegar aos hosts.*

**Configuração aplicada:** Há um host malicioso na rede local = sim; Os dois lados são enganados (vítima e gateway) = sim; Tráfego da vítima = http; Defesa na rede local = dai

O **switch com DAI** confere cada resposta ARP com a tabela do DHCP snooping e descarta as forjadas antes que cheguem aos hosts.

**Conceito.** Com a Dynamic ARP Inspection, o switch compara o par IP e MAC de cada resposta ARP com a tabela de DHCP snooping, que registra quem recebeu qual endereço por qual porta. Respostas que não conferem são descartadas.

**O que observar**

- A resposta forjada para no switch (✕ no caminho).
- As tabelas dos hosts continuam corretas.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>vítima
  participant n_m as Host M<br/>host malicioso
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Situação normal
  Note over n_a,n_g: 2. Respostas ARP forjadas
  n_m -x n_a: ARP Reply (forjada)
  n_m -x n_g: ARP Reply (forjada)
  Note over n_a,n_g: 3. Tráfego da vítima para o servidor
  n_a ->> n_g: HTTP GET
  n_g ->> n_a: HTTP 200
```

*Figura 7.3.6 (Tipo B, sequência).* Mensagens do cenário "Defesa: DAI no switch", na ordem do tempo, entre Host A, Host M, Gateway: 4 mensagens, numeradas de 1 a 4 na ordem da comunicação (em 3 fases; 2 perdidas). Corresponde ao diagrama de sequência e à aba Captura, no modo "Envenenamento de cache", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Reply (forjada) | descartada pelo switch | M para A e gateway |
| HTTP GET e HTTP 200 | tráfego direto | A e gateway |

**Por que importa.** Protege toda a rede sem configurar cada host, desde que o DHCP snooping esteja ativo e as portas de uplink estejam marcadas como confiáveis.

#### 7.3.7 Detecção: MAC do gateway mudou

*O monitoramento detecta a mudança de MAC, mas não bloqueia.*

**Configuração aplicada:** Há um host malicioso na rede local = sim; Os dois lados são enganados (vítima e gateway) = sim; Tráfego da vítima = http; Defesa na rede local = monitor

O **monitoramento** percebe que o MAC do gateway mudou e gera um alerta. Detecta, mas não impede o desvio.

**Conceito.** Ferramentas de monitoramento registram o par IP e MAC de cada host e alertam quando um deles muda sem motivo. Servem para detectar o problema e agir, mas o desvio acontece até alguém reagir.

**O que observar**

- O alerta aparece no estado e no Log.
- O tráfego já foi desviado.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>vítima
  participant n_m as Host M<br/>host malicioso
  participant n_g as Gateway<br/>roteador
  Note over n_a,n_g: 1. Situação normal
  Note over n_a,n_g: 2. Respostas ARP forjadas
  n_m ->> n_a: ARP Reply (forjada)
  n_m ->> n_g: ARP Reply (forjada)
  Note over n_a,n_g: 3. Tráfego da vítima para o servidor
  n_a ->> n_m: HTTP GET
  n_m ->> n_g: HTTP GET (repassado)
  n_g ->> n_m: HTTP 200
  n_m ->> n_a: HTTP 200 (repassado)
```

*Figura 7.3.7 (Tipo B, sequência).* Mensagens do cenário "Detecção: MAC do gateway mudou", na ordem do tempo, entre Host A, Host M, Gateway: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Envenenamento de cache", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Reply (forjada) | aceita | M para A e gateway |
| HTTP GET e HTTP 200 | passa por M | A, M e gateway |

**Por que importa.** Detecção sem bloqueio é complementar: avisa a equipe, que pode isolar a porta do host suspeito.

## 8. Referência

### 8.1 O que o ARP resolve

O **ARP** (*Address Resolution Protocol*, [RFC 826](https://www.rfc-editor.org/rfc/rfc826)) descobre o endereço físico (MAC) de um host a partir do endereço IPv4 dele, **dentro da mesma rede local**. A Ethernet entrega frames por MAC, e o IP só sabe de endereços IP: o ARP liga as duas coisas. No IPv6 essa função é do NDP, tratado em outro protocolo.

### 8.2 Formato do pacote ([RFC 826](https://www.rfc-editor.org/rfc/rfc826), para IPv4 sobre Ethernet)

| Campo | Tamanho | Valor |
| --- | --- | --- |
| Tipo de hardware | 2 bytes | 1 (Ethernet) |
| Tipo de protocolo | 2 bytes | 0x0800 (IPv4) |
| Tamanho do endereço físico | 1 byte | 6 |
| Tamanho do endereço de protocolo | 1 byte | 4 |
| Operação | 2 bytes | 1 requisição, 2 resposta |
| Endereço físico do remetente (SHA) | 6 bytes | MAC de quem envia |
| IP do remetente (SPA) | 4 bytes | IP de quem envia |
| Endereço físico do alvo (THA) | 6 bytes | zerado na requisição |
| IP do alvo (TPA) | 4 bytes | o IP perguntado |

O frame Ethernet que carrega o pacote usa o tipo 0x0806. São 28 bytes de ARP e 14 do cabeçalho Ethernet: 42 bytes, que a placa completa até o mínimo de 60 bytes no meio físico.

### 8.3 Requisição, resposta e aprendizado

- A **requisição** vai para o broadcast (ff:ff:ff:ff:ff:ff): todos os hosts da rede a recebem e só o dono do IP perguntado responde.
- A **resposta** vai em unicast para quem perguntou.
- Quem é o alvo da requisição guarda o par IP e MAC do remetente ([RFC 826](https://www.rfc-editor.org/rfc/rfc826)), e por isso a resposta de volta (o *Echo Reply* do ping) não exige outra consulta.

### 8.4 Tabela ARP e estados das entradas

O resultado fica numa tabela, que no Linux se vê com `ip neigh`. Os estados mostrados pelo simulador são os do kernel Linux:

| Estado | Significado |
| --- | --- |
| INCOMPLETE | requisição enviada, resposta ainda não chegou |
| REACHABLE | o vizinho respondeu há pouco; a entrada é confiável |
| STALE | passou o tempo de validade; ainda é usada, mas será confirmada |
| FAILED | sem resposta depois das tentativas |

Os tempos variam entre sistemas: no Linux, a retransmissão padrão é de 1 s com 3 tentativas, e a validade (REACHABLE) é de algumas dezenas de segundos, sorteada. Em roteadores, o padrão costuma ser de horas. O simulador usa os valores do Linux.

### 8.5 Fora da sub-rede e proxy ARP

- O broadcast **não atravessa roteadores**. Para um destino em outra rede, o host faz o ARP do **gateway**, e o frame leva o MAC do gateway com o IP de destino remoto.
- No **proxy ARP** ([RFC 1027](https://www.rfc-editor.org/rfc/rfc1027), sem classificação de status no índice do RFC Editor), o roteador responde a requisições por endereços de outras redes usando o próprio MAC. Serve para hosts sem gateway, mas esconde erros de máscara e de rota.

### 8.6 ARP gratuito, Probe e Announce ([RFC 5227](https://www.rfc-editor.org/rfc/rfc5227))

- O **ARP Probe** é uma requisição com o IP do remetente **zerado** (0.0.0.0): pergunta se alguém usa o endereço sem contaminar as tabelas dos vizinhos. A RFC prevê 3 Probes, com 1 a 2 s entre eles, depois de uma espera inicial de até 1 s.
- O **ARP Announce** é uma requisição em que o IP do remetente e o do alvo são o mesmo endereço. A RFC prevê 2 Announces, a cada 2 s, depois de uma espera de 2 s. Os vizinhos que já tinham uma entrada para o IP a atualizam; ninguém cria entrada por causa de um Announce.
- O **ARP gratuito** clássico também pode ser uma resposta (operação 2) que ninguém pediu, em broadcast. É o que muitas implementações enviam ao assumir um IP em um failover. O valor do endereço físico do alvo varia entre sistemas.
- Se o dono de um endereço vê um conflito, ele o **defende** com um Announce, no máximo uma vez a cada 10 s. Um segundo conflito dentro desse intervalo faz o host abandonar o endereço.
- Com DHCP, quem detecta o endereço em uso recusa a oferta com `DHCPDECLINE` ([RFC 2131](https://www.rfc-editor.org/rfc/rfc2131)).

### 8.7 Envenenamento do cache ARP (nível defensivo)

- **Por que é possível:** o ARP não autentica quem responde e muitos sistemas aceitam respostas que ninguém pediu. Um host da mesma rede local pode declarar o IP de outro no próprio MAC.
- **Efeito:** quem aceita a resposta passa a enviar o tráfego daquele IP ao host malicioso, que o repassa ao destino verdadeiro. A comunicação continua funcionando, o que torna o desvio difícil de notar.
- **Alcance:** só vale dentro do mesmo domínio de broadcast (a mesma sub-rede ou VLAN), pois o ARP não atravessa roteadores.
- **Impacto:** em HTTP, o conteúdo é lido. Com HTTPS ou SSH, o conteúdo continua cifrado de ponta a ponta, mas o tráfego ainda pode ser atrasado ou descartado.
- **Aviso:** este modo explica o mecanismo para fins de defesa. Interceptar o tráfego de uma rede que não é sua pode configurar crime; pratique apenas em laboratório isolado, com autorização.

### 8.8 Defesas

| Defesa | Onde atua | Observação |
| --- | --- | --- |
| Entrada ARP estática | no host ou no gateway | a tabela não aceita alteração; vale para poucos hosts críticos |
| DAI (Dynamic ARP Inspection) | no switch | compara IP e MAC com a tabela do DHCP snooping e descarta o que não confere |
| DHCP snooping e port security | no switch | limitam quem pode ofertar endereços e quantos MACs cada porta aceita |
| Monitoramento da tabela ARP | na rede | detecta a mudança de MAC e alerta, sem bloquear |
| Cifra de ponta a ponta (HTTPS, SSH, VPN) | nas aplicações | protege o conteúdo mesmo com a rede local comprometida |
| Segmentação (VLANs) e redes confiáveis | na arquitetura | reduz quem consegue enviar ARP à vítima |

### 8.9 Segurança

O ARP **não tem autenticação**: o host aceita qualquer resposta que pareça válida e a guarda na tabela. É o que torna a camada 2 uma superfície de ataque dentro da rede local, e é a razão de existirem entradas estáticas, inspeção de ARP em switches (DAI) e monitoramento da tabela. O ARP gratuito e a defesa de endereço tratam conflitos acidentais: um host malicioso pode enviar os mesmos pacotes para enganar a tabela dos vizinhos.

### 8.10 Limitações do simulador

O simulador mostra um único segmento Ethernet com três hosts (o switch não aparece, mas é ele que entrega o broadcast a todos). Os endereços são de documentação ([RFC 5737](https://www.rfc-editor.org/rfc/rfc5737) e [RFC 9542](https://www.rfc-editor.org/rfc/rfc9542)), os tempos são didáticos e, no destino remoto, a resposta do ping é gerada pelo gateway, sem simular a rede além dele. No modo de conflito, os tempos da [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227) são valores fixos (a RFC sorteia intervalos). O estado STALE revalida por unicast antes do ping (o Linux usa o estado DELAY, de 5 s, e envia o pacote antes de revalidar). O failover usa Gratuitous ARP Reply; a [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227) (seção 3) descreve o Request. Fora do escopo: o NDP do IPv6.


## 9. Glossário

Significado e finalidade das siglas usadas neste documento.

| Sigla | Significado | Para que serve |
| --- | --- | --- |
| **ARP** | Address Resolution Protocol, protocolo de resolução de endereços | descobre o endereço MAC que corresponde a um endereço IPv4 na rede local |
| **BGP** | Border Gateway Protocol, protocolo de roteador de borda | troca rotas entre sistemas autônomos e sustenta o roteamento entre operadoras na Internet |
| **CRC** | Cyclic Redundancy Check, verificação de redundância cíclica | código que detecta erros de transmissão, como o do FCS dos frames Ethernet e 802.11 |
| **DAI** | Dynamic ARP Inspection, inspeção dinâmica de ARP | recurso do switch que confere as respostas ARP com a tabela do DHCP snooping e descarta as forjadas |
| **DHCP** | Dynamic Host Configuration Protocol, protocolo de configuração dinâmica de hosts | entrega ao cliente endereço IP, máscara, gateway e DNS, por empréstimo (lease) |
| **FCS** | Frame Check Sequence, sequência de verificação do frame | código (CRC) no fim do frame que permite ao receptor descartar frames corrompidos |
| **HLEN** | Hardware Address Length, tamanho do endereço de hardware | campo do pacote ARP com o tamanho, em bytes, do endereço físico (6 para MAC) |
| **HTTP** | Hypertext Transfer Protocol, protocolo de transferência de hipertexto | transporta páginas e dados entre navegador e servidor web |
| **HTTPS** | HTTP Secure | HTTP protegido por TLS: cifra o conteúdo e autentica o servidor |
| **HTYPE** | Hardware Type, tipo de hardware | campo do pacote ARP que identifica a tecnologia do enlace (1 para Ethernet) |
| **ICMP** | Internet Control Message Protocol | leva mensagens de controle e de erro da camada IP, como o eco do ping e o aviso de destino inalcançável |
| **IEEE** | Institute of Electrical and Electronics Engineers | entidade que publica padrões de redes locais, como o 802.3 (Ethernet), o 802.1 (comutação) e o 802.11 (Wi-Fi) |
| **IP** | Internet Protocol, protocolo de internet | endereça e encaminha pacotes entre redes, de origem a destino |
| **MAC** | Media Access Control | camada de enlace que controla o acesso ao meio; também nomeia o endereço físico de 48 bits de uma interface |
| **NDP** | Neighbor Discovery Protocol, protocolo de descoberta de vizinhos | equivalente do ARP no IPv6 ([RFC 4861](https://www.rfc-editor.org/rfc/rfc4861)), feito por mensagens ICMPv6 |
| **OPER** | Operation, operação | campo do pacote ARP que distingue o pedido (1) da resposta (2) |
| **PLEN** | Protocol Address Length, tamanho do endereço de protocolo | campo do pacote ARP com o tamanho, em bytes, do endereço de rede (4 para IPv4) |
| **PTYPE** | Protocol Type, tipo de protocolo | campo do pacote ARP que identifica o protocolo de rede dos endereços resolvidos (0x0800 para IPv4) |
| **RFC** | Request for Comments, pedido de comentários | documento numerado do IETF que define ou descreve um protocolo da Internet; cada documento do projeto cita as RFCs com link para o RFC Editor |
| **RTT** | Round-Trip Time, tempo de ida e volta | mede o tempo entre enviar um pacote e receber a resposta; base dos temporizadores e da latência |
| **SHA** | Sender Hardware Address, endereço de hardware do remetente | campo do pacote ARP com o MAC de quem o enviou |
| **SPA** | Sender Protocol Address, endereço de protocolo do remetente | campo do pacote ARP com o IP de quem o enviou |
| **SSH** | Secure Shell | acesso remoto e transferência de arquivos por um canal cifrado, com autenticação do servidor e do usuário |
| **THA** | Target Hardware Address, endereço de hardware do alvo | campo do pacote ARP com o MAC procurado; na requisição vai zerado |
| **TLS** | Transport Layer Security, segurança da camada de transporte | estabelece um canal cifrado e autenticado entre dois pontos, a base do HTTPS |
| **TPA** | Target Protocol Address, endereço de protocolo do alvo | campo do pacote ARP com o IP cujo MAC se procura |
| **VLAN** | Virtual Local Area Network, rede local virtual | separa logicamente uma rede em domínios de broadcast isolados no mesmo equipamento físico |
| **VPN** | Virtual Private Network, rede privada virtual | cria um canal protegido, em geral cifrado, sobre uma rede pública |
| **VRRP** | Virtual Router Redundancy Protocol | permite que dois roteadores compartilhem um endereço IP virtual de gateway, para haver reserva |


---

*Simul-Net é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
