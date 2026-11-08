// Fundamentação do simulador IPv4, em Markdown: aparece na documentação (docs/simuladores/ipv4.md e na wiki), antes de
// "Como ler os diagramas". Explica o que o IP resolve, as duas decisões (host e roteador) e como o simulador as mostra.
export const fundamentacao: string = `
### O problema que o IPv4 resolve

Uma internet é um conjunto de redes diferentes ligadas por roteadores. O IPv4 (*Internet Protocol* versão 4, RFC 791) dá a cada interface um **endereço lógico de 32 bits** e define como um **datagrama** viaja de uma origem a um destino atravessando várias redes. Ele está na camada 3 do modelo OSI (camada Internet do TCP/IP).

O serviço é de **melhor esforço**: o IP não garante entrega, ordem nem ausência de duplicatas. Cada roteador decide sozinho, olhando só o endereço de destino e a própria tabela de rotas. Confiabilidade e ordem ficam para as camadas de cima (por exemplo, o TCP).

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

### A decisão do host: entrega direta ou gateway

\`\`\`mermaid
flowchart TD
  I["Host tem um pacote para o destino D"] --> T{"D E máscara<br/>é igual à minha rede?"}
  T -- "sim" --> DIR["Entrega direta:<br/>ARP resolve o MAC de D"]
  T -- "não" --> G{"Existe gateway<br/>na minha sub-rede?"}
  G -- "sim" --> GW["Envia ao gateway:<br/>MAC do gateway, IP de D"]
  G -- "não" --> E["Rede inalcançável no próprio host:<br/>nada é enviado"]
\`\`\`

*Esquema 2 (decisão do host).* O host compara o destino com a própria rede (RFC 1122, seção 3.3.1.1; RFC 1812, seção 5.2.4.2). Se o destino é de outra rede, o quadro vai ao **gateway**, com o MAC do gateway e o IP do destino final. O gateway precisa estar na sub-rede do host, porque é alcançado por ARP.

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

*Esquema 3 (decisão do roteador).* Cada roteador consulta só a própria tabela. A rota de maior prefixo vence (RFC 1812, seção 5.2.4.3), qualquer que seja a ordem em que as rotas foram escritas. A rota padrão (0.0.0.0/0) tem o menor prefixo e só vence quando nada mais casa. O TTL e o ICMP 11/0 seguem a RFC 1812, seção 5.3.1.

Exemplo: com as rotas 10.2.0.0/16 e 10.2.5.0/24, o destino 10.2.5.20 casa com as duas, e vence a /24.

### O cabeçalho IPv4

| Campo | Tamanho | Função |
| --- | --- | --- |
| Versão | 4 bits | vale 4 |
| IHL | 4 bits | tamanho do cabeçalho em palavras de 32 bits (mínimo 5, ou 20 bytes) |
| DSCP e ECN | 8 bits | prioridade e sinalização de congestionamento (antigo Tipo de Serviço) |
| Comprimento total | 16 bits | cabeçalho mais dados, em bytes |
| Identificação, flags e deslocamento | 32 bits | usados na fragmentação (não simulada aqui) |
| TTL | 8 bits | limite de saltos, decrementado em cada roteador |
| Protocolo | 8 bits | camada de cima (1 ICMP, 6 TCP, 17 UDP) |
| Checksum do cabeçalho | 16 bits | soma de verificação só do cabeçalho (RFC 1071) |
| Endereço de origem e de destino | 32 bits cada | quem enviou e para quem vai |

A aba **Cabeçalho IPv4** do simulador mostra esses campos com os valores do pacote em trânsito.

### Como ler o diagrama do simulador

O simulador tem dois modos, e cada um mostra uma das decisões.

- **Encaminhamento:** o caminho do pacote por três roteadores. O destaque da topologia mostra o enlace percorrido, e a aba **Tabela de rotas** marca a rota vencedora em cada roteador, com as candidatas que casaram. O diagrama de sequência mostra o pedido (ping) e a resposta, ou o erro ICMP que volta quando o pacote é descartado.
- **Endereçamento:** o que o **host** decide antes de enviar. A aba **Endereços** mostra o cálculo E lógico com a máscara, em binário, e o bloco especial a que o endereço pertence.
- **O estado da decisão:** o painel lateral resume o resultado (entregue, descartado, inalcançável) e o motivo.

O ping é só a **sonda**: serve para mostrar o caminho e os erros, e os tempos são didáticos.

### Blocos de endereço especiais

| Bloco | Uso | Definido em |
| --- | --- | --- |
| 10.0.0.0/8, 172.16.0.0/12 e 192.168.0.0/16 | uso privado | RFC 1918 |
| 100.64.0.0/10 | espaço compartilhado do NAT de operadora | RFC 6598 |
| 169.254.0.0/16 | link-local, nunca é encaminhado | RFC 3927 |
| 192.0.2.0/24, 198.51.100.0/24 e 203.0.113.0/24 | documentação e exemplos | RFC 5737 |
| 255.255.255.255 | broadcast limitado, nunca é encaminhado | RFC 919 |

A lista completa e atual está no registro de endereços de uso especial (RFC 6890).

### Limites do modelo e do diagrama

- O simulador usa **rotas estáticas**. As entradas "OSPF" são apenas rotas de outra origem, sem o protocolo em execução (veja os simuladores de OSPF, RIP e BGP).
- Não há fragmentação (veja o simulador de ICMP), ECMP, multicast, opções IP nem IPv6.
- A distância administrativa segue convenções de fabricantes, e não de RFC.
- O diagrama mostra **um** pacote por vez. Em redes reais, os roteadores encaminham milhares de datagramas por segundo, cada um decidido de forma independente.
`;
