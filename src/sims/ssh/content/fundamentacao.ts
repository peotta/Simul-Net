// Fundamentação do simulador de SSH, em Markdown: aparece na documentação (docs/simuladores/ssh.md e na wiki), antes de
// "Como ler os diagramas". Explica as três camadas, a troca de chaves, a autenticação e os túneis, no nível defensivo.
export const fundamentacao: string = `
### O problema que o SSH resolve

Administrar um servidor remoto exige abrir um terminal e transferir arquivos por uma rede **não confiável**. Os protocolos antigos (Telnet, rlogin) enviavam usuário, senha e comandos **em claro**. O **SSH-2** (*Secure Shell*, RFC 4251) protege o acesso remoto com **cifra**, **integridade** e **autenticação** do servidor e do usuário, normalmente em uma conexão TCP na porta 22.

**O que você aprende com este simulador.**

- Explicar o que o SSH protege e as três camadas do protocolo (transporte, autenticação e conexão).
- Ler o formato do pacote SSH e os números das mensagens de cada fase.
- Acompanhar a troca de chaves, a assinatura do servidor e o sigilo futuro.
- Entender a confiança na chave de host (TOFU) e os métodos de autenticação do usuário.
- Reconhecer o papel dos túneis (-L, -R, -D, ProxyJump) e como restringi-los, no nível defensivo.

### O diagrama das três camadas

\`\`\`mermaid
flowchart TB
  C["Camada de conexão, RFC 4254<br/>canais: shell, comando, SFTP, túneis"]
  A["Camada de autenticação, RFC 4252<br/>identifica o usuário"]
  T["Camada de transporte, RFC 4253<br/>negocia algoritmos, troca chaves,<br/>autentica o servidor e cifra os pacotes"]
  TCP["TCP, porta 22"]
  C --> A --> T --> TCP
\`\`\`

*Esquema 1 (as três camadas do SSH).* A camada de **transporte** protege tudo o que vem depois. A camada de **autenticação** identifica o usuário. A camada de **conexão** **multiplexa** vários canais (uma sessão de terminal, uma transferência SFTP, vários túneis) sobre a mesma conexão cifrada.

### As fases da sessão

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente
  participant S as Servidor
  C->>S: versão: SSH-2.0 e o software
  S->>C: versão: SSH-2.0 e o software
  C->>S: KEXINIT: listas de algoritmos
  S->>C: KEXINIT: listas de algoritmos
  C->>S: KEX_ECDH_INIT: parte pública efêmera do cliente
  S->>C: KEX_ECDH_REPLY: parte pública, chave de host, assinatura de H
  C->>S: NEWKEYS
  S->>C: NEWKEYS
  Note over C,S: a partir daqui, tudo é cifrado
  C->>S: autenticação do usuário
  S->>C: sucesso
  C->>S: abre um canal
\`\`\`

*Esquema 2 (da versão ao canal).* As quatro primeiras fases, de versão até o NEWKEYS, ocorrem **em claro**, mas não expõem segredos. A autenticação e os canais já vão **cifrados**.

| Fase | Mensagens | Em claro? | Objetivo |
| --- | --- | --- | --- |
| Versões | texto SSH-2.0 e o software | sim | combinar a versão do protocolo |
| Negociação | KEXINIT | sim | listas de algoritmos; vale o primeiro do cliente que o servidor aceita |
| Troca de chaves | KEX_ECDH_INIT, KEX_ECDH_REPLY, NEWKEYS | sim | segredo efêmero, assinatura pela chave de host, chaves da sessão |
| Autenticação | SERVICE_REQUEST, USERAUTH | não | identificar o usuário |
| Canais | CHANNEL | não | shell, comando, SFTP e túneis, com janela de fluxo por canal |

### O pacote do SSH

Na camada de transporte, cada mensagem viaja em um **pacote binário**. O desenho mostra o formato lógico, antes da cifra, em linhas de 32 bits, na ordem de transmissão ([RFC 4253](https://www.rfc-editor.org/rfc/rfc4253), seção 6).

\`\`\`mermaid
packet-beta
  0-31: "Tamanho do pacote"
  32-39: "Tamanho do padding"
  40-63: "Payload (1º byte: tipo da mensagem)"
  64-95: "Payload (continuação, variável)"
  96-127: "Padding aleatório (4 a 255 bytes) e MAC"
\`\`\`

*Esquema 3 (o pacote do SSH).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O payload e o padding aparecem **condensados**: o payload tem tamanho variável, e o primeiro byte dele é o **tipo da mensagem**. O padding aleatório completa o pacote até um múltiplo do tamanho do bloco da cifra (no mínimo 4 bytes), e o **MAC** (ou a etiqueta, nos modos AEAD) garante a integridade de cada pacote. Antes do NEWKEYS, os pacotes vão em claro e sem MAC.

Os números das mensagens mais importantes são estes (RFC 4250, seção 4.1):

| Número | Mensagem | Fase |
| --- | --- | --- |
| 20 | KEXINIT | negociação dos algoritmos |
| 21 | NEWKEYS | passa a usar as chaves novas |
| 30 e 31 | KEX_ECDH_INIT e KEX_ECDH_REPLY | troca de chaves |
| 5 e 6 | SERVICE_REQUEST e SERVICE_ACCEPT | pedido do serviço de autenticação |
| 50, 51 e 52 | USERAUTH_REQUEST, USERAUTH_FAILURE e USERAUTH_SUCCESS | autenticação do usuário |
| 90 e 94 | CHANNEL_OPEN e CHANNEL_DATA | abertura de canal e dados |
| 1 | DISCONNECT | encerra a conexão |

O KEXINIT leva seis listas de algoritmos, em ordem de preferência: troca de chaves, chave de host, cifra (nos dois sentidos), MAC (nos dois sentidos) e compressão. Para cada categoria, vale o **primeiro algoritmo da lista do cliente** que o servidor também oferece.

### Troca de chaves e sigilo futuro

- Cada lado gera um par **efêmero** e envia só a parte pública. O segredo **K** é calculado nas pontas e **nunca trafega**.
- O servidor **assina** o hash **H** da troca com a sua **chave de host**. Isso prova que ele possui a chave e amarra a troca à sua identidade: um intermediário não consegue se passar por ele.
- Como o par efêmero é descartado, o comprometimento futuro da chave de host **não decifra** sessões antigas (sigilo futuro).

### Confiar no servidor: a chave de host

\`\`\`mermaid
flowchart TD
  P["Primeira conexão ao servidor"] --> I["O cliente mostra a impressão digital da chave de host"]
  I --> Q{"O usuário confere com uma fonte confiável?"}
  Q -- "sim" --> G["Guarda a chave no arquivo known_hosts"]
  Q -- "aceita sem conferir" --> R["Risco: se há um intermediário,<br/>ele passa a ser o 'servidor' confiado"]
  G --> N["Próximas conexões: se a chave mudar,<br/>o cliente alerta"]
\`\`\`

*Esquema 4 (confiança na primeira vez).* O SSH não usa uma autoridade certificadora por padrão. O cliente confia na chave que **viu na primeira conexão** (modelo *trust on first use*) e a guarda. Se, depois, a chave mudar, o cliente **alerta**: pode ser uma reinstalação legítima ou um intermediário. A defesa é **conferir a impressão digital** por um canal independente na primeira vez, ou distribuir as chaves de host de forma administrada.

### Autenticação do usuário

| Método | Como funciona | Observação |
| --- | --- | --- |
| Chave pública | o usuário prova que possui a chave privada, assinando um desafio | a mais forte; a chave privada nunca sai do cliente |
| Senha | o usuário envia a senha dentro do canal cifrado | exposta a adivinhação em massa se o servidor aceita tentativas ilimitadas |
| *Keyboard-interactive* (RFC 4256) | o servidor faz perguntas, por exemplo um segundo fator | flexível, para dois fatores |

Algoritmos de assinatura usados hoje incluem o RSA com SHA-2 (RFC 8332) e o Ed25519 (RFC 8709).

### Túneis: o canal além do terminal

\`\`\`mermaid
flowchart LR
  subgraph LOC["Encaminhamento local"]
    A1["Aplicação local"] --> P1["Porta no cliente"] -- "dentro do SSH" --> S1["Servidor SSH"] --> D1["Serviço interno da rede do servidor"]
  end
  subgraph REM["Encaminhamento remoto"]
    D2["Serviço do cliente"] --> P2["Porta no servidor SSH"] -- "dentro do SSH" --> A2["Cliente SSH"]
  end
\`\`\`

*Esquema 5 (túneis).* O SSH permite **encaminhar portas**: uma porta local é ligada, por dentro da conexão cifrada, a um serviço do lado do servidor (e o contrário, no encaminhamento remoto). É muito útil para administrar serviços internos. Também é **um caminho a mais para o tráfego**, que pode atravessar o firewall sem ser visto. Do ponto de vista defensivo, o administrador deve **restringir o encaminhamento** nos servidores que não o exigem e registrar quem o usa.

### O que cada modo e aba do simulador mostram

- **Diagrama de sequência:** as fases da sessão e, no modo de túneis, os canais abertos.
- **Aba Chaves e sessão:** os segredos e as chaves de cada fase e a impressão digital da chave de host.
- **Aba Configuração:** um exemplo ilustrativo de configuração do servidor.
- **Modos:** *Sessão e autenticação* (do handshake ao shell, e os casos de falha) e *Túneis e encaminhamento*.

Para a conexão, use "Conexão moderna com chave", "Primeira conexão (TOFU)" e "Chave do servidor mudou". Para os algoritmos, use "Sem algoritmo em comum" e "Algoritmos fracos aceitos". Para a autenticação, use "Login por senha", "Muitas tentativas de senha", "Chave + TOTP (2 fatores)" e "Login de root bloqueado". Para os canais, use "Comando remoto", "Transferência SFTP" e "ForwardAgent e seus riscos". Para os túneis, use "Túnel local (-L)", "Túnel remoto (-R)", "Proxy SOCKS (-D)", "ProxyJump (bastion)" e "Encaminhamento bloqueado".

### Limites do modelo e do diagrama

- **Nenhuma criptografia real** é feita: chaves, hashes e impressões digitais são ilustrativos, e os tempos são didáticos.
- O simulador mostra o caminho principal: não há renegociação de chaves, *agent forwarding*, certificados SSH nem autenticação por GSSAPI.
- Os trechos de configuração são exemplos: confira a sintaxe e os parâmetros na documentação do produto e da versão em uso antes de aplicá-los.
`;
