// Fundamentação do simulador de STP, RSTP e MSTP, em Markdown: aparece na documentação (docs/simuladores/stp.md e na wiki),
// antes de "Como ler os diagramas". Explica o laço, a eleição da raiz, os papéis e estados das portas e as variantes.
export const fundamentacao: string = `
### O problema que o spanning tree resolve

Enlaces redundantes dão resiliência a uma rede local, mas formam **laços**. O quadro Ethernet **não tem TTL**: um broadcast preso em um laço circula para sempre, se multiplica a cada switch e satura a rede (uma **tempestade de broadcast**), e as tabelas MAC perdem a estabilidade, porque o mesmo MAC é "visto" em portas diferentes.

O *spanning tree* escolhe, entre os switches, uma **árvore sem laços** e deixa em bloqueio as portas que formariam um laço. Se um enlace da árvore falha, uma porta bloqueada é reaberta. São três versões: o **STP** (IEEE 802.1D), o **RSTP** (IEEE 802.1w, convergência rápida) e o **MSTP** (IEEE 802.1s, uma árvore por grupo de VLANs). Os três foram incorporados ao IEEE 802.1Q.

### O diagrama do laço e da árvore

\`\`\`mermaid
flowchart LR
  subgraph L["Sem spanning tree: laço"]
    A1["SW1"] --- B1["SW2"]
    B1 --- C1["SW3"]
    C1 --- A1
  end
  subgraph T["Com spanning tree: árvore"]
    A2["SW1<br/>raiz"] --- B2["SW2"]
    A2 --- C2["SW3"]
    B2 -. "enlace bloqueado<br/>porta em bloqueio" .- C2
  end
\`\`\`

*Esquema 1 (triângulo de switches).* Os três switches ligados em triângulo formam um laço. O spanning tree mantém dois enlaces ativos e bloqueia o terceiro, e a porta bloqueada volta a funcionar se um dos enlaces ativos falhar.

### A eleição da raiz

\`\`\`mermaid
flowchart TD
  I["Todos os switches começam achando<br/>que são a raiz e enviam BPDUs"] --> C["Cada um compara o que recebe<br/>com o próprio identificador"]
  C --> R["Vence a ponte de menor identificador:<br/>prioridade e, no empate, o MAC"]
  R --> P["Cada ponte não raiz escolhe a porta raiz:<br/>menor custo acumulado até a raiz"]
  P --> D["Em cada enlace, a ponte com o melhor vetor<br/>fica com a porta designada"]
  D --> B["A porta que não é raiz nem designada<br/>fica bloqueada"]
\`\`\`

*Esquema 2 (como a árvore é construída).* O **identificador da ponte** tem 8 bytes: prioridade (padrão 32768) e o MAC. Na versão atual, a prioridade usa os 4 bits mais altos, em múltiplos de 4096, e os 12 bits restantes formam a extensão de identificador de sistema (o número da VLAN ou da instância). Os switches trocam **BPDUs** (*Bridge Protocol Data Units*), que carregam o identificador da raiz, o custo até ela e o identificador de quem enviou.

Um desempate entre caminhos de mesmo custo usa o identificador da ponte vizinha e, depois, o número da porta. **Custos menores** representam enlaces mais rápidos, e a escolha do caminho é por **custo acumulado**, e não por número de saltos.

### Papéis e estados das portas

| Papel | Significado |
| --- | --- |
| Raiz | a melhor porta de uma ponte não raiz em direção à raiz |
| Designada | a melhor porta de um enlace para enviar quadros ao segmento |
| Alternativa ou bloqueada | uma porta que poderia ser raiz, mas perdeu; fica de reserva |

\`\`\`mermaid
stateDiagram-v2
  [*] --> Blocking
  Blocking --> Listening: eleita raiz ou designada
  Listening --> Learning: espera o Forward Delay
  Learning --> Forwarding: espera o Forward Delay
  Forwarding --> Blocking: perde o papel
\`\`\`

*Esquema 3 (estados do STP clássico).* Uma porta que passa de bloqueada a ativa não encaminha de imediato: espera, escutando e depois aprendendo, para não criar um laço temporário. Com os temporizadores padrão (Hello de 2 s, Max Age de 20 s e Forward Delay de 15 s), a convergência do STP leva de **30 a 50 s**.

### RSTP: a convergência rápida

O RSTP troca a espera por um **acordo entre vizinhos**: uma porta designada propõe tornar-se ativa, a ponte vizinha **sincroniza** (bloqueia temporariamente as portas que poderiam formar laço) e responde com um acordo, e a porta passa a encaminhar em instantes.

\`\`\`mermaid
sequenceDiagram
  participant A as Ponte A, porta designada
  participant B as Ponte B
  A->>B: BPDU com proposta
  Note over B: sincroniza: bloqueia suas portas não de borda
  B->>A: BPDU com acordo
  Note over A: a porta passa a encaminhar
\`\`\`

*Esquema 4 (proposta e acordo no RSTP).* O RSTP também reduz os estados para três (descarte, aprendizado e encaminhamento) e detecta a falha de um vizinho em poucos períodos de Hello, e não pelo Max Age.

### MSTP: uma árvore por grupo de VLANs

No MSTP, as VLANs são agrupadas em **instâncias**, e cada instância tem a sua árvore, com a sua raiz. Assim, VLANs diferentes usam enlaces diferentes, e os enlaces bloqueados em uma árvore ficam em uso em outra. Os fabricantes oferecem ainda versões por VLAN (como o PVST+ e o Rapid PVST+), que não são tratadas aqui.

### As proteções

O spanning tree é baseado em confiança: o switch aceita BPDUs de qualquer porta. Um equipamento ligado por engano, ou de má fé, pode se declarar raiz e **desviar** o tráfego da rede. As proteções comuns (nomes de fabricantes) são:

| Proteção | O que faz |
| --- | --- |
| BPDU guard | desativa a porta de borda que recebe um BPDU |
| Root guard | impede que a porta aceite uma raiz melhor que a atual |
| Loop guard | evita que uma porta passe a encaminhar quando deixa de receber BPDUs |

### Como ler o diagrama do simulador

- **Topologia:** três switches em **triângulo** (e uma quarta ponte no modo de proteções). Os enlaces bloqueados aparecem diferentes dos ativos.
- **Aba Portas:** o papel e o estado de cada porta, no instante atual.
- **Aba Instâncias:** no MSTP, a que instância pertence cada VLAN e quem é a raiz de cada uma.
- **Modos:** *STP clássico*, *RSTP*, *MSTP*, *Laço e tempestade* (sem spanning tree) e *Proteções*.

### Limites do modelo e do diagrama

- A eleição é simulada por **rodadas de BPDUs**, sem os temporizadores de Hello nem o envelhecimento da informação (Max Age). Na falha da raiz, o simulador refaz a eleição entre as pontes que sobraram.
- Usa a tabela longa de custos e uma só instância de STP. No RSTP, os papéis de backup e as portas de borda não aparecem, e o MSTP mostra a sincronização só do CIST.
- Os temporizadores citados são os padrões do protocolo, e os tempos de trânsito são didáticos.
- Não são citadas cláusulas do IEEE 802.1Q, por falta de um texto aberto para conferência: confira o texto oficial do IEEE antes de citar uma.
`;
