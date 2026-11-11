// Fundamentação do simulador de Wi-Fi (operação 802.11), em Markdown: aparece na documentação (docs/simuladores/wifi.md e na
// wiki), antes de "Como ler os diagramas". Explica a descoberta, o acesso ao meio, o roaming, a energia e os canais.
export const fundamentacao: string = `
### O problema que o 802.11 resolve

Em uma rede cabeada, cada enlace é um meio dedicado. Em uma rede sem fio, **todos compartilham o ar**: ninguém consegue ouvir e falar ao mesmo tempo no mesmo canal, o sinal chega com intensidades diferentes e as mensagens se perdem por interferência. O **IEEE 802.11** (Wi-Fi é a marca da Wi-Fi Alliance) define a camada de enlace (MAC) e a camada física dessas redes. Este simulador trata da **operação da camada MAC**: descobrir e entrar em uma rede, disputar o meio, trocar de AP, economizar energia e escolher canais.

**O que você aprende com este simulador.**

- Explicar por que o meio sem fio exige evitar a colisão (CSMA/CA) em vez de detectá-la.
- Acompanhar a descoberta, a autenticação e a associação de um cliente a um AP.
- Ler o cabeçalho do quadro 802.11 e o significado dos endereços conforme os bits To DS e From DS.
- Entender o backoff, o NAV, o RTS/CTS e o problema do terminal escondido.
- Interpretar o roaming, a economia de energia e a escolha de canais sem sobreposição.

### Os atores

| Termo | Significado |
| --- | --- |
| STA | estação: o cliente (notebook, celular) |
| AP | ponto de acesso: liga os clientes sem fio à rede cabeada |
| BSS e BSSID | o conjunto de um AP e seus clientes; o BSSID é o endereço MAC do AP |
| SSID | o nome da rede, de até 32 bytes |
| ESS | vários APs com o mesmo SSID, em que o cliente pode circular |
| DS | sistema de distribuição: a rede, em geral cabeada, que liga os APs |

### O diagrama da entrada em uma rede

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente
  participant A as AP
  A->>C: Beacon, periódico: SSID, taxas, capacidades
  C->>A: Probe Request, descoberta ativa
  A->>C: Probe Response
  C->>A: Authentication
  A->>C: Authentication
  C->>A: Association Request
  A->>C: Association Response, com o AID
  Note over C,A: handshake de quatro vias: EAPOL-Key, 4 quadros
  C->>A: Data
  A->>C: ACK
\`\`\`

*Esquema 1 (descoberta, associação e dados).* O cliente descobre a rede de dois modos: **passivo** (escuta os Beacons que o AP envia periodicamente) ou **ativo** (envia um Probe Request e recebe um Probe Response). Depois vêm a **autenticação** (no 802.11, só uma etapa inicial) e a **associação**, em que o AP concede ao cliente um identificador (AID). Em redes protegidas, o **handshake de quatro vias** deriva as chaves de cifra. A segurança (WPA2 e WPA3) está em outro simulador.

Os quadros 802.11 são de três tipos:

| Tipo | Exemplos | Função |
| --- | --- | --- |
| Gerência | Beacon, Probe, Authentication, Association, Reassociation | descobrir, entrar, sair e negociar recursos |
| Controle | RTS, CTS, ACK, PS-Poll | coordenar o acesso ao meio; são curtos e sem corpo |
| Dados | Data, Null | carregar os dados e sinalizar o modo de energia |

### O quadro 802.11

Os quadros 802.11 têm um cabeçalho MAC próprio, diferente do Ethernet. O desenho mostra o quadro de dados, em linhas de 32 bits, na ordem de transmissão (IEEE 802.11).

\`\`\`mermaid
packet-beta
  0-1: "Versão"
  2-3: "Tipo"
  4-7: "Subtipo"
  8-15: "Sinalização (flags)"
  16-31: "Duração ou ID"
  32-79: "Endereço 1 (receptor)"
  80-127: "Endereço 2 (transmissor)"
  128-175: "Endereço 3"
  176-191: "Controle de sequência"
  192-223: "Corpo do quadro (variável)"
  224-255: "FCS"
\`\`\`

*Esquema 2 (o quadro de dados 802.11).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. Os oito bits de sinalização (8 a 15) aparecem juntos porque um bit sozinho não comporta o texto; na ordem, são To DS, From DS, More Frag, Retry, Pwr Mgt, More Data, Protected e Order. O corpo do quadro também é **condensado** no desenho, e há campos opcionais que dependem do tipo: o Endereço 4 (só quando To DS e From DS valem 1, em um enlace entre APs), o controle de QoS (nos quadros de dados com QoS) e o controle HT. A tabela abaixo descreve os campos do desenho.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Versão | 0 a 1 | 2 bits | versão do protocolo do quadro, sempre 0 |
| Tipo | 2 a 3 | 2 bits | classe do quadro: 00 gerência, 01 controle, 10 dados |
| Subtipo | 4 a 7 | 4 bits | função dentro do tipo (por exemplo Beacon, ACK ou dados com QoS) |
| To DS | 8 | 1 bit | 1 quando o quadro vai para o sistema de distribuição (do cliente para o AP) |
| From DS | 9 | 1 bit | 1 quando o quadro vem do sistema de distribuição (do AP para o cliente) |
| More Frag | 10 | 1 bit | 1 quando ainda há fragmentos do mesmo quadro a seguir |
| Retry | 11 | 1 bit | 1 quando o quadro é uma retransmissão |
| Pwr Mgt | 12 | 1 bit | 1 quando o cliente avisa que vai entrar em modo de economia de energia |
| More Data | 13 | 1 bit | 1 quando o AP avisa que há mais quadros guardados para o cliente |
| Protected | 14 | 1 bit | 1 quando o corpo do quadro está cifrado |
| Order | 15 | 1 bit | 1 quando o quadro pertence à classe de serviço de ordem estrita (raro) |
| Duração ou ID | 16 a 31 | 2 bytes | o tempo que o meio ficará reservado (base do NAV), ou o AID no PS-Poll |
| Endereço 1 | 32 a 79 | 6 bytes | receptor imediato do quadro |
| Endereço 2 | 80 a 127 | 6 bytes | transmissor do quadro |
| Endereço 3 | 128 a 175 | 6 bytes | BSSID, origem ou destino final, conforme To DS e From DS (tabela abaixo) |
| Controle de sequência | 176 a 191 | 2 bytes | número do fragmento (4 bits) e número de sequência (12 bits), para detectar duplicatas e remontar fragmentos |
| Corpo do quadro | 192 a 223 (condensado) | variável | os dados transportados (por exemplo um pacote IP, precedido do cabeçalho LLC/SNAP), cifrados quando Protected vale 1 |
| FCS | 224 a 255 (depois do corpo) | 4 bytes | verificação do quadro, um CRC de 32 bits |

Os campos de 8 a 15 formam o byte de sinalização do Controle do quadro; junto com Versão, Tipo e Subtipo, ele ocupa 2 bytes. A posição do corpo e do FCS no desenho é apenas ilustrativa, porque o corpo tem tamanho variável.

O papel de cada endereço muda com os bits To DS e From DS:

| Sentido | To DS | From DS | Endereço 1 | Endereço 2 | Endereço 3 |
| --- | --- | --- | --- | --- | --- |
| Cliente para o AP | 1 | 0 | BSSID (o AP) | origem (o cliente) | destino final |
| AP para o cliente | 0 | 1 | destino (o cliente) | BSSID (o AP) | origem original |
| Gerência (Beacon, Probe, Association) | 0 | 0 | destino | origem | BSSID |

Por isso o quadro **leva três endereços**: o terceiro é o dispositivo do outro lado do AP, na rede cabeada, que o Ethernet não precisa. Os quadros de controle são curtos: o ACK e o CTS têm só o controle do quadro, a duração, o endereço do receptor e o FCS (14 bytes), e o RTS acrescenta o endereço do transmissor (20 bytes).

### O acesso ao meio: CSMA/CA

Como o rádio não detecta colisão enquanto transmite, o Wi-Fi **evita** a colisão (CSMA/CA, *Carrier Sense Multiple Access with Collision Avoidance*), em vez de detectá-la, como a Ethernet antiga.

\`\`\`mermaid
flowchart TD
  Q["Estação tem um quadro para enviar"] --> S{"Meio livre durante o DIFS?"}
  S -- "não" --> W["Espera o meio ficar livre"]
  W --> S
  S -- "sim" --> B["Sorteia o backoff e conta<br/>só enquanto o meio está livre"]
  B --> Z{"Contador zerou?"}
  Z -- "não" --> B
  Z -- "sim" --> T["Transmite"]
  T --> K{"Chegou o ACK, depois do SIFS?"}
  K -- "sim" --> OK["Sucesso: janela de contenção volta ao mínimo"]
  K -- "não" --> R["Colisão ou perda: dobra a janela<br/>e tenta de novo"]
\`\`\`

*Esquema 3 (disputa do meio).* Antes de transmitir, a estação ouve o meio por um intervalo (**DIFS**) e depois espera um **backoff** aleatório. O **SIFS**, mais curto, é o intervalo antes de uma resposta (como o ACK), o que garante a prioridade da resposta sobre os novos quadros. Cada quadro de dados precisa de um **ACK**: sem ele, o emissor assume que houve perda e **dobra** a janela do sorteio.

### Terminal escondido e RTS/CTS

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant A as Estação A
  participant P as AP
  participant B as Estação B
  A->>P: RTS
  P->>A: CTS
  Note over B: ouve o CTS, ajusta o NAV e fica em silêncio
  A->>P: Data
  P->>A: ACK
\`\`\`

*Esquema 4 (reserva do meio).* Duas estações podem não se ouvir, mas ambas ouvem o AP: é o problema do **terminal escondido**. O **RTS** pede a reserva e o **CTS**, que o AP envia, é ouvido por todos: quem o ouve acerta o seu **NAV** (*Network Allocation Vector*, um temporizador de silêncio virtual) e espera. O custo são dois quadros extras por transmissão.

### Roaming e economia de energia

- **Roaming:** quando o sinal do AP cai, o cliente procura outro AP **com o mesmo SSID** e envia uma **Reassociation** a ele. O AP novo e o antigo trocam informações pela rede cabeada. O tempo de troca é o que o usuário sente como corte em uma chamada.
- **Economia de energia:** o cliente avisa que vai dormir com um quadro Null (bit de gerência de energia). O AP **guarda** os quadros que chegam e indica nos Beacons (no mapa de tráfego) que há dados. O cliente acorda, consulta (**PS-Poll**) e recebe os quadros guardados.

### Os canais

\`\`\`mermaid
flowchart LR
  subgraph B24["Banda de 2,4 GHz: canais de 20 MHz se sobrepõem"]
    C1["Canal 1"]
    C6["Canal 6"]
    C11["Canal 11"]
  end
  C1 -. "sem sobreposição" .- C6
  C6 -. "sem sobreposição" .- C11
\`\`\`

*Esquema 5 (canais sem sobreposição em 2,4 GHz).* Em 2,4 GHz, os canais adjacentes se sobrepõem. Os canais **1, 6 e 11** são o conjunto que não se sobrepõe, e por isso são os preferidos. Dois APs no mesmo canal (ou em canais sobrepostos) **dividem o tempo de ar**: cada um ouve o outro e adia a transmissão, e o desempenho cai.

### O que cada modo e aba do simulador mostram

- **Topologia:** clientes, pontos de acesso e a rede cabeada. A legenda distingue gerência (beacon, probe, autenticação, associação), controle (ACK, RTS, CTS, PS-Poll), dados e Ethernet, o handshake de chaves (EAPOL-Key) e colisão, quadro perdido ou descartado.
- **Diagrama de sequência:** cada seta é um quadro 802.11, com o tipo e a duração no ar.
- **Aba Estados:** o estado do cliente (sem autenticar, autenticado, associado) a cada instante.
- **Aba Temporização:** SIFS, DIFS, slot, backoff e a duração de cada quadro.
- **Aba Canais:** a ocupação e a sobreposição dos canais.
- **Aba Energia:** o ciclo de sono e vigília do cliente e os quadros guardados no AP.
- **Modos:** *Descoberta e associação*, *Acesso ao meio*, *Roaming e energia* e *Canais*.

Para a entrada na rede, use "Varredura passiva e rede aberta", "Varredura ativa com Probe Request" e "Rede com SSID oculto". Para o acesso ao meio, use "Esperar, sortear o backoff, transmitir e receber o ACK" e "O ACK se perde e o frame é repetido". Para as colisões, use "Dois clientes escolhem o mesmo slot" e "A mesma colisão, agora com RTS/CTS". Para o terminal escondido, use "Nó oculto sem RTS/CTS" e "Nó oculto com RTS/CTS". Para o roaming, use "O cliente se afasta e troca de AP" e "Cliente preso ao AP distante". Para a energia, use "Cliente que acorda a cada beacon". Para os canais, use "Canais 1 e 6: independentes", "Mesmo canal: as redes dividem o tempo" e "Canais 1 e 3: sobrepostos".

### Limites do modelo e do diagrama

- É **um BSS por vez** (ou duas redes vizinhas, no modo Canais), um fluxo por cliente e taxas fixas: 54 Mb/s nos dados e 6 Mb/s nos quadros de controle e de gerência. Não há agregação, fragmentação, QoS (EDCA) nem camada física detalhada.
- Os tempos usam os valores do OFDM em 5 GHz (SIFS de 16 µs e slot de 9 µs) em todos os cenários, inclusive nos de 2,4 GHz, onde o SIFS é de 10 µs. O foco são as **proporções**.
- Os sorteios do backoff são fixos por cenário, para o resultado ser reproduzível. Os tempos de varredura, roaming e handshake são ilustrativos e menores que os de equipamentos reais.
- Não há Wi-Fi 6, 6E e 7 (OFDMA, MU-MIMO, TWT, múltiplos links), mesh, modo ad hoc nem Wi-Fi Direct. O handshake de quatro vias é resumido, sem criptografia real, PMF, SAE e OWE.
- Os MACs são de documentação (RFC 9542). O texto do IEEE 802.11 não é de acesso livre: confira a edição vigente antes de citar uma cláusula.
`;
