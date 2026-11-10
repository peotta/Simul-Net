// Fundamentação do simulador de NAT, em Markdown: aparece na documentação (docs/simuladores/nat.md e na wiki), antes de
// "Como ler os diagramas". Explica a tradução de endereços e portas, a tabela, o DNAT e os limites do NAT.
export const fundamentacao: string = `
### O problema que o NAT resolve

O IPv4 tem **32 bits**, o que dá cerca de 4,3 bilhões de endereços, insuficientes para todos os dispositivos. O **NAT** (*Network Address Translation*) permite que uma rede interna use **endereços privados** (RFC 1918), que não são roteados na internet, e que um roteador os **traduza** para um ou poucos endereços públicos. A terminologia está na RFC 2663, e a técnica tradicional, na RFC 3022. Os requisitos de comportamento estão nas RFCs 4787 (UDP), 5382 (TCP) e 5508 (ICMP).

**O que você aprende com este simulador.**

- Explicar por que o NAT existe e a diferença entre Basic NAT, NAPT, SNAT e DNAT.
- Ler a tabela NAT e entender como as portas distinguem muitos hosts em um só endereço público.
- Saber que campos do pacote o NAT reescreve e por que precisa recalcular os checksums.
- Publicar um serviço interno com DNAT e reconhecer o caso do hairpin.
- Reconhecer os limites do NAT (esgotamento de portas, IPsec, CGNAT) e por que ele não é segurança.

### O diagrama da tradução de saída

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant H as Host interno, 192.168.1.10
  participant N as Roteador NAT, público 203.0.113.1
  participant S as Servidor externo, 198.51.100.9
  H->>N: origem 192.168.1.10:40000, destino 198.51.100.9:80
  Note over N: cria a entrada na tabela e reescreve a origem
  N->>S: origem 203.0.113.1:50001, destino 198.51.100.9:80
  S->>N: origem 198.51.100.9:80, destino 203.0.113.1:50001
  Note over N: consulta a tabela e reescreve o destino
  N->>H: origem 198.51.100.9:80, destino 192.168.1.10:40000
\`\`\`

*Esquema 1 (NAPT: muitos hosts, um endereço).* O NAT **reescreve** campos do cabeçalho IP (e, quando há, das portas) de pacotes que atravessam o roteador. Na saída, ele troca a **origem** (privada) pela origem pública e **registra** a correspondência em uma **tabela**. Na volta, consulta a tabela e desfaz a troca. O host interno não percebe, e o servidor externo só enxerga o endereço público. Os endereços do exemplo são de documentação (RFC 5737).

### Os tipos de tradução

| Termo da RFC 3022 | Termo de uso comum | O que traduz |
| --- | --- | --- |
| Basic NAT | NAT estático ou dinâmico | só o endereço IP, 1 para 1, de um mapeamento fixo ou de um pool |
| NAPT | PAT, *overload*, *masquerade* | endereço **e porta** (ou identificador ICMP): muitos hosts em um endereço |
| Twice NAT | SNAT e DNAT no mesmo pacote | origem e destino reescritos (por exemplo, em redes com endereços sobrepostos) |

**SNAT** (*source NAT*, reescreve a **origem**) e **DNAT** (*destination NAT*, reescreve o **destino**) são termos de uso consagrado na prática, e não da RFC 2663 ou da RFC 3022. Descrevem **qual campo** é reescrito.

### A tabela NAT

A tabela é o **coração** do NAPT: cada entrada associa uma conexão interna a uma porta externa, e **expira por inatividade**.

| Endereço e porta internos | Endereço e porta externos | Destino | Protocolo |
| --- | --- | --- | --- |
| 192.168.1.10:40000 | 203.0.113.1:50001 | 198.51.100.9:80 | TCP |
| 192.168.1.11:40000 | 203.0.113.1:50002 | 198.51.100.9:80 | TCP |

Dois hosts internos podem usar a **mesma** porta de origem (40000), e o NAT dá a cada um uma **porta externa diferente**: é o que os distingue na volta. Se o número de conexões passa do número de portas disponíveis, **esgota** a tabela, e as conexões novas falham.

### Que campos o NAT reescreve

O NAT não olha o conteúdo da aplicação: ele mexe só em alguns campos do cabeçalho IP e do cabeçalho de transporte. O desenho mostra, em ordem de aparição, apenas os campos que a tradução toca; os demais campos do pacote seguem como estão ([RFC 3022](https://www.rfc-editor.org/rfc/rfc3022), seção 4).

\`\`\`mermaid
packet-beta
  0-15: "Checksum do cabeçalho IP (recalculado)"
  16-47: "Endereço IP de origem (SNAT, NAPT)"
  48-79: "Endereço IP de destino (DNAT)"
  80-95: "Porta de origem (NAPT)"
  96-111: "Porta de destino (DNAT com troca de porta)"
  112-127: "Checksum TCP ou UDP (recalculado)"
\`\`\`

*Esquema 2 (os campos que a tradução toca).* Este é um desenho **condensado**, e não o formato real dos cabeçalhos: no pacote, os campos de endereço ficam no cabeçalho IP e os de porta e checksum, no cabeçalho TCP ou UDP. A tabela abaixo mostra o que muda em cada sentido.

| Campo | Saída (SNAT ou NAPT) | Entrada (volta ou DNAT) | Observação |
| --- | --- | --- | --- |
| Endereço de origem | trocado pelo público | restaurado na volta | muda na saída |
| Endereço de destino | não muda | trocado pelo interno (DNAT) ou restaurado (volta) | muda na entrada |
| Porta de origem | trocada, no NAPT | restaurada na volta | distingue os hosts internos |
| Porta de destino | não muda | trocada no DNAT com troca de porta (443 para 8443) | |
| Checksum do IP | recalculado | recalculado | o cabeçalho mudou |
| Checksum do TCP ou UDP | recalculado | recalculado | cobre os endereços IP, por causa do pseudocabeçalho |

No ICMP de consulta, como o eco, não há porta: o NAPT troca o **identificador** da mensagem, que faz o papel dela (RFC 3022, seção 4.1; RFC 5508). Por reescrever o endereço, o NAT também precisa recalcular o checksum do TCP e do UDP, que cobre os endereços IP em um pseudocabeçalho (veja os simuladores de TCP e UDP).

### DNAT: publicar um serviço interno

\`\`\`mermaid
flowchart LR
  E["Cliente externo<br/>destino: 203.0.113.1:443"] --> N["Roteador NAT<br/>regra de DNAT"]
  N -- "destino reescrito: 192.168.1.50:443" --> I["Servidor interno"]
  I -- "resposta: origem reescrita<br/>para 203.0.113.1:443" --> N
  N --> E
\`\`\`

*Esquema 3 (entrada, com DNAT).* Uma conexão **iniciada de fora** não tem entrada na tabela, então o NAT não sabe a que host interno entregá-la. O **DNAT** resolve isso com uma regra **estática**: pacotes para uma porta do endereço público são reescritos para um servidor interno. A resposta volta pelo mesmo roteador (o servidor precisa usá-lo como gateway) e tem a origem reescrita de volta. A ordem entre o DNAT e o roteamento importa: a tradução do destino vem **antes** da decisão de rota.

### Comportamento do mapeamento: EIM e APDM

A RFC 4787 distingue como o NAT **reaproveita** um mapeamento:

| Comportamento | Regra | Consequência |
| --- | --- | --- |
| *Endpoint-Independent Mapping* (EIM) | a mesma porta externa para qualquer destino | gasta menos portas e ajuda aplicações ponto a ponto |
| *Address and Port-Dependent Mapping* (APDM) | uma porta externa nova a cada destino | gasta mais portas e atrapalha aplicações ponto a ponto |

### Limites do NAT

\`\`\`mermaid
flowchart TD
  L["Limites do NAT"] --> L1["Esgotamento de portas<br/>da tabela"]
  L --> L2["Entrada de fora<br/>sem DNAT não chega"]
  L --> L3["Protocolos que escrevem endereços<br/>no corpo do pacote: exigem um ALG"]
  L --> L4["IPsec e outros protocolos<br/>que protegem o cabeçalho"]
  L --> L5["CGNAT: duas camadas de NAT<br/>no 100.64.0.0/10"]
\`\`\`

*Esquema 4 (limites do NAT).* O NAT **não é segurança**: ele esconde a estrutura interna, mas o que bloqueia o tráfego indesejado é o filtro com estado do firewall (veja o simulador de firewall). No **CGNAT** (RFC 6888), a operadora aplica outro NAT e usa o bloco 100.64.0.0/10 (RFC 6598) entre o equipamento do cliente e o dela, o que dobra os limites e impede, por exemplo, publicar serviços sem acordo com a operadora.

### O que cada modo e aba do simulador mostram

- **Topologia:** a rede interna, o roteador NAT e o servidor externo. A legenda de cores distingue o lado interno (endereços privados), o lado externo (traduzido), o trecho entre CPE e CGN (100.64.0.0/10) e o descartado.
- **Diagrama de sequência:** cada seta é um pacote, e a tradução aparece como a mudança de endereço e porta entre um lado e outro do roteador.
- **Aba Tabela NAT:** as entradas criadas e removidas, com o tempo de inatividade, no instante atual.
- **Aba Portas:** o uso das portas externas e o esgotamento.
- **Modos:** *Saída* (Basic NAT e NAPT, colisão de portas, EIM e APDM, *hairpin*), *Entrada: DNAT* e *Limites, IPsec e CGNAT*.

Para o Basic NAT, use "Basic NAT estático (1:1)", "Basic NAT dinâmico (pool de 2)" e "Pool esgotado (1 endereço, 2 hosts)". Para o NAPT, use "NAPT (PAT): dois hosts, um endereço", "Colisão de portas" e "ICMP Echo (ping) sem portas". Para o comportamento do mapeamento, use "Mapeamento independente do destino (EIM)" e "Mapeamento dependente do destino (APDM)". Para publicar serviços, use "Publicar um serviço (443 para 8443)" e os cenários de hairpin. Para os limites, use "Esgotamento de portas", "Expiração por inatividade", "ESP atrás de NAPT", "NAT-T: ESP dentro de UDP 4500" e "CGNAT: NAT em duas camadas".

### Limites do modelo e do diagrama

- O modelo é **didático**: a primeira mensagem de cada sentido representa a conexão, sem o handshake completo, sem os estados do TCP (FIN e RST) e sem fragmentação.
- Há **um único tempo de inatividade** por entrada, e os valores são parâmetros do simulador, e não padrões de equipamentos. A alocação de portas é determinística: equipamentos reais variam e alguns sorteiam a porta.
- Não há ALG, IPv6, tradução de mensagens de erro ICMP nem regras de filtragem. Os comandos de equipamentos específicos não são reproduzidos.
`;
