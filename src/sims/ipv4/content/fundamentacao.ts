// Fundamentação do simulador IPv4, em Markdown: aparece na documentação (docs/simuladores/ipv4.md e na wiki), antes de
// "Como ler os diagramas". Explica o que o IP resolve, as duas decisões (host e roteador) e como o simulador as mostra.
export const fundamentacao: string = `
### O problema que o IPv4 resolve

Uma internet é um conjunto de redes diferentes ligadas por roteadores. O IPv4 (*Internet Protocol* versão 4, RFC 791) dá a cada interface um **endereço lógico de 32 bits** e define como um **datagrama** viaja de uma origem a um destino atravessando várias redes. Ele está na camada 3 do modelo OSI (camada Internet do TCP/IP).

O serviço é de **melhor esforço**: o IP não garante entrega, ordem nem ausência de duplicatas. Cada roteador decide sozinho, olhando só o endereço de destino e a própria tabela de rotas. Confiabilidade e ordem ficam para as camadas de cima (por exemplo, o TCP).

**O que você aprende com este simulador.**

- Calcular a rede, o broadcast e os hosts de um endereço a partir da máscara, e distinguir endereços públicos, privados e especiais.
- Entender o CIDR e o VLSM, que substituíram as classes de endereço.
- Ler o cabeçalho IPv4 campo a campo.
- Prever as duas decisões do caminho: a do **host** (entrega direta ou gateway) e a do **roteador** (prefixo mais específico, TTL e erros ICMP).


### O diagrama da viagem de um datagrama

\`\`\`mermaid
flowchart LR
  A["PC-A"] -- "quadro 1<br/>MAC: PC-A para R1" --> R1["Roteador R1<br/>TTL 64 para 63"]
  R1 -- "quadro 2<br/>MAC: R1 para R2" --> R2["Roteador R2<br/>TTL 63 para 62"]
  R2 -- "quadro 3<br/>MAC: R2 para R3" --> R3["Roteador R3<br/>TTL 62 para 61"]
  R3 -- "quadro 4<br/>MAC: R3 para SRV2" --> S["SRV2<br/>10.2.5.20"]
\`\`\`

*Esquema 1 (a viagem do datagrama).* O endereço IP de origem e o de destino não mudam de ponta a ponta. A cada salto mudam o **quadro** (MAC de origem e de destino), o **TTL** e o **checksum** do cabeçalho IP, que é recalculado porque o TTL mudou.

Essa é a ideia central do roteamento: o endereço físico (MAC) vale em **um enlace**, e o endereço IP vale **fim a fim**.

### Endereço, máscara e prefixo

Um endereço IPv4 tem duas partes: a **rede** (os bits mais à esquerda) e o **host** (os bits restantes). A máscara de sub-rede, ou o comprimento do prefixo (por exemplo, /24), diz onde está a divisa.

| Valor | Como se calcula | Exemplo (192.168.10.10/24) |
| --- | --- | --- |
| Máscara | prefixo de bits 1 seguido de bits 0 | 255.255.255.0 |
| Endereço da rede | endereço E máscara (E lógico, bit a bit) | 192.168.10.0 |
| Endereço de broadcast | rede com todos os bits de host em 1 | 192.168.10.255 |
| Hosts utilizáveis | 2 elevado a (32 menos prefixo), menos 2 | 254 |

Em enlaces ponto a ponto, o prefixo /31 usa os dois endereços como hosts, sem rede nem broadcast (RFC 3021, seção 2.1).

**A máscara de rede.** A máscara tem 32 bits, como o endereço: os bits 1 marcam a parte de rede e os bits 0, a parte de host. Em 192.168.10.10/24, a máscara é 11111111.11111111.11111111.00000000 (255.255.255.0): 24 bits de rede e 8 de host. Dois hosts estão na mesma rede quando o E lógico (AND) do endereço de cada um com a máscara dá o mesmo resultado.

\`\`\`mermaid
%%{init: {"packet": {"bitWidth": 22}}}%%
packet-beta
  0-23: "Rede: 24 bits (192.168.10)"
  24-31: "Host: 8 bits (.10)"
\`\`\`

*Esquema 2 (rede e host em um /24).* Os 32 bits do endereço 192.168.10.10/24, numerados de 0 a 31 da esquerda para a direita: os 24 primeiros identificam a rede, e os 8 últimos, o host dentro dela. Mudar o prefixo desloca essa divisa.

**Um exemplo com prefixo que não é múltiplo de 8.** Em 192.168.10.77/26, a máscara é 255.255.255.192, e só o último octeto muda o resultado:

| Passo | Último octeto | Binário |
| --- | --- | --- |
| Endereço | 77 | 01001101 |
| Máscara | 192 | 11000000 |
| E lógico (rede) | 64 | 01000000 |
| Bits de host em 1 (broadcast) | 127 | 01111111 |

A rede é 192.168.10.64/26, o broadcast é 192.168.10.127 e os hosts utilizáveis vão de 192.168.10.65 a 192.168.10.126 (62 hosts, pois 2 elevado a 6 menos 2). Os blocos /26 começam em múltiplos de 64: .0, .64, .128 e .192. A aba **Endereços** do simulador faz esse mesmo cálculo em binário, e os cenários "Máscara larga demais" e "Sub-redes sobrepostas" mostram o que acontece quando a máscara está errada.

### Endereços públicos, privados e classes

Um endereço **público** é único na internet, é alocado pelos registros regionais (no Brasil, o Registro.br, que atua sob a LACNIC) e é roteável globalmente. Um endereço **privado** (RFC 1918) pode ser repetido em qualquer rede interna, não é roteado na internet e precisa de NAT para sair (veja o simulador de NAT).

**As classes de endereço (histórico).** Até 1993, o primeiro octeto definia a classe, e a classe fixava o tamanho da rede. O modelo foi substituído pelo CIDR, e os roteadores atuais **não usam classes**. A divisão ainda aparece em provas, em equipamentos antigos e na RFC 1918.

| Classe | Bits iniciais | Primeiro octeto | Máscara padrão | Hosts por rede | Bloco privado (RFC 1918) | Uso |
| --- | --- | --- | --- | --- | --- | --- |
| A | 0 | 1 a 126 | /8 | 16.777.214 | 10.0.0.0/8 | redes muito grandes |
| B | 10 | 128 a 191 | /16 | 65.534 | 172.16.0.0/12 (16 redes /16) | redes médias |
| C | 110 | 192 a 223 | /24 | 254 | 192.168.0.0/16 (256 redes /24) | redes pequenas |
| D | 1110 | 224 a 239 | não se aplica | não se aplica | nenhum | multicast (RFC 5771) |
| E | 1111 | 240 a 255 | não se aplica | não se aplica | nenhum | reservada (RFC 1112, seção 4) |

Os blocos 0.0.0.0/8 (RFC 1122, seção 3.2.1.3) e 127.0.0.0/8 (loopback) pertencem à faixa da classe A, mas não são endereços de host comuns. Qualquer endereço fora dos blocos privados e dos blocos especiais da seção "Blocos de endereço especiais", logo adiante, é público.

### CIDR e VLSM

**CIDR.** O CIDR (*Classless Inter-Domain Routing*, RFC 4632, que substituiu a RFC 1519) descarta as classes: o prefixo pode ter qualquer comprimento de 0 a 32 bits, escrito como /n. Isso permite entregar blocos do tamanho certo e **agregar** rotas: 192.168.0.0/24 e 192.168.1.0/24 viram uma só rota, 192.168.0.0/23, que a tabela de rotas guarda em uma única entrada.

**VLSM.** O VLSM (*Variable Length Subnet Masking*) divide um bloco em sub-redes de **tamanhos diferentes**, cada uma com a máscara que o seu número de hosts exige, sem desperdiçar endereços. A regra é alocar das maiores para as menores. Exemplo com 192.168.10.0/24:

\`\`\`mermaid
flowchart TD
  B["192.168.10.0/24<br/>256 endereços"] --> A["LAN A: 192.168.10.0/25<br/>126 hosts"]
  B --> R["192.168.10.128/25<br/>128 endereços"]
  R --> LB["LAN B: 192.168.10.128/26<br/>62 hosts"]
  R --> R2["192.168.10.192/26<br/>64 endereços"]
  R2 --> LC["LAN C: 192.168.10.192/27<br/>30 hosts"]
  R2 --> R3["192.168.10.224/27<br/>32 endereços"]
  R3 --> PP["Enlace R1-R2: 192.168.10.224/30<br/>2 hosts"]
  R3 --> L["192.168.10.228 a .255<br/>livres"]
\`\`\`

*Esquema 3 (VLSM aplicado a um /24).* Cada divisão parte ao meio o bloco que sobrou e reserva uma metade. Os endereços abaixo mostram o plano resultante.

| Sub-rede | Prefixo | Máscara | Hosts utilizáveis | Faixa (rede a broadcast) |
| --- | --- | --- | --- | --- |
| LAN A (até 100 hosts) | /25 | 255.255.255.128 | 126 | 192.168.10.0 a 192.168.10.127 |
| LAN B (até 50 hosts) | /26 | 255.255.255.192 | 62 | 192.168.10.128 a 192.168.10.191 |
| LAN C (até 20 hosts) | /27 | 255.255.255.224 | 30 | 192.168.10.192 a 192.168.10.223 |
| Enlace R1-R2 | /30 | 255.255.255.252 | 2 | 192.168.10.224 a 192.168.10.227 |

Sem VLSM, com uma máscara única de /25 em todas as sub-redes, o /24 só comportaria duas sub-redes, e o enlace entre roteadores consumiria um bloco de 128 endereços para usar apenas 2.

O erro mais comum no VLSM é desenhar sub-redes que se sobrepõem. O cenário "Sub-redes sobrepostas" mostra o efeito, e o cenário "Enlace ponto a ponto /31" mostra o menor bloco possível para um enlace entre roteadores (RFC 3021, seção 2.1).

### Blocos de endereço especiais

| Bloco | Uso | Definido em |
| --- | --- | --- |
| 10.0.0.0/8, 172.16.0.0/12 e 192.168.0.0/16 | uso privado, não roteado na internet | RFC 1918 |
| 100.64.0.0/10 | espaço compartilhado do NAT de operadora | RFC 6598 |
| 127.0.0.0/8 | loopback, nunca sai do host (não simulado: nenhum pacote chega à rede) | RFC 1122, seção 3.2.1.3 |
| 169.254.0.0/16 | link-local, nunca é encaminhado | RFC 3927 |
| 192.0.2.0/24, 198.51.100.0/24 e 203.0.113.0/24 | documentação e exemplos | RFC 5737 |
| 255.255.255.255 | broadcast limitado, nunca é encaminhado | RFC 919 |

A lista completa e atual está no registro de endereços de uso especial (RFC 6890).

### O cabeçalho IPv4

Um **datagrama** é o cabeçalho IPv4 seguido da carga útil (o segmento TCP, o datagrama UDP, a mensagem ICMP). O desenho mostra o cabeçalho de 20 bytes (160 bits) em linhas de 32 bits, na ordem de transmissão (RFC 791, seção 3.1).

\`\`\`mermaid
packet-beta
  0-3: "Versão"
  4-7: "IHL"
  8-13: "DSCP"
  14-15: "ECN"
  16-31: "Comprimento total"
  32-47: "Identificação"
  48-50: "Flags"
  51-63: "Deslocamento do fragmento"
  64-71: "TTL"
  72-79: "Protocolo"
  80-95: "Checksum do cabeçalho"
  96-127: "Endereço de origem"
  128-159: "Endereço de destino"
  160-191: "Opções e preenchimento (só se IHL maior que 5)"
  192-223: "Dados (carga útil)"
\`\`\`

*Esquema 4 (o datagrama IPv4).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. As cinco primeiras linhas formam o cabeçalho fixo de 20 bytes; as opções, quando existem, ocupam até 40 bytes a mais (o IHL chega a 15, ou 60 bytes); depois vem a carga útil. A tabela abaixo descreve todos os campos, em ordem.

| Campo | Posição (bits) | Tamanho | Função |
| --- | --- | --- | --- |
| Versão | 0 a 3 | 4 bits | vale 4 |
| IHL (*Internet Header Length*) | 4 a 7 | 4 bits | tamanho do cabeçalho em palavras de 32 bits (mínimo 5, ou 20 bytes) |
| DSCP | 8 a 13 | 6 bits | classe de serviço (RFC 2474), antigo Tipo de Serviço |
| ECN | 14 a 15 | 2 bits | sinalização explícita de congestionamento (RFC 3168) |
| Comprimento total | 16 a 31 | 16 bits | cabeçalho mais dados, em bytes (no máximo 65.535) |
| Identificação | 32 a 47 | 16 bits | agrupa os fragmentos de um mesmo datagrama (RFC 791; RFC 6864) |
| Flags | 48 a 50 | 3 bits | bit 0 reservado (0), bit 1 DF (não fragmentar), bit 2 MF (há mais fragmentos) |
| Deslocamento do fragmento | 51 a 63 | 13 bits | posição do fragmento no datagrama original, em unidades de 8 bytes |
| TTL (*Time to Live*) | 64 a 71 | 8 bits | limite de saltos, decrementado em cada roteador |
| Protocolo | 72 a 79 | 8 bits | camada de cima (1 ICMP, 6 TCP, 17 UDP; lista no registro "Protocol Numbers" da IANA) |
| Checksum do cabeçalho | 80 a 95 | 16 bits | soma de verificação só do cabeçalho (RFC 1071), recalculada a cada salto |
| Endereço de origem | 96 a 127 | 32 bits | quem enviou |
| Endereço de destino | 128 a 159 | 32 bits | para quem vai |
| Opções e preenchimento | 160 em diante | 0 a 40 bytes | extensões raras (por exemplo, registro de rota); o preenchimento alinha o cabeçalho a 32 bits |

A fragmentação (Identificação, Flags e Deslocamento) não é simulada aqui; ela aparece no simulador de ICMP, na mensagem "fragmentação necessária".

A aba **Cabeçalho IPv4** do simulador mostra esses campos com os valores do pacote em trânsito.

### A decisão do host: entrega direta ou gateway

\`\`\`mermaid
flowchart TD
  I["Host tem um pacote para o destino D"] --> T{"D E máscara<br/>é igual à minha rede?"}
  T -- "sim" --> DIR["Entrega direta:<br/>ARP resolve o MAC de D"]
  T -- "não" --> G{"Existe gateway<br/>na minha sub-rede?"}
  G -- "sim" --> GW["Envia ao gateway:<br/>MAC do gateway, IP de D"]
  G -- "não" --> E["Rede inalcançável no próprio host:<br/>nada é enviado"]
\`\`\`

*Esquema 5 (decisão do host).* O host compara o destino com a própria rede (RFC 1122, seção 3.3.1.1; RFC 1812, seção 5.2.4.2). Se o destino é de outra rede, o quadro vai ao **gateway**, com o MAC do gateway e o IP do destino final. O gateway precisa estar na sub-rede do host, porque é alcançado por ARP.

Por isso um erro de máscara ou de gateway no host não aparece como erro de roteamento: aparece como falta de resposta.

### A decisão do roteador: o prefixo mais específico

\`\`\`mermaid
flowchart TD
  P["Pacote chega com destino D"] --> V{"TTL maior que 1?"}
  V -- "não" --> X1["Descarta e envia<br/>ICMP 11/0 à origem"]
  V -- "sim" --> C["Seleciona as rotas cujo prefixo contém D"]
  C --> N{"Alguma rota casa?"}
  N -- "não" --> X2["Descarta e envia<br/>ICMP 3/0 à origem"]
  N -- "sim" --> L["Fica com o maior comprimento de prefixo"]
  L --> D2["Desempate: preferência administrativa e depois métrica"]
  D2 --> F["Decrementa o TTL, recalcula o checksum<br/>e encaminha ao próximo salto"]
\`\`\`

*Esquema 6 (decisão do roteador).* Cada roteador consulta só a própria tabela. A rota de maior prefixo vence (RFC 1812, seção 5.2.4.3), qualquer que seja a ordem em que as rotas foram escritas. A rota padrão (0.0.0.0/0) tem o menor prefixo e só vence quando nada mais casa. O TTL e o ICMP 11/0 seguem a RFC 1812, seção 5.3.1.

Exemplo: com as rotas 10.2.0.0/16 e 10.2.5.0/24, o destino 10.2.5.20 casa com as duas, e vence a /24.

### O que cada modo e aba do simulador mostram

O simulador tem dois modos, e cada um mostra uma das decisões.

- **Encaminhamento:** o caminho do pacote por três roteadores. O destaque da topologia mostra o enlace percorrido, e a aba **Tabela de rotas** marca a rota vencedora em cada roteador, com as candidatas que casaram. O diagrama de sequência mostra o pedido (ping) e a resposta, ou o erro ICMP que volta quando o pacote é descartado.
- **Endereçamento:** o que o **host** decide antes de enviar. A aba **Endereços** mostra o cálculo E lógico com a máscara, em binário, e o bloco especial a que o endereço pertence.
- **O estado da decisão:** o painel lateral resume o resultado (entregue, descartado, inalcançável) e o motivo.

O ping é só a **sonda**: serve para mostrar o caminho e os erros, e os tempos são didáticos.

Para treinar o endereçamento, use o modo **Endereçamento** e os cenários "Máscara larga demais", "Sub-redes sobrepostas" e "Enlace ponto a ponto /31". Para treinar o encaminhamento, use o modo **Encaminhamento** e os cenários de prefixo mais específico, de TTL e de uRPF.

### Limites do modelo e do diagrama

- As rotas são **estáticas**. As entradas "OSPF" são apenas rotas de outra origem, sem o protocolo em execução (veja os simuladores de OSPF, RIP, BGP e IS-IS).
- Não há ECMP, roteamento por política, multicast, opções IP, fragmentação (veja o simulador de ICMP para a fragmentação e o PMTUD) nem IPv6.
- As tabelas ARP já estão preenchidas, exceto no primeiro salto do host A.
- A distância administrativa e as métricas seguem convenções de fabricantes, e não de RFC. No uRPF flexível, a rota padrão vale como qualquer outra rota.
- O ping é só a sonda: os tempos são didáticos e não há tráfego real. O diagrama mostra **um** pacote por vez; em redes reais, cada roteador decide milhares de datagramas por segundo, cada um de forma independente.
- Os endereços usados são de uso privado ([RFC 1918](https://www.rfc-editor.org/rfc/rfc1918)) e de documentação ([RFC 5737](https://www.rfc-editor.org/rfc/rfc5737)).
`;
