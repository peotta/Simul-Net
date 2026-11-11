// Fundamentação do simulador OSPF, em Markdown: aparece na documentação (docs/simuladores/ospf.md e na wiki), antes de
// "Como ler os diagramas". Explica o roteamento por estado de enlace, da descoberta de vizinhos ao cálculo das rotas.
export const fundamentacao: string = `
### O problema que o OSPF resolve

Um roteador só encaminha bem se souber a rota de cada destino. Em redes pequenas, as rotas podem ser escritas à mão (estáticas), mas qualquer falha ou mudança exige que alguém as corrija. Um **protocolo de roteamento dinâmico** faz os roteadores descobrirem a rede e se ajustarem sozinhos.

O OSPF (*Open Shortest Path First*, versão 2, RFC 2328) é um protocolo de **estado de enlace**, usado **dentro** de um sistema autônomo (um IGP, *Interior Gateway Protocol*). A ideia é simples: cada roteador descreve os **próprios enlaces e custos**, e esse relato é espalhado por toda a área. Quando todos têm o mesmo mapa, cada um calcula sozinho o melhor caminho. Os pacotes do OSPF vão direto sobre o IP, no protocolo 89.

**O que você aprende com este simulador.**

- Explicar a diferença entre roteamento estático e dinâmico e o que é um protocolo de estado de enlace.
- Acompanhar as fases do OSPF: Hello, adjacência, inundação de LSAs, SPF e tabela de rotas.
- Ler o cabeçalho do pacote OSPF, o Hello e o cabeçalho do LSA campo a campo.
- Entender como o custo e as falhas mudam o caminho escolhido pelo SPF.
- Interpretar a divisão em áreas, o backbone, o ABR e os Summary-LSAs.

### O diagrama das fases do OSPF

\`\`\`mermaid
flowchart LR
  H["1. Hello<br/>descobre vizinhos"] --> A["2. Adjacência<br/>sincroniza as bases"]
  A --> F["3. Inundação<br/>espalha os LSAs"]
  F --> L["4. LSDB igual<br/>em todos da área"]
  L --> S["5. SPF<br/>Dijkstra em cada roteador"]
  S --> T["6. Tabela de rotas<br/>próximo salto por destino"]
\`\`\`

*Esquema 1 (do Hello à tabela de rotas).* Cada fase prepara a seguinte. Quando um enlace muda de custo ou cai, o roteador afetado gera um LSA novo, e o processo recomeça a partir da inundação (fase 3).

### Vizinhos e adjacências

\`\`\`mermaid
stateDiagram-v2
  [*] --> Down
  Down --> Init: recebe Hello
  Init --> TwoWay: o Hello recebido lista o meu Router ID
  TwoWay --> ExStart: decide ser adjacente
  ExStart --> Exchange: define mestre e escravo
  Exchange --> Loading: troca DBD, falta algum LSA
  Loading --> Full: recebe os LSAs pedidos
  Exchange --> Full: nada faltou
\`\`\`

*Esquema 2 (estados do vizinho, resumidos).* O Hello detecta o vizinho. Quando cada lado vê o próprio Router ID na lista de vizinhos do outro, o estado passa a 2-Way. Depois, os dois trocam os resumos das bases (DBD), pedem o que falta (LSR) e recebem (LSU) até chegar a Full (RFC 2328, seção 10.1 e seção 10.5). A tabela completa de transições está na seção 10.3.

| Pacote | Função |
| --- | --- |
| Hello | descobre e mantém vizinhos, com HelloInterval (10 s) e RouterDeadInterval (40 s) nos enlaces ponto a ponto e de difusão |
| DBD (*Database Description*) | resume os LSAs da base, só pelos cabeçalhos |
| LSR (*Link State Request*) | pede os LSAs que faltam |
| LSU (*Link State Update*) | entrega os LSAs |
| LSAck | confirma o recebimento |

### Os formatos: cabeçalho, Hello e cabeçalho do LSA

Todo pacote OSPF começa com um cabeçalho comum de 24 bytes e vai direto sobre o IP (protocolo 89), em geral para o multicast 224.0.0.5 (todos os roteadores OSPF) e, nas redes de acesso múltiplo, 224.0.0.6 (DR e BDR). O desenho mostra o cabeçalho seguido do corpo do pacote Hello, em linhas de 32 bits, na ordem de transmissão ([RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), apêndice A).

\`\`\`mermaid
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
\`\`\`

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

O **LSA** começa com um cabeçalho de 20 bytes, que também é o que vai nos DBDs e nos LSAcks (RFC 2328, seção 12.1):

\`\`\`mermaid
packet-beta
  0-15: "Idade do LSA (LS age)"
  16-23: "Opções"
  24-31: "Tipo do LSA"
  32-63: "ID do estado de enlace"
  64-95: "Roteador que anunciou"
  96-127: "Número de sequência"
  128-143: "Checksum"
  144-159: "Tamanho"
\`\`\`

*Esquema 4 (o cabeçalho do LSA).* Os campos **tipo**, **ID do estado de enlace** e **roteador que anunciou** identificam o LSA, e o **número de sequência**, a **idade** e o **checksum** dizem qual cópia é a mais recente (RFC 2328, seção 13.1). O roteador reemite o próprio LSA a cada 30 minutos, e a idade máxima é de 1 hora, depois da qual o LSA é removido da base.

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

### O LSA e a LSDB

Cada roteador gera um **Router-LSA** com os próprios enlaces ativos e os custos. A coleção de todos os LSAs de uma área é a **LSDB** (*Link State Database*), e ela é igual em todos os roteadores da área.

\`\`\`mermaid
flowchart TD
  N["R1 gera um LSA novo<br/>número de sequência maior"] --> E["Envia LSU a todos os vizinhos"]
  E --> Q{"O vizinho já tem<br/>este LSA ou um mais novo?"}
  Q -- "sim" --> D["Descarta"]
  Q -- "não" --> G["Guarda na LSDB, confirma com LSAck<br/>e reenvia aos outros vizinhos"]
\`\`\`

*Esquema 5 (inundação de um LSA).* O LSA se espalha de vizinho em vizinho, e o **número de sequência** decide qual cópia é a mais recente (RFC 2328, seção 13). Um LSA repetido morre ali, o que impede a inundação de girar para sempre.

O OSPF define vários tipos de LSA (RFC 2328, seção 12.4): o Router-LSA (tipo 1) descreve os enlaces de um roteador, o Network-LSA (tipo 2) descreve uma rede de acesso múltiplo, o Summary-LSA (tipos 3 e 4) leva destinos de outra área, e o AS-external-LSA (tipo 5) leva rotas externas.

### O cálculo das rotas: SPF

Com a LSDB completa, cada roteador monta o grafo da área e roda o **algoritmo de Dijkstra** (SPF, *Shortest Path First*), com raiz em si mesmo (RFC 2328, seção 16.1). O resultado é a **árvore de menor custo** até cada destino. A rota instalada é o primeiro salto dessa árvore.

- O **custo** da interface é um parâmetro configurável: quanto menor, mais preferido. Vence o menor **custo total** do caminho.
- A fórmula "largura de banda de referência dividida pela do enlace" é prática de fabricantes, como o Cisco IOS, e não faz parte da RFC.
- Como cada roteador calcula sobre o mesmo mapa, os resultados são consistentes entre si, sem laços de roteamento em regime.

### Várias áreas

\`\`\`mermaid
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
\`\`\`

*Esquema 6 (áreas e ABRs).* A área 0 é o **backbone**, e toda área precisa se ligar a ela. O ABR (*Area Border Router*) tem interfaces em mais de uma área e mantém **uma LSDB por área**. Os Router-LSAs não saem da própria área. Para que as áreas se alcancem, o ABR origina **Summary-LSAs** (tipo 3, RFC 2328, seção 12.4.3): cada um carrega só o destino e o custo, sem a topologia.

O roteador interno soma o custo até o ABR ao custo anunciado e obtém uma **rota inter-área**. Por isso uma falha dentro de uma área não obriga as outras a refazer o SPF: elas apenas atualizam um custo.

### O que cada modo e aba do simulador mostram

- **Topologia:** os roteadores, o **custo** de cada enlace e os dois PCs. O caminho do tráfego fica destacado, e os eventos de custo e de falha se refletem no desenho.
- **Diagrama de sequência e legenda de cores:** cada cor é um tipo de mensagem (Hello, pacotes da adjacência, LSU da inundação e pacote de dados ou Summary-LSA).
- **Aba LSDB:** a base de estado de enlace do roteador escolhido, no instante atual. Compare a de dois roteadores e veja que, depois da inundação, elas ficam iguais.
- **Aba Tabela de roteamento:** as rotas calculadas pelo SPF no mesmo roteador.
- **Modos:** *Convergência* (do Hello às rotas), *Custo e falha* (o que muda quando um custo sobe ou um enlace cai) e *Multiárea* (ABRs e Summary-LSAs).

Para ver a rede convergir, use "Convergência em área única". Para o efeito do custo e da falha, use "Custo 50 em R2 / R3", "Queda do enlace R2 / R3" e "Isolamento do PC-B". Para as áreas, use "Três áreas e Summary LSAs" e "Enlace R4 / R8 fora de serviço".

### Limites do modelo e do diagrama

- Todos os enlaces são **ponto a ponto**: não há eleição de DR e BDR (redes de acesso múltiplo, RFC 2328, seção 7.3).
- Cada roteador anuncia um só destino, o próprio Router ID. Não há Network-LSA, AS-external-LSA nem áreas *stub*.
- A inundação é desenhada em rodadas, com atraso fixo, e a detecção de falha é instantânea. Em redes reais, ela depende do RouterDeadInterval (40 s) ou de mecanismos como o BFD.
- A autenticação (RFC 5709) e as proteções do plano de controle são discutidas na aba Referência, mas não são simuladas.
`;
