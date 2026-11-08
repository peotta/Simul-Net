// Fundamentação do simulador de Wi-Fi (operação 802.11), em Markdown: aparece na documentação (docs/simuladores/wifi.md e na
// wiki), antes de "Como ler os diagramas". Explica a descoberta, o acesso ao meio, o roaming, a energia e os canais.
export const fundamentacao: string = `
### O problema que o 802.11 resolve

Em uma rede cabeada, cada enlace é um meio dedicado. Em uma rede sem fio, **todos compartilham o ar**: ninguém consegue ouvir e falar ao mesmo tempo no mesmo canal, o sinal chega com intensidades diferentes e as mensagens se perdem por interferência. O **IEEE 802.11** (Wi-Fi é a marca da Wi-Fi Alliance) define a camada de enlace (MAC) e a camada física dessas redes. Este simulador trata da **operação da camada MAC**: descobrir e entrar em uma rede, disputar o meio, trocar de AP, economizar energia e escolher canais.

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

*Esquema 2 (disputa do meio).* Antes de transmitir, a estação ouve o meio por um intervalo (**DIFS**) e depois espera um **backoff** aleatório. O **SIFS**, mais curto, é o intervalo antes de uma resposta (como o ACK), o que garante a prioridade da resposta sobre os novos quadros. Cada quadro de dados precisa de um **ACK**: sem ele, o emissor assume que houve perda e **dobra** a janela do sorteio.

### Terminal escondido e RTS/CTS

\`\`\`mermaid
sequenceDiagram
  participant A as Estação A
  participant P as AP
  participant B as Estação B
  A->>P: RTS
  P->>A: CTS
  Note over B: ouve o CTS, ajusta o NAV e fica em silêncio
  A->>P: Data
  P->>A: ACK
\`\`\`

*Esquema 3 (reserva do meio).* Duas estações podem não se ouvir, mas ambas ouvem o AP: é o problema do **terminal escondido**. O **RTS** pede a reserva e o **CTS**, que o AP envia, é ouvido por todos: quem o ouve acerta o seu **NAV** (*Network Allocation Vector*, um temporizador de silêncio virtual) e espera. O custo são dois quadros extras por transmissão.

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

*Esquema 4 (canais sem sobreposição em 2,4 GHz).* Em 2,4 GHz, os canais adjacentes se sobrepõem. Os canais **1, 6 e 11** são o conjunto que não se sobrepõe, e por isso são os preferidos. Dois APs no mesmo canal (ou em canais sobrepostos) **dividem o tempo de ar**: cada um ouve o outro e adia a transmissão, e o desempenho cai.

### Como ler o diagrama do simulador

- **Topologia:** clientes, pontos de acesso e a rede cabeada. A legenda distingue gerência (beacon, probe, autenticação, associação), controle (ACK, RTS, CTS, PS-Poll), dados e Ethernet, o handshake de chaves (EAPOL-Key) e colisão, quadro perdido ou descartado.
- **Aba Estados:** o estado do cliente (sem autenticar, autenticado, associado) a cada instante.
- **Aba Temporização:** SIFS, DIFS, slot, backoff e a duração de cada quadro.
- **Aba Canais:** a ocupação e a sobreposição dos canais.
- **Aba Energia:** o ciclo de sono e vigília do cliente e os quadros guardados no AP.
- **Modos:** *Descoberta e associação*, *Acesso ao meio*, *Roaming e energia* e *Canais*.

### Limites do modelo e do diagrama

- É **um BSS por vez** (ou duas redes vizinhas, no modo Canais), um fluxo por cliente e taxas fixas: 54 Mb/s nos dados e 6 Mb/s nos quadros de controle e de gerência. Não há agregação, fragmentação, QoS (EDCA) nem camada física detalhada.
- Os tempos usam os valores do OFDM em 5 GHz (SIFS de 16 µs e slot de 9 µs) em todos os cenários, inclusive nos de 2,4 GHz, onde o SIFS é de 10 µs. O foco são as **proporções**.
- Os sorteios do backoff são fixos por cenário, para o resultado ser reproduzível. Os tempos de varredura, roaming e handshake são ilustrativos e menores que os de equipamentos reais.
- Não há Wi-Fi 6, 6E e 7 (OFDMA, MU-MIMO, TWT, múltiplos links), mesh, modo ad hoc nem Wi-Fi Direct. O handshake de quatro vias é resumido, sem criptografia real, PMF, SAE e OWE.
- Os MACs são de documentação (RFC 9542). O texto do IEEE 802.11 não é de acesso livre: confira a edição vigente antes de citar uma cláusula.
`;
