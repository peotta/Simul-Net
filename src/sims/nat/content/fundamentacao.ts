// Fundamentação do simulador de NAT, em Markdown: aparece na documentação (docs/simuladores/nat.md e na wiki), antes de
// "Como ler os diagramas". Explica a tradução de endereços e portas, a tabela, o DNAT e os limites do NAT.
export const fundamentacao: string = `
### O problema que o NAT resolve

O IPv4 tem **32 bits**, o que dá cerca de 4,3 bilhões de endereços, insuficientes para todos os dispositivos. O **NAT** (*Network Address Translation*) permite que uma rede interna use **endereços privados** (RFC 1918), que não são roteados na internet, e que um roteador os **traduza** para um ou poucos endereços públicos. A terminologia está na RFC 2663, e a técnica tradicional, na RFC 3022. Os requisitos de comportamento estão nas RFCs 4787 (UDP), 5382 (TCP) e 5508 (ICMP).

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

### DNAT: publicar um serviço interno

\`\`\`mermaid
flowchart LR
  E["Cliente externo<br/>destino: 203.0.113.1:443"] --> N["Roteador NAT<br/>regra de DNAT"]
  N -- "destino reescrito: 192.168.1.50:443" --> I["Servidor interno"]
  I -- "resposta: origem reescrita<br/>para 203.0.113.1:443" --> N
  N --> E
\`\`\`

*Esquema 2 (entrada, com DNAT).* Uma conexão **iniciada de fora** não tem entrada na tabela, então o NAT não sabe a que host interno entregá-la. O **DNAT** resolve isso com uma regra **estática**: pacotes para uma porta do endereço público são reescritos para um servidor interno. A resposta volta pelo mesmo roteador (o servidor precisa usá-lo como gateway) e tem a origem reescrita de volta. A ordem entre o DNAT e o roteamento importa: a tradução do destino vem **antes** da decisão de rota.

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

*Esquema 3 (limites do NAT).* O NAT **não é segurança**: ele esconde a estrutura interna, mas o que bloqueia o tráfego indesejado é o filtro com estado do firewall (veja o simulador de firewall). No **CGNAT** (RFC 6888), a operadora aplica outro NAT e usa o bloco 100.64.0.0/10 (RFC 6598) entre o equipamento do cliente e o dela, o que dobra os limites e impede, por exemplo, publicar serviços sem acordo com a operadora.

### Como ler o diagrama do simulador

- **Topologia:** a rede interna, o roteador NAT e o servidor externo. A legenda de cores distingue o lado interno (endereços privados), o lado externo (traduzido), o trecho entre CPE e CGN (100.64.0.0/10) e o descartado.
- **Aba Tabela NAT:** as entradas criadas e removidas, com o tempo de inatividade, no instante atual.
- **Aba Portas:** o uso das portas externas e o esgotamento.
- **Modos:** *Saída* (Basic NAT e NAPT, colisão de portas, EIM e APDM, *hairpin*), *Entrada: DNAT* e *Limites, IPsec e CGNAT*.

### Limites do modelo e do diagrama

- O modelo é **didático**: a primeira mensagem de cada sentido representa a conexão, sem o handshake completo, sem os estados do TCP (FIN e RST) e sem fragmentação.
- Há **um único tempo de inatividade** por entrada, e os valores são parâmetros do simulador, e não padrões de equipamentos. A alocação de portas é determinística: equipamentos reais variam e alguns sorteiam a porta.
- Não há ALG, IPv6, tradução de mensagens de erro ICMP nem regras de filtragem. Os comandos de equipamentos específicos não são reproduzidos.
`;
