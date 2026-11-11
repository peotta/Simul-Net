// Fundamentação do simulador ICMP, em Markdown: aparece na documentação (docs/simuladores/icmp.md e na wiki), antes de
// "Como ler os diagramas". Explica o papel do ICMP, as mensagens e as ferramentas que dependem dele.
export const fundamentacao: string = `
### O problema que o ICMP resolve

O IP não avisa quando algo dá errado: um roteador sem rota simplesmente descarta o pacote. O ICMP (*Internet Control Message Protocol*, RFC 792) é o **canal de aviso** do IP: os roteadores e os hosts o usam para informar erros e fazer testes simples. Ele é parte obrigatória de uma implementação de IP, mas viaja **dentro** de um datagrama IP (protocolo 1), e não é um protocolo de transporte.

O ICMP **informa**, mas não corrige: a decisão de tentar de novo, mudar de rota ou desistir é de quem recebe o aviso.

**O que você aprende com este simulador.**

- Explicar o papel do ICMP como canal de aviso do IP e por que ele informa sem corrigir.
- Ler o formato da mensagem ICMP (tipo, código, checksum) e o que o erro carrega do pacote original.
- Distinguir eco, tempo excedido e destino inalcançável, com os códigos mais comuns.
- Entender como ping, traceroute e PMTUD se apoiam em mensagens ICMP.
- Reconhecer o que o filtro de ICMP mal planejado quebra, e como observar um scan UDP no nível defensivo.

### O diagrama das mensagens

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as PC-A
  participant R as Roteador
  participant S as Servidor
  A->>S: Echo Request, tipo 8
  S->>A: Echo Reply, tipo 0
  A->>R: pacote com TTL 1
  R->>A: Time Exceeded, tipo 11 código 0
  A->>R: pacote para destino sem rota
  R->>A: Destination Unreachable, tipo 3 código 0
\`\`\`

*Esquema 1 (as três situações básicas).* O **eco** testa se o destino responde. O **tempo excedido** avisa que o TTL chegou a zero. O **destino inalcançável** avisa que não há caminho. Em todos os erros, o ICMP vai ao endereço de **origem** do datagrama que causou o problema.

### Formato e tipos de mensagem

Toda mensagem ICMP viaja dentro de um datagrama IP (protocolo 1) e começa com **tipo** (1 byte), **código** (1 byte) e **checksum** (2 bytes, que cobre toda a mensagem). O restante depende do tipo ([RFC 792](https://www.rfc-editor.org/rfc/rfc792)).

\`\`\`mermaid
packet-beta
  0-7: "Tipo"
  8-15: "Código"
  16-31: "Checksum"
  32-63: "Resto do cabeçalho (depende do tipo)"
  64-95: "Dados (depende do tipo)"
\`\`\`

*Esquema 2 (formato geral da mensagem ICMP).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O tipo diz a família da mensagem, e o código refina o motivo. O significado do "resto do cabeçalho" muda com o tipo: no eco, são o identificador e o número de sequência; no destino inalcançável com código 4, os 16 bits finais levam o MTU do próximo salto (RFC 1191); no Redirect, o endereço do roteador melhor; no tempo excedido, o campo não é usado.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Tipo | 0 a 7 | 8 bits | a família da mensagem (0 Echo Reply, 3 destino inalcançável, 8 Echo Request, 11 tempo excedido) |
| Código | 8 a 15 | 8 bits | refina o motivo dentro do tipo |
| Checksum | 16 a 31 | 16 bits | verificação da mensagem ICMP inteira |
| Resto do cabeçalho | 32 a 63 | 4 bytes | muda com o tipo: identificador e sequência no eco, MTU do próximo salto no código 4 do tipo 3, roteador melhor no Redirect, sem uso no tempo excedido |
| Dados | 64 a 95 (condensado) | variável | depende do tipo: dados do eco ou, nos erros, o cabeçalho IP original mais 8 bytes |

\`\`\`mermaid
packet-beta
  0-7: "Tipo (8 ou 0)"
  8-15: "Código (0)"
  16-31: "Checksum"
  32-47: "Identificador"
  48-63: "Número de sequência"
  64-95: "Dados do eco"
\`\`\`

*Esquema 3 (Echo Request e Echo Reply).* O eco leva um **identificador** e um **número de sequência**, que o ping usa para casar cada resposta com o pedido que a originou; o Echo Reply devolve os mesmos valores e os mesmos dados. As mensagens de erro, ao contrário, carregam o **cabeçalho IP original mais os 8 primeiros bytes** dos dados do datagrama que as provocou (RFC 792). Com isso, quem recebe o aviso identifica a conexão ou o processo afetado, pois as portas do TCP e do UDP estão nesses 8 bytes.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Tipo | 0 a 7 | 8 bits | 8 no Echo Request (pedido de eco), 0 no Echo Reply (resposta) |
| Código | 8 a 15 | 8 bits | 0 |
| Checksum | 16 a 31 | 16 bits | verificação da mensagem ICMP inteira |
| Identificador | 32 a 47 | 16 bits | identifica a sessão do ping; a resposta devolve o mesmo valor |
| Número de sequência | 48 a 63 | 16 bits | cresce a cada pedido e casa a resposta com ele |
| Dados do eco | 64 a 95 (condensado) | variável | conteúdo arbitrário, devolvido igual na resposta |

| Tipo | Mensagem | Códigos principais |
| --- | --- | --- |
| 0 | Echo Reply (resposta de eco) | 0 |
| 8 | Echo Request (pedido de eco) | 0 |
| 3 | Destination Unreachable (destino inalcançável) | 0 rede, 1 host, 2 protocolo, 3 porta, 4 fragmentação necessária com DF ligado, 13 proibido por filtro administrativo (RFC 1812) |
| 11 | Time Exceeded (tempo excedido) | 0 TTL esgotado em trânsito, 1 tempo de remontagem excedido |
| 5 | Redirect | 0 rede, 1 host |

Duas regras evitam tempestades de avisos: **não se envia ICMP de erro sobre outro ICMP de erro**, e só se avisa sobre o **primeiro fragmento** de um datagrama fragmentado (RFC 792). A RFC 1812 acrescenta que os roteadores devem limitar a taxa dos erros que geram.

### As ferramentas que dependem do ICMP

\`\`\`mermaid
flowchart TD
  P["ping: Echo Request e Echo Reply"] --> R1["Mede acessibilidade e tempo de ida e volta"]
  T["traceroute: TTL 1, 2, 3 ..."] --> R2["Cada roteador responde Time Exceeded:<br/>revela o caminho salto a salto"]
  H["scan UDP: porta fechada"] --> R3["Destino responde Destination Unreachable, código 3:<br/>porta fechada, e o silêncio indica porta aberta ou filtrada"]
  D["PMTUD: DF ligado"] --> R4["Roteador responde tipo 3, código 4:<br/>o pacote não cabe no enlace"]
\`\`\`

*Esquema 4 (ferramentas e a mensagem em que se apoiam).* O **ping** usa o par eco. O **traceroute** envia pacotes com TTL crescente e lê o endereço de cada roteador que responde com tempo excedido: é uma técnica, e não um protocolo próprio. O **PMTUD** (*Path MTU Discovery*, RFC 1191) usa o aviso de código 4 para descobrir o maior pacote que cabe no caminho; os problemas práticos de filtrar esse aviso estão na RFC 2923.

Isso explica um erro comum de projeto: **bloquear todo o ICMP** quebra o PMTUD e o traceroute. O correto é filtrar pelo tipo, e não descartar tudo.

### O que cada modo e aba do simulador mostram

- **Topologia:** o PC-A, três roteadores e o servidor. O destaque mostra por onde o pacote passa, e onde ele é descartado.
- **Diagrama de sequência:** as setas são os pacotes e as mensagens ICMP de volta, com o TTL em cada salto.
- **Abas:** *Terminal* mostra a saída do comando como o usuário a veria, *Comando* explica cada parte do comando usado, e *Rotas* mostra as tabelas dos roteadores. Na aba Mensagem, o cabeçalho de cada mensagem é aberto campo a campo.
- **Modos:** *Ping*, *Traceroute e tracert* e *Scan UDP (hping3)*. O scan é mostrado só no nível defensivo: o que o administrador observa e como se proteger.

Para o eco e o tempo excedido, use "Echo (ping)" e "TTL expirado". Para o caminho salto a salto, use "traceroute (UDP)" e "tracert (Windows)". Para os avisos de destino inalcançável, use "Rede inalcançável", "Host inalcançável" e "Porta inalcançável". Para o MTU, use "Fragmentação" e "PMTUD (DF)". Para o que o filtro quebra, use "Proibido (3/13)", "Filtro silencioso", "Buraco negro PMTUD" e "Loop de roteamento".

### Limites do modelo e do diagrama

- O simulador cobre o ICMP do **IPv4**. O ICMPv6 (RFC 4443) tem outras mensagens e mais funções, como a descoberta de vizinhos.
- Os tempos de ida e volta são **didáticos**, e a saída do terminal é uma aproximação do formato de cada sistema operacional.
- Nem todo equipamento responde a tudo: na prática, firewalls e roteadores limitam ou bloqueiam respostas ICMP, e o traceroute então mostra asteriscos.
`;
