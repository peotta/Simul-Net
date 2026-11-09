// Fundamentação do simulador de FTP, FTPS e SFTP, em Markdown: aparece na documentação (docs/simuladores/ftp.md e na wiki),
// antes de "Como ler os diagramas". Explica os dois canais do FTP, os modos ativo e passivo e as alternativas seguras.
export const fundamentacao: string = `
### O problema que o FTP resolve, e o que ele deixou em aberto

O FTP (*File Transfer Protocol*, RFC 959) transfere arquivos entre um cliente e um servidor. É um dos protocolos mais antigos da internet, e tem duas características marcantes: usa **dois canais** (um de controle e um de dados) e trafega usuário, senha, comandos e arquivos **em texto puro**. Por isso existem duas alternativas seguras, o **FTPS** e o **SFTP**, que o simulador compara.

### O diagrama dos dois canais

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente
  participant S as Servidor
  C->>S: conexão de controle: porta 21
  S->>C: 220 pronto
  C->>S: USER e PASS
  S->>C: 230 autenticado
  C->>S: PASV
  S->>C: 227 abra a conexão na porta P
  C->>S: nova conexão de dados: porta P
  C->>S: RETR arquivo
  S->>C: 150 abrindo conexão de dados
  S->>C: arquivo, pelo canal de dados
  S->>C: 226 transferência concluída
\`\`\`

*Esquema 1 (controle e dados no modo passivo).* O canal de **controle** (porta 21) leva os comandos e as respostas numéricas durante toda a sessão. Cada **transferência** (um arquivo ou uma listagem) usa um **canal de dados** separado, aberto só para ela. A organização dos canais está na RFC 959, seção 3.2, e os comandos de transferência, na seção 4.1.

### Modo ativo e modo passivo

\`\`\`mermaid
flowchart TD
  subgraph ATIVO["Modo ativo: PORT ou EPRT"]
    A1["O cliente anuncia o seu endereço e uma porta"] --> A2["O servidor conecta ao cliente,<br/>a partir da porta 20"]
  end
  subgraph PASSIVO["Modo passivo: PASV ou EPSV"]
    P1["O servidor abre uma porta<br/>de uma faixa e a informa"] --> P2["O cliente conecta ao servidor<br/>nessa porta"]
  end
\`\`\`

*Esquema 2 (quem abre o canal de dados).* No modo **ativo**, o servidor conecta **ao cliente**. Atrás de um NAT, o endereço anunciado é privado, e a conexão falha, a menos que um *helper* do firewall reescreva o comando. No modo **passivo**, o cliente conecta ao servidor, e isso atravessa NAT e firewalls de estado, desde que a faixa de portas esteja liberada no servidor. Os comandos EPSV e EPRT (RFC 2428) estendem o PASV e o PORT para outros tipos de endereço.

Um *helper* de FTP precisa **ler** o canal de controle para saber que porta abrir. Com o canal cifrado (FTPS), ele não consegue, e o modo ativo e o passivo exigem outra solução.

### As três variantes

| Aspecto | FTP | FTPS | SFTP |
| --- | --- | --- | --- |
| Especificação | RFC 959 | RFC 4217, com RFC 2228 | protocolo próprio sobre o SSH |
| Canais | controle e dados | controle e dados, cifrados | **um só** canal, dentro do SSH |
| Porta | 21 (controle) | 21 (explícito) ou 990 (implícito, por convenção) | 22 |
| Segredos e arquivos | em claro | cifrados com TLS | cifrados com o SSH |
| Atravessa firewall e NAT | difícil (dois canais) | difícil (dois canais, cifrados) | **fácil** (uma porta) |

O **SFTP não é "FTP sobre SSH"**: é um protocolo de acesso a arquivos distinto, que roda como subsistema do SSH (RFC 4251 a 4254). No **FTPS explícito**, o cliente envia **AUTH TLS** na porta 21 e passa a usar TLS. No **FTPS implícito**, o TLS começa no primeiro byte, em uma porta própria. Os comandos **PBSZ 0** e **PROT P** ou **PROT C** escolhem se o canal de dados também é cifrado.

### Riscos e defesas (nível defensivo)

\`\`\`mermaid
flowchart TD
  R["Riscos do FTP"] --> R1["Credenciais e arquivos em claro:<br/>quem observa a rede os lê"]
  R --> R2["PORT permite apontar o servidor<br/>para outro destino (ataque de bounce)"]
  R --> R3["Adivinhação de senha e<br/>vazamento de nomes de usuário"]
  R1 --> D1["Defesa: usar FTPS ou SFTP"]
  R2 --> D2["Defesa: o servidor só conecta ao endereço do cliente"]
  R3 --> D3["Defesa: limitar tentativas, mensagens iguais para erros,<br/>autenticação por chave no SFTP"]
\`\`\`

*Esquema 3 (riscos e defesas).* A RFC 2577 reúne as considerações de segurança do FTP (o ataque de *bounce* com o PORT, a adivinhação de senha e o vazamento de nomes de usuário). A recomendação geral é **trocar o FTP por SFTP ou FTPS** sempre que possível, e nunca expor credenciais em claro.

### Como ler o diagrama do simulador

- **Diagrama de sequência:** os comandos e as respostas do canal de controle, com o canal de dados aparecendo separado.
- **Aba Conexões e portas:** as portas usadas em cada canal e quem abriu cada conexão.
- **Aba O que o observador vê:** o que um intermediário lê em cada protocolo (em claro ou cifrado).
- **Aba Comparação:** FTP, FTPS e SFTP lado a lado.
- **Modos:** *FTP* (ativo e passivo), *FTPS* (explícito e implícito), *SFTP* e *Comparação*.

### Limites do modelo e do diagrama

- **Não há criptografia real:** chaves, hashes e conteúdos são ilustrativos, e o certificado e o TLS são simplificados. Os tempos são didáticos.
- Em FTPS, muitos servidores exigem que o canal de dados **reuse** a sessão TLS do canal de controle. É uma escolha de implementação, e o simulador não modela esse reuso.
- A especificação do SFTP é um rascunho do IETF (*SSH File Transfer Protocol*), e a versão 3 é a mais usada. O simulador mostra o essencial.
`;
