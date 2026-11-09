// Fundamentação do simulador RIP, em Markdown: aparece na documentação (docs/simuladores/rip.md e na wiki), antes de
// "Como ler os diagramas". Explica o vetor de distância, a contagem ao infinito e o split horizon.
export const fundamentacao: string = `
### O problema que o RIP resolve

O RIP (*Routing Information Protocol*, versão 2, RFC 2453) é um protocolo de roteamento dinâmico de **vetor de distância**, usado dentro de um sistema autônomo (um IGP). Como no OSPF, o objetivo é que os roteadores descubram as rotas sozinhos. A diferença está no que cada um sabe: no RIP, o roteador **não tem o mapa da rede**. Conhece só o que os **vizinhos anunciam**: uma lista de destinos com a distância até cada um.

É um protocolo simples e antigo, adequado a redes pequenas. Seu valor didático está em mostrar por que a convergência pode ser lenta, e como os limites do protocolo (o infinito em 16) tentam conter os erros.

### O diagrama de uma rodada de atualização

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as R1
  participant B as R2
  participant C as R3
  A->>B: Response: R1 está a 0 saltos
  B->>A: Response: R2 a 0 e R3 a 1
  B->>C: Response: R2 a 0 e R1 a 1
  C->>B: Response: R3 a 0
  Note over A,C: cada roteador soma 1 ao que recebe e guarda o melhor
\`\`\`

*Esquema 1 (troca de vetores de distância).* A cada rodada, cada roteador envia a seus vizinhos a sua tabela (destino e distância). O vizinho soma **1** à métrica recebida e adota a rota se ela for melhor que a atual. É o algoritmo de **Bellman-Ford distribuído**: nenhum roteador vê o caminho inteiro, só o próximo salto.

### Métrica, mensagens e temporizadores

| Item | Valor | Seção da RFC 2453 |
| --- | --- | --- |
| Métrica | número de saltos; 16 significa inalcançável | 3.1 |
| Alcance máximo | 15 saltos | 3.1 |
| Mensagens | Request e Response, em UDP porta 520 | 3.6 |
| Endereço do RIPv2 | multicast 224.0.0.9 | 4.5 |
| Rotas por mensagem | até 25 | 3.6 |
| Atualização periódica | a cada 30 s | 3.8 |
| Timeout de uma rota | 180 s sem atualização | 3.8 |
| Coleta de lixo | mais 120 s antes de remover | 3.8 |
| Atualização disparada | imediata após mudança, com atraso aleatório de 1 a 5 s | 3.4.4 e 3.10.1 |

A versão 2 acrescenta à versão 1 a **máscara de sub-rede**, o próximo salto, a etiqueta de rota e a autenticação.

### Contagem ao infinito

\`\`\`mermaid
flowchart TD
  F["O destino X fica inalcançável"] --> V["O vizinho que o alcançava<br/>para de anunciar X"]
  V --> I["Outro roteador ainda anuncia uma rota<br/>para X que passava por ele"]
  I --> L["Os dois aceitam a rota um do outro<br/>com métrica maior"]
  L --> C["A métrica sobe a cada rodada: 3, 4, 5 ..."]
  C --> M["Chega a 16: inalcançável"]
\`\`\`

*Esquema 2 (contagem ao infinito).* Quando um destino some, os roteadores que ainda guardam uma rota para ele podem aceitar, do próprio vizinho, um caminho que depende deles mesmos. Cada um anuncia ao outro uma rota mais longa, e a métrica sobe até 16 (RFC 2453, seção 3.4.2). Enquanto isso, o tráfego para o destino é perdido ou fica em laço. É por isso que o infinito do RIP é tão pequeno: ele limita quanto tempo esse erro dura.

### Split horizon e poison reverse

\`\`\`mermaid
flowchart LR
  subgraph SEM["Sem split horizon"]
    S1["R2 aprendeu X por R1"] --> S2["R2 anuncia X de volta a R1"]
  end
  subgraph SH["Split horizon"]
    H1["R2 aprendeu X por R1"] --> H2["R2 não anuncia X a R1"]
  end
  subgraph PR["Poison reverse"]
    P1["R2 aprendeu X por R1"] --> P2["R2 anuncia X a R1 com métrica 16"]
  end
\`\`\`

*Esquema 3 (as três variantes).* O **split horizon** não anuncia a um vizinho as rotas aprendidas dele. O **poison reverse** as anuncia com métrica 16, o que desfaz uma rota errada mais depressa (RFC 2453, seção 3.4.3).

As duas técnicas evitam o laço entre **dois** vizinhos, mas não os laços de **três ou mais** roteadores. A topologia do simulador contém esses laços, e por isso a contagem ao infinito ainda acontece, mesmo com a técnica ligada. As **atualizações disparadas** (seção 3.4.4) aceleram a notícia de uma mudança, mas também não eliminam o problema.

### Como ler o diagrama do simulador

- **Topologia:** seis roteadores e os dois PCs. O RIP conta só **saltos**, então o caminho escolhido pode não ser o de maior velocidade.
- **Diagrama de sequência e legenda de cores:** *Response* periódica, *Response* disparada por mudança e pacote de dados.
- **Aba Tabela de roteamento:** destino, próximo salto e métrica, a cada rodada.
- **Aba Vetores:** o vetor que o roteador escolhido anuncia a cada vizinho, com ou sem split horizon.
- **Modos:** *Convergência* (tabelas até estabilizar) e *Falha e contagem ao infinito* (a métrica que sobe até 16, com e sem split horizon).

### Limites do modelo e do diagrama

- As rodadas são **síncronas**: todos enviam e recebem ao mesmo tempo. Em uma rede real, cada roteador tem seu relógio de 30 s.
- Não há timeout de 180 s nem coleta de lixo de 120 s. A falha é detectada na hora, e as rotas inalcançáveis ficam na tabela com métrica 16.
- Cada roteador anuncia um destino (o próprio Router ID). Não há Request, etiqueta de rota, rotas externas nem autenticação.
- Técnicas de fabricantes, como o *holddown*, não são simuladas. O RIPng (IPv6) está fora do escopo.
`;
