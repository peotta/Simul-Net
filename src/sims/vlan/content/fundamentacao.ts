// Fundamentação do simulador de VLAN, em Markdown: aparece na documentação (docs/simuladores/vlan.md e na wiki), antes de
// "Como ler os diagramas". Explica a segmentação lógica, a tag 802.1Q, o tronco e os riscos de configuração.
export const fundamentacao: string = `
### O problema que a VLAN resolve

Em uma rede local sem divisão, todos os dispositivos formam **um só domínio de broadcast**: um broadcast de qualquer host chega a todos. Separar departamentos exigiria switches e cabos separados. Uma **VLAN** (*Virtual LAN*) divide uma rede física em **redes lógicas independentes**: cada VLAN é um domínio de broadcast próprio, com a sua sub-rede IP, e pode se espalhar por vários switches. O padrão é o IEEE 802.1Q, que define a tag de VLAN e o comportamento das portas.

Dispositivos de VLANs diferentes só se comunicam **por um roteador** (ou por um switch de camada 3), o que permite aplicar regras de segurança entre eles.

**O que você aprende com este simulador.**

- Explicar como a VLAN divide uma rede física em domínios de broadcast independentes.
- Ler a tag 802.1Q campo a campo e saber onde ela fica no quadro.
- Distinguir portas de acesso e de tronco e o papel da VLAN nativa.
- Acompanhar o roteamento entre VLANs com um roteador em um único cabo.
- Reconhecer o VLAN hopping e as defesas de configuração.

### A tag 802.1Q no quadro

A tag é inserida entre o MAC de origem e o campo Tipo. O desenho mostra o quadro com tag, em linhas de 32 bits, na ordem de transmissão (IEEE 802.1Q).

\`\`\`mermaid
packet-beta
  0-47: "MAC de destino"
  48-95: "MAC de origem"
  96-111: "TPID (0x8100)"
  112-114: "PCP"
  115: "DEI"
  116-127: "VID (VLAN)"
  128-143: "Tipo (EtherType)"
  144-175: "Dados (46 a 1500 bytes)"
  176-207: "FCS"
\`\`\`

*Esquema 1 (o quadro com a tag 802.1Q).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O quadro sem tag tem Destino, Origem, Tipo e Dados. A tag soma **4 bytes** (TPID e TCI) e ocupa o lugar logo depois do MAC de origem, e o Tipo original segue depois dela. O campo de dados é condensado no desenho. O quadro com tag pode chegar a 1522 bytes, e o FCS é recalculado quando a tag é inserida ou removida.

| Campo da tag | Posição (bits) | Tamanho | Função |
| --- | --- | --- | --- |
| TPID | 96 a 111 | 16 bits | vale 0x8100 e identifica o quadro como marcado (ocupa o lugar do Tipo) |
| PCP | 112 a 114 | 3 bits | prioridade do quadro (classe de serviço) |
| DEI | 115 | 1 bit | elegibilidade para descarte em caso de congestionamento |
| VID | 116 a 127 | 12 bits | identificador da VLAN: 1 a 4094 em uso; 0 indica só prioridade, e 4095 é reservado |

Os três últimos campos formam o **TCI** (*Tag Control Information*), de 16 bits.

### Portas de acesso e portas de tronco

\`\`\`mermaid
flowchart LR
  H1["Host da VLAN 10"] -- "sem tag" --> SW1["Switch 1<br/>porta de acesso, VLAN 10"]
  SW1 == "tronco: quadros com tag" ==> SW2["Switch 2"]
  SW2 -- "sem tag" --> H2["Host da VLAN 10"]
  SW2 == "tronco: quadros com tag" ==> R["Roteador"]
\`\`\`

*Esquema 2 (acesso e tronco).* Uma **porta de acesso** pertence a uma só VLAN: o quadro chega e sai **sem tag**, e o switch "carimba" a VLAN da porta internamente. Uma **porta de tronco** (*trunk*) leva **várias VLANs** no mesmo cabo, e cada quadro viaja **com a tag** que diz a que VLAN pertence.

| Porta | Quadro que chega | Quadro que sai |
| --- | --- | --- |
| Acesso | sem tag, entra na VLAN da porta | sempre sem tag, e só da VLAN da porta |
| Tronco | com tag, aceito se a VLAN for permitida no tronco | com tag, só das VLANs permitidas |

### A VLAN nativa

No tronco, a **VLAN nativa** é a única cujos quadros viajam **sem tag**. Ela existe para compatibilidade com dispositivos que não entendem a tag. Os dois lados do tronco precisam concordar sobre qual é a VLAN nativa: se discordam, os quadros caem na VLAN errada, e o problema aparece como vazamento entre VLANs ou falta de comunicação.

### Roteamento entre VLANs

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as Host da VLAN 10
  participant SW as Switch
  participant R as Roteador, tronco
  participant B as Host da VLAN 20
  A->>SW: quadro para o gateway da VLAN 10
  SW->>R: quadro com tag 10, pelo tronco
  Note over R: remove a tag 10, consulta a tabela IP, decide a saída pela VLAN 20
  R->>SW: quadro com tag 20, pelo mesmo tronco
  SW->>B: quadro sem tag, porta da VLAN 20
\`\`\`

*Esquema 3 (um roteador em um único cabo).* Com uma interface de tronco dividida em subinterfaces, uma por VLAN, o roteador faz o encaminhamento IP entre as VLANs. Cada VLAN tem **um gateway** próprio, que é o endereço da subinterface correspondente. É aqui que se aplicam as listas de controle de acesso entre departamentos.

### VLAN hopping: o risco de uma configuração fraca

A VLAN é uma separação **lógica**, e a segurança dela depende da configuração dos switches. O *VLAN hopping* é o termo para um dispositivo conseguir enviar tráfego a uma VLAN que não é a dele. Há duas causas conhecidas, e o simulador as mostra no nível defensivo, com o efeito e a defesa:

| Causa | Como acontece | Defesa |
| --- | --- | --- |
| Negociação automática de tronco | uma porta de acesso aceita negociar e vira tronco, e recebe todas as VLANs | desativar a negociação e fixar o modo da porta como acesso |
| Tag dupla e VLAN nativa | o quadro leva duas tags, e a externa coincide com a VLAN nativa do tronco, então é removida e a interna vale na saída | usar uma VLAN nativa que **não tenha hosts**, e que não seja a das portas de usuário |

Outras boas práticas: limitar as VLANs permitidas em cada tronco, desativar as portas não usadas e não usar a VLAN 1 para dados.

### O que cada modo e aba do simulador mostram

- **Topologia:** dois switches ligados por um **tronco**, hosts nas VLANs 10 e 20 e um roteador. A legenda de cores mostra quadro sem tag, quadro com tag 802.1Q e quadro descartado ou ação indevida.
- **Diagrama de sequência:** cada seta é um quadro, e o tronco mostra quando ele leva a tag e quando não leva.
- **Aba Portas:** o modo de cada porta (acesso ou tronco), a VLAN e as VLANs permitidas.
- **Aba Roteador:** a tabela do roteador, com uma rede por VLAN.
- **Modos:** *Marcação 802.1Q*, *Segmentação*, *Roteamento entre VLANs*, *VLAN nativa* e *VLAN hopping*.

Para a tag, use "O frame ganha a tag no tronco", "A VLAN nativa não leva tag" e "VLAN fora da lista do tronco". Para o isolamento, use "Mesma VLAN em dois switches", "O broadcast fica na VLAN" e "Entre VLANs não há caminho". Para o roteamento, use "A para B pelo roteador" e, para as falhas, "Falta a subinterface da VLAN 20" e "Tronco do R1 sem a VLAN 20". Para a VLAN nativa, use "Mesma nativa nas duas pontas" e "Divergência: o frame muda de VLAN". Para o risco e a defesa, use "Porta dinâmica aceita virar tronco", "Defesa: porta fixa em acesso", "Nativa igual à VLAN do invasor" e "Defesa: nativa em VLAN sem uso".

### Limites do modelo e do diagrama

- A topologia é uma **árvore**: não há laços, e o comportamento com o spanning tree está no simulador de STP.
- Não há tabela MAC dinâmica nem envelhecimento, GVRP ou MVRP, VLANs privadas, QinQ completo (TPID 0x88A8) nem VTP e DTP (protocolos proprietários).
- Há um só roteador, com o tronco no switch 1. As sub-redes são 192.168.10.0/24 e 192.168.20.0/24 (RFC 1918), e os MACs são de documentação (RFC 9542).
- Não são citadas cláusulas do IEEE 802.1Q, por falta de um texto aberto para conferência: confira o texto oficial do IEEE antes de citar uma.
`;
