// Fundamentação do simulador BGP, em Markdown: aparece na documentação (docs/simuladores/bgp.md e na wiki), antes de
// "Como ler os diagramas". Explica o roteamento entre sistemas autônomos, a sessão, a seleção de caminho e a política.
export const fundamentacao: string = `
### O problema que o BGP resolve

A internet é um conjunto de milhares de redes administradas de forma independente: provedores, empresas, universidades e serviços de conteúdo. Cada uma é um **sistema autônomo** (AS), identificado por um número. Dentro de um AS, um IGP como o OSPF encontra o caminho mais curto. **Entre** AS, o critério não é só a distância: cada AS quer escolher, por **política** (custo, contrato, preferência), por onde o tráfego entra e sai.

O BGP-4 (*Border Gateway Protocol*, RFC 4271) é o protocolo que troca alcançabilidade entre AS. Ele é de **vetor de caminho**: cada rota carrega a lista dos AS que atravessou (o atributo AS_PATH), e essa lista dá a cada roteador informação para decidir e para evitar laços.

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

*Esquema 2 (processo de decisão).* O BGP escolhe **um** melhor caminho por prefixo, instala e repassa só esse. A ordem acima segue a RFC 4271, seção 9.1: o grau de preferência (LOCAL_PREF, seção 9.1.1) e depois os desempates da seção 9.1.2.2. Rotas com laço de AS_PATH são excluídas antes. Implementações acrescentam critérios próprios, como "rota originada localmente" nos fabricantes.

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

*Esquema 3 (regra valley-free).* Entre AS, as relações são de **cliente e provedor** (o cliente paga) e de **peering** (troca de tráfego entre as redes e seus clientes, em geral sem pagamento). A regra de exportação conhecida como *valley-free* (modelo de Gao e Rexford) é: rotas de clientes e rotas próprias vão a todos; rotas de peers e de provedores vão **só aos clientes**. Assim, nenhum AS oferece trânsito gratuito entre dois provedores ou dois peers.

### Quando a política falha: segurança do roteamento

O BGP foi desenhado na base da **confiança**: o protocolo aceita o que o vizinho anuncia. Três problemas decorrem disso, e o simulador os mostra no nível defensivo, com o efeito e a defesa.

| Problema | O que acontece | Defesa |
| --- | --- | --- |
| Sequestro de prefixo | um AS anuncia um prefixo que não é dele, e o tráfego é desviado | filtro de prefixos de clientes, validação de origem com RPKI (ROV, RFC 6811) |
| Vazamento de rota | um AS repassa rotas contra a regra de exportação (RFC 7908) | filtros de saída e de entrada por relação comercial |
| Instabilidade (*flapping*) | uma rota que cai e volta repetidas vezes sobrecarrega todo o roteamento | amortecimento (*flap damping*), com cuidado para não punir quem não tem culpa |

A **RPKI** liga cada prefixo ao AS autorizado a originá-lo por meio de um ROA (RFC 9582), e o ROV (*Route Origin Validation*, RFC 6811) usa isso para marcar anúncios como válidos, inválidos ou desconhecidos. A RFC 9319 trata do cuidado com o campo *maxLength* dos ROAs.

### Como ler o diagrama do simulador

- **Topologia:** seis sistemas autônomos e as **relações comerciais** entre eles (cliente, provedor e peer).
- **Diagrama de sequência e legenda de cores:** TCP (porta 179), OPEN e KEEPALIVE, UPDATE, retirada ou NOTIFICATION e tráfego de dados.
- **Aba Sessões:** o estado de cada sessão BGP no instante atual.
- **Aba Tabela BGP:** as rotas de cada AS, com os atributos e a marca do melhor caminho.
- **Aba Comandos:** a saída dos comandos de consulta do roteador escolhido, no formato do Cisco IOS.
- **Modos:** *Sessões* (abertura e hold timer), *Rotas e política* (propagação, LOCAL_PREF, prepend, falhas) e *Segurança e defesa* (sequestro, ROV, vazamento e *flapping*).

### Limites do modelo e do diagrama

- Há **um roteador por AS**: não há iBGP nem custo IGP, então o critério 6 da escolha não é exercitado.
- O simulador mostra o essencial de cada atributo e só uma parte das implementações reais. Não há comunidades, reflexores de rota nem confederações.
- Os temporizadores e os tempos de convergência são **didáticos**: na internet real, a propagação de uma mudança leva de segundos a minutos.
- As relações comerciais e o modelo *valley-free* são uma simplificação: contratos reais têm exceções.
`;
