// Fundamentação do simulador de switching, em Markdown: aparece na documentação (docs/simuladores/switching.md e na wiki),
// antes de "Como ler os diagramas". Explica o switch como ponte multiporta: aprender, decidir e envelhecer.
export const fundamentacao: string = `
### O problema que o switch resolve

Em uma rede local, vários dispositivos precisam trocar quadros Ethernet. Um **hub** repete cada quadro para todas as portas, e todos competem pelo mesmo meio. Um **switch** é uma **ponte multiporta** (*MAC bridge*, IEEE 802.1D, hoje incorporada ao IEEE 802.1Q): ele aprende onde cada dispositivo está e envia o quadro **só pela porta certa**. Ele trabalha na camada 2 e decide **apenas pelo endereço MAC**: não olha o endereço IP.

**O que você aprende com este simulador.**

- Explicar como o switch aprende, decide e envelhece as entradas da tabela de endereços MAC.
- Ler o quadro Ethernet campo a campo e saber quais campos o switch usa (destino e origem).
- Distinguir os domínios de colisão e de broadcast e o tratamento de unicast, broadcast e multicast.
- Entender o IGMP snooping e os endereços reservados que as pontes não encaminham.
- Reconhecer o ponto fraco da tabela finita e como a segurança de porta o reduz.

### O diagrama dos três passos

\`\`\`mermaid
flowchart TD
  Q["Quadro chega pela porta P"] --> A["1. Aprender<br/>associa o MAC de origem à porta P<br/>ou renova o relógio da entrada"]
  A --> D{"2. Decidir<br/>o MAC de destino é conhecido?"}
  D -- "sim, em outra porta" --> F["Encaminha só por essa porta"]
  D -- "sim, na própria porta P" --> X["Filtra: descarta"]
  D -- "não, broadcast ou multicast" --> I["Inunda: todas as portas, menos P"]
  F --> E["3. Envelhecer<br/>entrada sem tráfego expira"]
  X --> E
  I --> E
\`\`\`

*Esquema 1 (aprender, decidir e envelhecer).* O MAC de **origem** alimenta a tabela, e o MAC de **destino** consulta a tabela. Endereços de grupo e de broadcast nunca são aprendidos como origem. O valor recomendado para o envelhecimento é de 300 s, e é configurável.

Por isso o primeiro quadro entre dois hosts que não se conhecem é **inundado**: o switch ainda não sabe onde está o destino. Quando o destino responde, o switch aprende a porta dele, e os quadros seguintes seguem direto.

### O quadro Ethernet

O switch trabalha com quadros Ethernet. O desenho mostra os campos em linhas de 32 bits, na ordem de transmissão (IEEE 802.3; o quadro começa depois do preâmbulo de 7 bytes e do delimitador SFD de 1 byte, que as placas tratam à parte).

\`\`\`mermaid
packet-beta
  0-47: "MAC de destino"
  48-95: "MAC de origem"
  96-111: "Tipo (EtherType)"
  112-143: "Dados (46 a 1500 bytes)"
  144-175: "FCS"
\`\`\`

*Esquema 2 (o quadro Ethernet).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O campo de dados é **condensado** no desenho: ele ocupa de 46 a 1500 bytes. A tabela abaixo descreve todos os campos, em ordem.

| Campo | Tamanho | Observação |
| --- | --- | --- |
| Destino | 6 bytes | o bit menos significativo do primeiro byte indica endereço de grupo (broadcast ou multicast) |
| Origem | 6 bytes | sempre unicast |
| Tipo | 2 bytes | 0x0800 IPv4, 0x0806 ARP, 0x86DD IPv6, 0x88CC LLDP, 0x8100 tag de VLAN |
| Dados | 46 a 1500 bytes | preenchidos até o mínimo de 46 bytes |
| FCS | 4 bytes | verificação do quadro (*Frame Check Sequence*), um CRC de 32 bits |

O menor quadro tem 64 bytes (do destino ao FCS) e o maior, 1518 bytes, ou 1522 com a tag de VLAN. O switch usa o campo **Destino** para decidir e o campo **Origem** para aprender. Os endereços MAC têm 48 bits e o bit seguinte ao de grupo distingue os administrados localmente dos de fabricante.

### A tabela de endereços e os domínios

\`\`\`mermaid
flowchart LR
  subgraph SW["Switch com 4 portas"]
    T["Tabela de endereços<br/>MAC e porta de cada host"]
  end
  A["Host A"] --- P1["Porta 1"] --- SW
  B["Host B"] --- P2["Porta 2"] --- SW
  C["Host C"] --- P3["Porta 3"] --- SW
  D["Host D"] --- P4["Porta 4"] --- SW
\`\`\`

*Esquema 3 (um domínio de colisão por porta, um domínio de broadcast no switch).* Cada porta é um domínio de colisão próprio, mas todas as portas formam **um só domínio de broadcast**. Para dividir o domínio de broadcast, é preciso usar VLANs (veja o simulador de VLAN) ou um roteador.

### Broadcast, multicast e endereços reservados

| Tipo de destino | Como o switch trata |
| --- | --- |
| Unicast conhecido | encaminha pela porta aprendida |
| Unicast desconhecido | inunda por todas as portas, menos a de entrada |
| Broadcast (ff:ff:ff:ff:ff:ff) | inunda por todas as portas, menos a de entrada |
| Multicast sem controle | inunda como broadcast |
| Multicast com IGMP snooping | envia só às portas que pediram o grupo (RFC 4541) |
| Endereços reservados de protocolos de ponte | não são encaminhados por pontes comuns, e o switch os trata localmente |

O multicast IP (RFC 1112) usa o IGMP para os hosts anunciarem os grupos de que participam, e o **IGMP snooping** é a técnica pela qual o switch escuta esses anúncios para não inundar o tráfego de grupo (RFC 4541). A RFC 9776 define o IGMPv3.

### Quando a tabela é um ponto fraco

A tabela de endereços tem **tamanho finito**. Se ela enche, o switch deixa de aprender endereços novos e passa a inundar o tráfego de destinos que não cabem, o que expõe quadros a portas que não deveriam recebê-los. Isso pode acontecer por um erro de projeto ou por um ataque de inundação de MACs.

A defesa é a **segurança de porta** (*port security*): limitar quantos MACs uma porta pode aprender e escolher o que fazer quando o limite é excedido (descartar, descartar e registrar, ou desativar a porta). Os nomes dos modos seguem a terminologia de um fabricante comum, e não de um padrão.

### O que cada modo e aba do simulador mostram

- **Topologia:** um switch com **quatro portas** e os hosts ligados a elas. O destaque mostra o caminho de cada quadro, inclusive a inundação para várias portas.
- **Diagrama de sequência:** cada seta é um quadro, e o switch aparece decidindo entre aprender, encaminhar, filtrar e inundar.
- **Aba Tabela de endereços:** os MACs aprendidos e a porta de cada um, no instante atual.
- **Aba Decisões:** a decisão do switch para cada quadro (aprender, encaminhar, filtrar ou inundar) e o motivo.
- **Modos:** *Aprendizado e encaminhamento* (os três passos), *Inundação de MAC e segurança de porta* (tabela cheia e defesa) e *Broadcast, multicast e reservados*.

Para os três passos, use "Primeiro frame: inundação e aprendizado", "Destinos já conhecidos" e "Origem e destino na mesma porta". Para as mudanças na tabela, use "Host que muda de porta" e "Envelhecimento da entrada". Para o ponto fraco da tabela, use "Tabela cheia: A e B ficam expostos" e, para as defesas, "Segurança de porta: protect", "restrict" e "shutdown". Para os tipos de destino, use "Broadcast é inundado", "Multicast sem snooping", "Multicast com IGMP snooping" e "BPDU e LLDP não são encaminhados".

### Limites do modelo e do diagrama

- É **um só switch**, sem VLANs, sem spanning tree e sem agregação de enlaces. Os endereços MAC e IP são de documentação (RFC 9542 e RFC 5737).
- A tabela do modo de inundação tem 4 ou 6 entradas, e a de um switch real guarda de milhares a centenas de milhares. Quando a tabela enche, equipamentos reais variam: alguns removem entradas antigas, outros descartam o quadro.
- Não há colisões, modos de encaminhamento (*store-and-forward* e *cut-through*), velocidade de porta nem negociação automática. Os tempos de trânsito são didáticos.
- Não são citadas cláusulas do IEEE 802.1D e do 802.1Q, por falta de um texto aberto para conferência: confira o texto oficial do IEEE antes de citar uma.
`;
