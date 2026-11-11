// Fundamentação do simulador BGP, em Markdown: aparece na documentação (docs/simuladores/bgp.md e na wiki), antes de
// "Como ler os diagramas". Explica o roteamento entre sistemas autônomos, a sessão, a seleção de caminho e a política.
export const fundamentacao: string = `
### O problema que o BGP resolve

A internet é um conjunto de milhares de redes administradas de forma independente: provedores, empresas, universidades e serviços de conteúdo. Cada uma é um **sistema autônomo** (AS), identificado por um número. Dentro de um AS, um IGP como o OSPF encontra o caminho mais curto. **Entre** AS, o critério não é só a distância: cada AS quer escolher, por **política** (custo, contrato, preferência), por onde o tráfego entra e sai.

O BGP-4 (*Border Gateway Protocol*, RFC 4271) é o protocolo que troca alcançabilidade entre AS. Ele é de **vetor de caminho**: cada rota carrega a lista dos AS que atravessou (o atributo AS_PATH), e essa lista dá a cada roteador informação para decidir e para evitar laços.

**O que você aprende com este simulador.**

- Explicar por que o roteamento entre sistemas autônomos é decidido por política, e não só por distância.
- Acompanhar a sessão BGP (TCP 179, OPEN, KEEPALIVE) e o hold timer.
- Ler o cabeçalho BGP, o OPEN e a estrutura do UPDATE e dos atributos.
- Aplicar o processo de decisão (LOCAL_PREF, AS_PATH, ORIGIN, MED) e as ferramentas de política.
- Reconhecer a regra valley-free e os riscos de confiança (sequestro, vazamento, flapping) com as defesas (RPKI e ROV).

### O diagrama da sessão

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as Roteador do AS 65001
  participant B as Roteador do AS 65002
  A->>B: TCP, porta 179
  A->>B: OPEN: versão, AS, hold time, BGP Identifier
  B->>A: OPEN
  A->>B: KEEPALIVE
  B->>A: KEEPALIVE
  Note over A,B: sessão Established
  A->>B: UPDATE: prefixo e atributos
  A->>B: KEEPALIVE periódico
  A->>B: UPDATE: retirada do prefixo
\`\`\`

*Esquema 1 (sessão e mensagens).* Os vizinhos BGP conversam por uma conexão TCP na porta 179, configurada de forma manual nos dois lados. A sessão passa pelos estados Idle, Connect, Active, OpenSent, OpenConfirm e Established (RFC 4271, seção 8.2.2).

| Mensagem | Tipo | Função (RFC 4271) |
| --- | --- | --- |
| OPEN | 1 | abre a sessão: versão, AS, hold time proposto e BGP Identifier (seção 4.2) |
| UPDATE | 2 | anuncia prefixos com atributos ou retira prefixos (seção 4.3) |
| NOTIFICATION | 3 | informa um erro e encerra a sessão (seção 4.5) |
| KEEPALIVE | 4 | só o cabeçalho de 19 bytes: mostra que o vizinho continua vivo (seção 4.4) |

Se o **hold timer** vence sem ouvir nada do vizinho, a sessão cai e todas as rotas aprendidas dele são retiradas. A RFC sugere um hold time de 90 s e KEEPALIVE a cada um terço desse valor (seções 4.4 e 10); fabricantes usam outros padrões.

### Os formatos: cabeçalho, OPEN e UPDATE

Toda mensagem BGP começa com um cabeçalho de 19 bytes. O desenho mostra o cabeçalho, em linhas de 32 bits, na ordem de transmissão ([RFC 4271](https://www.rfc-editor.org/rfc/rfc4271), seção 4.1).

\`\`\`mermaid
packet-beta
  0-127: "Marcador (16 bytes, todos em 1)"
  128-143: "Tamanho da mensagem"
  144-151: "Tipo (1 a 4)"
\`\`\`

*Esquema 2 (o cabeçalho BGP).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O **marcador** tem 16 bytes com todos os bits em 1 (na versão 4 sem autenticação) e serve para o receptor se sincronizar no fluxo TCP. O **tamanho** vai de 19 (o KEEPALIVE, que é só o cabeçalho) a 4096 bytes. O **tipo** é 1 OPEN, 2 UPDATE, 3 NOTIFICATION e 4 KEEPALIVE.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Marcador | 0 a 127 | 16 bytes | todos os bits em 1 (sem autenticação), para o receptor se sincronizar no fluxo TCP |
| Tamanho da mensagem | 128 a 143 | 2 bytes | tamanho total da mensagem, cabeçalho incluído, de 19 a 4096 bytes |
| Tipo | 144 a 151 | 1 byte | 1 OPEN, 2 UPDATE, 3 NOTIFICATION, 4 KEEPALIVE |

O corpo da mensagem **OPEN** vem logo depois do cabeçalho (RFC 4271, seção 4.2):

\`\`\`mermaid
packet-beta
  0-7: "Versão (4)"
  8-23: "Meu AS"
  24-39: "Hold Time"
  40-71: "BGP Identifier"
  72-79: "Tamanho dos parâmetros"
  80-111: "Parâmetros opcionais (variável)"
\`\`\`

*Esquema 3 (o corpo do OPEN).* O **Meu AS** tem 16 bits: para um AS de 32 bits, o campo leva o valor 23456 (AS_TRANS) e o número real viaja em uma capacidade negociada nos parâmetros opcionais (RFC 6793). O **Hold Time** proposto vale zero ou pelo menos 3 s, e a sessão usa o menor dos dois valores propostos. O **BGP Identifier** é um número de 32 bits, no formato de um endereço IPv4, que identifica o roteador e é o desempate final da decisão.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Versão | 0 a 7 | 1 byte | versão do BGP, 4 |
| Meu AS | 8 a 23 | 2 bytes | número do AS de quem envia; 23456 (AS_TRANS) quando o AS tem 32 bits |
| Hold Time | 24 a 39 | 2 bytes | tempo máximo, em segundos, sem receber KEEPALIVE ou UPDATE; 0 ou pelo menos 3 |
| BGP Identifier | 40 a 71 | 4 bytes | identificador do roteador, no formato de um endereço IPv4 |
| Tamanho dos parâmetros | 72 a 79 | 1 byte | tamanho dos parâmetros opcionais; 0 se não houver |
| Parâmetros opcionais | 80 a 111 (condensado) | variável | capacidades negociadas, como o AS de 32 bits e o suporte a IPv6 |

O corpo do **UPDATE** tem três partes, nesta ordem (RFC 4271, seção 4.3):

| Parte | O que carrega |
| --- | --- |
| Rotas retiradas | prefixos que deixam de ser alcançáveis por este vizinho |
| Atributos de caminho | os atributos que valem para todos os prefixos anunciados na mensagem |
| NLRI | a lista dos prefixos anunciados (*Network Layer Reachability Information*) |

Cada atributo tem um formato de **tipo, tamanho e valor**: um byte de flags (opcional, transitivo, parcial e tamanho estendido), um byte de código do tipo (1 ORIGIN, 2 AS_PATH, 3 NEXT_HOP, 4 MED e 5 LOCAL_PREF), o tamanho e o valor. Por isso um UPDATE anuncia vários prefixos com **um único conjunto de atributos**, e a retirada e o anúncio podem vir na mesma mensagem.

### Os atributos que a rota carrega

| Atributo | Função | Seção |
| --- | --- | --- |
| AS_PATH | lista dos AS atravessados; evita laços e mede o tamanho do caminho | 5.1.2 |
| NEXT_HOP | para onde enviar o tráfego | 5.1.3 |
| ORIGIN | como a rota nasceu (IGP, EGP ou incompleta) | 5.1.1 |
| MULTI_EXIT_DISC (MED) | sugere a um AS vizinho qual entrada preferir | 5.1.4 |
| LOCAL_PREF | preferência dentro do próprio AS (só circula no iBGP) | 5.1.5 |

### O diagrama da escolha do melhor caminho

\`\`\`mermaid
flowchart TD
  R["Chegam vários caminhos para o mesmo prefixo"] --> L{"AS_PATH contém o meu AS?"}
  L -- "sim" --> X["Descarta: laço"]
  L -- "não" --> P["1. Maior LOCAL_PREF"]
  P --> A["2. AS_PATH mais curto"]
  A --> O["3. Menor ORIGIN"]
  O --> M["4. Menor MED, entre rotas do mesmo AS vizinho"]
  M --> E["5. eBGP antes de iBGP"]
  E --> I["6. Menor custo IGP até o NEXT_HOP"]
  I --> D["7. Menor BGP Identifier: desempate final"]
\`\`\`

*Esquema 4 (processo de decisão).* O BGP escolhe **um** melhor caminho por prefixo, instala e repassa só esse. A ordem acima segue a RFC 4271, seção 9.1: o grau de preferência (LOCAL_PREF, seção 9.1.1) e depois os desempates da seção 9.1.2.2. Rotas com laço de AS_PATH são excluídas antes. Implementações acrescentam critérios próprios, como "rota originada localmente" nos fabricantes.

Duas ferramentas de política seguem desse processo:

- O **LOCAL_PREF** decide por onde o tráfego **sai** do AS.
- O **AS-path prepend** (repetir o próprio número do AS no anúncio) torna um caminho menos atraente e influencia por onde o tráfego **entra**.

### Relações comerciais e regra de exportação

\`\`\`mermaid
flowchart TD
  C["Clientes<br/>pagam pelo trânsito"] --- M["Meu AS"]
  PE["Peers<br/>trocam tráfego entre si"] --- M
  PR["Provedores<br/>cobram pelo trânsito"] --- M
  M -- "rotas de clientes e próprias" --> T["Anuncia a todos"]
  M -- "rotas de peers e de provedores" --> O["Anuncia só aos clientes"]
\`\`\`

*Esquema 5 (regra valley-free).* Entre AS, as relações são de **cliente e provedor** (o cliente paga) e de **peering** (troca de tráfego entre as redes e seus clientes, em geral sem pagamento). A regra de exportação conhecida como *valley-free* (modelo de Gao e Rexford) é: rotas de clientes e rotas próprias vão a todos; rotas de peers e de provedores vão **só aos clientes**. Assim, nenhum AS oferece trânsito gratuito entre dois provedores ou dois peers.

### Quando a política falha: segurança do roteamento

O BGP foi desenhado na base da **confiança**: o protocolo aceita o que o vizinho anuncia. Três problemas decorrem disso, e o simulador os mostra no nível defensivo, com o efeito e a defesa.

| Problema | O que acontece | Defesa |
| --- | --- | --- |
| Sequestro de prefixo | um AS anuncia um prefixo que não é dele, e o tráfego é desviado | filtro de prefixos de clientes, validação de origem com RPKI (ROV, RFC 6811) |
| Vazamento de rota | um AS repassa rotas contra a regra de exportação (RFC 7908) | filtros de saída e de entrada por relação comercial |
| Instabilidade (*flapping*) | uma rota que cai e volta repetidas vezes sobrecarrega todo o roteamento | amortecimento (*flap damping*), com cuidado para não punir quem não tem culpa |

A **RPKI** liga cada prefixo ao AS autorizado a originá-lo por meio de um ROA (RFC 9582), e o ROV (*Route Origin Validation*, RFC 6811) usa isso para marcar anúncios como válidos, inválidos ou desconhecidos. A RFC 9319 trata do cuidado com o campo *maxLength* dos ROAs.

### O que cada modo e aba do simulador mostram

- **Topologia:** seis sistemas autônomos e as **relações comerciais** entre eles (cliente, provedor e peer).
- **Diagrama de sequência e legenda de cores:** TCP (porta 179), OPEN e KEEPALIVE, UPDATE, retirada ou NOTIFICATION e tráfego de dados.
- **Aba Sessões:** o estado de cada sessão BGP no instante atual.
- **Aba Tabela BGP:** as rotas de cada AS, com os atributos e a marca do melhor caminho.
- **Aba Comandos:** a saída dos comandos de consulta do roteador escolhido, no formato do Cisco IOS.
- **Modos:** *Sessões* (abertura e hold timer), *Rotas e política* (propagação, LOCAL_PREF, prepend, falhas) e *Segurança e defesa* (sequestro, ROV, vazamento e *flapping*).

Para a sessão, use "Estabelecimento da sessão" e "Hold timer". Para a propagação, use "Propagação do anúncio" e "Exportação entre provedores e peers". Para a seleção de caminho, use "AS_PATH mais curto", "Desempate por router ID", "LOCAL_PREF (saída)" e "AS-path prepend (entrada)". Para as falhas, use "Falha de enlace" e "Retirada do prefixo". Para os riscos e as defesas, use "Sequestro de prefixo", "Defesa: filtro de prefixos", "Defesa: RPKI / ROV", "Vazamento de rota" e "Flapping de rota".

### Limites do modelo e do diagrama

- Há **um roteador por AS**: não há iBGP nem custo IGP, então o critério 6 da escolha não é exercitado.
- O simulador mostra o essencial de cada atributo e só uma parte das implementações reais. Não há comunidades, reflexores de rota nem confederações.
- Os temporizadores e os tempos de convergência são **didáticos**: na internet real, a propagação de uma mudança leva de segundos a minutos.
- As relações comerciais e o modelo *valley-free* são uma simplificação: contratos reais têm exceções.
`;
