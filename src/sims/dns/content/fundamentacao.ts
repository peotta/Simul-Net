// Fundamentação do simulador de DNS e DNSSEC, em Markdown: aparece na documentação (docs/simuladores/dns.md e na wiki),
// antes de "Como ler os diagramas". Explica a hierarquia, a resolução, o cache, o DNSSEC e os riscos, no nível defensivo.
export const fundamentacao: string = `
### O problema que o DNS resolve

As redes se comunicam por endereços IP, mas as pessoas usam **nomes**. O DNS (*Domain Name System*, RFC 1034 e RFC 1035) traduz nomes em dados: endereços IP, servidores de e-mail, textos de política. É um banco de dados **hierárquico e distribuído**: a raiz delega os domínios de primeiro nível (como .com e .br), que delegam os domínios de cada organização. Nenhum servidor sabe tudo, e cada um sabe a quem perguntar.

**O que você aprende com este simulador.**

- Explicar a hierarquia do DNS e o papel do resolvedor, da raiz, do TLD e do servidor autoritativo.
- Ler a mensagem DNS (cabeçalho, pergunta e registros) e os flags QR, AA, TC, RD, RA e RCODE.
- Prever o efeito do cache, do TTL, do cache negativo e da delegação.
- Entender a cadeia de confiança do DNSSEC (DNSKEY, DS, RRSIG, NSEC) e o que ele não protege.
- Reconhecer o envenenamento de cache e a amplificação (nível defensivo), com as defesas, e o DoT e o DoH.

### O diagrama da resolução

\`\`\`mermaid
sequenceDiagram
  autonumber
  participant C as Cliente
  participant R as Resolvedor recursivo
  participant Z as Servidor raiz
  participant T as Servidor do TLD
  participant A as Servidor autoritativo
  C->>R: www.exemplo.com.br ? (RD = 1)
  R->>Z: www.exemplo.com.br ?
  Z->>R: delegação: servidores de .br
  R->>T: www.exemplo.com.br ?
  T->>R: delegação: servidores de exemplo.com.br
  R->>A: www.exemplo.com.br ?
  A->>R: resposta com AA = 1: endereço e TTL
  R->>C: resposta, guardada no cache
\`\`\`

*Esquema 1 (resolução completa).* O cliente faz **uma** pergunta ao resolvedor, que percorre a hierarquia por ele: a raiz e o TLD só **delegam**, indicando os servidores do nível seguinte, e o servidor **autoritativo** dá a resposta final. O resolvedor guarda o resultado no **cache**, e as perguntas seguintes são respondidas sem percorrer a árvore.

| Papel | O que faz |
| --- | --- |
| Cliente (*stub resolver*) | faz uma pergunta só, com RD = 1 (recursão desejada), ao resolvedor configurado |
| Resolvedor recursivo | percorre a hierarquia pelo cliente e guarda as respostas; atende à própria rede |
| Servidor autoritativo | dono dos dados de uma zona; responde com AA = 1 e não faz recursão |
| Raiz e TLD | só delegam, indicando os servidores do nível seguinte |

### A mensagem DNS

A mensagem tem **uma estrutura só** para pergunta e resposta: cabeçalho, pergunta, resposta, autoridade e informações adicionais ([RFC 1035](https://www.rfc-editor.org/rfc/rfc1035), seção 4.1). O desenho mostra o cabeçalho de 12 bytes, em linhas de 32 bits, na ordem de transmissão.

\`\`\`mermaid
packet-beta
  0-15: "Identificador"
  16: "QR"
  17-20: "Opcode"
  21: "AA"
  22: "TC"
  23: "RD"
  24: "RA"
  25: "Z"
  26: "AD"
  27: "CD"
  28-31: "RCODE"
  32-47: "QDCOUNT (perguntas)"
  48-63: "ANCOUNT (respostas)"
  64-79: "NSCOUNT (autoridade)"
  80-95: "ARCOUNT (adicionais)"
\`\`\`

*Esquema 2 (o cabeçalho da mensagem DNS).* Cada linha tem 32 bits, numerados de 0 a 31 da esquerda para a direita. O **identificador** casa a resposta com a pergunta. Os flags dizem se a mensagem é pergunta ou resposta (QR), o tipo de consulta (Opcode), se a resposta é autoritativa (AA), se foi truncada (TC), se a recursão é desejada (RD) e está disponível (RA); o bit Z é reservado, e o AD (dados autenticados) e o CD (checagem desabilitada) são do DNSSEC (RFC 4035). O **RCODE** é o resultado: 0 sem erro, 1 formato inválido, 2 falha do servidor, 3 nome inexistente (NXDOMAIN) e 5 recusado. Os quatro contadores dizem quantas entradas cada seção tem.

Cada entrada das seções de resposta, autoridade e adicionais é um **registro de recurso**, com o formato abaixo (seção 3.2.1).

\`\`\`mermaid
packet-beta
  0-31: "Nome (variável, com compressão)"
  32-47: "Tipo"
  48-63: "Classe"
  64-95: "TTL (segundos)"
  96-111: "RDLENGTH"
  112-143: "RDATA (variável)"
\`\`\`

*Esquema 3 (um registro de recurso).* O **nome** é uma sequência de rótulos precedidos do tamanho, e pode ser trocado por um ponteiro para um trecho anterior da mensagem, o que economiza espaço (seção 4.1.4). O **tipo** diz o que o registro é, a **classe** é quase sempre IN (internet), o **TTL** é o prazo de validade no cache, e o **RDATA** tem o dado, com o tamanho dado em RDLENGTH. A seção de pergunta tem só o nome, o tipo e a classe.

| Tipo de registro | Código | Função |
| --- | --- | --- |
| A e AAAA | 1 e 28 | endereço IPv4 e IPv6 |
| CNAME | 5 | apelido para outro nome |
| NS | 2 | servidores de nomes de uma zona (a delegação) |
| MX | 15 | servidor de e-mail do domínio |
| SOA | 6 | dados de controle da zona |
| TXT | 16 | texto livre, usado em políticas |
| DS, RRSIG, NSEC e DNSKEY | 43, 46, 47 e 48 | registros do DNSSEC |

O DNS usa a porta 53, em **UDP** por padrão. A RFC 1035 (seção 4.2.1) limita a mensagem em UDP a 512 bytes, e o **TCP** (seção 4.2.2) é usado quando a resposta não cabe (flag TC) e nas transferências de zona.

### Cache, TTL e cache negativo

- O **TTL** é o prazo, em segundos, em que uma resposta pode ser reutilizada. TTL alto reduz a carga e a latência. TTL baixo acelera a propagação de uma mudança.
- O **cache negativo** (RFC 2308) também guarda a resposta "o nome não existe" (NXDOMAIN), pelo menor valor entre o TTL do SOA e o campo *minimum*.
- A **delegação** (NS) e o **glue** (o registro A do servidor de nomes, entregue junto) evitam a dependência circular: para achar o servidor de ns.exemplo.com.br seria preciso consultar... o próprio exemplo.com.br.
- Toda zona precisa de **pelo menos dois** servidores de nomes, em redes diferentes.

### A confiança no DNS: DNSSEC

O DNS original **não autentica** as respostas: o resolvedor aceita a que parecer correta. O **DNSSEC** (RFC 4033 e RFC 4035) assina os dados da zona para provar que a resposta é **autêntica** e **íntegra**.

\`\`\`mermaid
flowchart TD
  RZ["Raiz: chave de confiança<br/>conhecida do resolvedor"] -- "DS assina a chave do TLD" --> TLD["TLD .br: DNSKEY"]
  TLD -- "DS assina a chave da zona" --> ZONA["Zona exemplo.com.br: DNSKEY"]
  ZONA -- "RRSIG assina cada conjunto de registros" --> RR["Registro A de www"]
\`\`\`

*Esquema 4 (cadeia de confiança).* Cada nível assina a chave do nível abaixo (registro **DS**), e a zona assina os próprios registros (**RRSIG**) com a sua chave (**DNSKEY**). O resolvedor valida a cadeia **da raiz até o registro**. Se a assinatura confere, a resposta é aceita (flag AD). Se **não** confere, o resolvedor devolve falha, e não o dado forjado. O **NSEC** prova que um nome **não existe**.

O DNSSEC protege a **autenticidade** da resposta. Ele **não cifra** a consulta, e quem observa a rede ainda vê o que foi perguntado.

### Riscos e defesas (nível defensivo)

\`\`\`mermaid
flowchart TD
  F["Envenenamento de cache:<br/>resposta forjada aceita pelo resolvedor"] --> E["Todos os clientes do resolvedor recebem<br/>o endereço errado até o TTL vencer"]
  E --> D1["Defesa: identificador e porta de origem<br/>aleatórios (RFC 5452)"]
  E --> D2["Defesa: validar com DNSSEC"]
  A["Amplificação: resposta bem maior que a consulta,<br/>com a origem falsificada"] --> V["A vítima recebe respostas que não pediu"]
  V --> D3["Defesa: não manter resolvedor aberto<br/>a toda a internet"]
  V --> D4["Defesa: limitar a taxa de respostas<br/>e filtrar origens falsas na borda (BCP 38, RFC 2827)"]
\`\`\`

*Esquema 5 (riscos do DNS e defesas).* O **envenenamento de cache** explora a falta de autenticação: quanto menos imprevisível for a resposta (identificador de 16 bits e porta), mais fácil é forjá-la. Randomizar o identificador e a porta de origem (RFC 5452) e validar com DNSSEC reduzem o risco. A **amplificação** explora o UDP sem conexão e resolvedores abertos. Os cenários do simulador ficam no nível defensivo: aviso, efeito e defesa.

### Privacidade: DoT e DoH

O DNS tradicional é enviado **em claro**. O **DoT** (DNS sobre TLS, RFC 7858, com perfis de uso na RFC 8310) cifra a consulta em uma conexão TLS dedicada, e o **DoH** (DNS sobre HTTPS, RFC 8484) a cifra dentro do HTTP, misturada ao tráfego web. Os dois protegem a consulta do **observador do caminho**, mas o resolvedor ainda vê tudo.

### O que cada modo e aba do simulador mostram

- **Topologia:** cliente, resolvedor e servidores do DNS. A legenda de cores distingue consulta em claro, resposta, tráfego cifrado ou autenticado e o que é forjado, perdido ou descartado.
- **Diagrama de sequência:** cada seta é uma mensagem DNS, com o tipo, o nome e os flags relevantes.
- **Aba Cache:** o que o resolvedor guarda, com os TTLs, no instante atual.
- **Aba Zonas:** os dados de cada zona.
- **Aba Cadeia:** a cadeia de confiança do DNSSEC e o resultado da validação.
- **Modos:** *Resolução*, *DNSSEC*, *Envenenamento de cache*, *Amplificação* e *DoT e DoH*.

Para o percurso e o cache, use "Resolução completa (cache frio)", "Delegação do .com em cache" e "Resposta em cache". Para os tipos de registro, use "AAAA (IPv6)", "MX (e-mail)", "CNAME (apelido)" e "Nome inexistente (NXDOMAIN)". Para as falhas, use "Consulta perdida", "ns1 fora do ar (usa ns2)" e "Resposta truncada (TCP)". Para o DNSSEC, use "Cadeia de confiança válida", "Assinatura vencida" e "DS que não casa com a chave". Para o envenenamento, use "Sem defesa (porta fixa)" e "Porta e ID aleatórios". Para a amplificação, use "Resolvedor aberto (ANY)" e as defesas "Provedor com BCP 38", "Resolvedor fechado (ACL)" e "Limite de taxa (RRL)". Para a privacidade, use "DNS puro (UDP 53)", "DNS sobre TLS (DoT)" e "DNS sobre HTTPS (DoH)".

### Limites do modelo e do diagrama

- Os nomes, os endereços e as zonas são de **exemplo** (domínios e redes de documentação). As chaves e as assinaturas são ilustrativas, e não há criptografia real.
- O simulador não implementa o EDNS, a negociação de cookies, o *QNAME minimization* nem as variantes de DNSSEC por algoritmo.
- Os tempos de trânsito são didáticos, e o cache tem poucas entradas.
`;
