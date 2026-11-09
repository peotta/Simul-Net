// Fundamentação do simulador de 802.1X e RADIUS, em Markdown: aparece na documentação (docs/simuladores/802-1x.md e na wiki),
// antes de "Como ler os diagramas". Explica os três papéis, o EAP sobre o enlace e sobre o RADIUS e a porta controlada.
export const fundamentacao: string = `
### O problema que o 802.1X resolve

Em uma rede cabeada ou Wi-Fi, qualquer dispositivo que se conecte a uma porta já estaria "dentro". O **IEEE 802.1X** é o **controle de acesso à rede baseado em porta**: a porta de um switch (ou de um ponto de acesso) fica **fechada** para dados e só os libera depois de o dispositivo se **autenticar**. A autenticação em si é feita pelo **EAP** (*Extensible Authentication Protocol*, RFC 3748), e o servidor costuma falar **RADIUS** (RFC 2865).

### Os três papéis

\`\`\`mermaid
flowchart LR
  S["Suplicante<br/>quem quer entrar"] -- "EAPOL, no enlace" --> A["Autenticador<br/>switch ou ponto de acesso"]
  A -- "RADIUS, em UDP" --> R["Servidor de autenticação<br/>RADIUS"]
  A -. "porta controlada:<br/>abre ou fecha" .-> N["Rede protegida"]
\`\`\`

*Esquema 1 (os papéis do 802.1X).* O **suplicante** é o dispositivo que quer entrar e prova a identidade. O **autenticador** mantém a porta fechada, repassa o EAP ao servidor e abre a porta conforme o resultado: ele **não interpreta** o método EAP. O **servidor RADIUS** conduz o método EAP e decide entre aceitar e rejeitar.

### Porta controlada e não controlada

O autenticador expõe duas portas lógicas. A **não controlada** aceita sempre o EAPOL (EAP sobre LAN, EtherType 0x888E). A **controlada** só encaminha os dados depois da autorização.

\`\`\`mermaid
stateDiagram-v2
  [*] --> Nao_autorizada
  Nao_autorizada --> Em_autenticacao: suplicante inicia (EAPOL-Start)
  Em_autenticacao --> Autorizada: servidor envia Access-Accept
  Em_autenticacao --> Nao_autorizada: Access-Reject ou falha
  Autorizada --> Em_autenticacao: reautenticação
  Autorizada --> Nao_autorizada: EAPOL-Logoff ou link cai
\`\`\`

*Esquema 2 (estados da porta).* Quem **abre** a porta é o **Access-Accept** do servidor, e não o EAP-Success enviado ao suplicante: o autenticador decide a autorização a partir da resposta do servidor.

### O diálogo completo

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant S as Suplicante
  participant A as Autenticador
  participant R as Servidor RADIUS
  S->>A: EAPOL-Start
  A->>S: EAP-Request, Identity
  S->>A: EAP-Response, Identity
  A->>R: Access-Request, com o EAP
  R->>A: Access-Challenge, método EAP
  A->>S: EAP-Request, método
  S->>A: EAP-Response, método
  A->>R: Access-Request
  Note over S,R: o método se repete até concluir, no caso do EAP-TLS com o handshake TLS
  R->>A: Access-Accept, com EAP-Success
  A->>S: EAP-Success
  Note over A: a porta controlada se abre
\`\`\`

*Esquema 3 (de EAPOL-Start ao Access-Accept).* O EAP funciona em **ordem estrita** (um Request, um Response). O mesmo EAP viaja por **duas camadas de transporte**:

| Trecho | Transporte | Como o EAP viaja |
| --- | --- | --- |
| Suplicante e autenticador | EAPOL, direto sobre o quadro Ethernet | um quadro EAPOL por mensagem EAP |
| Autenticador e servidor | RADIUS, em UDP (porta 1812 na RFC 2865) | dentro do atributo EAP-Message (RFC 3579) |

Os códigos do EAP são Request (1), Response (2), Success (3) e Failure (4) (RFC 3748, seção 4). Os códigos do RADIUS são Access-Request (1), Access-Accept (2), Access-Reject (3) e Access-Challenge (11) (RFC 2865, seção 4).

### Os métodos EAP

O 802.1X **não escolhe** o método: o EAP é um arcabouço, e o método define como a identidade é provada.

| Método | Como autentica | Observação |
| --- | --- | --- |
| EAP-TLS (RFC 5216, e RFC 9190 para o TLS 1.3) | certificados dos dois lados, em um túnel TLS | o mais forte; exige uma PKI e certificados nos clientes |
| Métodos com túnel TLS e senha | o servidor se autentica por certificado, e o cliente por senha, dentro do túnel | mais simples de implantar; o servidor precisa ser validado pelo cliente |
| EAP-MD5 (RFC 3748, seção 5.4) | desafio e resposta com hash | **fraco**: não autentica o servidor, não protege a identidade, e a senha pode ser atacada offline |

### Riscos e defesas

\`\`\`mermaid
flowchart TD
  P["Riscos do 802.1X"] --> M["Método fraco ou mal validado"]
  P --> C["Segredo compartilhado fraco<br/>entre autenticador e servidor"]
  P --> D["Dispositivo sem suplicante<br/>impressora, telefone"]
  M --> M1["Defesa: EAP-TLS ou túnel com validação<br/>do certificado do servidor"]
  C --> C1["Defesa: segredo longo e único por autenticador,<br/>Message-Authenticator (RFC 3579), RFC 5080"]
  D --> D1["Defesa: política à parte,<br/>por exemplo VLAN restrita"]
\`\`\`

*Esquema 4 (riscos e defesas, no nível defensivo).* O servidor RADIUS e o autenticador compartilham um **segredo** que protege a integridade das mensagens e esconde alguns atributos. A RFC 5080 reúne problemas comuns de implementação do RADIUS.

### Como ler o diagrama do simulador

- **Topologia:** o suplicante, o switch autenticador, o servidor RADIUS e a rede protegida. A legenda de cores distingue EAPOL, RADIUS e dados, o que está dentro do túnel TLS, Accept ou Success, e Reject ou falha.
- **Aba Porta:** o estado da porta controlada, no instante atual.
- **Aba RADIUS:** os pacotes RADIUS trocados e seus atributos.
- **Aba Métodos EAP:** uma comparação dos métodos.
- **Modos:** *Autenticação*, *Falhas* (credencial inválida e outras), *Porta e sessão* (reautenticação e término) e *Riscos e defesas*.

### Limites do modelo e do diagrama

- Há **um** suplicante, um autenticador, um servidor RADIUS e uma rede. Não há proxy RADIUS, servidores redundantes nem contabilização (RFC 2866).
- O EAP-TLS não aparece fragmentado: os handshakes TLS são agrupados em poucas rodadas. Os valores de desafios e estados são ilustrativos, e não há criptografia real.
- Não há derivação de chaves (MSK e EMSK, RFC 5247), MACsec, autorização por atributos do servidor (como VLAN) nem verificação de postura do dispositivo.
- A autorização por endereço MAC existe nas implementações com nomes e comportamentos variáveis. O simulador mostra só a ideia.
- Os MACs são de documentação (RFC 9542) e os IPs, de redes de documentação (RFC 5737). Confira o texto oficial do IEEE 802.1X antes de citar uma cláusula.
`;
