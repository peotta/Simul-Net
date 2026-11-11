// Fundamentação do simulador de 802.1X e RADIUS, em Markdown: aparece na documentação (docs/simuladores/802-1x.md e na wiki),
// antes de "Como ler os diagramas". Explica os três papéis, o EAP sobre o enlace e sobre o RADIUS e a porta controlada.
export const fundamentacao: string = `
### O problema que o 802.1X resolve

Em uma rede cabeada ou Wi-Fi, qualquer dispositivo que se conecte a uma porta já estaria "dentro". O **IEEE 802.1X** é o **controle de acesso à rede baseado em porta**: a porta de um switch (ou de um ponto de acesso) fica **fechada** para dados e só os libera depois de o dispositivo se **autenticar**. A autenticação em si é feita pelo **EAP** (*Extensible Authentication Protocol*, RFC 3748), e o servidor costuma falar **RADIUS** (RFC 2865).

**O que você aprende com este simulador.**

- Explicar o controle de acesso baseado em porta e os três papéis (suplicante, autenticador e servidor).
- Acompanhar o diálogo do EAPOL ao Access-Accept e o estado da porta controlada.
- Ler os formatos do EAPOL, do pacote EAP e do pacote RADIUS e como o EAP viaja nas duas camadas.
- Comparar os métodos EAP (EAP-TLS, túnel com senha e EAP-MD5) e o que cada um prova.
- Reconhecer os riscos (método fraco, segredo compartilhado, dispositivo sem suplicante) e as defesas.

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

### Os formatos: EAPOL, EAP e RADIUS

O 802.1X usa três formatos encaixados. O **EAPOL** é o quadro que leva o EAP no enlace, entre o suplicante e o autenticador (EtherType 0x888E, em geral para o endereço de grupo 01:80:C2:00:00:03). Dentro dele vai o **pacote EAP**.

\`\`\`mermaid
packet-beta
  0-7: "Versão EAPOL"
  8-15: "Tipo do pacote EAPOL"
  16-31: "Tamanho do corpo"
  32-39: "Código EAP"
  40-47: "Identificador"
  48-63: "Tamanho do pacote EAP"
  64-71: "Tipo do método"
  72-95: "Dados do método"
\`\`\`

*Esquema 4 (EAPOL e o pacote EAP que ele carrega).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. As duas primeiras linhas são o cabeçalho EAPOL: versão, tipo (0 para um pacote EAP, 1 para Start, 2 para Logoff e 3 para Key) e o tamanho do corpo. O corpo é o pacote EAP, com o código (1 Request, 2 Response, 3 Success e 4 Failure), o identificador que casa cada Response com o seu Request, o tamanho e, nos Request e Response, o **tipo do método** (1 Identity, 3 Nak, 4 MD5-Challenge e 13 EAP-TLS) seguido dos dados dele (RFC 3748, seção 4). Success e Failure não têm tipo nem dados.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Versão EAPOL | 0 a 7 | 8 bits | versão do EAPOL (1, 2 ou 3, conforme a edição do 802.1X) |
| Tipo do pacote EAPOL | 8 a 15 | 8 bits | 0 EAP-Packet, 1 EAPOL-Start, 2 EAPOL-Logoff, 3 EAPOL-Key |
| Tamanho do corpo | 16 a 31 | 16 bits | tamanho do corpo que vem depois do cabeçalho EAPOL, em bytes |
| Código EAP | 32 a 39 | 8 bits | 1 Request, 2 Response, 3 Success, 4 Failure |
| Identificador | 40 a 47 | 8 bits | casa cada Response com o Request que o provocou |
| Tamanho do pacote EAP | 48 a 63 | 16 bits | tamanho do pacote EAP inteiro, do código aos dados |
| Tipo do método | 64 a 71 | 8 bits | só em Request e Response: 1 Identity, 3 Nak, 4 MD5-Challenge, 13 EAP-TLS |
| Dados do método | 72 a 95 (condensado) | variável | conteúdo específico do método, como a identidade ou o desafio |

Os campos de Código EAP a Dados do método formam o pacote EAP, que vai no corpo do EAPOL. Success e Failure terminam no tamanho, sem tipo nem dados.

Entre o autenticador e o servidor, o EAP viaja dentro do RADIUS:

\`\`\`mermaid
packet-beta
  0-7: "Código RADIUS"
  8-15: "Identificador"
  16-31: "Tamanho"
  32-159: "Authenticator (16 bytes)"
  160-191: "Atributos (variável)"
\`\`\`

*Esquema 5 (o pacote RADIUS).* O pacote tem o código (1 Access-Request, 2 Access-Accept, 3 Access-Reject e 11 Access-Challenge), um identificador, o tamanho, o campo **Authenticator** de 16 bytes e uma lista de atributos (RFC 2865, seção 3). Os atributos têm o formato tipo, tamanho e valor. O pacote EAP vai no atributo **EAP-Message** (tipo 79), e o atributo **Message-Authenticator** (tipo 80) protege a integridade do pacote com o segredo compartilhado (RFC 3579). O campo Authenticator do Access-Request é um número aleatório de 16 bytes, usado também para esconder atributos como a senha.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Código RADIUS | 0 a 7 | 8 bits | 1 Access-Request, 2 Access-Accept, 3 Access-Reject, 11 Access-Challenge |
| Identificador | 8 a 15 | 8 bits | casa a resposta com o pedido |
| Tamanho | 16 a 31 | 16 bits | tamanho do pacote RADIUS inteiro, em bytes |
| Authenticator | 32 a 159 | 16 bytes | no Access-Request, um número aleatório; nas respostas, um resumo calculado com o segredo compartilhado |
| Atributos | 160 a 191 (condensado) | variável | lista de atributos em tipo, tamanho e valor; o EAP vai no EAP-Message (79) e a integridade, no Message-Authenticator (80) |

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

*Esquema 6 (riscos e defesas, no nível defensivo).* O servidor RADIUS e o autenticador compartilham um **segredo** que protege a integridade das mensagens e esconde alguns atributos. A RFC 5080 reúne problemas comuns de implementação do RADIUS.

### O que cada modo e aba do simulador mostram

- **Topologia:** o suplicante, o switch autenticador, o servidor RADIUS e a rede protegida. A legenda de cores distingue EAPOL, RADIUS e dados, o que está dentro do túnel TLS, Accept ou Success, e Reject ou falha.
- **Diagrama de sequência:** cada seta é um quadro EAPOL ou um pacote RADIUS, e a porta controlada muda de estado quando o Access-Accept chega.
- **Aba Porta:** o estado da porta controlada, no instante atual.
- **Aba RADIUS:** os pacotes RADIUS trocados e seus atributos.
- **Aba Métodos EAP:** uma comparação dos métodos.
- **Modos:** *Autenticação*, *Falhas* (credencial inválida e outras), *Porta e sessão* (reautenticação e término) e *Riscos e defesas*.

Para os métodos, use "EAP-TLS: certificados nos dois lados", "PEAP: certificado no servidor, senha no cliente" e "EAP-MD5: só desafio e resposta". Para as falhas, use "Senha incorreta (PEAP)", "Certificado do cliente expirado (EAP-TLS)", "Servidor RADIUS inalcançável", "Segredo compartilhado diferente" e "Dispositivo sem suplicante". Para a sessão, use "Reautenticação sem cortar a sessão" e "EAPOL-Logoff fecha a porta". Para os riscos e as defesas, use "EAP-MD5 aceita um autenticador falso", "Defesa: EAP-TLS com autenticação mútua", "PEAP sem validar o certificado do servidor" e "Defesa: validar a CA e o nome do servidor".

### Limites do modelo e do diagrama

- Há **um** suplicante, um autenticador, um servidor RADIUS e uma rede. Não há proxy RADIUS, servidores redundantes nem contabilização (RFC 2866).
- O EAP-TLS não aparece fragmentado: os handshakes TLS são agrupados em poucas rodadas. Os valores de desafios e estados são ilustrativos, e não há criptografia real.
- Não há derivação de chaves (MSK e EMSK, RFC 5247), MACsec, autorização por atributos do servidor (como VLAN) nem verificação de postura do dispositivo.
- A autorização por endereço MAC existe nas implementações com nomes e comportamentos variáveis. O simulador mostra só a ideia.
- Os MACs são de documentação (RFC 9542) e os IPs, de redes de documentação (RFC 5737). Confira o texto oficial do IEEE 802.1X antes de citar uma cláusula.
`;
