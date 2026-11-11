# OSPF (estado de enlace)

OSPF passo a passo: Hello, adjacências, inundação de LSAs, SPF e tabela de rotas, com mudança de custo, falhas de enlace e rede multiárea com Summary LSAs dos ABRs.

- **Categoria:** Roteamento e serviços de rede
- **Motor:** nativo (TypeScript puro, apresentado pela bancada genérica)
- **Código-fonte:** `src/sims/ospf/`
- **RFCs e padrões:** [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328) (OSPF versão 2), [RFC 5709](https://www.rfc-editor.org/rfc/rfc5709) (Autenticação HMAC-SHA)
- **Tópicos:** Hello e adjacências; LSAs e SPF; Custo e falhas de enlace; Multiárea e Summary LSAs

## 1. Modos

| Modo | Cenário inicial | Cenários |
| --- | --- | --- |
| Convergência | Convergência em área única | 7.1.1 |
| Custo e falha | Custo 50 em R2 / R3 | 7.2.1 a 7.2.3 |
| Multiárea | Três áreas e Summary LSAs | 7.3.1 e 7.3.2 |

## 2. Fundamentação

### 2.1 O problema que o OSPF resolve

Um roteador só encaminha bem se souber a rota de cada destino. Em redes pequenas, as rotas podem ser escritas à mão (estáticas), mas qualquer falha ou mudança exige que alguém as corrija. Um **protocolo de roteamento dinâmico** faz os roteadores descobrirem a rede e se ajustarem sozinhos.

O OSPF (*Open Shortest Path First*, versão 2, [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328)) é um protocolo de **estado de enlace**, usado **dentro** de um sistema autônomo (um IGP, *Interior Gateway Protocol*). A ideia é simples: cada roteador descreve os **próprios enlaces e custos**, e esse relato é espalhado por toda a área. Quando todos têm o mesmo mapa, cada um calcula sozinho o melhor caminho. Os pacotes do OSPF vão direto sobre o IP, no protocolo 89.

**O que você aprende com este simulador.**

- Explicar a diferença entre roteamento estático e dinâmico e o que é um protocolo de estado de enlace.
- Acompanhar as fases do OSPF: Hello, adjacência, inundação de LSAs, SPF e tabela de rotas.
- Ler o cabeçalho do pacote OSPF, o Hello e o cabeçalho do LSA campo a campo.
- Entender como o custo e as falhas mudam o caminho escolhido pelo SPF.
- Interpretar a divisão em áreas, o backbone, o ABR e os Summary-LSAs.

### 2.2 O diagrama das fases do OSPF

```mermaid
flowchart LR
  H["1. Hello<br/>descobre vizinhos"] --> A["2. Adjacência<br/>sincroniza as bases"]
  A --> F["3. Inundação<br/>espalha os LSAs"]
  F --> L["4. LSDB igual<br/>em todos da área"]
  L --> S["5. SPF<br/>Dijkstra em cada roteador"]
  S --> T["6. Tabela de rotas<br/>próximo salto por destino"]
```

*Esquema 1 (do Hello à tabela de rotas).* Cada fase prepara a seguinte. Quando um enlace muda de custo ou cai, o roteador afetado gera um LSA novo, e o processo recomeça a partir da inundação (fase 3).

### 2.3 Vizinhos e adjacências

```mermaid
stateDiagram-v2
  [*] --> Down
  Down --> Init: recebe Hello
  Init --> TwoWay: o Hello recebido lista o meu Router ID
  TwoWay --> ExStart: decide ser adjacente
  ExStart --> Exchange: define mestre e escravo
  Exchange --> Loading: troca DBD, falta algum LSA
  Loading --> Full: recebe os LSAs pedidos
  Exchange --> Full: nada faltou
```

*Esquema 2 (estados do vizinho, resumidos).* O Hello detecta o vizinho. Quando cada lado vê o próprio Router ID na lista de vizinhos do outro, o estado passa a 2-Way. Depois, os dois trocam os resumos das bases (DBD), pedem o que falta (LSR) e recebem (LSU) até chegar a Full ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 10.1 e seção 10.5). A tabela completa de transições está na seção 10.3.

| Pacote | Função |
| --- | --- |
| Hello | descobre e mantém vizinhos, com HelloInterval (10 s) e RouterDeadInterval (40 s) nos enlaces ponto a ponto e de difusão |
| DBD (*Database Description*) | resume os LSAs da base, só pelos cabeçalhos |
| LSR (*Link State Request*) | pede os LSAs que faltam |
| LSU (*Link State Update*) | entrega os LSAs |
| LSAck | confirma o recebimento |

### 2.4 Os formatos: cabeçalho, Hello e cabeçalho do LSA

Todo pacote OSPF começa com um cabeçalho comum de 24 bytes e vai direto sobre o IP (protocolo 89), em geral para o multicast 224.0.0.5 (todos os roteadores OSPF) e, nas redes de acesso múltiplo, 224.0.0.6 (DR e BDR). O desenho mostra o cabeçalho seguido do corpo do pacote Hello, em linhas de 32 bits, na ordem de transmissão ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), apêndice A).

```mermaid
packet-beta
  0-7: "Versão (2)"
  8-15: "Tipo (1 = Hello)"
  16-31: "Tamanho do pacote"
  32-63: "Router ID"
  64-95: "ID da área"
  96-111: "Checksum"
  112-127: "Tipo de autenticação"
  128-191: "Autenticação (64 bits)"
  192-223: "Máscara de rede"
  224-239: "HelloInterval"
  240-247: "Opções"
  248-255: "Prioridade"
  256-287: "RouterDeadInterval"
  288-319: "Roteador designado (DR)"
  320-351: "Designado de reserva (BDR)"
  352-383: "Vizinhos vistos (lista de Router IDs)"
```

*Esquema 3 (o cabeçalho OSPF e o corpo do Hello).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. A lista de vizinhos é condensada: tem um Router ID de 4 bytes por vizinho visto. A tabela abaixo descreve os campos, em ordem.

| Campo | Tamanho | Função |
| --- | --- | --- |
| Versão | 1 byte | 2 para o OSPFv2 |
| Tipo | 1 byte | 1 Hello, 2 DBD, 3 LSR, 4 LSU e 5 LSAck |
| Tamanho do pacote | 2 bytes | o pacote inteiro, em bytes, incluindo o cabeçalho |
| Router ID | 4 bytes | identifica quem enviou, no formato de um endereço IPv4 |
| ID da área | 4 bytes | a área do enlace; a área 0 é o backbone |
| Checksum | 2 bytes | verificação do pacote, sem o campo de autenticação |
| Tipo de autenticação | 2 bytes | 0 nenhuma, 1 senha simples e 2 criptográfica |
| Autenticação | 8 bytes | dados da autenticação, conforme o tipo |
| Máscara de rede | 4 bytes | máscara da interface que envia; os vizinhos precisam concordar |
| HelloInterval | 2 bytes | segundos entre os Hellos (os vizinhos precisam concordar) |
| Opções | 1 byte | recursos que o roteador suporta |
| Prioridade | 1 byte | usada na eleição do DR e do BDR; zero impede de ser eleito |
| RouterDeadInterval | 4 bytes | segundos sem Hello até declarar o vizinho morto |
| DR e BDR | 4 bytes cada | o roteador designado e o de reserva que o remetente enxerga |
| Vizinhos vistos | 4 bytes cada | Router IDs dos vizinhos dos quais ouviu um Hello recentemente |

É por esse último campo que o estado **2-Way** é alcançado: o vizinho só chega a 2-Way quando o próprio Router ID aparece na lista de vizinhos vistos do Hello recebido. Dois roteadores com HelloInterval, RouterDeadInterval, máscara ou área diferentes **não formam vizinhança**.

O **LSA** começa com um cabeçalho de 20 bytes, que também é o que vai nos DBDs e nos LSAcks ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 12.1):

```mermaid
packet-beta
  0-15: "Idade do LSA (LS age)"
  16-23: "Opções"
  24-31: "Tipo do LSA"
  32-63: "ID do estado de enlace"
  64-95: "Roteador que anunciou"
  96-127: "Número de sequência"
  128-143: "Checksum"
  144-159: "Tamanho"
```

*Esquema 4 (o cabeçalho do LSA).* Os campos **tipo**, **ID do estado de enlace** e **roteador que anunciou** identificam o LSA, e o **número de sequência**, a **idade** e o **checksum** dizem qual cópia é a mais recente ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 13.1). O roteador reemite o próprio LSA a cada 30 minutos, e a idade máxima é de 1 hora, depois da qual o LSA é removido da base.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Idade do LSA (LS age) | 0 a 15 | 16 bits | segundos desde a origem do LSA; chega a 3600 (1 hora), quando ele é removido |
| Opções | 16 a 23 | 8 bits | recursos que o roteador suporta (por exemplo, área stub) |
| Tipo do LSA | 24 a 31 | 8 bits | 1 Router, 2 Network, 3 Summary, 4 ASBR-Summary e 5 AS-External |
| ID do estado de enlace | 32 a 63 | 32 bits | identifica o que o LSA descreve; depende do tipo |
| Roteador que anunciou | 64 a 95 | 32 bits | Router ID de quem originou o LSA |
| Número de sequência | 96 a 127 | 32 bits | cresce a cada nova versão do LSA; a maior sequência é a mais recente |
| Checksum | 128 a 143 | 16 bits | verificação do LSA, sem o campo de idade |
| Tamanho | 144 a 159 | 16 bits | tamanho do LSA, cabeçalho incluído, em bytes |

### 2.5 O LSA e a LSDB

Cada roteador gera um **Router-LSA** com os próprios enlaces ativos e os custos. A coleção de todos os LSAs de uma área é a **LSDB** (*Link State Database*), e ela é igual em todos os roteadores da área.

```mermaid
flowchart TD
  N["R1 gera um LSA novo<br/>número de sequência maior"] --> E["Envia LSU a todos os vizinhos"]
  E --> Q{"O vizinho já tem<br/>este LSA ou um mais novo?"}
  Q -- "sim" --> D["Descarta"]
  Q -- "não" --> G["Guarda na LSDB, confirma com LSAck<br/>e reenvia aos outros vizinhos"]
```

*Esquema 5 (inundação de um LSA).* O LSA se espalha de vizinho em vizinho, e o **número de sequência** decide qual cópia é a mais recente ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 13). Um LSA repetido morre ali, o que impede a inundação de girar para sempre.

O OSPF define vários tipos de LSA ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 12.4): o Router-LSA (tipo 1) descreve os enlaces de um roteador, o Network-LSA (tipo 2) descreve uma rede de acesso múltiplo, o Summary-LSA (tipos 3 e 4) leva destinos de outra área, e o AS-external-LSA (tipo 5) leva rotas externas.

### 2.6 O cálculo das rotas: SPF

Com a LSDB completa, cada roteador monta o grafo da área e roda o **algoritmo de Dijkstra** (SPF, *Shortest Path First*), com raiz em si mesmo ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 16.1). O resultado é a **árvore de menor custo** até cada destino. A rota instalada é o primeiro salto dessa árvore.

- O **custo** da interface é um parâmetro configurável: quanto menor, mais preferido. Vence o menor **custo total** do caminho.
- A fórmula "largura de banda de referência dividida pela do enlace" é prática de fabricantes, como o Cisco IOS, e não faz parte da RFC.
- Como cada roteador calcula sobre o mesmo mapa, os resultados são consistentes entre si, sem laços de roteamento em regime.

### 2.7 Várias áreas

```mermaid
flowchart LR
  subgraph A1["Área 1"]
    R1["R1"]
  end
  subgraph A0["Área 0: backbone"]
    ABR1["ABR 1"]
    ABR2["ABR 2"]
  end
  subgraph A2["Área 2"]
    R7["R7"]
  end
  R1 --- ABR1
  ABR1 --- ABR2
  ABR2 --- R7
```

*Esquema 6 (áreas e ABRs).* A área 0 é o **backbone**, e toda área precisa se ligar a ela. O ABR (*Area Border Router*) tem interfaces em mais de uma área e mantém **uma LSDB por área**. Os Router-LSAs não saem da própria área. Para que as áreas se alcancem, o ABR origina **Summary-LSAs** (tipo 3, [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 12.4.3): cada um carrega só o destino e o custo, sem a topologia.

O roteador interno soma o custo até o ABR ao custo anunciado e obtém uma **rota inter-área**. Por isso uma falha dentro de uma área não obriga as outras a refazer o SPF: elas apenas atualizam um custo.

### 2.8 O que cada modo e aba do simulador mostram

- **Topologia:** os roteadores, o **custo** de cada enlace e os dois PCs. O caminho do tráfego fica destacado, e os eventos de custo e de falha se refletem no desenho.
- **Diagrama de sequência e legenda de cores:** cada cor é um tipo de mensagem (Hello, pacotes da adjacência, LSU da inundação e pacote de dados ou Summary-LSA).
- **Aba LSDB:** a base de estado de enlace do roteador escolhido, no instante atual. Compare a de dois roteadores e veja que, depois da inundação, elas ficam iguais.
- **Aba Tabela de roteamento:** as rotas calculadas pelo SPF no mesmo roteador.
- **Modos:** *Convergência* (do Hello às rotas), *Custo e falha* (o que muda quando um custo sobe ou um enlace cai) e *Multiárea* (ABRs e Summary-LSAs).

Para ver a rede convergir, use "Convergência em área única". Para o efeito do custo e da falha, use "Custo 50 em R2 / R3", "Queda do enlace R2 / R3" e "Isolamento do PC-B". Para as áreas, use "Três áreas e Summary LSAs" e "Enlace R4 / R8 fora de serviço".

### 2.9 Limites do modelo e do diagrama

- Todos os enlaces são **ponto a ponto**: não há eleição de DR e BDR (redes de acesso múltiplo, [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), seção 7.3).
- Cada roteador anuncia um só destino, o próprio Router ID. Não há Network-LSA, AS-external-LSA nem áreas *stub*.
- A inundação é desenhada em rodadas, com atraso fixo, e a detecção de falha é instantânea. Em redes reais, ela depende do RouterDeadInterval (40 s) ou de mecanismos como o BFD.
- A autenticação ([RFC 5709](https://www.rfc-editor.org/rfc/rfc5709)) e as proteções do plano de controle são discutidas na aba Referência, mas não são simuladas.

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

- [Figura 4.1](#41-convergência): topologia do modo "Convergência"
- [Figura 4.2a](#42-custo-e-falha): topologia do modo "Custo e falha", variante a
- [Figura 4.2b](#42-custo-e-falha): topologia do modo "Custo e falha", variante b
- [Figura 4.2c](#42-custo-e-falha): topologia do modo "Custo e falha", variante c
- [Figura 4.3a](#43-multiárea): topologia do modo "Multiárea", variante a
- [Figura 4.3b](#43-multiárea): topologia do modo "Multiárea", variante b

**Tipo B (sequência)**

- [Figura 7.1.1](#711-convergência-em-área-única): sequência de "Convergência em área única"
- [Figura 7.2.1](#721-custo-50-em-r2--r3): sequência de "Custo 50 em R2 / R3"
- [Figura 7.2.2](#722-queda-do-enlace-r2--r3): sequência de "Queda do enlace R2 / R3"
- [Figura 7.2.3](#723-isolamento-do-pc-b): sequência de "Isolamento do PC-B"
- [Figura 7.3.1](#731-três-áreas-e-summary-lsas): sequência de "Três áreas e Summary LSAs"
- [Figura 7.3.2](#732-enlace-r4--r8-fora-de-serviço): sequência de "Enlace R4 / R8 fora de serviço"

## 4. Topologia

Figuras do Tipo A, uma por modo (e uma por variante do desenho, quando a rede muda entre cenários). Foram geradas a partir da mesma definição de topologia que a bancada usa.

### 4.1 Convergência

```mermaid
flowchart LR
  n_R1("R1<br/>0.1")
  n_R2("R2<br/>0.2")
  n_R3("R3<br/>0.3")
  n_R4("R4<br/>0.4")
  n_R5("R5<br/>0.5")
  n_R6("R6<br/>0.6")
  n_PC_A["PC-A<br/>192.168.1.10"]
  n_PC_B["PC-B<br/>192.168.2.10"]
  n_R1 -- "L1, custo 10" --- n_R2
  n_R1 -- "L2, custo 20" --- n_R4
  n_R2 -- "L3, custo 10" --- n_R3
  n_R2 -- "L4, custo 15" --- n_R5
  n_R3 -- "L5, custo 10" --- n_R6
  n_R4 -- "L6, custo 10" --- n_R5
  n_R5 -- "L7, custo 20" --- n_R6
  n_PC_A --- n_R1
  n_PC_B --- n_R6
```

*Figura 4.1 (Tipo A, topologia).* Elementos do modo "Convergência": R1 (0.1); R2 (0.2); R3 (0.3); R4 (0.4); R5 (0.5); R6 (0.6); PC-A (192.168.1.10); PC-B (192.168.2.10). Vale para todos os cenários do modo (7.1.1).

### 4.2 Custo e falha

```mermaid
flowchart LR
  n_R1("R1<br/>0.1")
  n_R2("R2<br/>0.2")
  n_R3("R3<br/>0.3")
  n_R4("R4<br/>0.4")
  n_R5("R5<br/>0.5")
  n_R6("R6<br/>0.6")
  n_PC_A["PC-A<br/>192.168.1.10"]
  n_PC_B["PC-B<br/>192.168.2.10"]
  n_R1 -- "L1, custo 10" --- n_R2
  n_R1 -- "L2, custo 20" --- n_R4
  n_R2 -- "L3, custo 50 (era 10)" --- n_R3
  n_R2 -- "L4, custo 15" --- n_R5
  n_R3 -- "L5, custo 10" --- n_R6
  n_R4 -- "L6, custo 10" --- n_R5
  n_R5 -- "L7, custo 20" --- n_R6
  n_PC_A --- n_R1
  n_PC_B --- n_R6
```

*Figura 4.2a (Tipo A, topologia).* Elementos do modo "Custo e falha": R1 (0.1); R2 (0.2); R3 (0.3); R4 (0.4); R5 (0.5); R6 (0.6); PC-A (192.168.1.10); PC-B (192.168.2.10). Vale para os cenários (7.2.1).

```mermaid
flowchart LR
  n_R1("R1<br/>0.1")
  n_R2("R2<br/>0.2")
  n_R3("R3<br/>0.3")
  n_R4("R4<br/>0.4")
  n_R5("R5<br/>0.5")
  n_R6("R6<br/>0.6")
  n_PC_A["PC-A<br/>192.168.1.10"]
  n_PC_B["PC-B<br/>192.168.2.10"]
  n_R1 -- "L1, custo 10" --- n_R2
  n_R1 -- "L2, custo 20" --- n_R4
  n_R2 -. "L3, custo 10 (caído)" .- n_R3
  n_R2 -- "L4, custo 15" --- n_R5
  n_R3 -- "L5, custo 10" --- n_R6
  n_R4 -- "L6, custo 10" --- n_R5
  n_R5 -- "L7, custo 20" --- n_R6
  n_PC_A --- n_R1
  n_PC_B --- n_R6
```

*Figura 4.2b (Tipo A, topologia).* Elementos do modo "Custo e falha": R1 (0.1); R2 (0.2); R3 (0.3); R4 (0.4); R5 (0.5); R6 (0.6); PC-A (192.168.1.10); PC-B (192.168.2.10). Linhas tracejadas: enlaces alternativos, forjados ou caídos. Vale para os cenários (7.2.2).

```mermaid
flowchart LR
  n_R1("R1<br/>0.1")
  n_R2("R2<br/>0.2")
  n_R3("R3<br/>0.3")
  n_R4("R4<br/>0.4")
  n_R5("R5<br/>0.5")
  n_R6("R6<br/>0.6")
  n_PC_A["PC-A<br/>192.168.1.10"]
  n_PC_B["PC-B<br/>192.168.2.10"]
  n_R1 -- "L1, custo 10" --- n_R2
  n_R1 -- "L2, custo 20" --- n_R4
  n_R2 -- "L3, custo 10" --- n_R3
  n_R2 -- "L4, custo 15" --- n_R5
  n_R3 -. "L5, custo 10 (caído)" .- n_R6
  n_R4 -- "L6, custo 10" --- n_R5
  n_R5 -. "L7, custo 20 (caído)" .- n_R6
  n_PC_A --- n_R1
  n_PC_B --- n_R6
```

*Figura 4.2c (Tipo A, topologia).* Elementos do modo "Custo e falha": R1 (0.1); R2 (0.2); R3 (0.3); R4 (0.4); R5 (0.5); R6 (0.6); PC-A (192.168.1.10); PC-B (192.168.2.10). Linhas tracejadas: enlaces alternativos, forjados ou caídos. Vale para os cenários (7.2.3).

### 4.3 Multiárea

```mermaid
flowchart LR
  n_R1("R1<br/>área 1, 0.1")
  n_R2("R2<br/>ABR, área 1 e 0, 0.2")
  n_R3("R3<br/>ABR, área 1 e 0, 0.3")
  n_R4("R4<br/>área 0, 0.4")
  n_R5("R5<br/>área 0, 0.5")
  n_R6("R6<br/>área 0, 0.6")
  n_R7("R7<br/>área 2, 0.7")
  n_R8("R8<br/>ABR, área 2 e 0, 0.8")
  n_R9("R9<br/>ABR, área 2 e 0, 0.9")
  n_PC_A["PC-A<br/>192.168.1.10"]
  n_PC_B["PC-B<br/>192.168.2.10"]
  n_R1 -- "MA1, custo 10, área 1" --- n_R2
  n_R1 -- "MA2, custo 15, área 1" --- n_R3
  n_R2 -- "MA3, custo 10, área 1" --- n_R3
  n_R4 -- "MA4, custo 10, área 0" --- n_R5
  n_R5 -- "MA5, custo 15, área 0" --- n_R6
  n_R4 -- "MA6, custo 20, área 0" --- n_R6
  n_R7 -- "MA7, custo 10, área 2" --- n_R8
  n_R7 -- "MA8, custo 15, área 2" --- n_R9
  n_R8 -- "MA9, custo 10, área 2" --- n_R9
  n_R2 -- "MA10, custo 25, área 0" --- n_R4
  n_R3 -- "MA11, custo 30, área 0" --- n_R6
  n_R4 -- "MA12, custo 20, área 0" --- n_R8
  n_R6 -- "MA13, custo 25, área 0" --- n_R9
  n_PC_A --- n_R1
  n_PC_B --- n_R7
```

*Figura 4.3a (Tipo A, topologia).* Elementos do modo "Multiárea": R1 (área 1, 0.1); R2 (ABR, área 1 e 0, 0.2); R3 (ABR, área 1 e 0, 0.3); R4 (área 0, 0.4); R5 (área 0, 0.5); R6 (área 0, 0.6); R7 (área 2, 0.7); R8 (ABR, área 2 e 0, 0.8); R9 (ABR, área 2 e 0, 0.9); PC-A (192.168.1.10); PC-B (192.168.2.10). Vale para os cenários (7.3.1).

```mermaid
flowchart LR
  n_R1("R1<br/>área 1, 0.1")
  n_R2("R2<br/>ABR, área 1 e 0, 0.2")
  n_R3("R3<br/>ABR, área 1 e 0, 0.3")
  n_R4("R4<br/>área 0, 0.4")
  n_R5("R5<br/>área 0, 0.5")
  n_R6("R6<br/>área 0, 0.6")
  n_R7("R7<br/>área 2, 0.7")
  n_R8("R8<br/>ABR, área 2 e 0, 0.8")
  n_R9("R9<br/>ABR, área 2 e 0, 0.9")
  n_PC_A["PC-A<br/>192.168.1.10"]
  n_PC_B["PC-B<br/>192.168.2.10"]
  n_R1 -- "MA1, custo 10, área 1" --- n_R2
  n_R1 -- "MA2, custo 15, área 1" --- n_R3
  n_R2 -- "MA3, custo 10, área 1" --- n_R3
  n_R4 -- "MA4, custo 10, área 0" --- n_R5
  n_R5 -- "MA5, custo 15, área 0" --- n_R6
  n_R4 -- "MA6, custo 20, área 0" --- n_R6
  n_R7 -- "MA7, custo 10, área 2" --- n_R8
  n_R7 -- "MA8, custo 15, área 2" --- n_R9
  n_R8 -- "MA9, custo 10, área 2" --- n_R9
  n_R2 -- "MA10, custo 25, área 0" --- n_R4
  n_R3 -- "MA11, custo 30, área 0" --- n_R6
  n_R4 -. "MA12, custo 20, área 0 (caído)" .- n_R8
  n_R6 -- "MA13, custo 25, área 0" --- n_R9
  n_PC_A --- n_R1
  n_PC_B --- n_R7
```

*Figura 4.3b (Tipo A, topologia).* Elementos do modo "Multiárea": R1 (área 1, 0.1); R2 (ABR, área 1 e 0, 0.2); R3 (ABR, área 1 e 0, 0.3); R4 (área 0, 0.4); R5 (área 0, 0.5); R6 (área 0, 0.6); R7 (área 2, 0.7); R8 (ABR, área 2 e 0, 0.8); R9 (ABR, área 2 e 0, 0.9); PC-A (192.168.1.10); PC-B (192.168.2.10). Linhas tracejadas: enlaces alternativos, forjados ou caídos. Vale para os cenários (7.3.2).

## 5. Abas da bancada

Cenário, Captura, Mensagem, LSDB, Tabela de roteamento, Experimento, Referência e Log.

## 6. Configurações (campos do painel)

### 6.1 Teste

- **Sentido do tráfego**. Valores: PC-A (192.168.1.10) → PC-B; PC-B (192.168.2.10) → PC-A. Padrão: PC-A (192.168.1.10) → PC-B. Modos: todos.
  - Quem envia o pacote de teste ao final da simulação.
  - Escolhe se o pacote sai do PC-A para o PC-B ou do PC-B para o PC-A.
  - Como o custo é o mesmo nos dois sentidos, o caminho de volta é o inverso da ida. Em redes reais, custos diferentes por interface podem tornar o caminho assimétrico.

### 6.2 Evento

- **Tipo de evento**. Valores: Mudança de custo de um enlace; Queda de enlace. Padrão: Mudança de custo de um enlace. Modos: Custo e falha.
  - O que acontece depois que a rede converge.
  - **Mudança de custo:** o administrador altera o custo da interface nas duas pontas do enlace. A topologia continua a mesma, mas o SPF pode escolher outro caminho.
  - **Queda de enlace:** o enlace deixa de funcionar e as duas pontas perdem a adjacência.
- **Enlace afetado**. Valores: L1: R1 / R2 (custo 10); L2: R1 / R4 (custo 20); L3: R2 / R3 (custo 10); L4: R2 / R5 (custo 15); L5: R3 / R6 (custo 10); L6: R4 / R5 (custo 10); L7: R5 / R6 (custo 20). Padrão: L3: R2 / R3 (custo 10). Modos: Custo e falha.
  - O enlace que muda de custo ou cai.
  - O caminho de menor custo inicial é R1, R2, R3, R6. Se o enlace escolhido não faz parte dele, o tráfego pode continuar pelo mesmo caminho, e ainda assim os dois roteadores do enlace originam novos LSAs.
- **Novo custo (só na mudança de custo)**. Valores: 1; 10 (igual ao de L1, L3 e L5); 20; 30; 50; 100. Padrão: 50. Modos: Custo e falha.
  - Custo OSPF configurado na interface.
  - A [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328) trata o custo como um parâmetro configurável: quanto menor, mais preferido. A fórmula "largura de banda de referência dividida pela do enlace" é prática dos fabricantes.
  - Usado só quando o evento é mudança de custo. Se o valor for igual ao atual, nada muda.
- **Segundo enlace que cai (opcional)**. Valores: Nenhum; L1: R1 / R2 (custo 10); L2: R1 / R4 (custo 20); L3: R2 / R3 (custo 10); L4: R2 / R5 (custo 15); L5: R3 / R6 (custo 10); L6: R4 / R5 (custo 10); L7: R5 / R6 (custo 20). Padrão: Nenhum. Modos: Custo e falha.
  - Derruba um segundo enlace junto com o primeiro.
  - Usado só na queda de enlace. Para isolar o PC-B, derrube L5 (R3 / R6) e L7 (R5 / R6): R6 fica sem nenhum vizinho e o pacote é descartado.

### 6.3 Falha

- **Enlace fora de serviço**. Valores: Nenhum (rede íntegra); MA1: R1 / R2 (área 1); MA2: R1 / R3 (área 1); MA3: R2 / R3 (área 1); MA4: R4 / R5 (área 0); MA5: R5 / R6 (área 0); MA6: R4 / R6 (área 0); MA7: R7 / R8 (área 2); MA8: R7 / R9 (área 2); MA9: R8 / R9 (área 2); MA10: R2 / R4 (área 0); MA11: R3 / R6 (área 0); MA12: R4 / R8 (área 0); MA13: R6 / R9 (área 0). Padrão: Nenhum (rede íntegra). Modos: Multiárea.
  - Um enlace que já está caído quando a rede converge.
  - Com o enlace MA12 (R4 / R8) fora de serviço, o caminho do backbone para a área 2 passa por R6 e R9.
  - Dentro de uma área a falha altera o Router-LSA; entre áreas, o ABR muda o custo dos Summary LSAs.

### 6.4 Tabelas

- **Ver a LSDB e a tabela do roteador**. Valores: R1; R2; R3; R4; R5; R6. Padrão: R1. Modos: Convergência; Custo e falha.
  - Escolhe o roteador cujas tabelas aparecem nas abas LSDB e Tabela de roteamento.
  - Em área única, todas as LSDBs convergem para o mesmo conteúdo; a tabela de rotas, não: cada roteador tem a raiz do SPF em si mesmo.
  - Não muda o resultado da simulação.
- **Ver a LSDB e a tabela do roteador**. Valores: R1 (área 1); R2 (ABR 1 e 0); R3 (ABR 1 e 0); R4 (área 0); R5 (área 0); R6 (área 0); R7 (área 2); R8 (ABR 2 e 0); R9 (ABR 2 e 0). Padrão: R1 (área 1). Modos: Multiárea.
  - Escolhe o roteador cujas tabelas aparecem nas abas.
  - Compare R1 (só a área 1 e Summary LSAs) com R2 (ABR: duas LSDBs, uma por área) e com R4 (só o backbone).
  - Não muda o resultado da simulação.

## 7. Cenários

### 7.1 Modo: Convergência

> **Grupo:** Convergência

Como roteadores sem nenhuma rota chegam a um mapa comum da rede e calculam o melhor caminho.

#### 7.1.1 Convergência em área única

*Todos os roteadores obtêm a mesma LSDB e calculam o caminho de menor custo.*

**Configuração aplicada:** Sentido do tráfego = PC-A; Ver a LSDB e a tabela do roteador = R1

Acompanhe as quatro fases: **Hello** (vizinhos em 2-Way), **adjacência** (DBD, LSR, LSU e LSAck até Full), **inundação** dos Router-LSAs e **SPF**. Em seguida o PC-A envia um pacote ao PC-B.

O caminho escolhido é R1, R2, R3 e R6, com custo 30. Todos os caminhos entre R1 e R6 têm 3 saltos; o R1, R4, R5, R6, por exemplo, custa 50. O OSPF escolhe pelo **custo**, não pelo número de saltos.

**Conceito.** O **OSPF** ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328)) é um protocolo de **estado de enlace**: cada roteador descreve os próprios enlaces em um **Router-LSA**, e a inundação entrega todos os LSAs a todos os roteadores da área. Com a mesma **LSDB**, cada um executa o **SPF** (Dijkstra, seção 16.1) com raiz em si mesmo e instala o próximo salto de cada destino.

**O que observar**

- No diagrama: Hello, adjacência, inundação e SPF, uma fase depois da outra.
- Na aba LSDB: o conteúdo do roteador escolhido cresce com as rodadas de inundação.
- Na aba Tabela de roteamento: custo e próximo salto de cada destino, calculados pelo SPF.

```mermaid
sequenceDiagram
  autonumber
  participant n_PC_A as PC-A<br/>host
  participant n_R1 as R1<br/>roteador
  participant n_R2 as R2<br/>roteador
  participant n_R3 as R3<br/>roteador
  participant n_R4 as R4<br/>roteador
  participant n_R5 as R5<br/>roteador
  participant n_R6 as R6<br/>roteador
  participant n_PC_B as PC-B<br/>host
  Note over n_PC_A,n_PC_B: 1. Hello
  n_R1 ->> n_R2: Hello
  n_R2 ->> n_R1: Hello
  n_R1 ->> n_R4: Hello
  n_R4 ->> n_R1: Hello
  n_R2 ->> n_R3: Hello
  n_R3 ->> n_R2: Hello
  n_R2 ->> n_R5: Hello
  n_R5 ->> n_R2: Hello
  n_R3 ->> n_R6: Hello
  n_R6 ->> n_R3: Hello
  n_R4 ->> n_R5: Hello
  n_R5 ->> n_R4: Hello
  n_R5 ->> n_R6: Hello
  n_R6 ->> n_R5: Hello
  Note over n_PC_A,n_PC_B: 2. Adjacência
  n_R1 ->> n_R2: DBD
  n_R2 ->> n_R1: DBD
  n_R1 ->> n_R4: DBD
  n_R4 ->> n_R1: DBD
  n_R2 ->> n_R3: DBD
  n_R3 ->> n_R2: DBD
  n_R2 ->> n_R5: DBD
  n_R5 ->> n_R2: DBD
  n_R3 ->> n_R6: DBD
  n_R6 ->> n_R3: DBD
  n_R4 ->> n_R5: DBD
  n_R5 ->> n_R4: DBD
  n_R5 ->> n_R6: DBD
  n_R6 ->> n_R5: DBD
  n_R1 ->> n_R2: LSR
  n_R1 ->> n_R4: LSR
  n_R2 ->> n_R3: LSR
  n_R2 ->> n_R5: LSR
  n_R3 ->> n_R6: LSR
  n_R4 ->> n_R5: LSR
  n_R5 ->> n_R6: LSR
  n_R2 ->> n_R1: LSU
  n_R4 ->> n_R1: LSU
  n_R3 ->> n_R2: LSU
  n_R5 ->> n_R2: LSU
  n_R6 ->> n_R3: LSU
  n_R5 ->> n_R4: LSU
  n_R6 ->> n_R5: LSU
  n_R1 ->> n_R2: LSAck
  n_R1 ->> n_R4: LSAck
  n_R2 ->> n_R3: LSAck
  n_R2 ->> n_R5: LSAck
  n_R3 ->> n_R6: LSAck
  n_R4 ->> n_R5: LSAck
  n_R5 ->> n_R6: LSAck
  Note over n_PC_A,n_PC_B: 3. Inundação de LSAs
  n_R1 ->> n_R2: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R1 ->> n_R4: LSU (1 LSA)
  n_R4 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R3: LSU (1 LSA)
  n_R3 ->> n_R2: LSU (1 LSA)
  n_R2 ->> n_R5: LSU (1 LSA)
  n_R5 ->> n_R2: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R4 ->> n_R5: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R5: LSU (1 LSA)
  n_R1 ->> n_R2: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (2 LSAs)
  n_R1 ->> n_R4: LSU (1 LSA)
  n_R4 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R3: LSU (2 LSAs)
  n_R3 ->> n_R2: LSU (1 LSA)
  n_R2 ->> n_R5: LSU (2 LSAs)
  n_R5 ->> n_R2: LSU (2 LSAs)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R4 ->> n_R5: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (2 LSAs)
  n_R5 ->> n_R6: LSU (2 LSAs)
  n_R6 ->> n_R5: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R1 ->> n_R4: LSU (1 LSA)
  n_R4 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R3: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R6: LSU (1 LSA)
  Note over n_PC_A,n_PC_B: SPF
  Note over n_PC_A,n_PC_B: Pacote PC-A → PC-B
  n_PC_A ->> n_R1: IP ttl 64
  n_R1 ->> n_R2: IP ttl 63
  n_R2 ->> n_R3: IP ttl 62
  n_R3 ->> n_R6: IP ttl 61
  n_R6 ->> n_PC_B: IP ttl 60
```

*Figura 7.1.1 (Tipo B, sequência).* Mensagens do cenário "Convergência em área única", na ordem do tempo, entre PC-A, R1, R2, R3, R4, R5, R6, PC-B: 90 mensagens, numeradas de 1 a 90 na ordem da comunicação (em 6 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Convergência", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Hello | descobre vizinhos e mantém a adjacência | todos os roteadores |
| DBD, LSR, LSU e LSAck | sincronizam a LSDB entre vizinhos | cada par de vizinhos |
| LSU com Router-LSA | inunda o estado dos enlaces | todos os roteadores |

**Por que importa.** Como todos enxergam o mesmo mapa, o resultado é um caminho sem laços e a convergência é rápida. O custo, e não o número de saltos, define a escolha.

### 7.2 Modo: Custo e falha

> **Grupo:** Custo e falha

Como o OSPF reage depois de convergir: um novo LSA é inundado e cada roteador refaz o SPF.

#### 7.2.1 Custo 50 em R2 / R3

*Uma mudança de custo gera novos LSAs e um novo SPF.*

**Configuração aplicada:** Sentido do tráfego = PC-A; Tipo de evento = custo; Enlace afetado = L3; Novo custo (só na mudança de custo) = 50; Segundo enlace que cai (opcional) = none; Ver a LSDB e a tabela do roteador = R1

A rede já convergiu. O custo do enlace **L3 (R2 / R3)** passa de 10 para 50. Só **R2 e R3** originam novos Router-LSAs (sequência maior), que são inundados; depois todos recalculam o SPF.

O novo caminho é R1, R2, R5, R6 com custo 45. Na aba Tabela de roteamento, o roteador escolhido mostra a tabela antes e depois do SPF.

**Conceito.** Quando o custo de um enlace muda, os **dois** roteadores do enlace originam um novo Router-LSA com **número de sequência maior**. Os demais aceitam o LSA mais novo, descartam o antigo e refazem o SPF. A topologia não mudou, mas os custos sim, e o caminho de menor custo pode ser outro.

**O que observar**

- Só R2 e R3 originam LSAs novos (sequência 0x80000002).
- Na aba LSDB: o LSA de R2 e R3 com o custo novo, depois da inundação.
- Na aba Tabela de roteamento: antes e depois do SPF.

```mermaid
sequenceDiagram
  autonumber
  participant n_PC_A as PC-A<br/>host
  participant n_R1 as R1<br/>roteador
  participant n_R2 as R2<br/>roteador
  participant n_R3 as R3<br/>roteador
  participant n_R4 as R4<br/>roteador
  participant n_R5 as R5<br/>roteador
  participant n_R6 as R6<br/>roteador
  participant n_PC_B as PC-B<br/>host
  Note over n_PC_A,n_PC_B: Evento
  Note over n_PC_A,n_PC_B: Inundação do novo LSA
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R3: LSU (1 LSA)
  n_R3 ->> n_R2: LSU (1 LSA)
  n_R2 ->> n_R5: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R1 ->> n_R4: LSU (1 LSA)
  n_R2 ->> n_R5: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R5: LSU (1 LSA)
  n_R1 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  Note over n_PC_A,n_PC_B: SPF
  Note over n_PC_A,n_PC_B: Pacote PC-A → PC-B
  n_PC_A ->> n_R1: IP ttl 64
  n_R1 ->> n_R2: IP ttl 63
  n_R2 ->> n_R5: IP ttl 62
  n_R5 ->> n_R6: IP ttl 61
  n_R6 ->> n_PC_B: IP ttl 60
```

*Figura 7.2.1 (Tipo B, sequência).* Mensagens do cenário "Custo 50 em R2 / R3", na ordem do tempo, entre PC-A, R1, R2, R3, R4, R5, R6, PC-B: 19 mensagens, numeradas de 1 a 19 na ordem da comunicação (em 5 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Custo e falha", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| LSU | leva o Router-LSA novo | R2 e R3, depois todos |
| SPF | recalcula a árvore de menor custo | todos os roteadores |

**Por que importa.** Mostra por que o administrador usa o custo para fazer engenharia de tráfego: o caminho muda sem mexer na topologia.

#### 7.2.2 Queda do enlace R2 / R3

*A falha é detectada e o enlace sai dos Router-LSAs.*

**Configuração aplicada:** Sentido do tráfego = PC-A; Tipo de evento = queda; Enlace afetado = L3; Novo custo (só na mudança de custo) = 10; Segundo enlace que cai (opcional) = none; Ver a LSDB e a tabela do roteador = R1

O enlace **L3** cai. R2 e R3 perdem a adjacência (por falha da interface ou por RouterDeadInterval) e originam novos LSAs sem o enlace. O destino continua alcançável por outro caminho.

**Conceito.** A falha é detectada porque a interface cai ou porque o **RouterDeadInterval** (40 s por padrão) expira sem Hello. As duas pontas originam um novo Router-LSA sem o enlace, o LSA é inundado e todos refazem o SPF. Detecção mais rápida usa BFD, que está fora do escopo do simulador.

**O que observar**

- O Hello sem resposta, em vermelho, no enlace caído.
- Os dois roteadores originam novos LSAs.
- O pacote segue por outro caminho, com custo maior.

```mermaid
sequenceDiagram
  autonumber
  participant n_PC_A as PC-A<br/>host
  participant n_R1 as R1<br/>roteador
  participant n_R2 as R2<br/>roteador
  participant n_R3 as R3<br/>roteador
  participant n_R4 as R4<br/>roteador
  participant n_R5 as R5<br/>roteador
  participant n_R6 as R6<br/>roteador
  participant n_PC_B as PC-B<br/>host
  Note over n_PC_A,n_PC_B: Evento
  n_R2 -x n_R3: Hello (sem resposta)
  Note over n_PC_A,n_PC_B: Inundação do novo LSA
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R5: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R1 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R5: LSU (1 LSA)
  n_R5 ->> n_R2: LSU (1 LSA)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R4 ->> n_R1: LSU (1 LSA)
  Note over n_PC_A,n_PC_B: SPF
  Note over n_PC_A,n_PC_B: Pacote PC-A → PC-B
  n_PC_A ->> n_R1: IP ttl 64
  n_R1 ->> n_R2: IP ttl 63
  n_R2 ->> n_R5: IP ttl 62
  n_R5 ->> n_R6: IP ttl 61
  n_R6 ->> n_PC_B: IP ttl 60
```

*Figura 7.2.2 (Tipo B, sequência).* Mensagens do cenário "Queda do enlace R2 / R3", na ordem do tempo, entre PC-A, R1, R2, R3, R4, R5, R6, PC-B: 18 mensagens, numeradas de 1 a 18 na ordem da comunicação (em 5 fases; 1 perdida). Corresponde ao diagrama de sequência e à aba Captura, no modo "Custo e falha", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Hello (sem resposta) | indica que o vizinho não responde | as duas pontas do enlace |
| LSU | leva o Router-LSA sem o enlace | as duas pontas, depois todos |

**Por que importa.** A rapidez da reconvergência depende da detecção da falha e do tempo de inundação e de SPF. Em produção, esses temporizadores são ajustados.

#### 7.2.3 Isolamento do PC-B

*Sem nenhum caminho, o destino sai da tabela e o pacote é descartado.*

**Configuração aplicada:** Sentido do tráfego = PC-A; Tipo de evento = queda; Enlace afetado = L5; Novo custo (só na mudança de custo) = 10; Segundo enlace que cai (opcional) = L7; Ver a LSDB e a tabela do roteador = R1

Caem **L5 (R3 / R6)** e **L7 (R5 / R6)**: o R6 fica sem vizinhos e o PC-B deixa de ser alcançável. Os outros roteadores removem R6 da LSDB e da tabela; o pacote é descartado ao chegar ao último roteador que tinha rota.

**Conceito.** Se a falha divide a rede em duas partes, cada parte passa a ter uma LSDB sem a outra. O SPF não encontra mais o destino, que sai da tabela de rotas. O pacote é encaminhado até o último roteador que ainda tinha rota e descartado ali.

**O que observar**

- R6 fica sem adjacências.
- Na aba Tabela de roteamento: R6 aparece sem rota.
- O último evento é o descarte do pacote.

```mermaid
sequenceDiagram
  autonumber
  participant n_PC_A as PC-A<br/>host
  participant n_R1 as R1<br/>roteador
  participant n_R2 as R2<br/>roteador
  participant n_R3 as R3<br/>roteador
  participant n_R4 as R4<br/>roteador
  participant n_R5 as R5<br/>roteador
  participant n_R6 as R6<br/>roteador
  participant n_PC_B as PC-B<br/>host
  Note over n_PC_A,n_PC_B: Evento
  n_R3 -x n_R6: Hello (sem resposta)
  n_R5 -x n_R6: Hello (sem resposta)
  Note over n_PC_A,n_PC_B: Inundação do novo LSA
  n_R3 ->> n_R2: LSU (1 LSA)
  n_R5 ->> n_R2: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (2 LSAs)
  n_R4 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R3: LSU (1 LSA)
  n_R2 ->> n_R5: LSU (1 LSA)
  n_R1 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  Note over n_PC_A,n_PC_B: SPF
  Note over n_PC_A,n_PC_B: Pacote PC-A → PC-B
  n_PC_A ->> n_R1: IP ttl 64
```

*Figura 7.2.3 (Tipo B, sequência).* Mensagens do cenário "Isolamento do PC-B", na ordem do tempo, entre PC-A, R1, R2, R3, R4, R5, R6, PC-B: 12 mensagens, numeradas de 1 a 12 na ordem da comunicação (em 5 fases; 2 perdidas). Corresponde ao diagrama de sequência e à aba Captura, no modo "Custo e falha", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| Hello (sem resposta) | detecta a perda dos vizinhos de R6 | R3, R5 e R6 |
| LSU | leva os Router-LSAs sem os enlaces | R3 e R5, na parte conectada |

**Por que importa.** Mostra que o roteamento dinâmico só encontra caminhos que existem: a redundância física precisa ser projetada.

### 7.3 Modo: Multiárea

> **Grupo:** Multiárea

Como as áreas limitam a inundação e como os ABRs resumem uma área para as outras.

#### 7.3.1 Três áreas e Summary LSAs

*Cada área inunda os próprios LSAs e os ABRs resumem as outras áreas.*

**Configuração aplicada:** Sentido do tráfego = PC-A; Enlace fora de serviço = none; Ver a LSDB e a tabela do roteador = R1

Nove roteadores em três áreas: 1, 0 (backbone) e 2. Os **ABRs** R2, R3, R8 e R9 pertencem a duas áreas. Cada área inunda só os próprios LSAs, e depois os ABRs anunciam as outras áreas por **Summary LSAs** (tipo 3).

Escolha R1 em **Ver a LSDB**: ele não tem o Router-LSA de R7, só um Summary LSA com o custo até R7.

**Conceito.** Em redes grandes, o OSPF divide a rede em **áreas** ligadas à **área 0** (backbone). Os Router-LSAs ficam dentro da própria área, o que reduz a LSDB e o custo do SPF. Os **ABRs** (Area Border Routers) pertencem a duas áreas e anunciam cada área às outras por **Summary LSAs** (tipo 3, [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328) seção 12.4.3), que carregam só o destino e o custo.

**O que observar**

- As LSDBs são diferentes entre áreas: R1 não tem o Router-LSA de R7.
- Os ABRs têm uma LSDB para cada área.
- Na aba Tabela de roteamento: rotas intra-área e inter-área (via ABR).

```mermaid
sequenceDiagram
  autonumber
  participant n_PC_A as PC-A<br/>host
  participant n_R1 as R1<br/>área 1
  participant n_R2 as R2<br/>ABR (áreas 1 e 0)
  participant n_R3 as R3<br/>ABR (áreas 1 e 0)
  participant n_R4 as R4<br/>área 0
  participant n_R5 as R5<br/>área 0
  participant n_R6 as R6<br/>área 0
  participant n_R7 as R7<br/>área 2
  participant n_R8 as R8<br/>ABR (áreas 2 e 0)
  participant n_R9 as R9<br/>ABR (áreas 2 e 0)
  participant n_PC_B as PC-B<br/>host
  Note over n_PC_A,n_PC_B: 1. Adjacências
  Note over n_PC_A,n_PC_B: 2. Inundação em cada área
  n_R4 ->> n_R5: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R5: LSU (1 LSA)
  n_R4 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R4: LSU (1 LSA)
  n_R2 ->> n_R4: LSU (1 LSA)
  n_R4 ->> n_R2: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R4 ->> n_R8: LSU (1 LSA)
  n_R8 ->> n_R4: LSU (1 LSA)
  n_R6 ->> n_R9: LSU (1 LSA)
  n_R9 ->> n_R6: LSU (1 LSA)
  n_R1 ->> n_R2: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R1 ->> n_R3: LSU (1 LSA)
  n_R3 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R3: LSU (1 LSA)
  n_R3 ->> n_R2: LSU (1 LSA)
  n_R7 ->> n_R8: LSU (1 LSA)
  n_R8 ->> n_R7: LSU (1 LSA)
  n_R7 ->> n_R9: LSU (1 LSA)
  n_R9 ->> n_R7: LSU (1 LSA)
  n_R8 ->> n_R9: LSU (1 LSA)
  n_R9 ->> n_R8: LSU (1 LSA)
  n_R4 ->> n_R5: LSU (2 LSAs)
  n_R6 ->> n_R5: LSU (2 LSAs)
  n_R4 ->> n_R6: LSU (2 LSAs)
  n_R6 ->> n_R4: LSU (2 LSAs)
  n_R4 ->> n_R2: LSU (3 LSAs)
  n_R6 ->> n_R3: LSU (3 LSAs)
  n_R4 ->> n_R8: LSU (3 LSAs)
  n_R6 ->> n_R9: LSU (3 LSAs)
  n_R4 ->> n_R2: LSU (2 LSAs)
  n_R6 ->> n_R3: LSU (2 LSAs)
  n_R4 ->> n_R8: LSU (2 LSAs)
  n_R6 ->> n_R9: LSU (2 LSAs)
  Note over n_PC_A,n_PC_B: 3. Summary LSAs
  n_R2 ->> n_R4: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R8 ->> n_R4: LSU (1 LSA)
  n_R9 ->> n_R6: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (6 LSAs)
  n_R3 ->> n_R1: LSU (6 LSAs)
  n_R2 ->> n_R3: LSU (6 LSAs)
  n_R3 ->> n_R2: LSU (6 LSAs)
  n_R8 ->> n_R7: LSU (6 LSAs)
  n_R9 ->> n_R7: LSU (6 LSAs)
  n_R8 ->> n_R9: LSU (6 LSAs)
  n_R9 ->> n_R8: LSU (6 LSAs)
  n_R4 ->> n_R5: LSU (2 LSAs)
  n_R6 ->> n_R5: LSU (2 LSAs)
  n_R4 ->> n_R6: LSU (2 LSAs)
  n_R6 ->> n_R4: LSU (2 LSAs)
  n_R4 ->> n_R2: LSU (1 LSA)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R4 ->> n_R8: LSU (1 LSA)
  n_R6 ->> n_R9: LSU (1 LSA)
  n_R4 ->> n_R2: LSU (2 LSAs)
  n_R6 ->> n_R3: LSU (2 LSAs)
  n_R4 ->> n_R8: LSU (2 LSAs)
  n_R6 ->> n_R9: LSU (2 LSAs)
  Note over n_PC_A,n_PC_B: SPF
  Note over n_PC_A,n_PC_B: Pacote PC-A → PC-B
  n_PC_A ->> n_R1: IP ttl 64
  n_R1 ->> n_R2: IP ttl 63
  n_R2 ->> n_R4: IP ttl 62
  n_R4 ->> n_R8: IP ttl 61
  n_R8 ->> n_R7: IP ttl 60
  n_R7 ->> n_PC_B: IP ttl 59
```

*Figura 7.3.1 (Tipo B, sequência).* Mensagens do cenário "Três áreas e Summary LSAs", na ordem do tempo, entre PC-A, R1, R2, R3, R4, R5, R6, R7, R8, R9, PC-B: 68 mensagens, numeradas de 1 a 68 na ordem da comunicação (em 6 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Multiárea", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| LSU com Router-LSA | inunda os enlaces dentro de uma área | os roteadores da área |
| LSU com Summary LSA | anuncia um destino de outra área e o custo | R2, R3, R8 e R9 (ABRs) |

**Por que importa.** O resumo esconde a topologia interna de cada área: uma falha dentro de uma área não obriga as outras a refazer o SPF, só a atualizar um custo.

#### 7.3.2 Enlace R4 / R8 fora de serviço

*A falha no backbone muda o custo dos Summary LSAs.*

**Configuração aplicada:** Sentido do tráfego = PC-A; Enlace fora de serviço = MA12; Ver a LSDB e a tabela do roteador = R1

Com **MA12 (R4 / R8)** fora de serviço, o tráfego do backbone para a área 2 passa por **R6 e R9**. O custo anunciado nos Summary LSAs cresce, e o caminho do PC-A ao PC-B muda sem que R1 saiba por onde.

**Conceito.** O custo que um ABR anuncia no Summary LSA inclui o caminho dentro do backbone. Quando o enlace MA12 cai, o caminho de R4 até a área 2 passa por R6 e R9, e os custos anunciados aumentam. Os roteadores da área 1 só enxergam esse custo maior.

**O que observar**

- O caminho do pacote passa por R9.
- Na aba Tabela de roteamento de R1: o custo até R7 é maior.
- R1 não sabe quais enlaces foram usados dentro do backbone.

```mermaid
sequenceDiagram
  autonumber
  participant n_PC_A as PC-A<br/>host
  participant n_R1 as R1<br/>área 1
  participant n_R2 as R2<br/>ABR (áreas 1 e 0)
  participant n_R3 as R3<br/>ABR (áreas 1 e 0)
  participant n_R4 as R4<br/>área 0
  participant n_R5 as R5<br/>área 0
  participant n_R6 as R6<br/>área 0
  participant n_R7 as R7<br/>área 2
  participant n_R8 as R8<br/>ABR (áreas 2 e 0)
  participant n_R9 as R9<br/>ABR (áreas 2 e 0)
  participant n_PC_B as PC-B<br/>host
  Note over n_PC_A,n_PC_B: 1. Adjacências
  Note over n_PC_A,n_PC_B: 2. Inundação em cada área
  n_R4 ->> n_R5: LSU (1 LSA)
  n_R5 ->> n_R4: LSU (1 LSA)
  n_R5 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R5: LSU (1 LSA)
  n_R4 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R4: LSU (1 LSA)
  n_R2 ->> n_R4: LSU (1 LSA)
  n_R4 ->> n_R2: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R6 ->> n_R9: LSU (1 LSA)
  n_R9 ->> n_R6: LSU (1 LSA)
  n_R1 ->> n_R2: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (1 LSA)
  n_R1 ->> n_R3: LSU (1 LSA)
  n_R3 ->> n_R1: LSU (1 LSA)
  n_R2 ->> n_R3: LSU (1 LSA)
  n_R3 ->> n_R2: LSU (1 LSA)
  n_R7 ->> n_R8: LSU (1 LSA)
  n_R8 ->> n_R7: LSU (1 LSA)
  n_R7 ->> n_R9: LSU (1 LSA)
  n_R9 ->> n_R7: LSU (1 LSA)
  n_R8 ->> n_R9: LSU (1 LSA)
  n_R9 ->> n_R8: LSU (1 LSA)
  n_R4 ->> n_R5: LSU (1 LSA)
  n_R6 ->> n_R5: LSU (2 LSAs)
  n_R4 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R4: LSU (2 LSAs)
  n_R4 ->> n_R2: LSU (2 LSAs)
  n_R6 ->> n_R3: LSU (3 LSAs)
  n_R6 ->> n_R9: LSU (3 LSAs)
  n_R4 ->> n_R2: LSU (2 LSAs)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R6 ->> n_R9: LSU (1 LSA)
  Note over n_PC_A,n_PC_B: 3. Summary LSAs
  n_R2 ->> n_R4: LSU (1 LSA)
  n_R3 ->> n_R6: LSU (1 LSA)
  n_R9 ->> n_R6: LSU (1 LSA)
  n_R2 ->> n_R1: LSU (5 LSAs)
  n_R3 ->> n_R1: LSU (5 LSAs)
  n_R2 ->> n_R3: LSU (5 LSAs)
  n_R3 ->> n_R2: LSU (5 LSAs)
  n_R9 ->> n_R7: LSU (6 LSAs)
  n_R9 ->> n_R8: LSU (6 LSAs)
  n_R4 ->> n_R5: LSU (1 LSA)
  n_R6 ->> n_R5: LSU (2 LSAs)
  n_R4 ->> n_R6: LSU (1 LSA)
  n_R6 ->> n_R4: LSU (2 LSAs)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R6 ->> n_R9: LSU (1 LSA)
  n_R4 ->> n_R2: LSU (2 LSAs)
  n_R6 ->> n_R3: LSU (1 LSA)
  n_R6 ->> n_R9: LSU (1 LSA)
  Note over n_PC_A,n_PC_B: SPF
  Note over n_PC_A,n_PC_B: Pacote PC-A → PC-B
  n_PC_A ->> n_R1: IP ttl 64
  n_R1 ->> n_R3: IP ttl 63
  n_R3 ->> n_R6: IP ttl 62
  n_R6 ->> n_R9: IP ttl 61
  n_R9 ->> n_R7: IP ttl 60
  n_R7 ->> n_PC_B: IP ttl 59
```

*Figura 7.3.2 (Tipo B, sequência).* Mensagens do cenário "Enlace R4 / R8 fora de serviço", na ordem do tempo, entre PC-A, R1, R2, R3, R4, R5, R6, R7, R8, R9, PC-B: 58 mensagens, numeradas de 1 a 58 na ordem da comunicação (em 6 fases). Corresponde ao diagrama de sequência e à aba Captura, no modo "Multiárea", com a configuração aplicada acima.

**Mensagens**

| Mensagem | Significado | Origem |
| --- | --- | --- |
| LSU com Summary LSA | leva o custo atualizado até as outras áreas | os ABRs |

**Por que importa.** É a vantagem e o preço do resumo: a rede escala, mas o roteador interno não vê o caminho completo.

## 8. Referência

### 8.1 Roteamento por estado de enlace

No **OSPF** (Open Shortest Path First, versão 2, [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328)), cada roteador descreve os próprios enlaces e os custos em um **LSA** (Link State Advertisement) e o inunda por toda a área. Quando todos têm a mesma **LSDB** (base de estado de enlace), cada um calcula sozinho a árvore de menor custo, com raiz em si mesmo, pelo algoritmo de **Dijkstra** (**SPF**, seção 16.1). O OSPF é um IGP (Interior Gateway Protocol) e transporta seus pacotes direto sobre o IP, protocolo 89.

### 8.2 Do Hello à tabela de rotas

- **Hello:** descobre vizinhos, em 224.0.0.5 (AllSPFRouters). Quando um roteador vê o próprio Router ID na lista de vizinhos do Hello recebido, o estado passa a **2-Way** (seção 10.5). Os padrões são HelloInterval de 10 s e RouterDeadInterval de 40 s em redes ponto a ponto e broadcast.
- **Adjacência:** os vizinhos trocam **DBD** (cabeçalhos dos LSAs), **LSR** (pedido dos LSAs que faltam), **LSU** (entrega dos LSAs) e **LSAck** (confirmação) até o estado **Full** (seção 10.1 e seção 7.2).
- **Inundação:** cada roteador origina o Router-LSA com os enlaces ativos e os custos. Quem recebe um LSA novo ou mais recente o guarda e o reenvia aos demais vizinhos (seção 13). O **número de sequência** decide qual LSA é o mais novo.
- **SPF:** cada roteador executa o Dijkstra sobre a LSDB e instala o próximo salto de cada destino.
- **Custo:** a RFC trata o custo da interface apenas como parâmetro configurável (quanto menor, mais preferido); vence o menor custo total. A fórmula "largura de banda de referência dividida pela do enlace" é prática de fabricantes, como o Cisco IOS, e não faz parte da RFC.

### 8.3 Multiárea

A **área 0** é o backbone, e toda área precisa se ligar a ela. Um **ABR** (Area Border Router) tem interfaces em mais de uma área e mantém uma LSDB por área. Os Router-LSAs não saem da própria área. Para que as áreas se alcancem, o ABR origina **Summary LSAs** (tipo 3, seção 12.4.3): cada um carrega só o destino e o custo, sem a topologia. O roteador interno soma o custo até o ABR ao custo anunciado e obtém uma rota **inter-área**. Uma falha dentro de uma área não obriga as outras a refazer o SPF, apenas a atualizar um custo.

### 8.4 Comparação com o RIP

| Aspecto | OSPF | RIPv2 |
| --- | --- | --- |
| Tipo | Estado de enlace | Vetor de distância |
| Algoritmo | Dijkstra (SPF) | Bellman-Ford |
| Métrica | Custo configurável | Saltos (máximo 15) |
| Visão da rede | Mapa completo da área | Só o que os vizinhos anunciam |
| Transporte | IP protocolo 89, 224.0.0.5 e 224.0.0.6 | UDP 520, 224.0.0.9 |
| Escala | Grande, com áreas | Pequena |

### 8.5 OSPF e segurança

- **Injeção de LSAs e de rotas:** um atacante na mesma rede pode anunciar LSAs falsos para desviar tráfego (homem no meio) ou criar um buraco negro. A defesa é a **autenticação**: no OSPFv2, o HMAC-SHA da [RFC 5709](https://www.rfc-editor.org/rfc/rfc5709) (a autenticação simples e o MD5 original são fracos).
- **Interfaces passivas:** desativar o Hello nas interfaces voltadas para usuários impede que um host participe do roteamento.
- **Filtragem e resumo de rotas:** reduzem o efeito de anúncios indevidos e da instabilidade de enlaces (flapping).
- **Proteção do plano de controle:** limitar quem pode enviar OSPF aos roteadores vizinhos conhecidos e usar o TTL de segurança (GTSM, [RFC 5082](https://www.rfc-editor.org/rfc/rfc5082)) quando aplicável.

### 8.6 O que o simulador simplifica

- Todos os enlaces são ponto a ponto: não há eleição de **DR** e **BDR** (redes de acesso múltiplo), e o endereço 224.0.0.6 (AllDRouters) aparece só nesta referência.
- Cada roteador anuncia um destino: o próprio Router ID. As redes dos PCs não entram em LSAs próprios (não há Network-LSA, Type 5 nem áreas stub).
- A inundação mostra um LSU por enlace e sentido, por rodada, com atraso fixo, e **não mostra o LSAck** da fase de inundação (só o da adjacência). A ordem real depende de temporizadores.
- Os Summary LSAs são calculados sobre a topologia verdadeira, que é o que a LSDB teria depois de convergir; o simulador não mostra o cálculo de cada ABR passo a passo.
- O custo de cada enlace é fixo no cenário, sem cálculo por largura de banda de referência. OSPFv3 e IPv6 estão fora do escopo.
- A detecção da falha é instantânea no desenho; em redes reais depende do RouterDeadInterval (40 s) ou de BFD.

### 8.7 Roteiro de exercícios

1. No modo **Convergência**, anote o caminho de PC-A a PC-B. Todos os caminhos de R1 a R6 têm 3 saltos; por que o OSPF escolheu R1, R2, R3, R6?
2. Na aba **LSDB**, escolha R1 e compare com R6 depois da inundação. O que mudou entre os dois? E na **Tabela de roteamento**?
3. No modo **Evento**, aumente o custo de **L3 (R2 / R3)** para 50. Quais roteadores originam novos LSAs, e qual é o novo caminho?
4. Derrube o enlace **L3** e depois **L1**. Em qual caso o tráfego deixa de passar por R2? Troque o custo de um enlace fora do caminho: o tráfego muda?
5. Isole o PC-B derrubando **L5** e **L7**. O que acontece com a tabela dos outros roteadores?
6. No modo **Multiárea**, identifique os ABRs. Compare a LSDB de R1, R2 e R4. Por que R1 não tem o Router-LSA de R7?
7. Ponha o enlace **MA12** fora de serviço. O que muda no custo até R7 que R1 enxerga?
8. **Segurança:** um host na rede do PC-A passa a enviar LSAs falsos. Que configurações impediriam a injeção?


## 9. Glossário

Significado e finalidade das siglas usadas neste documento.

| Sigla | Significado | Para que serve |
| --- | --- | --- |
| **ABR** | Area Border Router, roteador de borda de área | roteador OSPF ligado a mais de uma área, que resume as rotas entre elas |
| **BDR** | Backup Designated Router, roteador designado de reserva | assume no lugar do DR se ele falhar |
| **BFD** | Bidirectional Forwarding Detection | detecta em milissegundos a falha de um enlace ou vizinho, para o roteamento reagir depressa |
| **BGP** | Border Gateway Protocol, protocolo de roteador de borda | troca rotas entre sistemas autônomos e sustenta o roteamento entre operadoras na Internet |
| **DBD** | Database Description, descrição de base de dados | mensagem OSPF que resume a LSDB na sincronização entre vizinhos |
| **DR** | Designated Router, roteador designado | roteador eleito num segmento multiacesso para trocar LSAs com todos os demais |
| **GTSM** | Generalized TTL Security Mechanism, mecanismo generalizado de segurança por TTL | faz o roteador aceitar pacotes BGP só com TTL 255, o que protege sessões entre vizinhos diretamente ligados ([RFC 5082](https://www.rfc-editor.org/rfc/rfc5082)) |
| **HMAC-SHA** | keyed-Hash Message Authentication Code com SHA | autentica as mensagens de roteamento com uma chave compartilhada, como no OSPF ([RFC 5709](https://www.rfc-editor.org/rfc/rfc5709)) |
| **ID** | Identifier, identificador | valor que distingue uma entidade ou uma consulta, como o router ID do BGP e o ID da consulta DNS |
| **IGP** | Interior Gateway Protocol, protocolo de roteamento interno | roteamento dentro de um sistema autônomo, como o OSPF; contrasta com o BGP, que liga sistemas autônomos |
| **IOS** | Internetwork Operating System | sistema operacional dos equipamentos Cisco; os valores padrão citados nos exemplos vêm dele |
| **IP** | Internet Protocol, protocolo de internet | endereça e encaminha pacotes entre redes, de origem a destino |
| **L2** | Layer 2, camada 2 (enlace) | indica que o equipamento encaminha por endereço MAC, como um switch |
| **LSA** | Link State Advertisement, anúncio de estado de enlace | anúncio do estado dos enlaces trocado no OSPF |
| **LSDB** | Link-State Database, base de estado de enlaces | base com o mapa da topologia que cada roteador OSPF mantém |
| **LSR** | Label Switching Router, roteador de comutação por rótulos | roteador MPLS que encaminha pacotes pelo rótulo, sem consultar o endereço IP de destino |
| **LSU** | Link State Update, atualização de estado de enlace | mensagem OSPF que leva os LSAs |
| **MD5** | Message Digest 5 | função de hash antiga, considerada insegura para assinaturas; ainda aparece em protocolos legados |
| **OSPF** | Open Shortest Path First | protocolo de roteamento interno que calcula o menor caminho a partir do mapa completo da rede |
| **RFC** | Request for Comments, pedido de comentários | documento numerado do IETF que define ou descreve um protocolo da Internet; cada documento do projeto cita as RFCs com link para o RFC Editor |
| **RIP** | Routing Information Protocol, protocolo de informação de roteamento | protocolo de vetor de distância que usa a contagem de saltos (máximo de 15) |
| **SPF** | Sender Policy Framework | registro DNS que lista os servidores autorizados a enviar e-mail por um domínio |
| **TTL** | Time To Live, tempo de vida | limita quantos saltos um pacote pode dar; cada roteador o reduz de 1, e ao chegar a zero o pacote é descartado |
| **UDP** | User Datagram Protocol | entrega datagramas sem conexão nem confirmação, com baixo custo; usado em consultas curtas e em tempo real |


---

*Simul-Net é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
