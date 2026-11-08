// Fundamentação do simulador IPv6, em Markdown: aparece na documentação (docs/simuladores/ipv6.md e na wiki), antes de
// "Como ler os diagramas". Explica o que o IPv6 muda, a anatomia do endereço, o SLAAC com a DAD, o Neighbor Discovery e a
// decisão de encaminhamento.
export const fundamentacao: string = `
### O problema que o IPv6 resolve

O IPv4 tem endereços de 32 bits, cerca de 4,3 bilhões, e a internet os esgotou. O IPv6 (*Internet Protocol* versão 6, RFC 8200) dá a cada interface um **endereço de 128 bits**, o que torna a escassez de endereços um problema do passado e devolve a comunicação fim a fim, sem depender de NAT. Ele também simplifica o cabeçalho e muda a forma de configurar os hosts.

O serviço continua sendo de **melhor esforço**, como no IPv4: o IP não garante entrega, ordem nem ausência de duplicatas. Cada roteador decide sozinho, olhando só o destino e a própria tabela de rotas.

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

*Esquema 5 (decisão do roteador).* Os avisos do ICMPv6 (RFC 4443) distinguem as falhas: **1/0** é falta de rota, **1/3** é um endereço da rede conectada que não responde no enlace (o Neighbor Discovery falhou), e **3/0** é o Hop Limit esgotado. Também não há erro ICMPv6 sobre outro erro ICMPv6, e o aviso leva o máximo do pacote original sem passar do MTU mínimo de 1280 bytes (seção 2.4).

### O cabeçalho fixo de 40 bytes

\`\`\`mermaid
flowchart LR
  A["Versão, classe de tráfego e rótulo de fluxo<br/>4 bytes"] --> B["Comprimento da carga e próximo cabeçalho<br/>3 bytes"] --> C["Hop Limit<br/>1 byte"] --> D["Origem<br/>16 bytes"] --> E["Destino<br/>16 bytes"]
\`\`\`

*Esquema 6 (os campos do cabeçalho).* O cabeçalho tem tamanho fixo, o que facilita o trabalho dos roteadores, e não tem checksum: a integridade fica com o protocolo de cima. O checksum do ICMPv6 inclui as origens e destinos IPv6 em um pseudocabeçalho (RFC 8200, seção 8.1; RFC 4443, seção 2.3). Opções, quando existem, vão em **cabeçalhos de extensão** depois deste.

### Como o simulador mostra essas ideias

O simulador tem dois modos. O **Endereçamento e SLAAC** mostra como o host A forma o endereço de enlace local, o testa por DAD, pede o RA, forma o endereço global e usa o resultado para falar com um vizinho, com o roteador, com o grupo multicast ou com um endereço sem rota. O **Encaminhamento** leva um ping por quatro roteadores com tabelas estáticas e mostra a escolha do prefixo mais específico, o Neighbor Discovery no lugar do ARP, o Hop Limit e os avisos ICMPv6. As limitações estão na aba Referência.
`;
