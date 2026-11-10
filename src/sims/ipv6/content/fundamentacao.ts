// Fundamentação do simulador IPv6, em Markdown: aparece na documentação (docs/simuladores/ipv6.md e na wiki), antes de
// "Como ler os diagramas". Explica o que o IPv6 muda, a anatomia do endereço, o SLAAC com a DAD, o Neighbor Discovery e a
// decisão de encaminhamento.
export const fundamentacao: string = `
### O problema que o IPv6 resolve

O IPv4 tem endereços de 32 bits, cerca de 4,3 bilhões, e a internet os esgotou. O IPv6 (*Internet Protocol* versão 6, RFC 8200) dá a cada interface um **endereço de 128 bits**, o que torna a escassez de endereços um problema do passado e devolve a comunicação fim a fim, sem depender de NAT. Ele também simplifica o cabeçalho e muda a forma de configurar os hosts.

O serviço continua sendo de **melhor esforço**, como no IPv4: o IP não garante entrega, ordem nem ausência de duplicatas. Cada roteador decide sozinho, olhando só o destino e a própria tabela de rotas.

**O que você aprende com este simulador.**

- Explicar o que o IPv6 muda em relação ao IPv4 (endereço, cabeçalho, fragmentação, broadcast).
- Ler e compactar um endereço IPv6 e separar o prefixo do identificador de interface.
- Reconhecer os tipos de endereço (enlace local, ULA, global, multicast) e o alcance de cada um.
- Acompanhar o SLAAC, a detecção de duplicidade (DAD) e o Neighbor Discovery no lugar do ARP.
- Ler o cabeçalho de 40 bytes campo a campo e prever a decisão de encaminhamento e os erros ICMPv6.

### O que muda em relação ao IPv4

| Assunto | IPv4 | IPv6 |
| --- | --- | --- |
| Endereço | 32 bits | 128 bits |
| Cabeçalho | 20 a 60 bytes, com opções | 40 bytes fixos, extras em cabeçalhos de extensão |
| Checksum do cabeçalho | sim, recalculado a cada salto | não existe |
| Fragmentação | pela origem e pelos roteadores | só pela origem (RFC 8200, seção 4.5) |
| Limite de saltos | TTL | Hop Limit |
| Resolução de MAC | ARP | Neighbor Discovery, sobre ICMPv6 (RFC 4861) |
| Broadcast | existe | não existe: usa multicast |
| Configuração | manual ou DHCP | SLAAC, DHCPv6 ou manual |

### Como se lê um endereço IPv6

Um endereço tem oito grupos de 16 bits, escritos em hexadecimal e separados por dois-pontos. Para encurtar, tiram-se os zeros à esquerda de cada grupo, e uma única sequência de grupos zero vira "::" (RFC 4291, seção 2.2). A forma recomendada para texto é a da RFC 5952: minúsculas, e o "::" na maior sequência de grupos zero.

\`\`\`mermaid
flowchart LR
  F["2001:0db8:0010:0001:0000:0000:0000:0001<br/>forma completa, oito grupos"] --> Z["2001:db8:10:1:0:0:0:1<br/>sem os zeros à esquerda"]
  Z --> C["2001:db8:10:1::1<br/>forma compactada (RFC 5952)"]
\`\`\`

*Esquema 1 (as três formas do mesmo endereço).* O "::" só pode aparecer uma vez, senão não se saberia quantos grupos cada um representa.

Os endereços do simulador são do bloco **2001:db8::/32**, reservado a documentação (RFC 3849).

### Anatomia do endereço: prefixo e identificador de interface

\`\`\`mermaid
flowchart LR
  subgraph END["Endereço global: 128 bits"]
    direction LR
    P["Prefixo da rede<br/>64 bits<br/>2001:db8:10:1"]
    I["Identificador de interface<br/>64 bits<br/>derivado do MAC ou temporário"]
  end
  P --- I
\`\`\`

*Esquema 2 (divisão em 64 e 64).* Nas redes que usam SLAAC, o prefixo tem 64 bits, e os outros 64 identificam a interface no enlace. O identificador pode vir do MAC pelo método **EUI-64 modificado**: insere-se ff:fe no meio do MAC e inverte-se o bit U/L do primeiro byte (RFC 4291, apêndice A). Como isso revela o MAC, existem alternativas: o endereço temporário (RFC 8981) e o identificador estável e opaco (RFC 7217).

### Tipos de endereço

| Bloco | Tipo | Alcance |
| --- | --- | --- |
| ::1/128 | loopback | o próprio nó |
| fe80::/10 | enlace local | só o enlace; roteadores não o encaminham (RFC 4291, seção 2.5.6) |
| fc00::/7 | local único (ULA, RFC 4193) | a organização, sem rota na internet |
| ff00::/8 | multicast | conforme o escopo do grupo |
| 2000::/3 | unicast global | a internet |

O IPv6 **não tem broadcast**. O papel dele é feito por grupos multicast, como ff02::1 (todos os nós do enlace) e ff02::2 (todos os roteadores do enlace). Vantagem: só escuta o grupo quem precisa, e os demais nós não são interrompidos.

### Neighbor Discovery: o ARP do IPv6

O ARP não existe no IPv6. Quem resolve o MAC de um vizinho é o **Neighbor Discovery**, definido sobre mensagens ICMPv6 (RFC 4861).

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as Host A
  participant G as Grupo do nó solicitado
  participant B as Host B
  A->>G: NS, quem tem 2001:db8:10:1::20?
  Note over A,B: destino ff02::1:ffXX:XXXX<br/>MAC 33:33 e os 32 bits finais
  B-->>A: NA, o MAC de 2001:db8:10:1::20 é 00:00:5e:00:53:14
  Note over A: guarda a entrada<br/>na tabela de vizinhos
\`\`\`

*Esquema 3 (Neighbor Solicitation e Advertisement).* A pergunta não vai a todos: vai ao endereço **multicast de nó solicitado**, formado por ff02::1:ff e os 24 bits finais do endereço procurado. Só os nós com esses mesmos 24 bits o escutam. Todas as mensagens do ND saem com Hop Limit 255, o que prova que vieram do mesmo enlace (RFC 4861, seção 7.1).

| Mensagem | Tipo ICMPv6 | Função |
| --- | --- | --- |
| Router Solicitation (RS) | 133 | o host pede um anúncio de roteador |
| Router Advertisement (RA) | 134 | o roteador anuncia prefixo, flags e que é roteador padrão |
| Neighbor Solicitation (NS) | 135 | pergunta o MAC de um endereço |
| Neighbor Advertisement (NA) | 136 | responde com o MAC |

### Autoconfiguração sem estado (SLAAC) e DAD

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as Host A
  participant R as Roteador
  A->>A: forma fe80:: com o identificador de interface
  A->>R: NS de DAD, origem ::, alvo fe80::...
  Note over A,R: sem NA em 1 s,<br/>enlace local preferido
  A->>R: RS, há roteadores?
  R-->>A: RA com prefixo 2001:db8:10:1::/64, flags L e A
  A->>A: forma o endereço global, prefixo mais identificador
  A->>R: NS de DAD do endereço global
  Note over A,R: sem NA em 1 s,<br/>endereço global preferido
\`\`\`

*Esquema 4 (do enlace local ao endereço global).* O host forma o próprio endereço sem servidor: o roteador diz o prefixo, e o host completa o resto. Antes de usar qualquer endereço unicast, ele o testa por **DAD**, a detecção de duplicidade (RFC 4862, seção 5.4): envia um NS com origem não especificada (::), e qualquer resposta significa que o endereço já está em uso.

O host só forma o endereço global se o prefixo anunciado tiver a **flag A** ligada e comprimento **/64** (RFC 4862, seção 5.5.3). Sem RA, o host fica só com o endereço de enlace local, que serve ao enlace e não atravessa o roteador.

### A decisão de encaminhamento

A regra é a do IPv4: o roteador escolhe, entre as rotas cujo prefixo contém o destino, a de **maior comprimento de prefixo**. A rota padrão é ::/0.

\`\`\`mermaid
flowchart TD
  P["Pacote chega com destino D"] --> V{"Hop Limit maior que 1?"}
  V -- "não" --> X1["Descarta e envia<br/>ICMPv6 3/0 à origem"]
  V -- "sim" --> C["Seleciona as rotas cujo prefixo contém D"]
  C --> N{"Alguma rota casa?"}
  N -- "não" --> X2["Descarta e envia<br/>ICMPv6 1/0 à origem"]
  N -- "sim" --> W["Vence a de maior prefixo"]
  W --> K{"Rota conectada?"}
  K -- "não" --> F["Decrementa o Hop Limit<br/>e envia ao próximo salto"]
  K -- "sim" --> ND{"O Neighbor Discovery<br/>achou o MAC de D?"}
  ND -- "sim" --> OK["Entrega ao destino"]
  ND -- "não" --> X3["Envia ICMPv6 1/3 à origem<br/>endereço inalcançável"]
\`\`\`

*Esquema 5 (decisão do roteador).* Os avisos do ICMPv6 (RFC 4443) distinguem as falhas: **1/0** é falta de rota, **1/3** é um endereço da rede conectada que não responde no enlace (o Neighbor Discovery falhou), e **3/0** é o Hop Limit esgotado. Também não há erro ICMPv6 sobre outro erro ICMPv6, e o aviso leva o máximo do pacote original sem passar do MTU mínimo do IPv6, 1280 bytes (seção 2.4; RFC 8200, seção 5).

### O cabeçalho fixo de 40 bytes

O cabeçalho IPv6 tem tamanho fixo. O desenho mostra os campos em linhas de 32 bits, na ordem de transmissão ([RFC 8200](https://www.rfc-editor.org/rfc/rfc8200), seção 3).

\`\`\`mermaid
packet-beta
  0-3: "Versão (6)"
  4-11: "Classe de tráfego"
  12-31: "Rótulo de fluxo"
  32-47: "Comprimento da carga"
  48-55: "Próximo cabeçalho"
  56-63: "Hop Limit"
  64-191: "Endereço de origem (128 bits)"
  192-319: "Endereço de destino (128 bits)"
\`\`\`

*Esquema 6 (o cabeçalho IPv6).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. São 40 bytes no total, sem opções e **sem checksum**: a integridade fica com o protocolo de cima, e o checksum do ICMPv6, do TCP e do UDP inclui as origens e destinos IPv6 em um pseudocabeçalho (RFC 8200, seção 8.1; RFC 4443, seção 2.3). A tabela abaixo descreve todos os campos, em ordem.

| Campo | Posição (bits) | Tamanho | Função |
| --- | --- | --- | --- |
| Versão | 0 a 3 | 4 bits | sempre 6 |
| Classe de tráfego | 4 a 11 | 8 bits | prioridade e marcação de congestionamento (6 bits de DSCP e 2 de ECN, RFC 2474 e RFC 3168) |
| Rótulo de fluxo | 12 a 31 | 20 bits | identifica pacotes de um mesmo fluxo, para tratamento igual (RFC 6437); zero quando não usado |
| Comprimento da carga | 32 a 47 | 16 bits | bytes depois deste cabeçalho, incluindo os cabeçalhos de extensão |
| Próximo cabeçalho | 48 a 55 | 8 bits | tipo do que vem a seguir: um cabeçalho de extensão ou o protocolo de cima |
| Hop Limit | 56 a 63 | 8 bits | limite de saltos, decrementado por cada roteador; com zero, o pacote é descartado |
| Endereço de origem | 64 a 191 | 128 bits | quem enviou |
| Endereço de destino | 192 a 319 | 128 bits | para quem vai |

O campo **Próximo cabeçalho** usa os mesmos números de protocolo do IPv4. Os mais comuns são estes:

| Valor | O que vem a seguir |
| --- | --- |
| 6 | TCP |
| 17 | UDP |
| 58 | ICMPv6 |
| 0 | cabeçalho de extensão Hop-by-Hop (opções lidas por todos os roteadores do caminho) |
| 43 | cabeçalho de extensão de roteamento |
| 44 | cabeçalho de extensão de fragmento (a fragmentação é feita só pela origem) |
| 60 | cabeçalho de extensão de opções de destino |
| 59 | nada: não há cabeçalho depois deste |

As opções, quando existem, vão em **cabeçalhos de extensão** entre este cabeçalho e o protocolo de cima, encadeados pelo campo Próximo cabeçalho (RFC 8200, seção 4). Os roteadores só leem o cabeçalho de extensão Hop-by-Hop.

### O que cada modo e aba do simulador mostram

- **Topologia:** o PC-A, os roteadores e os servidores, com o destaque do caminho do pacote e do ponto em que ele é descartado.
- **Diagrama de sequência:** cada seta é uma mensagem (NS, NA, RS, RA ou o pacote de dados), com o Hop Limit em cada salto.
- **Aba Tabela de rotas:** as rotas estáticas de cada roteador, com a conectada (C) ou estática (S) de cada uma.
- **Aba Endereços:** a anatomia do endereço de enlace local do host A, com o MAC e o identificador de interface (modo Endereçamento e SLAAC).
- **Aba Cabeçalho IPv6:** os campos do cabeçalho do pacote selecionado, com os 40 bytes.
- **Modos:** *Endereçamento e SLAAC* mostra como o host forma e testa os endereços e o que faz com cada tipo de destino. *Encaminhamento* leva um ping por quatro roteadores com tabelas estáticas.

Para treinar a escolha do prefixo mais específico, use "Dois candidatos: vence o /48" e "Três candidatos: vence o /64". Para ver as falhas de rota e os avisos ICMPv6, use "Sem rota no R3 (ICMPv6 1/0)", "Neighbor Discovery sem resposta (1/3)" e "Hop Limit expira no R3". Para o SLAAC, use "SLAAC com EUI-64 e ping ao vizinho" e, para o que dá errado, "Sem Router Advertisement", "Flag A desligada", "Prefixo /80 anunciado" e "Endereço duplicado (DAD)". Para os endereços especiais, use "Enlace local sem roteador", "Multicast de todos os nós (ff02::1)" e "Endereço local único (ULA)".

As limitações estão na aba Referência: o modelo não inclui cabeçalhos de extensão, fragmentação, Path MTU Discovery, DHCPv6, Redirect nem a detecção de inalcançabilidade de vizinho (NUD).
`;
