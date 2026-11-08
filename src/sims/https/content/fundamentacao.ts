// Fundamentação do simulador de HTTPS, em Markdown: aparece na documentação (docs/simuladores/https.md e na wiki), antes de
// "Como ler os diagramas". Explica o que o TLS protege, o handshake, o certificado e o que o observador ainda vê.
export const fundamentacao: string = `
### O problema que o HTTPS resolve

O HTTP puro trafega **em claro**: quem estiver no caminho (rede Wi-Fi aberta, provedor, roteador comprometido) pode **ler** e **alterar** o que passa, inclusive logins e senhas. O **HTTPS** é o HTTP dentro de uma conexão **TLS** (*Transport Layer Security*), normalmente na porta 443. O TLS oferece três garantias:

- **Confidencialidade:** os dados são cifrados, e o observador não os lê.
- **Integridade:** qualquer alteração no caminho é detectada.
- **Autenticação do servidor:** o certificado X.509 (RFC 5280) prova que o servidor é mesmo o do nome acessado. Opcionalmente, o cliente também se autentica (mTLS).

O TLS roda sobre o TCP. O HTTP/3 usa o QUIC, que integra o TLS 1.3 sobre UDP (veja o simulador de versões do HTTP).

### O diagrama do handshake do TLS 1.3

\`\`\`mermaid
sequenceDiagram
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

*Esquema 2 (como o navegador valida o certificado).* O navegador confia em um conjunto de **autoridades certificadoras (CA)** raiz. O servidor envia o seu certificado e os intermediários, e o navegador confere três coisas: a cadeia de assinaturas até uma raiz confiada, o **nome** (a regra de verificação está na RFC 9525) e a **validade**. Se **qualquer** uma falha, o navegador avisa o usuário: certificado expirado, nome diferente, ou autoridade desconhecida.

### Do HTTP ao HTTPS: o HSTS

\`\`\`mermaid
flowchart LR
  U["Usuário digita o endereço sem https"] --> H1["Primeiro acesso por HTTP"]
  H1 --> RD["Redirecionamento para HTTPS"]
  RD --> HS["Resposta com Strict-Transport-Security"]
  HS --> N["Próximos acessos: o navegador<br/>só usa HTTPS, sem passar pelo HTTP"]
\`\`\`

*Esquema 3 (redirecionamento e HSTS).* O redirecionamento de HTTP para HTTPS tem uma janela de risco: o **primeiro** pedido ainda vai em claro e pode ser interceptado. O **HSTS** (RFC 6797) manda o navegador usar **só HTTPS** daquele site por um prazo, fechando a janela nos acessos seguintes.

### O que o observador ainda vê

O TLS esconde o **conteúdo**, mas não esconde tudo. Quem observa a rede ainda vê os **endereços IP**, o **momento e o volume** do tráfego e, em geral, o **nome do site** (pelo SNI). O que fica protegido são o caminho da página, os cabeçalhos, os cookies, o corpo e as senhas.

### Como ler o diagrama do simulador

- **Diagrama de sequência:** as mensagens do handshake e, depois, os pedidos e as respostas já cifrados.
- **Aba O que o observador vê:** o que um intermediário consegue ler em cada momento, em HTTP e em HTTPS.
- **Aba Comparação:** HTTP e HTTPS lado a lado para o mesmo acesso.
- **Aba Chaves e sessão:** os segredos e as chaves derivados em cada fase do handshake.
- **Aba Certificado:** os campos do certificado e o resultado da validação.
- **Aba Configuração:** um exemplo ilustrativo de configuração do servidor.
- **Modos:** *Handshake TLS* (1.3 e 1.2), *Certificados* (válido e com erro), *HTTP, HTTPS e HSTS* e *Comparação HTTP x HTTPS*.

### Limites do modelo e do diagrama

- **Nenhuma criptografia real** é feita: chaves, hashes e identificadores são ilustrativos, e os tempos são didáticos.
- O handshake aparece **simplificado**: não há negociação completa de extensões, retomada de sessão com tíquetes, 0-RTT detalhado, autenticação do cliente nem *certificate transparency*.
- Os trechos de configuração são exemplos: confira a sintaxe na documentação do servidor e da versão em uso antes de aplicá-los.
`;
