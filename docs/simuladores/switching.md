# Switching e aprendizado de MAC

Encaminhamento de frames em switches Ethernet: aprendizado do MAC de origem, tabela de endereços e envelhecimento, inundação, filtragem, mudança de porta, broadcast, multicast com IGMP snooping, endereços reservados e a inundação de MAC com a segurança de porta.

- **Categoria:** Camada de enlace e redes locais
- **Motor:** nativo (TypeScript puro, apresentado pela bancada genérica)
- **Código-fonte:** `src/sims/switching/`
- **RFCs e padrões:** [RFC 1112](https://www.rfc-editor.org/rfc/rfc1112) (Multicast IP), [RFC 4541](https://www.rfc-editor.org/rfc/rfc4541) (IGMP snooping), [RFC 9776](https://www.rfc-editor.org/rfc/rfc9776) (IGMPv3)
- **Tópicos:** Aprendizado e tabela de endereços; Inundação, filtragem e envelhecimento; Broadcast, multicast e IGMP snooping; Inundação de MAC e segurança de porta

## 1. Modos

| Modo | Cenário inicial | Cenários |
| --- | --- | --- |
| Aprendizado e encaminhamento | Primeiro frame: inundação e aprendizado | 7.1.1 a 7.1.7 |
| Inundação de MAC e segurança de porta | Sem ataque | 7.2.1 a 7.2.6 |
| Broadcast, multicast e reservados | Broadcast é inundado | 7.3.1 a 7.3.5 |

## 2. Fundamentação

### 2.1 O problema que o switch resolve

Em uma rede local, vários dispositivos precisam trocar quadros Ethernet. Um **hub** repete cada quadro para todas as portas, e todos competem pelo mesmo meio. Um **switch** é uma **ponte multiporta** (*MAC bridge*, IEEE 802.1D, hoje incorporada ao IEEE 802.1Q): ele aprende onde cada dispositivo está e envia o quadro **só pela porta certa**. Ele trabalha na camada 2 e decide **apenas pelo endereço MAC**: não olha o endereço IP.

**O que você aprende com este simulador.**

- Explicar como o switch aprende, decide e envelhece as entradas da tabela de endereços MAC.
- Ler o quadro Ethernet campo a campo e saber quais campos o switch usa (destino e origem).
- Distinguir os domínios de colisão e de broadcast e o tratamento de unicast, broadcast e multicast.
- Entender o IGMP snooping e os endereços reservados que as pontes não encaminham.
- Reconhecer o ponto fraco da tabela finita e como a segurança de porta o reduz.

### 2.2 O diagrama dos três passos

```mermaid
flowchart TD
  Q["Quadro chega pela porta P"] --> A["1. Aprender<br/>associa o MAC de origem à porta P<br/>ou renova o relógio da entrada"]
  A --> D{"2. Decidir<br/>o MAC de destino é conhecido?"}
  D -- "sim, em outra porta" --> F["Encaminha só por essa porta"]
  D -- "sim, na própria porta P" --> X["Filtra: descarta"]
  D -- "não, broadcast ou multicast" --> I["Inunda: todas as portas, menos P"]
  F --> E["3. Envelhecer<br/>entrada sem tráfego expira"]
  X --> E
  I --> E
```

*Esquema 1 (aprender, decidir e envelhecer).* O MAC de **origem** alimenta a tabela, e o MAC de **destino** consulta a tabela. Endereços de grupo e de broadcast nunca são aprendidos como origem. O valor recomendado para o envelhecimento é de 300 s, e é configurável.

Por isso o primeiro quadro entre dois hosts que não se conhecem é **inundado**: o switch ainda não sabe onde está o destino. Quando o destino responde, o switch aprende a porta dele, e os quadros seguintes seguem direto.

### 2.3 O quadro Ethernet

O switch trabalha com quadros Ethernet. O desenho mostra os campos em linhas de 32 bits, na ordem de transmissão (IEEE 802.3; o quadro começa depois do preâmbulo de 7 bytes e do delimitador SFD de 1 byte, que as placas tratam à parte).

```mermaid
packet-beta
  0-47: "MAC de destino"
  48-95: "MAC de origem"
  96-111: "Tipo (EtherType)"
  112-143: "Dados (46 a 1500 bytes)"
  144-175: "FCS"
```

*Esquema 2 (o quadro Ethernet).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O campo de dados é **condensado** no desenho: ele ocupa de 46 a 1500 bytes. A tabela abaixo descreve todos os campos, em ordem.

| Campo | Tamanho | Observação |
| --- | --- | --- |
| Destino | 6 bytes | o bit menos significativo do primeiro byte indica endereço de grupo (broadcast ou multicast) |
| Origem | 6 bytes | sempre unicast |
| Tipo | 2 bytes | 0x0800 IPv4, 0x0806 ARP, 0x86DD IPv6, 0x88CC LLDP, 0x8100 tag de VLAN |
| Dados | 46 a 1500 bytes | preenchidos até o mínimo de 46 bytes |
| FCS | 4 bytes | verificação do quadro (*Frame Check Sequence*), um CRC de 32 bits |

O menor quadro tem 64 bytes (do destino ao FCS) e o maior, 1518 bytes, ou 1522 com a tag de VLAN. O switch usa o campo **Destino** para decidir e o campo **Origem** para aprender. Os endereços MAC têm 48 bits e o bit seguinte ao de grupo distingue os administrados localmente dos de fabricante.

### 2.4 A tabela de endereços e os domínios

```mermaid
flowchart LR
  subgraph SW["Switch com 4 portas"]
    T["Tabela de endereços<br/>MAC e porta de cada host"]
  end
  A["Host A"] --- P1["Porta 1"] --- SW
  B["Host B"] --- P2["Porta 2"] --- SW
  C["Host C"] --- P3["Porta 3"] --- SW
  D["Host D"] --- P4["Porta 4"] --- SW
```

*Esquema 3 (um domínio de colisão por porta, um domínio de broadcast no switch).* Cada porta é um domínio de colisão próprio, mas todas as portas formam **um só domínio de broadcast**. Para dividir o domínio de broadcast, é preciso usar VLANs (veja o simulador de VLAN) ou um roteador.

### 2.5 Broadcast, multicast e endereços reservados

| Tipo de destino | Como o switch trata |
| --- | --- |
| Unicast conhecido | encaminha pela porta aprendida |
| Unicast desconhecido | inunda por todas as portas, menos a de entrada |
| Broadcast (ff:ff:ff:ff:ff:ff) | inunda por todas as portas, menos a de entrada |
| Multicast sem controle | inunda como broadcast |
| Multicast com IGMP snooping | envia só às portas que pediram o grupo ([RFC 4541](https://www.rfc-editor.org/rfc/rfc4541)) |
| Endereços reservados de protocolos de ponte | não são encaminhados por pontes comuns, e o switch os trata localmente |

O multicast IP ([RFC 1112](https://www.rfc-editor.org/rfc/rfc1112)) usa o IGMP para os hosts anunciarem os grupos de que participam, e o **IGMP snooping** é a técnica pela qual o switch escuta esses anúncios para não inundar o tráfego de grupo ([RFC 4541](https://www.rfc-editor.org/rfc/rfc4541)). A [RFC 9776](https://www.rfc-editor.org/rfc/rfc9776) define o IGMPv3.

### 2.6 Quando a tabela é um ponto fraco

A tabela de endereços tem **tamanho finito**. Se ela enche, o switch deixa de aprender endereços novos e passa a inundar o tráfego de destinos que não cabem, o que expõe quadros a portas que não deveriam recebê-los. Isso pode acontecer por um erro de projeto ou por um ataque de inundação de MACs.

A defesa é a **segurança de porta** (*port security*): limitar quantos MACs uma porta pode aprender e escolher o que fazer quando o limite é excedido (descartar, descartar e registrar, ou desativar a porta). Os nomes dos modos seguem a terminologia de um fabricante comum, e não de um padrão.

### 2.7 O que cada modo e aba do simulador mostram

- **Topologia:** um switch com **quatro portas** e os hosts ligados a elas. O destaque mostra o caminho de cada quadro, inclusive a inundação para várias portas.
- **Diagrama de sequência:** cada seta é um quadro, e o switch aparece decidindo entre aprender, encaminhar, filtrar e inundar.
- **Aba Tabela de endereços:** os MACs aprendidos e a porta de cada um, no instante atual.
- **Aba Decisões:** a decisão do switch para cada quadro (aprender, encaminhar, filtrar ou inundar) e o motivo.
- **Modos:** *Aprendizado e encaminhamento* (os três passos), *Inundação de MAC e segurança de porta* (tabela cheia e defesa) e *Broadcast, multicast e reservados*.

Para os três passos, use "Primeiro frame: inundação e aprendizado", "Destinos já conhecidos" e "Origem e destino na mesma porta". Para as mudanças na tabela, use "Host que muda de porta" e "Envelhecimento da entrada". Para o ponto fraco da tabela, use "Tabela cheia: A e B ficam expostos" e, para as defesas, "Segurança de porta: protect", "restrict" e "shutdown". Para os tipos de destino, use "Broadcast é inundado", "Multicast sem snooping", "Multicast com IGMP snooping" e "BPDU e LLDP não são encaminhados".

### 2.8 Limites do modelo e do diagrama

- É **um só switch**, sem VLANs, sem spanning tree e sem agregação de enlaces. Os endereços MAC e IP são de documentação ([RFC 9542](https://www.rfc-editor.org/rfc/rfc9542) e [RFC 5737](https://www.rfc-editor.org/rfc/rfc5737)).
- A tabela do modo de inundação tem 4 ou 6 entradas, e a de um switch real guarda de milhares a centenas de milhares. Quando a tabela enche, equipamentos reais variam: alguns removem entradas antigas, outros descartam o quadro.
- Não há colisões, modos de encaminhamento (*store-and-forward* e *cut-through*), velocidade de porta nem negociação automática. Os tempos de trânsito são didáticos.
- Não são citadas cláusulas do IEEE 802.1D e do 802.1Q, por falta de um texto aberto para conferência: confira o texto oficial do IEEE antes de citar uma.

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

- [Figura 4.1a](#41-aprendizado-e-encaminhamento): topologia do modo "Aprendizado e encaminhamento", variante a
- [Figura 4.1b](#41-aprendizado-e-encaminhamento): topologia do modo "Aprendizado e encaminhamento", variante b
- [Figura 4.2](#42-inundação-de-mac-e-segurança-de-porta): topologia do modo "Inundação de MAC e segurança de porta"
- [Figura 4.3](#43-broadcast-multicast-e-reservados): topologia do modo "Broadcast, multicast e reservados"

**Tipo B (sequência)**

- [Figura 7.1.1](#711-primeiro-frame-inundação-e-aprendizado): sequência de "Primeiro frame: inundação e aprendizado"
- [Figura 7.1.2](#712-destino-que-não-responde): sequência de "Destino que não responde"
- [Figura 7.1.3](#713-broadcast-arp-request): sequência de "Broadcast (ARP Request)"
- [Figura 7.1.4](#714-destinos-já-conhecidos): sequência de "Destinos já conhecidos"
- [Figura 7.1.5](#715-origem-e-destino-na-mesma-porta): sequência de "Origem e destino na mesma porta"
- [Figura 7.1.6](#716-host-que-muda-de-porta): sequência de "Host que muda de porta"
- [Figura 7.1.7](#717-envelhecimento-da-entrada): sequência de "Envelhecimento da entrada"
- [Figura 7.2.1](#721-sem-ataque): sequência de "Sem ataque"
- [Figura 7.2.2](#722-tabela-cheia-a-e-b-ficam-expostos): sequência de "Tabela cheia: A e B ficam expostos"
- [Figura 7.2.3](#723-a-e-b-já-estavam-na-tabela): sequência de "A e B já estavam na tabela"
- [Figura 7.2.4](#724-segurança-de-porta-protect): sequência de "Segurança de porta: protect"
- [Figura 7.2.5](#725-segurança-de-porta-restrict): sequência de "Segurança de porta: restrict"
- [Figura 7.2.6](#726-segurança-de-porta-shutdown): sequência de "Segurança de porta: shutdown"
- [Figura 7.3.1](#731-broadcast-é-inundado): sequência de "Broadcast é inundado"
- [Figura 7.3.2](#732-multicast-sem-snooping): sequência de "Multicast sem snooping"
- [Figura 7.3.3](#733-multicast-com-igmp-snooping): sequência de "Multicast com IGMP snooping"
- [Figura 7.3.4](#734-grupo-sem-assinantes): sequência de "Grupo sem assinantes"
- [Figura 7.3.5](#735-bpdu-e-lldp-não-são-encaminhados): sequência de "BPDU e LLDP não são encaminhados"

## 4. Topologia

Figuras do Tipo A, uma por modo (e uma por variante do desenho, quando a rede muda entre cenários). Foram geradas a partir da mesma definição de topologia que a bancada usa.

### 4.1 Aprendizado e encaminhamento

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.10"]
  n_b["Host B<br/>192.168.1.20"]
  n_sw{{"Switch<br/>camada 2"}}
  n_hub{{"Hub<br/>repetidor"}}
  n_c["Host C<br/>192.168.1.30"]
  n_d["Host D<br/>192.168.1.40"]
  n_a -- "p1" --- n_sw
  n_b -- "p2" --- n_sw
  n_sw -- "p3" --- n_hub
  n_hub --- n_c
  n_hub --- n_d
```

*Figura 4.1a (Tipo A, topologia).* Elementos do modo "Aprendizado e encaminhamento": Host A (192.168.1.10); Host B (192.168.1.20); Switch (camada 2); Hub (repetidor); Host C (192.168.1.30); Host D (192.168.1.40). Vale para os cenários (7.1.1 a 7.1.5; 7.1.7).

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.10"]
  n_b["Host B<br/>192.168.1.20"]
  n_sw{{"Switch<br/>camada 2"}}
  n_hub{{"Hub<br/>repetidor"}}
  n_c["Host C<br/>192.168.1.30"]
  n_d["Host D<br/>192.168.1.40"]
  n_a -- "p1" --- n_sw
  n_b -- "p4" --- n_sw
  n_sw -- "p3" --- n_hub
  n_hub --- n_c
  n_hub --- n_d
```

*Figura 4.1b (Tipo A, topologia).* Elementos do modo "Aprendizado e encaminhamento": Host A (192.168.1.10); Host B (192.168.1.20); Switch (camada 2); Hub (repetidor); Host C (192.168.1.30); Host D (192.168.1.40). Vale para os cenários (7.1.6).

### 4.2 Inundação de MAC e segurança de porta

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.10"]
  n_b["Host B<br/>192.168.1.20"]
  n_sw{{"Switch<br/>camada 2"}}
  n_m["Host M<br/>192.168.1.66"]
  n_a -- "p1" --- n_sw
  n_b -- "p2" --- n_sw
  n_sw -- "p3" --- n_m
  classDef atacante fill:#fde2e2,stroke:#b42318,color:#111
  class n_m atacante
```

*Figura 4.2 (Tipo A, topologia).* Elementos do modo "Inundação de MAC e segurança de porta": Host A (192.168.1.10); Host B (192.168.1.20); Switch (camada 2); Host M (192.168.1.66). Vale para todos os cenários do modo (7.2.1 a 7.2.6).

### 4.3 Broadcast, multicast e reservados

```mermaid
flowchart LR
  n_a["Host A<br/>192.168.1.10"]
  n_b["Host B<br/>192.168.1.20"]
  n_sw{{"Switch<br/>camada 2"}}
  n_hub{{"Hub<br/>repetidor"}}
  n_c["Host C<br/>192.168.1.30"]
  n_d["Host D<br/>192.168.1.40"]
  n_a -- "p1" --- n_sw
  n_b -- "p2" --- n_sw
  n_sw -- "p3" --- n_hub
  n_hub --- n_c
  n_hub --- n_d
```

*Figura 4.3 (Tipo A, topologia).* Elementos do modo "Broadcast, multicast e reservados": Host A (192.168.1.10); Host B (192.168.1.20); Switch (camada 2); Hub (repetidor); Host C (192.168.1.30); Host D (192.168.1.40). Vale para todos os cenários do modo (7.3.1 a 7.3.5).

## 5. Abas da bancada

Cenário, Captura, Mensagem, Tabela de endereços, Decisões, Experimento, Referência e Log.

## 6. Configurações (campos do painel)

### 6.1 Rede

- **RTT (ms)**. Valores: 1; 2; 5; 20; 100. Padrão: 2. Modos: todos.
  - Tempo de ida e volta na rede local.
  - Numa rede local Ethernet o RTT costuma ser de poucos milissegundos. Valores altos servem para ver o diagrama mais espaçado.
  - Não muda o que o switch faz, só os tempos mostrados.

### 6.2 Situação

- **O que acontece**. Valores: Primeiro frame: tabela vazia; Destinos já conhecidos; Broadcast (ARP Request); Origem e destino na mesma porta; Host que muda de porta; Envelhecimento da entrada. Padrão: Primeiro frame: tabela vazia. Modos: Aprendizado e encaminhamento.
  - Qual das seis histórias do aprendizado será simulada.
  - **Tabela vazia:** o destino é desconhecido, o switch inunda e aprende a origem. A resposta revela a porta de B.
  - **Destinos conhecidos:** a tabela já tem os hosts, e o frame sai só pela porta certa.
  - **Broadcast:** nunca consta da tabela, é sempre inundado.
  - **Mesma porta:** C e D estão atrás de um hub; o frame de C para D não precisa sair pelo switch.
  - **Mudança de porta:** o cabo de B vai para outra porta e a tabela fica desatualizada até B transmitir.
  - **Envelhecimento:** sem tráfego, a entrada expira e o destino volta a ser desconhecido.
- **O que acontece**. Valores: Broadcast (ARP Request); Multicast IP (grupo 239.1.1.1); Endereços de grupo reservados. Padrão: Broadcast (ARP Request). Modos: Broadcast, multicast e reservados.
  - Que tipo de endereço de destino é enviado.
  - **Broadcast:** todos os hosts do domínio de broadcast recebem.
  - **Multicast:** só os hosts que assinaram o grupo deveriam receber; o que o switch faz depende do IGMP snooping.
  - **Reservados:** endereços de 01-80-C2-00-00-00 a 0F são consumidos pela ponte, nunca encaminhados.

### 6.3 Tabela

- **Tempo de envelhecimento (s)** (ajuste avançado). Valores: 60; 300 (padrão do IEEE 802.1D); 600. Padrão: 300 (padrão do IEEE 802.1D). Modos: Aprendizado e encaminhamento.
  - Quanto tempo uma entrada dinâmica sobrevive sem receber tráfego.
  - Cada frame recebido de uma origem renova o relógio da entrada dela. Passado o tempo sem tráfego, a entrada é removida.
  - O padrão recomendado pelo IEEE 802.1D é de 300 s. Tempos curtos liberam espaço na tabela, mas aumentam a inundação.
- **A e B antes do ataque**. Valores: Fora da tabela (nunca falaram ou expiraram); Já na tabela. Padrão: Fora da tabela (nunca falaram ou expiraram). Modos: Inundação de MAC e segurança de porta.
  - Se o switch já conhecia A e B quando o ataque começou.
  - **Já na tabela:** o ataque não remove entradas. A e B continuam sendo encontrados enquanto as entradas não expirarem.
  - **Fora da tabela:** A e B não podem mais ser aprendidos, e o tráfego entre eles é inundado.
  - Na prática, o ataque mantido por tempo suficiente expõe até quem já estava na tabela: as entradas expiram em 300 s sem tráfego e não podem ser recriadas.
- **Capacidade da tabela (entradas)** (ajuste avançado). Valores: 4; 6. Padrão: 4. Modos: Inundação de MAC e segurança de porta.
  - Quantos endereços a tabela comporta.
  - Um switch real guarda de milhares a centenas de milhares de endereços. O simulador usa valores pequenos para que a tabela encha dentro do diagrama.
  - Não muda a lógica, só o número de frames forjados necessários.

### 6.4 Falhas

- **B responde**. Valores: caixa de seleção. Padrão: sim. Modos: Aprendizado e encaminhamento.
  - Vale para os cenários em que B recebe uma pergunta.
  - Desmarcado, B não responde. O switch só aprende um host quando recebe um frame **vindo dele**, então B continua desconhecido e os frames para B continuam inundados.

### 6.5 Ataque

- **M inunda a tabela com MACs forjados**. Valores: caixa de seleção. Padrão: sim. Modos: Inundação de MAC e segurança de porta.
  - Liga ou desliga a inundação de MAC, para comparar.
  - M envia frames com um endereço de origem diferente a cada vez. O switch tenta aprender todos e gasta uma entrada da tabela por frame.
  - O ataque só funciona na porta em que M está ligado, mas afeta o switch inteiro.

### 6.6 Defesa

- **Segurança de porta na porta 3**. Valores: Nenhuma; Máximo de 1 MAC: protect (descarta em silêncio); Máximo de 1 MAC: restrict (descarta e alerta); Máximo de 1 MAC: shutdown (desativa a porta). Padrão: Nenhuma. Modos: Inundação de MAC e segurança de porta.
  - Recurso de fabricantes que limita os MACs aceitos em cada porta.
  - **protect:** descarta os frames de MACs em excesso, sem registrar.
  - **restrict:** descarta, conta as violações e gera alerta.
  - **shutdown:** desativa a porta na primeira violação (err-disable); é preciso reativá-la.
  - Os nomes dos modos seguem os de um fabricante muito comum; outros usam termos diferentes. Não é um recurso do IEEE.

### 6.7 Multicast

- **IGMP snooping ligado**. Valores: caixa de seleção. Padrão: não. Modos: Broadcast, multicast e reservados.
  - O switch lê os relatórios IGMP para saber quem assinou cada grupo ([RFC 4541](https://www.rfc-editor.org/rfc/rfc4541)).
  - Desligado, o switch trata o multicast como broadcast e o inunda por todas as portas.
  - Ligado, encaminha o grupo só às portas com assinantes. Numa rede real é preciso também um **consultor** (querier) IGMP, para que as assinaturas sejam renovadas.
- **O host B assinou o grupo**. Valores: caixa de seleção. Padrão: sim. Modos: Broadcast, multicast e reservados.
  - Se existe algum receptor do grupo.
  - Marcado, B envia um relatório IGMP e passa a ser assinante.
  - Desmarcado, ninguém quer o grupo. Com snooping, o tráfego não sai por nenhuma porta de host (o comportamento para grupos sem assinante varia entre equipamentos); sem snooping, é inundado do mesmo jeito.

## 7. Cenários

### 7.1 Modo: Aprendizado e encaminhamento

> **Grupo:** Aprendizado

Um switch começa sem saber onde estão os hosts. Ele aprende olhando a origem de cada frame que chega e associa o endereço MAC à porta de entrada.

#### 7.1.1 Primeiro frame: inundação e aprendizado

*Inunda, aprende a origem e, na resposta, aprende o destino.*

**Configuração aplicada:** O que acontece = first; Tempo de envelhecimento (s) = 300; B responde = sim

A tabela está vazia. O switch **não sabe onde B está** e inunda o frame por todas as portas, mas já aprende A. A resposta de B revela a porta 2, e o frame seguinte sai só por ela.

**Conceito.** O switch aprende pela origem: cada frame que chega associa o MAC de origem à porta de entrada. Como o MAC de B ainda é desconhecido, o primeiro frame é inundado por todas as portas, menos a de entrada. Quando B responde, o switch aprende B, e os frames seguintes vão só à porta 2.

**O que observar**

- O primeiro frame chega a B, ao hub (C e D) e é descartado por quem não é o destino.
- Depois da resposta, a tabela tem A (porta 1) e B (porta 2).
- O terceiro frame sai só pela porta 2.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Tabela vazia: destino desconhecido
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_c: Echo Request
  n_sw ->> n_d: Echo Request
  Note over n_a,n_d: 2. A resposta de B revela a porta de B
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  Note over n_a,n_d: 3. Os frames seguintes vão só a B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
```

*Figura 7.1.1 (Tipo B, sequência).* Mensagens do cenário "Primeiro frame: inundação e aprendizado", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 8 mensagens, numeradas de 1 a 8 na ordem da comunicação (em 3 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Aprendizado e encaminhamento", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | A para B, destino desconhecido | inundado |
| Echo Reply | B para A, destino conhecido | só porta 1 |
| Echo Request | A para B, destino conhecido | só porta 2 |

**Por que importa.** É o mecanismo que torna o switch melhor que o hub: depois de aprender, cada frame ocupa apenas o enlace do destino.

#### 7.1.2 Destino que não responde

*Sem frame vindo de B, ele continua desconhecido.*

**Configuração aplicada:** O que acontece = first; Tempo de envelhecimento (s) = 300; B responde = não

B não responde. O switch só aprende quem **transmite**, então B continua desconhecido e todo frame para B é inundado.

**Conceito.** O switch só aprende o endereço de quem transmite. Se B nunca envia nada, o switch não sabe onde ele está, e todo frame para B é inundado.

**O que observar**

- A tabela tem só A.
- Os dois frames para B são inundados.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Tabela vazia: destino desconhecido
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_c: Echo Request
  n_sw ->> n_d: Echo Request
  Note over n_a,n_d: 2. B não responde: continua desconhecido
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_c: Echo Request
  n_sw ->> n_d: Echo Request
```

*Figura 7.1.2 (Tipo B, sequência).* Mensagens do cenário "Destino que não responde", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 8 mensagens, numeradas de 1 a 8 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Aprendizado e encaminhamento", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | A para B | inundado |
| Echo Request | A para B | inundado outra vez |

**Por que importa.** Hosts que só recebem (um servidor de captura, uma impressora desligada) fazem o switch inundar tráfego para eles.

#### 7.1.3 Broadcast (ARP Request)

*Broadcast nunca consta da tabela: sempre é inundado.*

**Configuração aplicada:** O que acontece = bcast; Tempo de envelhecimento (s) = 300; B responde = sim

O ARP Request vai a **ff:ff:ff:ff:ff:ff**, que nunca consta da tabela: é sempre inundado. A resposta, em unicast, já segue só para a porta de A.

**Conceito.** O destino ff:ff:ff:ff:ff:ff é recebido por todos. O switch não o procura na tabela e o inunda por todas as portas, menos a de entrada. A resposta ARP, em unicast, usa a tabela normalmente.

**O que observar**

- A requisição chega a B, C e D.
- A resposta vai só à porta 1.
- A tabela termina com A e B.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. ARP Request em broadcast
  n_a ->> n_sw: ARP Request
  n_sw ->> n_b: ARP Request
  n_sw ->> n_c: ARP Request
  n_sw ->> n_d: ARP Request
  Note over n_a,n_d: 2. Resposta unicast: B é aprendido
  n_b ->> n_sw: ARP Reply
  n_sw ->> n_a: ARP Reply
```

*Figura 7.1.3 (Tipo B, sequência).* Mensagens do cenário "Broadcast (ARP Request)", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Aprendizado e encaminhamento", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | quem tem 192.168.1.20? | broadcast |
| ARP Reply | 192.168.1.20 está em 00:00:5e:00:53:14 | só porta 1 |

**Por que importa.** O domínio de broadcast é o conjunto de portas que recebe esses frames. Redes locais grandes demais têm broadcast demais.

> **Grupo:** Encaminhamento

Com a tabela preenchida, o switch decide pelo MAC de destino: encaminha para uma porta, ou filtra quando o destino está do mesmo lado de onde o frame veio.

#### 7.1.4 Destinos já conhecidos

*Cada frame sai só pela porta do destino.*

**Configuração aplicada:** O que acontece = known; Tempo de envelhecimento (s) = 300; B responde = sim

A tabela já tem os quatro hosts. O frame para B sai **só pela porta 2**. O frame para C sai pela porta 3, onde o hub o repete também a D.

**Conceito.** Com a tabela preenchida, o switch encaminha por unicast. Atrás de um hub, porém, todos os hosts do segmento ouvem o frame, porque o hub repete para todas as suas portas.

**O que observar**

- O frame para B sai só pela porta 2.
- O frame para C sai pela porta 3 e o hub o repete a D, que o descarta.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Destino conhecido em outra porta
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  Note over n_a,n_d: 2. Destino atrás do hub (porta 3)
  n_a ->> n_sw: Echo Request
  n_sw ->> n_c: Echo Request
  n_sw ->> n_d: Echo Request
```

*Figura 7.1.4 (Tipo B, sequência).* Mensagens do cenário "Destinos já conhecidos", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 5 mensagens, numeradas de 1 a 5 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Aprendizado e encaminhamento", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | A para B | só porta 2 |
| Echo Request | A para C | só porta 3, repetido pelo hub |

**Por que importa.** Um switch isola o tráfego por porta. Um hub não isola nada dentro do próprio segmento.

#### 7.1.5 Origem e destino na mesma porta

*O switch não devolve o frame pela porta de onde veio.*

**Configuração aplicada:** O que acontece = filter; Tempo de envelhecimento (s) = 300; B responde = sim

C e D estão atrás do mesmo hub. O frame de C para D **é filtrado**: o destino está na porta de entrada, e A e B não são incomodados.

**Conceito.** Se o destino está na mesma porta por onde o frame entrou, o switch o filtra: o destino já o recebeu direto pelo segmento. Encaminhar seria desperdício e duplicaria o frame.

**O que observar**

- O frame de C para D foi ouvido por D através do hub.
- A e B não receberam nada.
- O frame de C para A sai só pela porta 1.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Origem e destino na mesma porta
  n_c ->> n_sw: Echo Request
  n_c ->> n_d: Echo Request
  Note over n_a,n_d: 2. Para comparar: destino em outra porta
  n_c ->> n_sw: Echo Request
  n_c ->> n_d: Echo Request
  n_sw ->> n_a: Echo Request
```

*Figura 7.1.5 (Tipo B, sequência).* Mensagens do cenário "Origem e destino na mesma porta", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 5 mensagens, numeradas de 1 a 5 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Aprendizado e encaminhamento", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | C para D | filtrado |
| Echo Request | C para A | só porta 1 |

**Por que importa.** A filtragem preserva a largura de banda dos outros segmentos.

> **Grupo:** Mudanças na tabela

A tabela não é permanente. Muda quando um host troca de porta e expira quando o host fica em silêncio.

#### 7.1.6 Host que muda de porta

*Depois da mudança, a tabela mente até B transmitir.*

**Configuração aplicada:** O que acontece = move; Tempo de envelhecimento (s) = 300; B responde = sim

O cabo de B vai da porta 2 para a 4. A tabela **continua apontando para a porta 2** e os frames para B se perdem, até B transmitir e o switch atualizar a entrada.

**Conceito.** A tabela associa o MAC de B à porta 2. Quando o cabo vai para a porta 4, o switch continua enviando à porta 2, onde não há mais ninguém. Assim que B transmite, o switch vê o MAC dele na porta 4 e corrige a entrada.

**O que observar**

- O frame enviado depois da mudança se perde.
- A entrada de B muda da porta 2 para a 4 quando B transmite.
- O frame seguinte chega.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. B está na porta 2
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  Note over n_a,n_d: 2. B é mudado para a porta 4
  n_a ->> n_sw: Echo Request
  n_sw -x n_b: Echo Request
  Note over n_a,n_d: 3. B transmite e a tabela se corrige
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  Note over n_a,n_d: 4. O tráfego volta a chegar a B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
```

*Figura 7.1.6 (Tipo B, sequência).* Mensagens do cenário "Host que muda de porta", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 8 mensagens, numeradas de 1 a 8 na ordem da comunicação (em 4 fases; 1 perdida). Corresponde ao diagrama de sequência e à aba Captura, no modo "Aprendizado e encaminhamento", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | A para B, na porta antiga | perdido |
| Echo Reply | B para A, da porta nova | atualiza a tabela |
| Echo Request | A para B | só porta 4 |

**Por que importa.** Por isso hosts móveis e servidores que trocam de porta costumam enviar um ARP gratuito: ele faz o switch aprender a porta nova na hora.

#### 7.1.7 Envelhecimento da entrada

*Sem tráfego, a entrada expira e o destino volta a ser desconhecido.*

**Configuração aplicada:** O que acontece = aging; Tempo de envelhecimento (s) = 300; B responde = sim

Passam-se 300 s sem tráfego. As entradas **expiram**, o destino volta a ser desconhecido e o frame seguinte é inundado outra vez.

**Conceito.** Cada entrada dinâmica tem um relógio, renovado quando o host transmite. Passado o tempo de envelhecimento (padrão de 300 s no IEEE 802.1D), a entrada é removida. O próximo frame para esse destino é inundado outra vez.

**O que observar**

- As duas entradas expiram durante o silêncio.
- O frame depois do silêncio é inundado.
- A resposta recria a entrada de B.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Tráfego recente
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  Note over n_a,n_d: 2. Silêncio por 300 s
  Note over n_a,n_d: 3. Entradas expiradas: o destino é desconhecido
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_c: Echo Request
  n_sw ->> n_d: Echo Request
  Note over n_a,n_d: 4. A resposta recria a entrada de B
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
```

*Figura 7.1.7 (Tipo B, sequência).* Mensagens do cenário "Envelhecimento da entrada", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 8 mensagens, numeradas de 1 a 8 na ordem da comunicação (em 4 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Aprendizado e encaminhamento", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | A para B, antes do silêncio | só porta 2 |
| Echo Request | A para B, depois do silêncio | inundado |
| Echo Reply | B para A | recria a entrada de B |

**Por que importa.** O envelhecimento mantém a tabela pequena e correta, ao custo de inundações ocasionais.

### 7.2 Modo: Inundação de MAC e segurança de porta

> **Grupo:** Referência

Antes de olhar o ataque, convém ver o comportamento normal da tabela de endereços.

#### 7.2.1 Sem ataque

*Sem ataque, só o primeiro frame é inundado.*

**Configuração aplicada:** M inunda a tabela com MACs forjados = não; A e B antes do ataque = absent; Capacidade da tabela (entradas) = 4; Segurança de porta na porta 3 = none

Sem ataque, a tabela vazia faz o **primeiro** frame ser inundado (e M o recebe), mas depois o switch aprende A e B e M não vê mais nada.

**Conceito.** Com a tabela vazia, o primeiro frame de A para B é inundado, e M também o recebe. A resposta de B ensina a porta de B ao switch, e dali em diante o tráfego é unicast.

**O que observar**

- M recebe um único frame de A e B.
- A tabela termina com A e B.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_m as Host M<br/>porta 3 (atacante)
  Note over n_a,n_m: 2. Tráfego legítimo entre A e B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_m: Echo Request
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
```

*Figura 7.2.1 (Tipo B, sequência).* Mensagens do cenário "Sem ataque", na ordem do tempo, entre Host A, Host B, Switch, Host M: 7 mensagens, numeradas de 1 a 7 na ordem da comunicação (em 1 fase). Corresponde ao diagrama de sequência e à aba Captura, no modo "Inundação de MAC e segurança de porta", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Echo Request | A para B | inundado, M recebe uma cópia |
| Echo Reply | B para A | só porta 1 |
| Echo Request | A para B | só porta 2 |

**Por que importa.** É a referência: mesmo em condições normais o switch inunda o que não conhece.

> **Grupo:** O ataque e seu efeito

A tabela de endereços tem tamanho limitado. Quando ela enche, o switch deixa de aprender e passa a inundar o que não conhece, o que expõe o tráfego a quem está na rede local.

#### 7.2.2 Tabela cheia: A e B ficam expostos

*Com a tabela cheia, o tráfego de A e B vira inundação.*

**Configuração aplicada:** M inunda a tabela com MACs forjados = sim; A e B antes do ataque = absent; Capacidade da tabela (entradas) = 4; Segurança de porta na porta 3 = none

M enche a tabela com origens forjadas. A e B **não podem mais ser aprendidos**, e todo o tráfego entre eles é inundado, inclusive para M.

**Conceito.** Cada frame forjado consome uma entrada. Quando a tabela enche, o switch não aprende mais ninguém. Como A e B não podem ser aprendidos, todo frame entre eles tem destino desconhecido e é inundado, e M o recebe.

**O que observar**

- A tabela termina cheia de endereços forjados.
- A tabela marca "não é aprendido" para A e B.
- M recebe os três frames legítimos.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_m as Host M<br/>porta 3 (atacante)
  Note over n_a,n_m: 1. M inunda a tabela com origens forjadas
  n_m ->> n_sw: Frame forjado nº 1
  n_sw ->> n_a: Frame forjado nº 1
  n_sw ->> n_b: Frame forjado nº 1
  n_m ->> n_sw: Frame forjado nº 2
  n_sw ->> n_a: Frame forjado nº 2
  n_sw ->> n_b: Frame forjado nº 2
  n_m ->> n_sw: Frame forjado nº 3
  n_sw ->> n_a: Frame forjado nº 3
  n_sw ->> n_b: Frame forjado nº 3
  n_m ->> n_sw: Frame forjado nº 4
  n_sw ->> n_a: Frame forjado nº 4
  n_sw ->> n_b: Frame forjado nº 4
  Note over n_a,n_m: 2. Tráfego legítimo entre A e B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_m: Echo Request
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  n_sw ->> n_m: Echo Reply
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_m: Echo Request
```

*Figura 7.2.2 (Tipo B, sequência).* Mensagens do cenário "Tabela cheia: A e B ficam expostos", na ordem do tempo, entre Host A, Host B, Switch, Host M: 21 mensagens, numeradas de 1 a 21 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Inundação de MAC e segurança de porta", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Frames forjados | um por entrada da tabela | M para todos |
| Echo Request e Reply | A e B | inundados, M recebe cópia |

**Por que importa.** Quem está na mesma rede local passa a ver tráfego que não era dele, e o switch passa a se comportar como um hub. Redes de acesso são o alvo típico.

#### 7.2.3 A e B já estavam na tabela

*Entradas existentes não são apagadas pelo ataque.*

**Configuração aplicada:** M inunda a tabela com MACs forjados = sim; A e B antes do ataque = present; Capacidade da tabela (entradas) = 4; Segurança de porta na porta 3 = none

A tabela enche, mas as entradas de A e B **já existiam** e continuam valendo. O tráfego segue unicast. O risco volta quando elas expiram.

**Conceito.** O ataque ocupa as vagas livres, mas não remove as entradas de A e B, que continuam valendo. O tráfego entre eles segue unicast. O risco volta quando as entradas expiram e não podem mais ser recriadas.

**O que observar**

- A tabela enche com as entradas de A e B mais as forjadas.
- M não recebe nenhum frame legítimo.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_m as Host M<br/>porta 3 (atacante)
  Note over n_a,n_m: 1. M inunda a tabela com origens forjadas
  n_m ->> n_sw: Frame forjado nº 1
  n_sw ->> n_a: Frame forjado nº 1
  n_sw ->> n_b: Frame forjado nº 1
  n_m ->> n_sw: Frame forjado nº 2
  n_sw ->> n_a: Frame forjado nº 2
  n_sw ->> n_b: Frame forjado nº 2
  n_m ->> n_sw: Frame forjado nº 3
  n_sw ->> n_a: Frame forjado nº 3
  n_sw ->> n_b: Frame forjado nº 3
  n_m ->> n_sw: Frame forjado nº 4
  n_sw ->> n_a: Frame forjado nº 4
  n_sw ->> n_b: Frame forjado nº 4
  Note over n_a,n_m: 2. Tráfego legítimo entre A e B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
```

*Figura 7.2.3 (Tipo B, sequência).* Mensagens do cenário "A e B já estavam na tabela", na ordem do tempo, entre Host A, Host B, Switch, Host M: 18 mensagens, numeradas de 1 a 18 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Inundação de MAC e segurança de porta", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Frames forjados | ocupam as vagas livres | M para todos |
| Echo Request e Reply | A e B | só nas portas deles |

**Por que importa.** Um ataque contínuo vence o envelhecimento: quem fica em silêncio por 300 s perde a entrada, e o primeiro frame seguinte já é inundado.

> **Grupo:** Defesas

A defesa limita o que cada porta pode ensinar ao switch. Nenhuma substitui a cifra de ponta a ponta.

#### 7.2.4 Segurança de porta: protect

*A porta aceita um só MAC; o resto é descartado.*

**Configuração aplicada:** M inunda a tabela com MACs forjados = sim; A e B antes do ataque = absent; Capacidade da tabela (entradas) = 4; Segurança de porta na porta 3 = protect

A porta 3 aceita **um só MAC**. Os demais frames são descartados em silêncio, a tabela não enche e M não vê o tráfego de A e B.

**Conceito.** Na segurança de porta, a porta guarda no máximo um MAC. Frames de outros endereços são descartados antes de chegar à tabela. No modo protect isso é silencioso: ninguém é avisado.

**O que observar**

- O primeiro frame forjado é aceito e os outros são descartados.
- A tabela não enche.
- M só recebe o primeiro frame de A para B, como em qualquer rede.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_m as Host M<br/>porta 3 (atacante)
  Note over n_a,n_m: 1. M inunda a tabela com origens forjadas
  n_m ->> n_sw: Frame forjado nº 1
  n_sw ->> n_a: Frame forjado nº 1
  n_sw ->> n_b: Frame forjado nº 1
  n_m -x n_sw: Frame forjado nº 2
  n_m -x n_sw: Frame forjado nº 3
  n_m -x n_sw: Frame forjado nº 4
  Note over n_a,n_m: 2. Tráfego legítimo entre A e B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_m: Echo Request
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
```

*Figura 7.2.4 (Tipo B, sequência).* Mensagens do cenário "Segurança de porta: protect", na ordem do tempo, entre Host A, Host B, Switch, Host M: 13 mensagens, numeradas de 1 a 13 na ordem da comunicação (em 2 fases; 3 perdidas). Corresponde ao diagrama de sequência e à aba Captura, no modo "Inundação de MAC e segurança de porta", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Frames forjados | descartados a partir do segundo | M |

**Por que importa.** A defesa impede a inundação, mas sem alerta o ataque passa despercebido.

#### 7.2.5 Segurança de porta: restrict

*Descarta e avisa.*

**Configuração aplicada:** M inunda a tabela com MACs forjados = sim; A e B antes do ataque = absent; Capacidade da tabela (entradas) = 4; Segurança de porta na porta 3 = restrict

Igual ao protect, mas cada violação é **contada e gera alerta**: a equipe fica sabendo do ataque.

**Conceito.** O modo restrict descarta os frames em excesso, como o protect, e incrementa um contador de violações e emite alerta (por exemplo, uma mensagem de log ou um trap SNMP).

**O que observar**

- O estado da porta 3 mostra o número de violações.
- O log registra cada descarte.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_m as Host M<br/>porta 3 (atacante)
  Note over n_a,n_m: 1. M inunda a tabela com origens forjadas
  n_m ->> n_sw: Frame forjado nº 1
  n_sw ->> n_a: Frame forjado nº 1
  n_sw ->> n_b: Frame forjado nº 1
  n_m -x n_sw: Frame forjado nº 2
  n_m -x n_sw: Frame forjado nº 3
  n_m -x n_sw: Frame forjado nº 4
  Note over n_a,n_m: 2. Tráfego legítimo entre A e B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_m: Echo Request
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
```

*Figura 7.2.5 (Tipo B, sequência).* Mensagens do cenário "Segurança de porta: restrict", na ordem do tempo, entre Host A, Host B, Switch, Host M: 13 mensagens, numeradas de 1 a 13 na ordem da comunicação (em 2 fases; 3 perdidas). Corresponde ao diagrama de sequência e à aba Captura, no modo "Inundação de MAC e segurança de porta", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Frames forjados | descartados com alerta | M |

**Por que importa.** A equipe de rede é avisada e pode investigar o host da porta.

#### 7.2.6 Segurança de porta: shutdown

*A porta é desativada na primeira violação.*

**Configuração aplicada:** M inunda a tabela com MACs forjados = sim; A e B antes do ataque = absent; Capacidade da tabela (entradas) = 4; Segurança de porta na porta 3 = shutdown

Na primeira violação, a porta 3 é **desativada** (err-disable) e as entradas dela são removidas. É preciso reativá-la.

**Conceito.** O modo shutdown coloca a porta em err-disable ao primeiro frame em excesso: o enlace cai, as entradas da porta saem da tabela e M deixa de enviar e de receber. É a reação mais forte e exige reativação manual (ou um temporizador de recuperação).

**O que observar**

- A porta 3 vai a "desativada".
- M não recebe mais nenhum frame.
- A tabela volta a ter vagas.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_m as Host M<br/>porta 3 (atacante)
  Note over n_a,n_m: 1. M inunda a tabela com origens forjadas
  n_m ->> n_sw: Frame forjado nº 1
  n_sw ->> n_a: Frame forjado nº 1
  n_sw ->> n_b: Frame forjado nº 1
  n_m -x n_sw: Frame forjado nº 2
  Note over n_a,n_m: 2. Tráfego legítimo entre A e B
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_b ->> n_sw: Echo Reply
  n_sw ->> n_a: Echo Reply
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
```

*Figura 7.2.6 (Tipo B, sequência).* Mensagens do cenário "Segurança de porta: shutdown", na ordem do tempo, entre Host A, Host B, Switch, Host M: 10 mensagens, numeradas de 1 a 10 na ordem da comunicação (em 2 fases; 1 perdida). Corresponde ao diagrama de sequência e à aba Captura, no modo "Inundação de MAC e segurança de porta", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Frames forjados | o segundo causa a violação | M |

**Por que importa.** Interrompe o ataque, mas um erro de configuração ou um segundo equipamento legítimo na porta derruba o serviço do usuário.

### 7.3 Modo: Broadcast, multicast e reservados

> **Grupo:** Broadcast

O endereço de broadcast nunca consta da tabela. Todo frame enviado a ele vai a todos os hosts do mesmo domínio de broadcast.

#### 7.3.1 Broadcast é inundado

*Broadcast sai por todas as portas, menos a de entrada.*

**Configuração aplicada:** O que acontece = bcast; IGMP snooping ligado = não; O host B assinou o grupo = sim

O ARP Request em broadcast sai por **todas as portas**, menos a de entrada. Todos os hosts da rede local o recebem.

**Conceito.** O endereço ff:ff:ff:ff:ff:ff é aceito por todas as placas. O switch o inunda por todas as portas, menos a de entrada. A resposta ARP volta em unicast.

**O que observar**

- B, C e D recebem a requisição.
- A resposta vai só à porta 1.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. ARP Request em broadcast
  n_a ->> n_sw: ARP Request
  n_sw ->> n_b: ARP Request
  n_sw ->> n_c: ARP Request
  n_sw ->> n_d: ARP Request
  Note over n_a,n_d: 2. Resposta unicast
  n_b ->> n_sw: ARP Reply
  n_sw ->> n_a: ARP Reply
```

*Figura 7.3.1 (Tipo B, sequência).* Mensagens do cenário "Broadcast é inundado", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Broadcast, multicast e reservados", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| ARP Request | quem tem 192.168.1.20? | broadcast |
| ARP Reply | resposta de B | unicast |

**Por que importa.** Um switch não segmenta o domínio de broadcast. Para isso é preciso VLANs ou um roteador.

> **Grupo:** Multicast

O multicast IP usa endereços MAC de grupo. Sem ajuda, o switch não sabe quem pertence ao grupo e os trata como broadcast.

#### 7.3.2 Multicast sem snooping

*Sem snooping, o multicast é tratado como broadcast.*

**Configuração aplicada:** O que acontece = mcast; IGMP snooping ligado = não; O host B assinou o grupo = sim

Só B assinou o grupo, mas o switch **não sabe disso** e inunda o fluxo. A, C e D recebem tráfego que não pediram (a placa o descarta, mas o enlace carrega).

**Conceito.** O endereço MAC de grupo 01:00:5e:01:01:01 vem do IP 239.1.1.1 ([RFC 1112](https://www.rfc-editor.org/rfc/rfc1112), seção 6.4). Sem snooping, o switch não sabe quem assinou e inunda o fluxo. As placas dos hosts que não assinaram o descartam, mas os enlaces carregam o tráfego à toa.

**O que observar**

- O relatório IGMP de B também é inundado.
- O fluxo chega a A, C e D, que o descartam.
- O fluxo é inundado duas vezes.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Assinatura do grupo (IGMP)
  n_b ->> n_sw: IGMP Membership Report
  n_sw ->> n_a: IGMP Membership Report
  n_sw ->> n_c: IGMP Membership Report
  n_sw ->> n_d: IGMP Membership Report
  Note over n_a,n_d: 2. Fluxo enviado ao grupo 239.1.1.1
  n_a ->> n_sw: Dados do grupo nº 1
  n_sw ->> n_b: Dados do grupo nº 1
  n_sw ->> n_c: Dados do grupo nº 1
  n_sw ->> n_d: Dados do grupo nº 1
  n_a ->> n_sw: Dados do grupo nº 2
  n_sw ->> n_b: Dados do grupo nº 2
  n_sw ->> n_c: Dados do grupo nº 2
  n_sw ->> n_d: Dados do grupo nº 2
```

*Figura 7.3.2 (Tipo B, sequência).* Mensagens do cenário "Multicast sem snooping", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 12 mensagens, numeradas de 1 a 12 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Broadcast, multicast e reservados", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| IGMP Membership Report | B entra no grupo | inundado |
| Dados do grupo | fluxo para 239.1.1.1 | inundado |

**Por que importa.** Um fluxo de vídeo multicast inundado sobrecarrega todos os enlaces da rede local.

#### 7.3.3 Multicast com IGMP snooping

*Com snooping, o grupo só sai pela porta de B.*

**Configuração aplicada:** O que acontece = mcast; IGMP snooping ligado = sim; O host B assinou o grupo = sim

O switch lê o relatório IGMP de B e envia o grupo **só pela porta 2**.

**Conceito.** O IGMP snooping ([RFC 4541](https://www.rfc-editor.org/rfc/rfc4541)) lê os relatórios IGMP para saber que portas têm assinantes. O fluxo para 239.1.1.1 passa a sair só pela porta 2.

**O que observar**

- O relatório IGMP é consumido pelo switch.
- O estado "Grupo" mostra a porta 2.
- O fluxo chega só a B.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Assinatura do grupo (IGMP)
  n_b ->> n_sw: IGMP Membership Report
  Note over n_a,n_d: 2. Fluxo enviado ao grupo 239.1.1.1
  n_a ->> n_sw: Dados do grupo nº 1
  n_sw ->> n_b: Dados do grupo nº 1
  n_a ->> n_sw: Dados do grupo nº 2
  n_sw ->> n_b: Dados do grupo nº 2
```

*Figura 7.3.3 (Tipo B, sequência).* Mensagens do cenário "Multicast com IGMP snooping", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 5 mensagens, numeradas de 1 a 5 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Broadcast, multicast e reservados", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| IGMP Membership Report | B entra no grupo | lido pelo switch |
| Dados do grupo | fluxo para 239.1.1.1 | só porta 2 |

**Por que importa.** O snooping evita que o multicast ocupe enlaces sem receptores.

#### 7.3.4 Grupo sem assinantes

*Sem assinantes, o fluxo não sai por nenhuma porta de host.*

**Configuração aplicada:** O que acontece = mcast; IGMP snooping ligado = sim; O host B assinou o grupo = não

Ninguém assinou o grupo. Com snooping, o fluxo **não sai por nenhuma porta de host**.

**Conceito.** Com o snooping ligado e nenhuma porta de assinante, o switch não tem para onde enviar o grupo. A [RFC 4541](https://www.rfc-editor.org/rfc/rfc4541) menciona o envio às portas de roteador multicast; esse caso não está no simulador, que não tem roteador.

**O que observar**

- Nenhuma mensagem sai do switch.
- O estado do grupo é "sem assinantes".

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Assinatura do grupo (IGMP)
  Note over n_a,n_d: 2. Fluxo enviado ao grupo 239.1.1.1
  n_a ->> n_sw: Dados do grupo nº 1
  n_a ->> n_sw: Dados do grupo nº 2
```

*Figura 7.3.4 (Tipo B, sequência).* Mensagens do cenário "Grupo sem assinantes", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 2 mensagens, numeradas de 1 a 2 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Broadcast, multicast e reservados", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Dados do grupo | fluxo para 239.1.1.1 | sem portas de saída |

**Por que importa.** Mostra o ganho do snooping: o tráfego que ninguém quer não ocupa nenhum enlace de host.

> **Grupo:** Endereços reservados

Alguns endereços de grupo servem aos protocolos da própria ponte e nunca atravessam um switch.

#### 7.3.5 BPDU e LLDP não são encaminhados

*BPDU e LLDP são consumidos; um frame comum é inundado.*

**Configuração aplicada:** O que acontece = reserved; IGMP snooping ligado = não; O host B assinou o grupo = sim

Frames para **01-80-C2-00-00-00** e **01-80-C2-00-00-0E** são consumidos pela ponte. Um frame comum, em seguida, é inundado normalmente.

**Conceito.** O IEEE reserva os endereços de grupo de 01-80-C2-00-00-00 a 0F para protocolos que valem só entre vizinhos diretos, como o spanning tree e o LLDP. Uma ponte não encaminha frames para esses endereços. O frame comum do fim mostra o contraste.

**O que observar**

- O BPDU e o LLDP não saem do switch.
- A origem desses frames não entra na tabela.
- O Echo Request é inundado.

```mermaid
sequenceDiagram
  autonumber
  participant n_a as Host A<br/>porta 1
  participant n_b as Host B<br/>porta 2
  participant n_sw as Switch<br/>camada 2
  participant n_c as Host C<br/>porta 3 (hub)
  participant n_d as Host D<br/>porta 3 (hub)
  Note over n_a,n_d: 1. Frames para endereços de grupo reservados
  n_a ->> n_sw: BPDU
  n_a ->> n_sw: LLDP
  Note over n_a,n_d: 2. Para comparar: unicast desconhecido
  n_a ->> n_sw: Echo Request
  n_sw ->> n_b: Echo Request
  n_sw ->> n_c: Echo Request
  n_sw ->> n_d: Echo Request
```

*Figura 7.3.5 (Tipo B, sequência).* Mensagens do cenário "BPDU e LLDP não são encaminhados", na ordem do tempo, entre Host A, Host B, Switch, Host C, Host D: 6 mensagens, numeradas de 1 a 6 na ordem da comunicação (em 2 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Broadcast, multicast e reservados", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| BPDU | spanning tree | não encaminhado |
| LLDP | anúncio de vizinho | não encaminhado |
| Echo Request | A para B, desconhecido | inundado |

**Por que importa.** Se um switch repassasse BPDUs, o spanning tree não conseguiria enxergar a topologia salto a salto. Alguns equipamentos simples não respeitam isso.

## 8. Referência

### 8.1 O que um switch faz

Um **switch** Ethernet é uma ponte multiporta (*MAC bridge*, IEEE 802.1D): recebe frames em cada porta e decide, **só pelo endereço MAC**, por onde enviá-los. Ele não olha o endereço IP. A especificação de pontes do 802.1D foi incorporada ao IEEE 802.1Q, que hoje é a referência vigente; o simulador usa os dois nomes como os livros-texto. A Ethernet em si é definida pelo IEEE 802.3.

### 8.2 Os três passos para cada frame

1. **Aprendizado:** o MAC de **origem** é associado à porta de entrada, ou o relógio da entrada é renovado. Endereços de grupo e de broadcast nunca são aprendidos como origem.
2. **Decisão:** o switch procura o MAC de **destino** na tabela. Destino conhecido em outra porta: **encaminha**. Destino conhecido na própria porta de entrada: **filtra**. Destino desconhecido, broadcast ou multicast: **inunda** (todas as portas, menos a de entrada).
3. **Envelhecimento:** sem tráfego da origem, a entrada expira. O valor recomendado é de 300 s e é configurável.

### 8.3 Frame Ethernet II

| Campo | Tamanho | Observação |
| --- | --- | --- |
| Destino | 6 bytes | o primeiro bit transmitido, o menos significativo do primeiro byte, indica endereço de grupo |
| Origem | 6 bytes | sempre unicast |
| Tipo | 2 bytes | 0x0800 IPv4, 0x0806 ARP, 0x88cc LLDP |
| Dados | 46 a 1500 bytes | preenchidos até o mínimo |
| FCS | 4 bytes | verificação do frame; o simulador não a mostra |

O menor frame tem 64 bytes (do destino ao FCS). Os tamanhos mostrados no simulador (42 para o ARP, 98 para o ping) são os do cabeçalho e dos dados, sem o preenchimento e sem o FCS.

### 8.4 Hub, switch e domínios

- Um **hub** (repetidor) repete cada bit para todas as portas: todos os hosts atrás dele formam um único **domínio de colisão** e ouvem tudo. É o segmento da porta 3 do simulador.
- Um **switch** isola o tráfego por porta: cada porta é um domínio de colisão à parte, e em full-duplex nem há colisão. O **domínio de broadcast**, porém, continua sendo a rede local inteira.
- Para dividir o domínio de broadcast é preciso VLANs ou um roteador (outros simuladores do projeto).

### 8.5 Multicast e IGMP snooping

- O endereço MAC de um grupo IP é derivado do IP: os 23 bits de baixa ordem do IP entram em `01:00:5e:00:00:00` ([RFC 1112](https://www.rfc-editor.org/rfc/rfc1112), seção 6.4). Como o IP tem 28 bits de grupo, 32 grupos IP diferentes compartilham o mesmo MAC.
- Sem ajuda, o switch trata o multicast como broadcast. O **IGMP snooping** lê os relatórios dos hosts e encaminha cada grupo só às portas com assinantes. O simulador usa o relatório do IGMPv3 ([RFC 9776](https://www.rfc-editor.org/rfc/rfc9776)), enviado a 224.0.0.22.
- A [RFC 4541](https://www.rfc-editor.org/rfc/rfc4541) (informativa, não normativa) descreve as regras de encaminhamento de um switch com snooping, entre elas a de que os grupos 224.0.0.x (de controle local) continuam sendo inundados. Um switch real precisa também de um consultor IGMP (*querier*) para renovar as assinaturas, e envia o fluxo às portas de roteador multicast; o simulador não tem nenhum dos dois.

### 8.6 Endereços de grupo reservados

Os endereços de `01-80-C2-00-00-00` a `01-80-C2-00-00-0F` são reservados pelo IEEE a protocolos que valem só entre vizinhos diretos, como o spanning tree (00) e o LLDP (0E). Uma ponte processa esses frames e **não os encaminha**. Alguns equipamentos simples não respeitam isso e os inundam.

### 8.7 Inundação de MAC e segurança de porta (nível defensivo)

- **Por que é possível:** a tabela de endereços é finita e o switch aprende qualquer origem, sem autenticá-la. Um host que envia frames com origens inventadas ocupa as vagas.
- **Efeito:** com a tabela cheia, hosts novos (e os que expiraram) não são aprendidos. O tráfego para eles é inundado e chega a todas as portas, inclusive à do atacante. O switch passa a se comportar como um hub.
- **Alcance:** só dentro da rede local (e da VLAN) do atacante. A inundação não atravessa roteadores.
- **Impacto:** em tráfego sem cifra, o conteúdo é lido. Com TLS ou SSH, o conteúdo segue protegido, mas há perda de desempenho, pelo tráfego a mais.
- **Aviso:** este modo explica o mecanismo para fins de defesa. Atacar a rede de terceiros pode configurar crime; pratique apenas em laboratório isolado, com autorização.

### 8.8 Defesas

| Defesa | Onde atua | Observação |
| --- | --- | --- |
| Segurança de porta (limite de MACs) | na porta do switch | recurso de fabricantes; os modos protect, restrict e shutdown variam por equipamento |
| IEEE 802.1X | na porta do switch | autentica o dispositivo antes de liberar a porta; é o padrão do IEEE |
| Tabelas maiores e envelhecimento ajustado | no switch | reduzem o impacto, mas não eliminam o ataque |
| Monitoramento de alertas e de MACs por porta | na rede | detecta o ataque e permite isolar a porta |
| Cifra de ponta a ponta (TLS, SSH, VPN) | nas aplicações | protege o conteúdo mesmo com a rede local comprometida |

### 8.9 Segurança

O aprendizado de endereços **não tem autenticação**: o switch confia no MAC de origem de qualquer frame. É a base de ataques de camada 2 como a inundação de MAC e o envenenamento de ARP (outro simulador do projeto). A proteção vem de limites por porta, de autenticação de acesso (802.1X) e da cifra de ponta a ponta.

### 8.10 Limitações do simulador

O simulador mostra um único switch com quatro portas, sem VLANs, sem spanning tree e sem agregação de enlaces. Os endereços são de documentação ([RFC 5737](https://www.rfc-editor.org/rfc/rfc5737) para IPv4; [RFC 7042](https://www.rfc-editor.org/rfc/rfc7042) e [RFC 9542](https://www.rfc-editor.org/rfc/rfc9542) para MAC). A tabela do modo de inundação tem 4 ou 6 entradas, enquanto a de um switch real guarda de milhares a centenas de milhares. Quando a tabela enche, o simulador não aprende o endereço novo e inunda o destino desconhecido, mas o comportamento de um equipamento real varia (alguns removem entradas antigas, outros descartam o frame). Os tempos de trânsito são didáticos e o simulador não representa colisões, modos de encaminhamento (*store-and-forward* e *cut-through*), velocidade das portas nem a negociação automática. Os modos da segurança de porta seguem a terminologia de um fabricante comum. Não foram citadas subcláusulas do IEEE 802.1D e do 802.1Q por falta de um texto aberto para conferência; as RFCs citadas foram conferidas no rfc-editor.org. Fora do escopo: IPv6 (MLD snooping), VLANs, STP, QoS e as funções de camada 3 do switch.


## 9. Glossário

Significado e finalidade das siglas usadas neste documento.

| Sigla | Significado | Para que serve |
| --- | --- | --- |
| **ARP** | Address Resolution Protocol, protocolo de resolução de endereços | descobre o endereço MAC que corresponde a um endereço IPv4 na rede local |
| **BGP** | Border Gateway Protocol, protocolo de roteador de borda | troca rotas entre sistemas autônomos e sustenta o roteamento entre operadoras na Internet |
| **BPDU** | Bridge Protocol Data Unit | frame que as pontes trocam no STP para eleger a raiz e calcular as portas |
| **CRC** | Cyclic Redundancy Check, verificação de redundância cíclica | código que detecta erros de transmissão, como o do FCS dos frames Ethernet e 802.11 |
| **FCS** | Frame Check Sequence, sequência de verificação do frame | código (CRC) no fim do frame que permite ao receptor descartar frames corrompidos |
| **IEEE** | Institute of Electrical and Electronics Engineers | entidade que publica padrões de redes locais, como o 802.3 (Ethernet), o 802.1 (comutação) e o 802.11 (Wi-Fi) |
| **IGMP** | Internet Group Management Protocol, protocolo de gerência de grupos da Internet | o host avisa à rede quais grupos multicast IPv4 quer receber |
| **IP** | Internet Protocol, protocolo de internet | endereça e encaminha pacotes entre redes, de origem a destino |
| **LLDP** | Link Layer Discovery Protocol, protocolo de descoberta da camada de enlace | os equipamentos anunciam sua identidade e suas portas aos vizinhos diretos (IEEE 802.1AB) |
| **MAC** | Media Access Control | camada de enlace que controla o acesso ao meio; também nomeia o endereço físico de 48 bits de uma interface |
| **MLD** | Multicast Listener Discovery, descoberta de receptores multicast | equivalente do IGMP para o IPv6 |
| **RTT** | Round-Trip Time, tempo de ida e volta | mede o tempo entre enviar um pacote e receber a resposta; base dos temporizadores e da latência |
| **SNMP** | Simple Network Management Protocol, protocolo simples de gerência de rede | consulta e configura equipamentos de rede, e recebe alertas deles |
| **SSH** | Secure Shell | acesso remoto e transferência de arquivos por um canal cifrado, com autenticação do servidor e do usuário |
| **STP** | Spanning Tree Protocol, protocolo de árvore de abrangência | evita laços em redes comutadas, bloqueando enlaces redundantes até que sejam necessários |
| **TLS** | Transport Layer Security, segurança da camada de transporte | estabelece um canal cifrado e autenticado entre dois pontos, a base do HTTPS |
| **VLAN** | Virtual Local Area Network, rede local virtual | separa logicamente uma rede em domínios de broadcast isolados no mesmo equipamento físico |
| **VPN** | Virtual Private Network, rede privada virtual | cria um canal protegido, em geral cifrado, sobre uma rede pública |


---

*Simul-Net é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
