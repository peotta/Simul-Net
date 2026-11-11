// Fundamentação do simulador de HTTPS, em Markdown: aparece na documentação (docs/simuladores/https.md e na wiki), antes de
// "Como ler os diagramas". Explica o que o TLS protege, o handshake, o certificado e o que o observador ainda vê.
export const fundamentacao: string = `
### O problema que o HTTPS resolve

O HTTP puro trafega **em claro**: quem estiver no caminho (rede Wi-Fi aberta, provedor, roteador comprometido) pode **ler** e **alterar** o que passa, inclusive logins e senhas. O **HTTPS** é o HTTP dentro de uma conexão **TLS** (*Transport Layer Security*), normalmente na porta 443. O TLS oferece três garantias:

- **Confidencialidade:** os dados são cifrados, e o observador não os lê.
- **Integridade:** qualquer alteração no caminho é detectada.
- **Autenticação do servidor:** o certificado X.509 (RFC 5280) prova que o servidor é mesmo o do nome acessado. Opcionalmente, o cliente também se autentica (mTLS).

O TLS roda sobre o TCP. O HTTP/3 usa o QUIC, que integra o TLS 1.3 sobre UDP (veja o simulador de versões do HTTP).

**O que você aprende com este simulador.**

- Explicar as três garantias do TLS (confidencialidade, integridade e autenticação do servidor).
- Ler o registro TLS e o cabeçalho das mensagens do handshake.
- Acompanhar o handshake do TLS 1.3, o sigilo futuro e a diferença para o TLS 1.2.
- Entender como o navegador valida o certificado (cadeia, nome e validade) e o que acontece quando falha.
- Reconhecer o que o observador ainda vê (SNI, IP, volume) e o papel do HSTS.

### O diagrama do handshake do TLS 1.3

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente
  participant S as Servidor
  C->>S: ClientHello: versões, cifras, key_share, SNI, ALPN
  S->>C: ServerHello: versão, cifra, key_share
  Note over C,S: a partir daqui, tudo é cifrado com as chaves do handshake
  S->>C: EncryptedExtensions, Certificate, CertificateVerify, Finished
  C->>S: Finished
  Note over C,S: dados da aplicação cifrados: o handshake levou 1 RTT
\`\`\`

*Esquema 1 (handshake do TLS 1.3).* O cliente envia a sua metade do **ECDHE** (*key_share*) já no primeiro passo, então as duas pontas calculam o **mesmo segredo** sem que ele trafegue. O servidor prova a identidade com o **certificado** e com uma **assinatura** (CertificateVerify) sobre o hash da conversa, e os dois confirmam com o **Finished**. O cliente já pode enviar dados depois de **1 RTT**.

O **SNI** (*Server Name Indication*) é o nome do site, enviado em claro no ClientHello, para o servidor escolher o certificado certo. O **ALPN** negocia o protocolo de aplicação (por exemplo, HTTP/2).

### O registro TLS e as mensagens do handshake

Tudo o que o TLS envia viaja em **registros**. O desenho mostra o cabeçalho de um registro, em linhas de 32 bits, na ordem de transmissão ([RFC 9846](https://www.rfc-editor.org/rfc/rfc9846), seção 5.1).

\`\`\`mermaid
packet-beta
  0-7: "Tipo (22 ou 23)"
  8-23: "Versão (0x0303)"
  24-39: "Tamanho"
  40-71: "Fragmento (dados do registro)"
\`\`\`

*Esquema 2 (o registro TLS).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O **tipo** é 20 para a troca de cifra, 21 para um alerta, 22 para o handshake e 23 para dados da aplicação. O campo **versão** vale 0x0303 por compatibilidade (era a do TLS 1.2), e a versão real do TLS 1.3 é negociada no handshake. O **tamanho** do fragmento chega a 16.384 bytes. No TLS 1.3, depois do ServerHello, os registros do handshake também usam o tipo 23: o tipo real vai **dentro** do fragmento cifrado, o que impede o observador de distinguir o handshake dos dados.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Tipo | 0 a 7 | 8 bits | 20 troca de cifra, 21 alerta, 22 handshake, 23 dados da aplicação |
| Versão | 8 a 23 | 16 bits | 0x0303 por compatibilidade com o TLS 1.2 |
| Tamanho | 24 a 39 | 16 bits | tamanho do fragmento, em bytes, de até 16.384 |
| Fragmento | 40 a 71 (condensado) | variável | os dados do registro, cifrados após o handshake |

Dentro de um registro de handshake, cada mensagem tem um cabeçalho de 4 bytes (seção 4).

\`\`\`mermaid
packet-beta
  0-7: "Tipo da mensagem"
  8-31: "Tamanho do corpo"
  32-63: "Corpo da mensagem (variável)"
\`\`\`

*Esquema 3 (o cabeçalho de uma mensagem de handshake).* O tipo é 1 para o ClientHello, 2 para o ServerHello, 8 para EncryptedExtensions, 11 para Certificate, 15 para CertificateVerify e 20 para Finished. O ClientHello leva as versões, as suítes de cifra, o key_share, o SNI e o ALPN, e o ServerHello escolhe a versão, a suíte e responde com o próprio key_share.

| Campo | Bits no desenho | Tamanho | Função |
| --- | --- | --- | --- |
| Tipo da mensagem | 0 a 7 | 8 bits | 1 ClientHello, 2 ServerHello, 8 EncryptedExtensions, 11 Certificate, 15 CertificateVerify, 20 Finished |
| Tamanho do corpo | 8 a 31 | 24 bits | tamanho do corpo da mensagem, em bytes |
| Corpo da mensagem | 32 a 63 (condensado) | variável | o conteúdo, conforme o tipo (versões, suítes, key_share, SNI, ALPN e outros) |

### TLS 1.3 e TLS 1.2

| Aspecto | TLS 1.3 (RFC 9846) | TLS 1.2 (RFC 5246) |
| --- | --- | --- |
| Handshake | 1 RTT (0-RTT na retomada) | 2 RTT (1 RTT na retomada) |
| Certificado | cifrado | em claro |
| Sigilo futuro | sempre (só ECDHE e DHE) | só nas suítes ECDHE e DHE, não na troca RSA |
| Cifras | só AEAD (AES-GCM, ChaCha20-Poly1305) | AEAD e também CBC, 3DES e RC4 (legado) |
| Derivação de chaves | HKDF | PRF |
| Proteção contra downgrade | sentinela no campo random | sem proteção própria |

O sigilo futuro (*forward secrecy*) significa que o vazamento da chave do servidor no futuro **não** decifra as conversas antigas, porque a chave de cada sessão é efêmera. As versões TLS 1.0 e 1.1 estão obsoletas (RFC 8996).

### O certificado e a cadeia de confiança

\`\`\`mermaid
flowchart TD
  R["Autoridade certificadora raiz<br/>já confiada pelo navegador"] -- "assina" --> I["Certificado intermediário"]
  I -- "assina" --> F["Certificado do servidor:<br/>nome, chave pública, validade"]
  F --> V{"O navegador verifica"}
  V --> V1["Assinatura da cadeia até uma raiz confiada"]
  V --> V2["Nome do site confere com o certificado (RFC 9525)"]
  V --> V3["Dentro do prazo de validade"]
\`\`\`

*Esquema 4 (como o navegador valida o certificado).* O navegador confia em um conjunto de **autoridades certificadoras (CA)** raiz. O servidor envia o seu certificado e os intermediários, e o navegador confere três coisas: a cadeia de assinaturas até uma raiz confiada, o **nome** (a regra de verificação está na RFC 9525) e a **validade**. Se **qualquer** uma falha, o navegador avisa o usuário: certificado expirado, nome diferente, ou autoridade desconhecida.

### Do HTTP ao HTTPS: o HSTS

\`\`\`mermaid
flowchart LR
  U["Usuário digita o endereço sem https"] --> H1["Primeiro acesso por HTTP"]
  H1 --> RD["Redirecionamento para HTTPS"]
  RD --> HS["Resposta com Strict-Transport-Security"]
  HS --> N["Próximos acessos: o navegador<br/>só usa HTTPS, sem passar pelo HTTP"]
\`\`\`

*Esquema 5 (redirecionamento e HSTS).* O redirecionamento de HTTP para HTTPS tem uma janela de risco: o **primeiro** pedido ainda vai em claro e pode ser interceptado. O **HSTS** (RFC 6797) manda o navegador usar **só HTTPS** daquele site por um prazo, fechando a janela nos acessos seguintes.

### O que o observador ainda vê

O TLS esconde o **conteúdo**, mas não esconde tudo. Quem observa a rede ainda vê os **endereços IP**, o **momento e o volume** do tráfego e, em geral, o **nome do site** (pelo SNI). O que fica protegido são o caminho da página, os cabeçalhos, os cookies, o corpo e as senhas.

### O que cada modo e aba do simulador mostram

- **Diagrama de sequência:** as mensagens do handshake e, depois, os pedidos e as respostas já cifrados.
- **Aba O que o observador vê:** o que um intermediário consegue ler em cada momento, em HTTP e em HTTPS.
- **Aba Comparação:** HTTP e HTTPS lado a lado para o mesmo acesso.
- **Aba Chaves e sessão:** os segredos e as chaves derivados em cada fase do handshake.
- **Aba Certificado:** os campos do certificado e o resultado da validação.
- **Aba Configuração:** um exemplo ilustrativo de configuração do servidor.
- **Modos:** *Handshake TLS* (1.3 e 1.2), *Certificados* (válido e com erro), *HTTP, HTTPS e HSTS* e *Comparação HTTP x HTTPS*.

Para o handshake, use "TLS 1.3 completo (1 RTT)", "TLS 1.2 completo (2 RTT)", "Retomada de sessão (ticket)" e "0-RTT e risco de replay". Para a compatibilidade, use "Sem versão em comum", "Sem cifra em comum" e "Downgrade detectado". Para o certificado, use "Certificado válido", "Certificado expirado", "Nome não confere", "Autoassinado (CA desconhecida)" e "Revogado (com stapling)". Para o HSTS, use "Primeiro acesso: HTTP e 301" e "Com HSTS em cache". Para o que o observador vê, use "Login: senha em claro x cifrada" e "Página com cookie de sessão", e para a integridade, "Conteúdo alterado no caminho".

### Limites do modelo e do diagrama

- **Nenhuma criptografia real** é feita: chaves, hashes e identificadores são ilustrativos, e os tempos são didáticos.
- O handshake aparece **simplificado**: não há negociação completa de extensões, retomada de sessão com tíquetes, 0-RTT detalhado, autenticação do cliente nem *certificate transparency*.
- Os trechos de configuração são exemplos: confira a sintaxe na documentação do servidor e da versão em uso antes de aplicá-los.
`;
