// Fundamentação do simulador de STP, RSTP e MSTP, em Markdown: aparece na documentação (docs/simuladores/stp.md e na wiki),
// antes de "Como ler os diagramas". Explica o laço, a eleição da raiz, os papéis e estados das portas e as variantes.
export const fundamentacao: string = `
### O problema que o spanning tree resolve

Enlaces redundantes dão resiliência a uma rede local, mas formam **laços**. O quadro Ethernet **não tem TTL**: um broadcast preso em um laço circula para sempre, se multiplica a cada switch e satura a rede (uma **tempestade de broadcast**), e as tabelas MAC perdem a estabilidade, porque o mesmo MAC é "visto" em portas diferentes.

O *spanning tree* escolhe, entre os switches, uma **árvore sem laços** e deixa em bloqueio as portas que formariam um laço. Se um enlace da árvore falha, uma porta bloqueada é reaberta. São três versões: o **STP** (IEEE 802.1D), o **RSTP** (IEEE 802.1w, convergência rápida) e o **MSTP** (IEEE 802.1s, uma árvore por grupo de VLANs). Os três foram incorporados ao IEEE 802.1Q.

**O que você aprende com este simulador.**

- Explicar por que um laço de camada 2 causa tempestade de broadcast e como o spanning tree o evita.
- Acompanhar a eleição da raiz e a escolha dos papéis das portas (raiz, designada e bloqueada).
- Ler o BPDU campo a campo e saber quais campos decidem a eleição.
- Comparar o STP, o RSTP (proposta e acordo) e o MSTP (uma árvore por instância).
- Reconhecer a falta de autenticação do protocolo e as proteções (BPDU guard, Root guard).

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

### O BPDU

Os switches trocam **BPDUs** (*Bridge Protocol Data Units*) para eleger a raiz e manter a árvore. O desenho mostra o BPDU de configuração (STP) e o RSTP, em linhas de 32 bits, na ordem de transmissão (IEEE 802.1D e 802.1w, hoje no IEEE 802.1Q).

\`\`\`mermaid
packet-beta
  0-15: "Protocol ID (0)"
  16-23: "Versão"
  24-31: "Tipo do BPDU"
  32: "TC Ack"
  33: "Agreement"
  34: "Forwarding"
  35: "Learning"
  36-37: "Papel"
  38: "Proposal"
  39: "TC"
  40-103: "ID da raiz (prioridade e MAC)"
  104-135: "Custo até a raiz"
  136-199: "ID da ponte que enviou"
  200-215: "ID da porta"
  216-231: "Message Age"
  232-247: "Max Age"
  248-263: "Hello Time"
  264-279: "Forward Delay"
\`\`\`

*Esquema 3 (o BPDU de configuração).* O BPDU tem 35 bytes (36 no RSTP, com mais um byte de tamanho da informação de versão 1) e vai dentro de um quadro **802.3 com LLC** (DSAP e SSAP 0x42), para o endereço de grupo 01:80:C2:00:00:00, que as pontes não encaminham. O byte de flags tem oito bits: no STP clássico só o TC e o TC Ack são usados, e o RSTP usa os demais (proposta, papel da porta, aprendizado, encaminhamento e acordo). A tabela abaixo descreve os campos.

| Campo | Tamanho | Função |
| --- | --- | --- |
| Protocol ID | 2 bytes | zero, para o protocolo de spanning tree |
| Versão | 1 byte | 0 para o STP, 2 para o RSTP e 3 para o MSTP |
| Tipo do BPDU | 1 byte | 0x00 configuração, 0x80 mudança de topologia (TCN) e 0x02 RSTP e MSTP |
| Flags | 1 byte | mudança de topologia (TC) e sua confirmação; no RSTP, proposta, papel, aprendizado, encaminhamento e acordo |
| ID da raiz | 8 bytes | quem esta ponte acha que é a raiz: prioridade e MAC |
| Custo até a raiz | 4 bytes | custo acumulado do caminho até a raiz |
| ID da ponte | 8 bytes | quem enviou o BPDU |
| ID da porta | 2 bytes | a porta de saída, com a prioridade |
| Message Age, Max Age, Hello Time, Forward Delay | 2 bytes cada | idade da informação e os temporizadores, em unidades de 1/256 de segundo |

A eleição compara, **em ordem**, o ID da raiz, o custo até a raiz, o ID da ponte e o ID da porta: o menor vence em cada comparação. É por isso que o BPDU carrega exatamente esses campos.

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

*Esquema 4 (estados do STP clássico).* Uma porta que passa de bloqueada a ativa não encaminha de imediato: espera, escutando e depois aprendendo, para não criar um laço temporário. Com os temporizadores padrão (Hello de 2 s, Max Age de 20 s e Forward Delay de 15 s), a convergência do STP leva de **30 a 50 s**.

### RSTP: a convergência rápida

O RSTP troca a espera por um **acordo entre vizinhos**: uma porta designada propõe tornar-se ativa, a ponte vizinha **sincroniza** (bloqueia temporariamente as portas que poderiam formar laço) e responde com um acordo, e a porta passa a encaminhar em instantes.

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as Ponte A, porta designada
  participant B as Ponte B
  A->>B: BPDU com proposta
  Note over B: sincroniza: bloqueia suas portas não de borda
  B->>A: BPDU com acordo
  Note over A: a porta passa a encaminhar
\`\`\`

*Esquema 5 (proposta e acordo no RSTP).* O RSTP também reduz os estados para três (descarte, aprendizado e encaminhamento) e detecta a falha de um vizinho em poucos períodos de Hello, e não pelo Max Age.

### MSTP: uma árvore por grupo de VLANs

No MSTP, as VLANs são agrupadas em **instâncias**, e cada instância tem a sua árvore, com a sua raiz. Assim, VLANs diferentes usam enlaces diferentes, e os enlaces bloqueados em uma árvore ficam em uso em outra. Os fabricantes oferecem ainda versões por VLAN (como o PVST+ e o Rapid PVST+), que não são tratadas aqui.

### As proteções

O spanning tree é baseado em confiança: o switch aceita BPDUs de qualquer porta. Um equipamento ligado por engano, ou de má fé, pode se declarar raiz e **desviar** o tráfego da rede. As proteções comuns (nomes de fabricantes) são:

| Proteção | O que faz |
| --- | --- |
| BPDU guard | desativa a porta de borda que recebe um BPDU |
| Root guard | impede que a porta aceite uma raiz melhor que a atual |
| Loop guard | evita que uma porta passe a encaminhar quando deixa de receber BPDUs |

### O que cada modo e aba do simulador mostram

- **Topologia:** três switches em **triângulo** (e uma quarta ponte no modo de proteções). Os enlaces bloqueados aparecem diferentes dos ativos.
- **Diagrama de sequência:** cada seta é um BPDU, com o ID da raiz e o custo que ele carrega.
- **Aba Portas:** o papel e o estado de cada porta, no instante atual.
- **Aba Instâncias:** no MSTP, a que instância pertence cada VLAN e quem é a raiz de cada uma.
- **Modos:** *STP clássico*, *RSTP*, *MSTP*, *Laço e tempestade* (sem spanning tree) e *Proteções*.

Para a eleição, use "Eleição pelo menor MAC", "Raiz escolhida pela prioridade" e "Custo do enlace decide a porta raiz". Para a reconvergência, use "Falha do enlace da porta raiz", "Falha da ponte raiz" e, no RSTP, "Proposta e acordo" e "Falha de enlace: a alternativa assume". Para o MSTP, use "Duas instâncias: balanceamento por VLAN". Para o laço, use "Sem STP: tempestade de broadcast" e "Com STP: o laço é cortado". Para as proteções, use "Intruso sem proteção vira a raiz", "BPDU Guard isola o intruso" e "Root Guard ignora a BPDU superior".

### Limites do modelo e do diagrama

- A eleição é simulada por **rodadas de BPDUs**, sem os temporizadores de Hello nem o envelhecimento da informação (Max Age). Na falha da raiz, o simulador refaz a eleição entre as pontes que sobraram.
- Usa a tabela longa de custos e uma só instância de STP. No RSTP, os papéis de backup e as portas de borda não aparecem, e o MSTP mostra a sincronização só do CIST.
- Os temporizadores citados são os padrões do protocolo, e os tempos de trânsito são didáticos.
- Não são citadas cláusulas do IEEE 802.1Q, por falta de um texto aberto para conferência: confira o texto oficial do IEEE antes de citar uma.
`;
