// Fundamentação do simulador OSPF, em Markdown: aparece na documentação (docs/simuladores/ospf.md e na wiki), antes de
// "Como ler os diagramas". Explica o roteamento por estado de enlace, da descoberta de vizinhos ao cálculo das rotas.
export const fundamentacao: string = `
### O problema que o OSPF resolve

Um roteador só encaminha bem se souber a rota de cada destino. Em redes pequenas, as rotas podem ser escritas à mão (estáticas), mas qualquer falha ou mudança exige que alguém as corrija. Um **protocolo de roteamento dinâmico** faz os roteadores descobrirem a rede e se ajustarem sozinhos.

O OSPF (*Open Shortest Path First*, versão 2, RFC 2328) é um protocolo de **estado de enlace**, usado **dentro** de um sistema autônomo (um IGP, *Interior Gateway Protocol*). A ideia é simples: cada roteador descreve os **próprios enlaces e custos**, e esse relato é espalhado por toda a área. Quando todos têm o mesmo mapa, cada um calcula sozinho o melhor caminho. Os pacotes do OSPF vão direto sobre o IP, no protocolo 89.

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

### O LSA e a LSDB

Cada roteador gera um **Router-LSA** com os próprios enlaces ativos e os custos. A coleção de todos os LSAs de uma área é a **LSDB** (*Link State Database*), e ela é igual em todos os roteadores da área.

\`\`\`mermaid
flowchart TD
  N["R1 gera um LSA novo<br/>número de sequência maior"] --> E["Envia LSU a todos os vizinhos"]
  E --> Q{"O vizinho já tem<br/>este LSA ou um mais novo?"}
  Q -- "sim" --> D["Descarta"]
  Q -- "não" --> G["Guarda na LSDB, confirma com LSAck<br/>e reenvia aos outros vizinhos"]
\`\`\`

*Esquema 3 (inundação de um LSA).* O LSA se espalha de vizinho em vizinho, e o **número de sequência** decide qual cópia é a mais recente (RFC 2328, seção 13). Um LSA repetido morre ali, o que impede a inundação de girar para sempre.

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

*Esquema 4 (áreas e ABRs).* A área 0 é o **backbone**, e toda área precisa se ligar a ela. O ABR (*Area Border Router*) tem interfaces em mais de uma área e mantém **uma LSDB por área**. Os Router-LSAs não saem da própria área. Para que as áreas se alcancem, o ABR origina **Summary-LSAs** (tipo 3, RFC 2328, seção 12.4.3): cada um carrega só o destino e o custo, sem a topologia.

O roteador interno soma o custo até o ABR ao custo anunciado e obtém uma **rota inter-área**. Por isso uma falha dentro de uma área não obriga as outras a refazer o SPF: elas apenas atualizam um custo.

### Como ler o diagrama do simulador

- **Topologia:** os roteadores, o **custo** de cada enlace e os dois PCs. O caminho do tráfego fica destacado, e os eventos de custo e de falha se refletem no desenho.
- **Diagrama de sequência e legenda de cores:** cada cor é um tipo de mensagem (Hello, pacotes da adjacência, LSU da inundação e pacote de dados ou Summary-LSA).
- **Aba LSDB:** a base de estado de enlace do roteador escolhido, no instante atual. Compare a de dois roteadores e veja que, depois da inundação, elas ficam iguais.
- **Aba Tabela de roteamento:** as rotas calculadas pelo SPF no mesmo roteador.
- **Modos:** *Convergência* (do Hello às rotas), *Custo e falha* (o que muda quando um custo sobe ou um enlace cai) e *Multiárea* (ABRs e Summary-LSAs).

### Limites do modelo e do diagrama

- Todos os enlaces são **ponto a ponto**: não há eleição de DR e BDR (redes de acesso múltiplo, RFC 2328, seção 7.3).
- Cada roteador anuncia um só destino, o próprio Router ID. Não há Network-LSA, AS-external-LSA nem áreas *stub*.
- A inundação é desenhada em rodadas, com atraso fixo, e a detecção de falha é instantânea. Em redes reais, ela depende do RouterDeadInterval (40 s) ou de mecanismos como o BFD.
- A autenticação (RFC 5709) e as proteções do plano de controle são discutidas na aba Referência, mas não são simuladas.
`;
