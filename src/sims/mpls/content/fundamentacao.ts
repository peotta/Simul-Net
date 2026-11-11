// Fundamentação do simulador MPLS, em Markdown: aparece na documentação (docs/simuladores/mpls.md e na wiki), antes de
// "Como ler os diagramas". Explica o encaminhamento por rótulo, o LDP, o PHP, o TTL e a L3VPN.
export const fundamentacao: string = `
### O problema que o MPLS resolve

No encaminhamento IP comum, **cada roteador** examina o endereço de destino e procura o prefixo mais específico na tabela de rotas, a cada salto. O MPLS (*Multiprotocol Label Switching*, RFC 3031) muda a divisão do trabalho: o roteador de **entrada** classifica o pacote **uma só vez** e cola nele um **rótulo** curto. No núcleo, cada roteador encaminha olhando **só o rótulo**, em uma tabela simples de troca, sem examinar o cabeçalho IP.

Hoje o ganho não é a velocidade da consulta, e sim a **flexibilidade**: o MPLS permite engenharia de tráfego, recuperação rápida de falhas e, principalmente, **VPNs de camada 3** sobre uma infraestrutura compartilhada, porque o núcleo não precisa conhecer as rotas dos clientes.

**O que você aprende com este simulador.**

- Explicar a diferença entre o encaminhamento IP salto a salto e o encaminhamento por rótulo.
- Ler a entrada da pilha de rótulos (rótulo, TC, S e TTL) e onde ela fica no quadro.
- Acompanhar o LDP, a LIB e a LFIB e as operações push, swap e pop.
- Entender o PHP, o Explicit NULL e os modelos de TTL Uniform e Pipe no traceroute.
- Explicar a L3VPN, com a VRF, o RD, o RT, o MP-BGP e os dois rótulos.

### O diagrama do caminho rotulado

\`\`\`mermaid
flowchart LR
  H1["Host 1"] -- "pacote IP" --> PE1["PE1<br/>push do rótulo 100"]
  PE1 -- "rótulo 100" --> P1["P1<br/>swap 100 para 200"]
  P1 -- "rótulo 200" --> P2["P2<br/>pop (PHP)"]
  P2 -- "pacote IP" --> PE2["PE2<br/>consulta IP"]
  PE2 -- "pacote IP" --> H2["Host 2"]
\`\`\`

*Esquema 1 (um LSP de PE1 a PE2).* O caminho percorrido por uma classe de pacotes é o **LSP** (*Label Switched Path*), que é **unidirecional**: a ida e a volta usam LSPs e rótulos diferentes. O roteador de borda é o **PE** (*Provider Edge*, também chamado LER), e o de núcleo é o **P** (*Provider*, também chamado LSR). Os rótulos têm **significado local**: cada roteador escolhe os seus, e o mesmo número pode significar coisas diferentes em roteadores diferentes.

As operações são três: **push** (impor um rótulo, na entrada), **swap** (trocar o rótulo do topo, no núcleo) e **pop** (remover o rótulo do topo, na saída). A RFC 3032 (seção 2.1) as descreve como ações sobre o rótulo do topo da pilha.

### O cabeçalho de rótulo

O rótulo fica **entre** o cabeçalho de enlace e o cabeçalho IP (RFC 3032, seção 2.1). O desenho mostra um quadro Ethernet com uma entrada de rótulo, em linhas de 32 bits, na ordem de transmissão.

\`\`\`mermaid
packet-beta
  0-47: "MAC de destino"
  48-95: "MAC de origem"
  96-111: "Tipo (0x8847)"
  112-131: "Rótulo"
  132-134: "TC"
  135: "S"
  136-143: "TTL"
  144-175: "Pacote IP (cabeçalho e dados)"
\`\`\`

*Esquema 2 (uma entrada de rótulo em um quadro Ethernet).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O Tipo 0x8847 indica unicast MPLS (0x8848, multicast), e o pacote IP aparece condensado no desenho. Cada entrada da pilha tem 32 bits, e o pacote pode levar **várias** entradas, uma depois da outra: o bit S vale 1 só na última.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| MAC de destino | 0 a 47 | 6 bytes | endereço do próximo equipamento no enlace |
| MAC de origem | 48 a 95 | 6 bytes | endereço de quem envia o quadro |
| Tipo | 96 a 111 | 2 bytes | 0x8847 para MPLS unicast (0x8848 para multicast) |
| Rótulo | 112 a 131 | 20 bits | identifica a classe de encaminhamento (FEC) e é o índice da tabela de rótulos |
| TC | 132 a 134 | 3 bits | classe de tráfego, usada para QoS (era chamado EXP na RFC 3032) |
| S | 135 | 1 bit | vale 1 na última entrada da pilha de rótulos |
| TTL | 136 a 143 | 8 bits | decrementado a cada roteador, como no IP |
| Pacote IP | 144 a 175 (condensado) | variável | o cabeçalho e os dados do pacote transportado |

Alguns valores são reservados (RFC 3032): 0 é o *IPv4 Explicit NULL*, 1 é o *Router Alert*, 2 é o *IPv6 Explicit NULL* e 3 é o *Implicit NULL*, que é anunciado mas nunca aparece no pacote. Os rótulos livres começam em 16.

### O plano de controle: como os rótulos são distribuídos

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as LSR vizinho A
  participant B as LSR vizinho B
  A->>B: Hello (UDP 646, multicast do enlace)
  B->>A: Hello
  A->>B: sessão TCP 646
  A->>B: Initialization
  B->>A: Initialization e KeepAlive
  A->>B: KeepAlive
  Note over A,B: sessão LDP operacional
  B->>A: Label Mapping: FEC 10.0.0.0/24, rótulo 200
\`\`\`

*Esquema 3 (descoberta, sessão e mapeamento de rótulos).* O LDP (*Label Distribution Protocol*, RFC 5036) começa com **Hello** por UDP (descoberta básica, seção 2.4.1), abre uma **sessão TCP** (seção 2.5) e então os vizinhos trocam **Label Mapping**: cada mensagem associa uma FEC a um rótulo (seção 3.5.7).

- A **FEC** (*Forwarding Equivalence Class*) é o conjunto de pacotes tratados do mesmo modo, por exemplo todos os destinos de um prefixo.
- O modo típico é o **Downstream Unsolicited** (o vizinho anuncia sem esperar pedido) com **controle independente** e **retenção liberal** (RFC 5036, seção 2.6).
- Com a retenção liberal, a **LIB** guarda os rótulos de **todos** os vizinhos, e a **LFIB** usa só o do próximo salto escolhido pelo IGP. Se o IGP mudar de caminho, o rótulo novo já está na LIB, e a convergência é rápida.

### O plano de dados: push, swap e pop

\`\`\`mermaid
flowchart TD
  I["Pacote chega com rótulo"] --> L["Consulta a LFIB pelo rótulo de entrada"]
  L --> Q{"Ação da entrada"}
  Q -- "swap" --> S["Troca o rótulo do topo<br/>e envia ao próximo salto"]
  Q -- "pop" --> PO["Remove o rótulo do topo<br/>e envia ao próximo salto"]
  Q -- "sem entrada" --> D["Descarta"]
\`\`\`

*Esquema 4 (decisão de um LSR).* A consulta é só pelo rótulo de entrada, e o resultado diz a ação e o próximo salto. Na entrada da rede, o PE faz o oposto: consulta o **IP** e faz o **push**.

### PHP: quem remove o último rótulo

Com o **PHP** (*Penultimate Hop Popping*, RFC 3031, seção 3.16), o roteador de saída anuncia o rótulo **3** (*Implicit NULL*) e o **penúltimo** LSR remove o rótulo. Assim, o roteador de saída faz uma única consulta (IP), em vez de duas (rótulo e IP). Com o **Explicit NULL** (rótulo 0), o rótulo chega ao egresso, o que preserva o campo TC para QoS.

### O TTL e o traceroute

| Modelo | O que acontece | O que o traceroute mostra |
| --- | --- | --- |
| Uniform | o TTL do IP é copiado para o rótulo na entrada e de volta na saída (RFC 3443) | todos os roteadores do núcleo |
| Pipe | o rótulo começa com um TTL fixo, e o núcleo fica invisível | só os roteadores de borda |

A cada roteador, o TTL do rótulo é decrementado (RFC 3032, seção 2.4). Quando o TTL expira dentro do LSP, o LSR gera o ICMP *Time Exceeded* e o envia adiante **pelo próprio LSP**, até o egresso, que o devolve à origem. Por isso todos os saltos do núcleo costumam mostrar um RTT parecido.

### L3VPN: dois rótulos

\`\`\`mermaid
flowchart LR
  CE1["CE do cliente A<br/>site 1"] --> PE1["PE1<br/>VRF do cliente A"]
  PE1 -- "pilha: rótulo de transporte<br/>(topo) e rótulo de VPN" --> P["P<br/>só olha o rótulo de transporte"]
  P --> PE2["PE2<br/>VRF do cliente A"]
  PE2 --> CE2["CE do cliente A<br/>site 2"]
  PE1 -. "MP-BGP: rotas VPNv4 com RD, RT e rótulo de VPN" .-> PE2
\`\`\`

*Esquema 5 (VPN de camada 3, RFC 4364).* Cada PE mantém uma tabela de roteamento por cliente, a **VRF** (seção 3). O **RD** (*Route Distinguisher*, seção 4.1) torna únicos prefixos iguais de clientes diferentes, e o **RT** (*Route Target*, seção 4.3.1) decide em quais VRFs a rota entra. Os PEs trocam as rotas dos clientes por **MP-BGP**. O pacote leva **dois rótulos**: o de **transporte** (externo), que leva o pacote de um PE ao outro, e o de **VPN** (interno), que o egresso usa para escolher a VRF e o destino do cliente (seções 4.3.2 e 5).

Como os roteadores P olham só o rótulo de transporte, eles **não precisam conhecer as rotas dos clientes**: é essa a propriedade que torna a VPN escalável.

### O que cada modo e aba do simulador mostram

- **Topologia:** um núcleo MPLS com **2 PE e 4 P** e um host atrás de cada PE. A legenda de cores distingue pacote de dados ou Hello, sessão LDP ou Echo Reply, Label Mapping, MP-BGP e ICMP de erro ou falha.
- **Diagrama de sequência:** cada seta é um pacote com o rótulo (ou a pilha de rótulos) que ele leva naquele trecho.
- **Aba LIB / LFIB:** as tabelas do roteador escolhido, no instante atual: rótulo de entrada, ação e rótulo de saída.
- **Aba Terminal:** a saída dos comandos de consulta ao MPLS, como o usuário a veria.
- **Modos:** *LDP e LSP* (Hello, sessão, mapeamento e tabelas), *Plano de dados* (ping com push, swap e pop, e L3VPN), *TTL e traceroute* (modelos Uniform e Pipe) e *Falha de enlace* (a recuperação pelo rótulo já guardado na LIB).

Para o plano de controle, use "Montagem do LSP". Para as operações, use "Push, swap e pop" e, para o que acontece sem o LDP, "Ping antes do LDP". Para o rótulo do egresso, use "explicit-null" e "Sem PHP". Para o TTL, use "TTL Uniform" e "TTL Pipe". Para a VPN, use "L3VPN: MP-BGP e rótulos VPN", "L3VPN: pilha de dois rótulos" e "L3VPN sem LDP: o PE descarta". Para a recuperação, use "Falha de enlace".

### Limites do modelo e do diagrama

- O simulador cobre o **LDP** e a **L3VPN**. Não há RSVP-TE, segment routing, multicast, pseudowires nem MPLS-TP.
- Cada LSR usa uma **faixa própria de rótulos** (por exemplo, 100 em diante no PE1 e 200 em diante no P1) só para facilitar a leitura. Nos equipamentos reais, os valores são livres.
- No plano de controle, as mensagens aparecem uma por vizinho e sentido, com atraso uniforme, para o diagrama ficar legível.
- O atraso de cada enlace é fixo, e só a falha de enlace é simulável.
`;
