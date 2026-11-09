// Fundamentação do simulador de DHCP, em Markdown: aparece na documentação (docs/simuladores/dhcp.md e na wiki), antes de
// "Como ler os diagramas". Explica a concessão (DORA), o lease e o teste do endereço.
export const fundamentacao: string = `
### O problema que o DHCP resolve

Para falar em uma rede IP, um host precisa de **endereço**, **máscara**, **gateway** e **servidores DNS**. Configurar isso à mão em cada dispositivo é trabalhoso e propenso a erro (endereços repetidos, máscaras erradas). O DHCP (*Dynamic Host Configuration Protocol*, RFC 2131) entrega essa configuração **automaticamente**, a partir de um servidor que administra um **pool** de endereços. As opções que carregam cada parâmetro estão na RFC 2132.

O endereço é **emprestado** por um tempo (*lease*) e precisa ser renovado: quando o host sai da rede, o endereço volta ao pool.

### O diagrama da concessão: DORA

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente, sem IP
  participant S as Servidor DHCP
  C->>S: DISCOVER, broadcast: 0.0.0.0 para 255.255.255.255
  S->>C: OFFER: endereço oferecido (yiaddr) e opções
  C->>S: REQUEST, broadcast: escolhe esta oferta (opção 54)
  S->>C: ACK: confirma e grava o lease
  Note over C: opcional: ARP Probe para testar o endereço antes de usar
\`\`\`

*Esquema 1 (as quatro mensagens da concessão).* **D**iscover, **O**ffer, **R**equest, **A**cknowledge. O cliente ainda **não tem IP**, então começa com o endereço de origem 0.0.0.0 e usa **broadcast**. O servidor escuta na porta UDP **67** e o cliente, na porta **68** (RFC 2131, seção 4.1). A mensagem REQUEST também é enviada em broadcast, e a opção 54 (*Server Identifier*) avisa os servidores **não escolhidos** para liberarem as suas reservas.

Quando há **mais de um servidor**, cada um responde com uma oferta, e o cliente escolhe uma. O fluxo completo está na RFC 2131, seção 3.1.

### Os estados do cliente

\`\`\`mermaid
stateDiagram-v2
  [*] --> INIT
  INIT --> SELECTING: envia DISCOVER
  SELECTING --> REQUESTING: recebe OFFER, envia REQUEST
  REQUESTING --> BOUND: recebe ACK
  BOUND --> RENEWING: T1 vence
  RENEWING --> BOUND: recebe ACK
  RENEWING --> REBINDING: T2 vence
  REBINDING --> BOUND: recebe ACK
  REBINDING --> INIT: lease expira
\`\`\`

*Esquema 2 (ciclo de vida do lease).* É um recorte da máquina de estados da RFC 2131, seção 4.4 (Figura 5). Quando o endereço está em uso (**BOUND**), dois temporizadores controlam a renovação:

| Temporizador | Valor padrão | O que o cliente faz |
| --- | --- | --- |
| T1 | 50% do lease | entra em RENEWING e pede a renovação, em **unicast**, ao servidor original |
| T2 | 87,5% do lease | sem resposta, entra em REBINDING e pede, em **broadcast**, a qualquer servidor |
| Expiração | 100% do lease | abandona o endereço e volta a INIT |

### Conflito de endereço e DECLINE

Antes de usar o endereço recebido, o cliente pode testá-lo com um **ARP Probe** (RFC 5227; veja o simulador de ARP). Se alguém responder, o endereço já está em uso: o cliente envia **DHCPDECLINE**, e o servidor marca o endereço como indisponível. Quando o cliente sai de propósito, envia **DHCPRELEASE**, e o servidor devolve o endereço ao pool.

### O que o DHCP não faz

O DHCP **não autentica** quem pede nem quem responde. Um servidor falso na mesma rede pode oferecer um gateway ou um DNS errado e desviar o tráfego dos clientes. A defesa está no switch (**DHCP snooping**, uma técnica de fabricantes, que aceita OFFER e ACK só de portas confiáveis), e não no protocolo.

### Como ler o diagrama do simulador

- **Topologia:** o cliente, o switch e os servidores DHCP. A legenda de cores distingue DISCOVER, OFFER, REQUEST, ACK, DECLINE ou falha, e RELEASE ou ARP.
- **Aba Leases:** o pool e os leases concedidos, com o tempo restante, no instante atual.
- **Modos:** *Concessão (DORA)*, com um ou mais servidores e os casos de falha, e *Ciclo do lease*, com a renovação, o rebinding e a expiração.

### Limites do modelo e do diagrama

- Na renovação, **não há retransmissão** em RENEWING e REBINDING (a RFC 2131, seção 4.4.5, manda repetir a cada metade do tempo restante, com mínimo de 60 s).
- O DHCPv6 (RFC 8415, substituída pela RFC 9915) está fora de escopo, assim como o BOOTP puro. O agente de retransmissão (*relay*, RFC 1542 e opção 82 da RFC 3046), o INIT-REBOOT, o DHCPNAK e o atraso aleatório de 1 a 10 s antes do primeiro DISCOVER não são simulados.
- Os tempos de lease são **curtos e didáticos**. Os temporizadores T1 e T2 seguem os valores padrão da RFC 2131.
`;
