// Fundamentação do simulador de ataques e defesas TCP e UDP, em Markdown: aparece na documentação
// (docs/simuladores/ataques-tcp-udp.md e na wiki), antes de "Como ler os diagramas". Só o nível defensivo: o efeito, o
// motivo de o ataque funcionar e a defesa. Sem passo a passo ofensivo.
export const fundamentacao: string = `
### O propósito deste simulador

Os protocolos de transporte foram desenhados em uma internet de **confiança**: o TCP mantém **estado** em cada ponta, e o UDP aceita datagramas sem verificar a origem. Essas propriedades, úteis para o desempenho, são o que os ataques de **negação de serviço** e de **abuso de estado** exploram. O simulador mostra, em um **ambiente didático isolado** (sem tráfego real), o **efeito** de cada ataque, **por que** ele funciona e **qual defesa** o neutraliza. Os cenários ficam no nível defensivo: aviso, efeito e defesa.

### O diagrama de um ataque e das camadas de defesa

\`\`\`mermaid
flowchart LR
  A["Tráfego de ataque"] --> U["Mitigação upstream<br/>na operadora"]
  U --> B["Filtro na borda<br/>anti-spoofing e listas de acesso"]
  B --> F["Firewall e limite de taxa"]
  F --> S["Servidor:<br/>proteções do sistema e da aplicação"]
  L["Tráfego legítimo"] --> U
  S --> V["Serviço atendido"]
\`\`\`

*Esquema 1 (defesa em profundidade).* Cada pacote atravessa os controles ativos **em camadas**, e é barrado se **algum** o neutraliza. A **eficácia** de um controle é a chance de ele neutralizar um pacote sozinho. Como as camadas são tratadas como independentes, a chance total de neutralização é **1 menos o produto de (1 menos a eficácia de cada controle)**, e **não** a soma das porcentagens. O **serviço legítimo** mede quantas requisições do cliente foram atendidas: ele cai quando o servidor satura, e também quando um controle gera **falsos positivos**.

### Ataques ao TCP: abuso de estado

O TCP mantém **estado** para cada conexão (RFC 9293), e isso tem um custo que o atacante pode explorar.

\`\`\`mermaid
sequenceDiagram
  participant A as Origem do ataque
  participant S as Servidor
  A->>S: SYN, com origens variadas ou forjadas
  S->>A: SYN e ACK: o servidor reserva estado e espera
  Note over S: a fila de conexões semiabertas enche
  A->>S: nunca completa o handshake
  Note over S: clientes legítimos não conseguem abrir conexão
\`\`\`

*Esquema 2 (esgotamento da fila de conexões semiabertas, o "SYN flood").* O servidor reserva memória a cada SYN recebido, esperando o último ACK que nunca vem. Quando a fila **enche**, os clientes legítimos são recusados (RFC 4987, seção 2). As defesas estão na seção 3 da mesma RFC: **SYN cookies** (seção 3.6, que codificam o estado na própria resposta e não reservam memória até o ACK voltar), filtros (3.1), aumento da fila (3.2), redução do tempo de espera (3.3) e firewalls e *proxies* (3.8).

| Ataque | Por que funciona | Defesa |
| --- | --- | --- |
| Esgotamento de conexões semiabertas | o estado é reservado antes de o cliente provar que existe | SYN cookies, limite de taxa, mitigação upstream |
| Injeção de RST | um segmento forjado com número de sequência aceitável encerra a conexão (RFC 5961) | números de sequência validados com rigor, autenticação (TCP-AO, RFC 5925) ou cifragem acima do TCP (TLS, SSH) |
| Conexões lentas (esgotamento de conexões por inatividade) | cada conexão aberta e quase parada ocupa um processo ou um espaço no servidor | limites de conexão por origem, tempos máximos e servidores baseados em eventos |

### Ataques ao UDP: sem conexão, sem prova de origem

\`\`\`mermaid
flowchart TD
  F["Datagrama UDP com origem falsificada"] --> R["Servidor aberto responde<br/>a quem aparece como origem"]
  R --> V["A vítima recebe respostas<br/>que não pediu, muito maiores que a consulta"]
  V --> D1["Defesa na origem: filtro de ingresso, BCP 38 (RFC 2827)"]
  V --> D2["Defesa no serviço: não responder a toda a internet,<br/>limitar a taxa de respostas"]
  V --> D3["Defesa na vítima: mitigação upstream, FlowSpec (RFC 8955),<br/>RTBH (RFC 7999)"]
\`\`\`

*Esquema 3 (reflexão e amplificação).* Como o UDP **não tem handshake**, nada prova que a origem é real. Um serviço que responde com uma mensagem **muito maior** que a consulta (amplificação) pode ser usado para voltar o tráfego contra uma terceira vítima. A defesa **mais eficaz** está na **origem**: impedir que pacotes com endereço de origem falso saiam da rede (BCP 38). Para quem opera o serviço, a defesa é não deixá-lo aberto à internet inteira e limitar a taxa. Para a vítima, a mitigação **upstream** na operadora (por exemplo, FlowSpec e RTBH) descarta o tráfego antes do enlace saturar. Veja também o simulador de DNS, no cenário de amplificação.

| Ataque | Por que funciona | Defesa |
| --- | --- | --- |
| Inundação de UDP | o servidor gasta recursos com cada datagrama, sem conexão para limitar | limite de taxa, filtros, mitigação upstream |
| Reflexão e amplificação | origem falsificada e resposta maior que a consulta | BCP 38, serviços não abertos, limite de taxa |
| Botnet distribuído (DDoS) | muitas origens reais, sem um endereço que se possa bloquear | mitigação upstream e capacidade (e não bloqueio de endereços) |

### Como ler o diagrama do simulador

- **Topologia:** onde cada controle atua e por onde passa cada pacote. A legenda distingue ataque, neutralizado, resposta, legítimo e legítimo descartado.
- **Aba Efeito dos controles:** quanto cada controle neutralizou, no instante atual.
- **Aba Configuração de referência:** trechos **ilustrativos** de configuração dos controles.
- **Aba Avaliação:** o balanço do cenário: carga, serviço legítimo, falsos positivos e os custos das defesas.
- **Telemetria:** vale sempre **ataque rumo à vítima = neutralizados + chegaram à vítima**. Na reflexão, as requisições enviadas aos refletores aparecem **à parte**, porque não vão para a vítima, e cada uma não barrada vira várias respostas que contam como ataque rumo à vítima. A **carga** é a fração da capacidade do servidor e para em 100%: quando a demanda passa disso, o excedente aparece como requisições legítimas descartadas.
- **Modos:** *Ataques TCP* e *Ataques UDP*.

### Limites do modelo e do diagrama

- As **eficácias** dos controles, os **limiares** (60% de carga para o primeiro alerta, 85% de proteção, 30% de carga para a recuperação) e as taxas de falso positivo são valores **didáticos e subjetivos**, escolhidos para comparar cenários. Não são medições nem constam de RFC: em ambiente real dependem do equipamento, da configuração e do tráfego.
- O sorteio usa uma **semente fixa**: o mesmo cenário com as mesmas defesas produz sempre o mesmo resultado, o que permite comparar exercícios.
- Os trechos de configuração (nftables, Suricata, BIND, nginx, sysctl, IOS) são **exemplos ilustrativos**: confira a sintaxe e os parâmetros na documentação oficial do produto e da versão em uso antes de aplicá-los.
- Os endereços usam as faixas de documentação da RFC 5737, e **não há tráfego de rede real**. Os cenários ficam no **nível defensivo**.
`;
