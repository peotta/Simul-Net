// Fundamentação do simulador de firewall, em Markdown: aparece na documentação (docs/simuladores/firewall.md e na wiki),
// antes de "Como ler os diagramas". Explica o filtro sem estado, o filtro com estado, a DMZ e as defesas, no nível defensivo.
export const fundamentacao: string = `
### O problema que o firewall resolve

Uma rede conectada a outra (por exemplo, a internet) fica exposta a tudo o que a outra rede enviar. Um **firewall** é um **ponto de controle** entre redes: ele decide, segundo uma **política**, quais pacotes passam. A RFC 2979 descreve o comportamento esperado de firewalls na internet, e o NIST SP 800-41 Rev. 1 traz orientações sobre os tipos de firewall e a escrita da política. O simulador trata do firewall de rede, que decide pelas **camadas 3 e 4**: endereços, protocolo, portas e estado.

**O que você aprende com este simulador.**

- Explicar o papel do firewall como ponto de controle entre zonas e a política de negação implícita.
- Saber que campos do pacote o filtro lê (a tupla de cinco campos e as flags do TCP).
- Ler uma lista de regras, prever qual regra decide e por que a ordem importa.
- Comparar o filtro sem estado com o filtro com estado e a tabela de conexões.
- Interpretar o perímetro com DMZ e as defesas de borda (origem forjada, varredura, rajada), no nível defensivo.

### O diagrama das zonas

\`\`\`mermaid
flowchart LR
  INT["Internet<br/>zona não confiável"] --> FW{"Firewall<br/>política entre zonas"}
  FW --> DMZ["DMZ<br/>servidores públicos: web, e-mail"]
  FW --> LAN["Rede interna<br/>zona confiável"]
  DMZ -. "bloqueado: a DMZ não inicia<br/>conexões para a rede interna" .-> LAN
\`\`\`

*Esquema 1 (zonas e fluxos).* O firewall separa **zonas** de confiança diferentes e aplica uma política a cada fluxo entre elas. A **DMZ** abriga os servidores que precisam ser acessados de fora, e **se um deles for comprometido**, o atacante ainda precisa passar pelo firewall para alcançar a rede interna.

### O que o firewall lê e como a regra é escrita

O firewall de rede decide pelos campos dos cabeçalhos das camadas 3 e 4. O desenho mostra, em ordem, apenas os campos que a regra usa; os demais campos do pacote não entram na decisão.

\`\`\`mermaid
packet-beta
  0-7: "Protocolo (IP)"
  8-39: "IP de origem"
  40-71: "IP de destino"
  72-87: "Porta de origem"
  88-103: "Porta de destino"
  104-111: "Flags do TCP"
\`\`\`

*Esquema 2 (os campos que o filtro usa).* Este é um desenho **condensado**, e não o formato real dos cabeçalhos: o protocolo e os endereços ficam no cabeçalho IP, e as portas e as flags, no cabeçalho TCP ou UDP (veja os simuladores de IPv4, TCP e UDP). Somando a **interface** por onde o pacote entrou, esses campos formam a **tupla de cinco campos** (protocolo, origem e destino, portas de origem e de destino) que identifica uma conexão. No ICMP, não há portas: valem o tipo e o código.

Uma regra casa quando **todos** os campos que ela cita conferem. Exemplo de lista, com a notação genérica do simulador:

| Ordem | Ação | Origem | Destino | Protocolo | Porta de destino | Para quê |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | permitir | rede interna | qualquer | TCP | 80 e 443 | navegação |
| 2 | permitir | Internet | servidor web da DMZ | TCP | 443 | serviço público |
| 3 | negar | qualquer | qualquer | qualquer | qualquer | política padrão (negação implícita) |

No filtro com estado, a tabela de conexões guarda a mesma tupla e o estado de cada conexão:

| Protocolo | Origem e porta | Destino e porta | Estado | Validade |
| --- | --- | --- | --- | --- |
| TCP | rede interna, 40000 | servidor externo, 443 | conexão estabelecida | renovada a cada pacote e removida por inatividade |

### Filtro sem estado: a lista de regras

- Cada pacote é avaliado **isoladamente**, só pelo cabeçalho: origem, destino, protocolo, portas e, no TCP, os flags.
- As regras são percorridas **de cima para baixo**, e a **primeira que casa decide**. Regras depois dela não são consultadas.
- Se nenhuma regra casa, vale a **política padrão** do fim da lista. **Negar o que não foi permitido** (negação implícita) é a postura mais segura.

\`\`\`mermaid
flowchart TD
  P["Pacote chega"] --> R1{"Regra 1 casa?"}
  R1 -- "sim" --> A1["Aplica: permitir ou negar"]
  R1 -- "não" --> R2{"Regra 2 casa?"}
  R2 -- "sim" --> A2["Aplica"]
  R2 -- "não" --> RN{"... demais regras"}
  RN -- "nenhuma casa" --> DEF["Política padrão:<br/>negar tudo"]
\`\`\`

*Esquema 3 (avaliação da lista).* A **ordem** das regras decide o resultado: uma regra genérica antes de uma específica a "engole". Como o filtro **não lembra dos pacotes anteriores**, o **retorno** de uma conexão precisa de uma regra própria, escrita por porta de origem ou por flag ACK. As duas são **palpites sobre o cabeçalho** que um pacote vindo de fora pode imitar.

### Filtro com estado: a tabela de conexões

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente interno
  participant F as Firewall com estado
  participant S as Servidor externo
  C->>F: SYN
  Note over F: avalia as regras, permite, cria a entrada na tabela
  F->>S: SYN
  S->>F: SYN e ACK
  Note over F: pertence a uma entrada da tabela: aceita
  F->>C: SYN e ACK
  S->>F: pacote sem conexão associada
  Note over F: sem entrada na tabela: descarta
\`\`\`

*Esquema 4 (a tabela de conexões).* O firewall com estado registra cada conexão **permitida**. Só o **primeiro pacote** (o SYN, no TCP) passa pelas regras. Os seguintes são aceitos se pertencem a uma entrada da tabela, **nos dois sentidos**, e um pacote que não pertence a nenhuma conexão é descartado. Isso resolve o problema do retorno **sem** abrir regras amplas, e é a defesa mais forte contra pacotes de resposta forjados.

A tabela é finita e as entradas **expiram** por inatividade. O comportamento do TCP segue a RFC 9293, e o SYN é retransmitido com intervalos crescentes (RFC 6298).

### Defesas de borda (nível defensivo)

| Situação | O que o firewall vê | Defesa |
| --- | --- | --- |
| Origem forjada (por exemplo, um endereço interno chegando de fora) | endereço de origem que não pode existir naquela interface | filtro de ingresso: descartar origens inválidas (BCP 38, RFC 2827) |
| Varredura de portas | muitas tentativas de conexão a portas fechadas | registrar, negar e limitar a taxa |
| Rajada de conexões | muitos SYNs por segundo | limite de taxa por origem e proteção da tabela de conexões |

### O que cada modo e aba do simulador mostram

- **Topologia:** o firewall e as suas **zonas**. A legenda de cores distingue o pacote que chega, o encaminhado, o conteúdo cifrado e o negado ou recusado.
- **Diagrama de sequência:** cada seta é um pacote, e o firewall aparece decidindo por regra ou por entrada da tabela.
- **Aba Regras:** a lista de regras, com a que casou para o pacote atual em destaque.
- **Aba Conexões:** a tabela de conexões do firewall com estado, no instante atual.
- **Modos:** *Filtro sem estado (ACL)*, *Filtro com estado*, *Perímetro com DMZ* e *Forja, varredura e limite de taxa*.

Para a lista de regras, use "Ida e volta permitidas", "Falta a regra de retorno", "Ordem invertida das regras" e "Negação implícita (consulta DNS)". Para os limites do filtro sem estado, use "Retorno por porta de origem: pacote de fora passa" e "Retorno por flag ACK". Para a tabela de conexões, use "Saída permitida, retorno pela tabela", "Pacotes de fora sem conexão registrada", "UDP: resposta dentro da validade" e "Tabela de conexões cheia". Para o perímetro, use "Internet acessa o servidor web da DMZ", "DMZ tenta chegar à rede interna (negado)" e "Regra permissiva de DMZ para a rede interna". Para as defesas, use "Origem interna vinda de fora, com filtro", "Varredura com descarte silencioso" e "Rajada com limite de 3 por segundo".

### Limites do modelo e do diagrama

- **Não há NAT** (os endereços não são traduzidos), fragmentação, IPv6 nem opções de IP. O NAT tem simulador próprio.
- Não há inspeção de aplicação (IPS, WAF, *proxies* e inspeção de TLS), filtragem por URL ou por usuário, desempenho, alta disponibilidade nem sincronização de tabelas.
- A notação das regras é **genérica**, e não a sintaxe de um fabricante. Estados, prazos e comportamentos diante de pacotes inválidos variam entre produtos.
- O SYN é retransmitido **uma** vez, depois de 1 s (RFC 6298, seção 2, regra 2.1). Os sistemas reais continuam tentando com intervalos crescentes.
- Os cenários de forja, varredura e rajada mostram o ponto de vista do **defensor** (o que o firewall vê, decide e registra), sem ensinar a executá-los.
`;
