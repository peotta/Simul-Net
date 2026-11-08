// Fundamentação do simulador ARP, em Markdown: aparece na documentação (docs/simuladores/arp.md e na wiki), antes de
// "Como ler os diagramas". Explica a resolução IP para MAC, o ARP gratuito e o limite de confiança do protocolo.
export const fundamentacao: string = `
### O problema que o ARP resolve

Em uma rede local, o quadro Ethernet precisa do **endereço MAC** do destino, mas a aplicação só conhece o **endereço IP**. O ARP (*Address Resolution Protocol*, RFC 826) responde à pergunta "quem tem este IP? me diga o seu MAC". Ele fica entre a camada 2 e a camada 3 e vale **só dentro de um enlace**: um ARP nunca atravessa um roteador.

Para falar com um destino de **outra** rede, o host não resolve o MAC do destino final: resolve o MAC do **gateway** (veja o simulador de IPv4 para a decisão entre entrega direta e gateway).

### O diagrama da resolução

\`\`\`mermaid
sequenceDiagram
  participant A as Host A
  participant L as Rede local (broadcast)
  participant B as Host B
  A->>L: ARP Request: quem tem 192.168.1.20?
  Note over L: ff:ff:ff:ff:ff:ff, todos recebem
  L->>B: o quadro chega ao Host B
  B->>A: ARP Reply: 192.168.1.20 está em MAC-B
  Note over A: guarda IP e MAC na tabela ARP
  A->>B: quadro IP com MAC-B de destino
\`\`\`

*Esquema 1 (resolução de um endereço).* A pergunta é um **broadcast**, e a resposta é **unicast** direto ao solicitante. O resultado fica na **tabela ARP** (cache) por um tempo, para não perguntar de novo a cada pacote.

O algoritmo da RFC 826 tem uma particularidade: ao receber qualquer pacote ARP, o host **atualiza** a entrada do remetente, se ela já existir, antes mesmo de olhar o código da operação. Só adiciona uma entrada nova se o pacote for dirigido a ele. Isso economiza mensagens, mas é a raiz do problema de confiança descrito mais abaixo.

### O pacote ARP

| Campo | Tamanho | Valor no Ethernet com IPv4 |
| --- | --- | --- |
| Tipo de hardware | 16 bits | 1 (Ethernet) |
| Tipo de protocolo | 16 bits | 0x0800 (IPv4) |
| Tamanho do endereço de hardware | 8 bits | 6 |
| Tamanho do endereço de protocolo | 8 bits | 4 |
| Operação | 16 bits | 1 (pedido) ou 2 (resposta) |
| MAC e IP do remetente | 6 e 4 bytes | quem envia |
| MAC e IP do alvo | 6 e 4 bytes | MAC desconhecido (zeros) no pedido |

No pedido, o MAC do alvo é o que se procura, por isso fica vazio. Na resposta, ele traz o MAC de quem pediu. O quadro Ethernet que carrega o ARP usa o tipo 0x0806.

### ARP gratuito, probe e conflito de endereço

\`\`\`mermaid
sequenceDiagram
  participant N as Host novo
  participant R as Rede local
  participant D as Dono atual do IP
  N->>R: ARP Probe, IP de origem 0.0.0.0, pergunta pelo IP desejado
  alt ninguém responde
    N->>R: ARP Announcement, origem e alvo iguais ao IP
    Note over N,R: o endereço passa a ser usado
  else alguém responde
    D->>N: ARP Reply
    Note over N: conflito: o endereço não deve ser usado
  end
\`\`\`

*Esquema 2 (detecção de conflito).* Segundo a RFC 5227, antes de usar um endereço o host envia **3 sondas** (*probes*) espaçadas de 1 a 2 segundos, com o IP de origem zerado para não contaminar o cache dos outros (seção 2.1.1). Se ninguém reclamar, envia **2 anúncios** com intervalo de 2 segundos (seção 2.3). Depois, continua a vigiar conflitos e defende o endereço (seção 2.4).

O anúncio é feito com um **pedido** (e não com uma resposta), e serve para atualizar os caches dos vizinhos quando um endereço muda de MAC, como acontece na troca de um equipamento ou em um failover de gateway.

### O limite de confiança: o ARP não autentica

O ARP não tem nenhuma forma de verificar quem responde. Qualquer host do enlace pode enviar uma resposta dizendo que um IP está em seu MAC, e os outros hosts a aceitam. É um limite do projeto original, e não um defeito de implementação.

\`\`\`mermaid
flowchart TD
  F["Resposta ARP falsa:<br/>o IP do gateway estaria no MAC de outro host"] --> C["Cache dos vizinhos é atualizado"]
  C --> E["O tráfego para o gateway passa<br/>a ser enviado a esse host"]
  E --> D["Defesas na camada 2"]
  D --> D1["Inspeção dinâmica de ARP<br/>no switch: valida contra a tabela do DHCP"]
  D --> D2["Entradas estáticas para<br/>o gateway em máquinas críticas"]
  D --> D3["Segurança de portas e<br/>segmentação em VLANs"]
  D --> D4["Monitoramento de mudanças<br/>de MAC para um mesmo IP"]
\`\`\`

*Esquema 3 (limite de confiança e defesas).* O diagrama mostra o efeito e as defesas, no nível defensivo. O simulador mostra, no modo **Envenenamento de cache**, como a tabela de um host muda depois de uma resposta não solicitada, e como uma proteção na rede impede essa mudança.

### Como ler o diagrama do simulador

- **Topologia:** hosts, um switch e o gateway, na mesma rede local. O ARP é enviado a todas as portas do switch, e a resposta segue só pelo caminho do solicitante.
- **Diagrama de sequência:** as setas são os pacotes ARP, e o quadro de dados só aparece depois da resolução.
- **Aba Tabela ARP:** mostra o cache de cada host no instante atual, no formato do \`ip neigh\` do Linux, com o estado de cada entrada (INCOMPLETE, REACHABLE, STALE ou FAILED).
- **Modos:** *Resolução*, *ARP gratuito e conflito* e *Envenenamento de cache*.

### Limites do modelo e do diagrama

- A RFC 826 não tem seções numeradas, então as citações se referem aos títulos ("Packet Reception"). A RFC 5227 tem seções numeradas, e elas são citadas.
- O simulador trata de **IPv4 sobre Ethernet**. O IPv6 usa outro mecanismo, o *Neighbor Discovery* (RFC 4861), no lugar do ARP.
- Os tempos de validade do cache e os atrasos são **didáticos**: cada sistema operacional usa os seus próprios valores.
`;
