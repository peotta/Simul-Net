// Cenários e documentação do simulador de BGP.
import type { ScenarioDef, ScenarioDoc } from '../../../sim-core/ui';

export const stageTitles: Record<string, string> = {
  sessao: 'Sessão BGP: TCP, OPEN, KEEPALIVE e troca de UPDATEs',
  rotas: 'Propagação de rotas, política e falhas entre sistemas autônomos',
  seguranca: 'Anúncios indevidos entre sistemas autônomos e as defesas de importação',
};

export const scenarios: ScenarioDef[] = [
  { id: "open", g: "Sessões", sub: "sessao", label: "Estabelecimento da sessão", set: { dir: 'DC', ev: 'none', link: 'L5', root: 'C' }, what: "<p>A simulação percorre as fases da sessão: <b>TCP</b> na porta 179, troca de <b>OPEN</b>, confirmação por <b>KEEPALIVE</b> e, por fim, os <b>UPDATE</b>. Use o relógio para parar em cada fase.</p><p>Acompanhe os estados na aba Sessões e abra um OPEN na aba Mensagem.</p>" },
  { id: "hold", g: "Sessões", sub: "sessao", label: "Hold timer", set: { dir: 'DC', ev: 'hold', link: 'L5', root: 'C' }, what: "<p>Depois da convergência, o <b>ISP B</b> trava e deixa de enviar KEEPALIVE ao Cliente (enlace <b>L5</b>), mas o enlace continua ativo: nada avisa a falha.</p><p>Só o hold timer de 180 s percebe. Troque o <b>Evento</b> para <b>Queda de enlace</b> e compare quanto tempo cada falha leva para ser percebida.</p>" },
  { id: "prop", g: "Propagação", sub: "rotas", label: "Propagação do anúncio", set: { dir: 'DC', lpA: 100, prependB: 0, ev: 'none', link: 'L5', root: 'D' }, what: "<p>Acompanhe o prefixo 203.0.113.0/24 saindo do Cliente. Na Captura, abra os UPDATEs em sequência.</p><p>A cada AS, o AS_PATH ganha mais um número e o NEXT_HOP passa a ser o endereço de quem anunciou.</p>" },
  { id: "export", g: "Propagação", sub: "rotas", label: "Exportação entre provedores e peers", set: { dir: 'DC', lpA: 100, prependB: 0, ev: 'none', link: 'L5', root: 'A' }, what: "<p>Com o <b>ISP A</b> em foco, veja na aba Tabela BGP quantos caminhos ele tem para 198.51.100.0/24. Depois ponha o <b>ISP B</b> em foco e compare.</p><p>O ISP B conhece um caminho mais curto, mas não o repassa ao ISP A.</p>" },
  { id: "aspath", g: "Seleção de caminho", sub: "rotas", label: "AS_PATH mais curto", set: { dir: 'DC', lpA: 100, prependB: 0, ev: 'none', link: 'L5', root: 'D' }, what: "<p>Com o <b>Conteúdo</b> em foco, rode <code>show ip bgp 203.0.113.0</code> na aba Comandos.</p><p>Há dois caminhos: pelo ISP B (peering) e pelo Trânsito. O tráfego de teste Conteúdo → Cliente mostra qual é usado.</p>" },
  { id: "rid", g: "Seleção de caminho", sub: "rotas", label: "Desempate por router ID", set: { dir: 'DC', lpA: 100, prependB: 0, ev: 'none', link: 'L5', root: 'T' }, what: "<p>Com o <b>Trânsito</b> em foco: para 203.0.113.0/24, ele recebe dois caminhos do mesmo tamanho, pelo ISP A e pelo ISP B.</p><p>Na aba Tabela BGP, veja qual critério desempatou.</p>" },
  { id: "lp", g: "Seleção de caminho", sub: "rotas", label: "LOCAL_PREF (saída)", set: { dir: 'CD', lpA: 200, prependB: 0, ev: 'none', link: 'L5', root: 'C' }, what: "<p>O Cliente atribui LOCAL_PREF 200 às rotas do ISP A, e o tráfego de teste vai de <b>Cliente → Conteúdo</b>.</p><p>Volte o <b>LOCAL_PREF</b> para 100 e compare: o caminho muda, e nenhum UPDATE sai do Cliente por causa disso.</p>" },
  { id: "prepend", g: "Seleção de caminho", sub: "rotas", label: "AS-path prepend (entrada)", set: { dir: 'DC', lpA: 100, prependB: 3, ev: 'none', link: 'L5', root: 'B' }, what: "<p>O Cliente repete o próprio AS três vezes no anúncio para o ISP B, e o tráfego de teste vai de <b>Conteúdo → Cliente</b>.</p><p>Tire o <b>prepend</b> e compare: o tráfego volta a entrar pelo ISP B.</p>" },
  { id: "fail", g: "Falhas", sub: "rotas", label: "Falha de enlace", set: { dir: 'DC', lpA: 100, prependB: 0, ev: 'down', link: 'L5', root: 'B' }, what: "<p>Depois de convergir, o enlace <b>L5 (ISP B / Cliente)</b> cai. A sessão termina na hora, as rotas aprendidas por ela são descartadas e a rede reconverge.</p><p>Escolha <b>Nenhum</b> em <b>Evento</b> e compare o caminho do tráfego de teste.</p>" },
  { id: "withdraw", g: "Falhas", sub: "rotas", label: "Retirada do prefixo", set: { dir: 'DC', lpA: 100, prependB: 0, ev: 'retirar', link: 'L5', root: 'D' }, what: "<p>Depois de convergir, o Cliente deixa de anunciar 203.0.113.0/24. Acompanhe as retiradas na Captura.</p><p>O tráfego de teste Conteúdo → Cliente não tem mais para onde ir.</p>" },
  { id: "hijack", g: "Segurança e defesa", sub: "seguranca", label: "Sequestro de prefixo", set: { dir: 'DC', attack: 'hijack', relLP: false, rov: 'off', cust: 'off', peer: 'off', damp: false, root: 'B' }, what: "<p>O Atacante (AS64666), cliente do ISP B, anuncia 203.0.113.0/24, prefixo que pertence ao Cliente (AS64510). Na Tabela BGP do ISP B, compare as duas rotas.</p><p>O tráfego de teste <b>Conteúdo → Cliente</b> mostra onde ele para. Depois ligue uma defesa no painel: a simulação é refeita.</p>" },
  { id: "hijack-filter", g: "Segurança e defesa", sub: "seguranca", label: "Defesa: filtro de prefixos", set: { dir: 'DC', attack: 'hijack', relLP: false, rov: 'off', cust: 'B', peer: 'off', damp: false, root: 'B' }, what: "<p>O mesmo anúncio falso, mas o ISP B filtra os prefixos que aceita de cada cliente. Veja, na Tabela BGP do ISP B, a rota do Atacante marcada como rejeitada.</p><p>Troque o filtro para <b>no Trânsito</b> e observe: o desvio volta. Por que o filtro do Trânsito não protege?</p>" },
  { id: "hijack-rov", g: "Segurança e defesa", sub: "seguranca", label: "Defesa: RPKI / ROV", set: { dir: 'DC', attack: 'hijack', relLP: false, rov: 'B', cust: 'off', peer: 'off', damp: false, root: 'B' }, what: "<p>O ISP B valida a origem de cada rota com os ROAs: 203.0.113.0/24 só pode ser originado pelo AS64510. Veja a rota do Atacante rejeitada como inválida.</p><p>Troque o ROV para <b>só no ISP A</b> e veja o tráfego Conteúdo → Cliente: o Conteúdo continua desviado. Por que a validação do ISP A não o protege?</p>" },
  { id: "route-leak", g: "Segurança e defesa", sub: "seguranca", label: "Vazamento de rota", set: { dir: 'AD', attack: 'route-leak', relLP: true, rov: 'off', cust: 'off', peer: 'off', damp: false, root: 'A' }, what: "<p>O ISP B repassa ao ISP A a rota de 198.51.100.0/24, que aprendeu do peer Conteúdo, embora a política valley-free proíba. Com LOCAL_PREF por relação comercial (peer 150, provedor 100), o ISP A passa a preferir essa rota.</p><p>O tráfego de teste é <b>ISP A → Conteúdo</b>. Ligue o <b>filtro de rotas de peers</b> no ISP A e compare.</p>" },
  { id: "route-flap", g: "Segurança e defesa", sub: "seguranca", label: "Flapping de rota", set: { dir: 'DC', attack: 'route-flap', relLP: false, rov: 'off', cust: 'off', peer: 'off', damp: false, root: 'B' }, what: "<p>Depois da primeira convergência, o Cliente retira e anuncia de novo 203.0.113.0/24, em dois ciclos. Observe os UPDATEs e as retiradas na Captura e o total no Experimento.</p><p>Ligue o <b>flap damping nos provedores</b> e compare o número de mensagens e o estado do prefixo no final.</p>" },
];

export const groupDoc: Record<string, string> = {
  "Sessões": "Como dois roteadores de AS diferentes abrem e mantêm uma sessão BGP, e como uma sessão morta é detectada.",
  "Propagação": "Como um prefixo se espalha de AS em AS e quem repassa o quê, conforme as relações comerciais.",
  "Seleção de caminho": "Como cada AS escolhe um único caminho entre vários, e como a política influencia o tráfego que sai e o que entra.",
  "Falhas": "O que acontece quando um caminho deixa de existir: retiradas, reconvergência e caminhos alternativos.",
  "Segurança e defesa": "Como anúncios indevidos, violações de política e instabilidade desviam ou interrompem o tráfego, e como as defesas de importação (filtros, RPKI, damping) barram cada problema."
};

export const scenDoc: Record<string, ScenarioDoc> = {
  "open": {
    "short": "TCP 179, OPEN e KEEPALIVE até Established.",
    "concept": "Uma sessão BGP é uma conexão <b>TCP na porta 179</b> entre dois roteadores configurados um como vizinho do outro. A sessão parte de <b>Idle</b>, passa por <b>Connect</b> (TCP subindo; se falhar, vai a <b>Active</b> e tenta de novo), <b>OpenSent</b> (OPEN enviado), <b>OpenConfirm</b> (OPEN recebido) e <b>Established</b> (OPEN confirmado por KEEPALIVE). Só então as rotas são trocadas.",
    "observe": [
      "Na aba Sessões: o estado de cada vizinho mudando a cada fase.",
      "Na aba Mensagem BGP de um OPEN: AS, hold time de 180 s (padrão Cisco IOS), router ID e capacidades.",
      "Na Captura: o handshake TCP antes de qualquer mensagem BGP."
    ],
    "msgs": [
      [
        "TCP SYN / SYN-ACK / ACK",
        "abre a conexão na porta 179",
        "um dos vizinhos"
      ],
      [
        "OPEN",
        "AS, hold time, router ID, capacidades",
        "os dois lados"
      ],
      [
        "KEEPALIVE",
        "confirma o OPEN",
        "os dois lados"
      ]
    ],
    "why": "O BGP não descobre vizinhos sozinho: toda sessão é configurada à mão, dos dois lados. Se os parâmetros do OPEN não batem (por exemplo, o AS esperado), a sessão termina com NOTIFICATION."
  },
  "hold": {
    "short": "Sem KEEPALIVE por 180 s, a sessão cai com NOTIFICATION.",
    "concept": "Cada lado envia um <b>KEEPALIVE</b> a cada 60 s e espera receber alguma mensagem dentro do <b>hold time</b> (180 s), valores padrão do Cisco IOS; a RFC 4271 sugere 30 s e 90 s. Quando o vizinho trava sem derrubar o enlace, só o <b>hold timer</b> percebe: ao expirar, o roteador envia <b>NOTIFICATION</b> (código 4, Hold Timer Expired), encerra a sessão e retira as rotas aprendidas por ela.",
    "observe": [
      "No log: os 180 s sem KEEPALIVE e a NOTIFICATION.",
      "Na aba Mensagem BGP da NOTIFICATION: código 4.",
      "Compare com a queda do enlace (cenário Falha de enlace): a queda da interface derruba a sessão na hora (fast-external-fallover)."
    ],
    "msgs": [
      [
        "KEEPALIVE",
        "param de chegar",
        "ISP B"
      ],
      [
        "NOTIFICATION",
        "Hold Timer Expired (código 4)",
        "Cliente"
      ],
      [
        "UPDATE (withdraw)",
        "retira as rotas que dependiam da sessão",
        "AS afetados"
      ]
    ],
    "why": "O hold time define quanto tempo o tráfego pode ir para um vizinho morto. Valores menores detectam falhas mais rápido; em produção, o BFD faz isso em milissegundos."
  },
  "prop": {
    "short": "A cada AS, o AS_PATH cresce e o NEXT_HOP muda.",
    "concept": "O Cliente anuncia o próprio prefixo aos provedores. Cada AS que repassa a rota acrescenta o <b>próprio número</b> no início do <b>AS_PATH</b> e troca o <b>NEXT_HOP</b> pelo próprio endereço no enlace. Um AS que recebe uma rota com o próprio número no AS_PATH a descarta: é assim que o BGP evita laços.",
    "observe": [
      "Na Captura: o mesmo prefixo com AS_PATH 64510, depois 64500 64510, depois 64496 64500 64510.",
      "Na aba Mensagem BGP: o NEXT_HOP de cada UPDATE é o endereço de quem anunciou.",
      "No log: anúncios descartados por conter o próprio AS."
    ],
    "msgs": [
      [
        "UPDATE",
        "AS_PATH 64510",
        "Cliente para os ISPs"
      ],
      [
        "UPDATE",
        "AS_PATH 64500 64510",
        "ISP A para Trânsito e ISP B"
      ],
      [
        "UPDATE",
        "AS_PATH 64496 64500 64510",
        "Trânsito para o Conteúdo"
      ]
    ],
    "why": "O AS_PATH é a memória do caminho: evita laços e serve de critério de escolha. Por isso o BGP é chamado de protocolo de vetor de caminho."
  },
  "export": {
    "short": "Rota de peer ou de provedor só vai para clientes.",
    "concept": "Cada AS repassa rotas conforme quem paga quem. Rotas de <b>clientes</b> vão para todos; rotas aprendidas de <b>peers</b> ou de <b>provedores</b> vão só para <b>clientes</b>. Assim nenhum AS oferece trânsito gratuito entre dois provedores ou dois peers (modelo valley-free, de Gao-Rexford).",
    "observe": [
      "Na Tabela BGP do ISP A: só um caminho para 198.51.100.0/24, pelo Trânsito.",
      "Na Tabela BGP do ISP B: dois caminhos, direto pelo Conteúdo (peer) e pelo Trânsito.",
      "O ISP B não repassa ao ISP A a rota do Conteúdo, porque ela veio de um peer e o ISP A também é peer."
    ],
    "cols": [
      "Rota aprendida de",
      "Repassada para",
      "Por quê"
    ],
    "msgs": [
      [
        "cliente",
        "clientes, peers e provedores",
        "o cliente paga pelo trânsito"
      ],
      [
        "peer",
        "só clientes",
        "peering não inclui trânsito para terceiros"
      ],
      [
        "provedor",
        "só clientes",
        "ninguém transporta de graça o tráfego de um provedor"
      ]
    ],
    "why": "É a política, e não a distância, que define boa parte dos caminhos da Internet. Repassar rotas fora dessa regra provoca vazamentos de rota e desvia tráfego por redes que não deveriam carregá-lo."
  },
  "aspath": {
    "short": "Com LOCAL_PREF igual, vence o caminho com menos AS.",
    "concept": "Quando o LOCAL_PREF é igual e nenhuma rota é local, o BGP escolhe o <b>AS_PATH mais curto</b>, isto é, o caminho que atravessa menos sistemas autônomos. O número de roteadores dentro de cada AS e a banda dos enlaces não entram nessa conta.",
    "observe": [
      "Na aba Comandos, com o Conteúdo em foco: <code>show ip bgp 203.0.113.0</code> mostra dois caminhos e o melhor.",
      "O caminho pelo ISP B tem 2 AS (64501 64510); o pelo Trânsito tem 3 (64496 64500 64510).",
      "No tráfego de teste Conteúdo → Cliente, ele vai pelo ISP B."
    ],
    "cols": [
      "Caminho",
      "AS_PATH",
      "Resultado"
    ],
    "msgs": [
      [
        "pelo ISP B (peering)",
        "64501 64510",
        "melhor: mais curto"
      ],
      [
        "pelo Trânsito",
        "64496 64500 64510",
        "perde: mais longo"
      ]
    ],
    "why": "O AS_PATH é uma aproximação grosseira de distância: um caminho com menos AS pode ser mais lento. Por isso os operadores combinam o AS_PATH com políticas de LOCAL_PREF."
  },
  "rid": {
    "short": "Empate em tudo: vence o vizinho de menor router ID.",
    "concept": "Quando LOCAL_PREF, AS_PATH, ORIGIN e MED empatam, o BGP ainda precisa escolher um único caminho. O último critério é o <b>menor router ID</b> (BGP Identifier) do vizinho que enviou a rota.",
    "observe": [
      "Na Tabela BGP do Trânsito: dois caminhos para 203.0.113.0/24, ambos com 2 AS no AS_PATH.",
      "O ISP A (router ID 10.0.0.2) vence o ISP B (10.0.0.3).",
      "A coluna Decisão mostra o critério que desempatou."
    ],
    "cols": [
      "Caminho",
      "Router ID do vizinho",
      "Resultado"
    ],
    "msgs": [
      [
        "pelo ISP A",
        "10.0.0.2",
        "melhor: menor router ID"
      ],
      [
        "pelo ISP B",
        "10.0.0.3",
        "perde no desempate"
      ]
    ],
    "why": "Desempates arbitrários tornam o caminho imprevisível para quem está fora. Operadores costumam definir políticas explícitas para não depender deles."
  },
  "lp": {
    "short": "O LOCAL_PREF controla por onde o tráfego sai do AS.",
    "concept": "O <b>LOCAL_PREF</b> é o primeiro critério da decisão e vale só dentro do AS: ele não é enviado aos vizinhos eBGP. Ao dar LOCAL_PREF 200 às rotas do ISP A, o Cliente passa a enviar seu tráfego por ele, mesmo com um AS_PATH mais longo.",
    "observe": [
      "Na Tabela BGP do Cliente: a rota para 198.51.100.0/24 pelo ISP A vence por LOCAL_PREF, apesar de ter 3 AS contra 2.",
      "No tráfego de teste Cliente → Conteúdo, ele sai pelo ISP A.",
      "Ao mudar o LOCAL_PREF, nenhum UPDATE é enviado: a decisão é só do Cliente."
    ],
    "cols": [
      "Caminho",
      "LOCAL_PREF / AS_PATH",
      "Resultado"
    ],
    "msgs": [
      [
        "pelo ISP A",
        "200 / 64500 64496 64511",
        "melhor: LOCAL_PREF maior"
      ],
      [
        "pelo ISP B",
        "100 / 64501 64511",
        "perde, mesmo mais curto"
      ]
    ],
    "why": "É a principal ferramenta de engenharia de tráfego de saída: preferir o provedor mais barato, o de melhor desempenho ou um enlace de backup."
  },
  "prepend": {
    "short": "Repetir o próprio AS desvia o tráfego que entra.",
    "concept": "No <b>AS-path prepend</b>, o AS repete o próprio número no anúncio para um vizinho, tornando aquele caminho mais longo para o resto da Internet. Como cada AS remoto decide sozinho, o prepend é uma <b>sugestão</b>: funciona nos AS que comparam o AS_PATH, não nos que decidem por LOCAL_PREF.",
    "observe": [
      "Na Captura: o UPDATE do Cliente para o ISP B com AS_PATH 64510 64510 64510 64510.",
      "Na Tabela BGP do ISP B: o caminho direto pelo Cliente passa a perder para o caminho pelo ISP A, mais curto.",
      "No tráfego de teste Conteúdo → Cliente, ele passa a entrar pelo ISP A."
    ],
    "cols": [
      "Anúncio",
      "AS_PATH",
      "Efeito"
    ],
    "msgs": [
      [
        "Cliente para ISP A",
        "64510",
        "normal"
      ],
      [
        "Cliente para ISP B",
        "64510 64510 64510 64510",
        "menos atraente para quem compara AS_PATH"
      ]
    ],
    "why": "É a ferramenta clássica para controlar o tráfego que entra. Muitos provedores dão LOCAL_PREF maior às rotas de clientes, e nesse caso o prepend não muda a escolha deles; aqui, todos usam LOCAL_PREF 100."
  },
  "fail": {
    "short": "O enlace cai, as rotas são retiradas e o tráfego muda de caminho.",
    "concept": "Quando um enlace cai, a sessão BGP termina e cada lado descarta as rotas aprendidas por ela. Quem perdeu o melhor caminho escolhe outro e avisa os vizinhos com UPDATEs ou <b>withdraws</b>, até a rede convergir de novo. Um cliente com dois provedores (<b>dual-homing</b>) continua alcançável pelo outro.",
    "observe": [
      "No log: a queda, as retiradas e os novos anúncios.",
      "No tráfego de teste Conteúdo → Cliente: o caminho passa a ser pelo Trânsito e pelo ISP A. Sem a queda, ele passa pelo ISP B.",
      "Na Tabela BGP do ISP B: a rota direta para o Cliente some."
    ],
    "msgs": [
      [
        "UPDATE (withdraw)",
        "retira o caminho perdido",
        "ISP B"
      ],
      [
        "UPDATE",
        "anuncia o novo melhor caminho",
        "AS que mudaram de escolha"
      ]
    ],
    "why": "O dual-homing só protege se o outro caminho também for anunciado e aceito. A convergência do BGP leva de segundos a minutos, e durante esse tempo parte do tráfego pode se perder."
  },
  "withdraw": {
    "short": "O prefixo deixa de existir: retiradas por toda a rede.",
    "concept": "Quando o AS de origem deixa de anunciar um prefixo, ele envia um UPDATE com o prefixo em <b>Withdrawn Routes</b>. Cada vizinho descarta a rota e, se não tiver alternativa, repassa a retirada. O prefixo desaparece da Internet.",
    "observe": [
      "Na Captura: UPDATEs de retirada saindo do Cliente e se espalhando.",
      "Na Tabela BGP de qualquer AS: 203.0.113.0/24 sem rota.",
      "No tráfego de teste Conteúdo → Cliente, ele é descartado no próprio Conteúdo, por falta de rota."
    ],
    "msgs": [
      [
        "UPDATE (withdraw)",
        "203.0.113.0/24 em Withdrawn Routes",
        "Cliente e depois os demais AS"
      ]
    ],
    "why": "É assim que uma rede sai do ar para o resto da Internet, de propósito (manutenção, migração) ou por erro de configuração."
  },
  "hijack": {
    "short": "Um cliente anuncia um prefixo que não é dele e desvia o tráfego.",
    "concept": "No <b>sequestro de prefixo</b>, um AS anuncia um prefixo que não lhe pertence. O BGP clássico não verifica se quem originou a rota tem autorização, e cada AS escolhe pelos critérios normais (LOCAL_PREF, AS_PATH, router ID). Onde a rota falsa vence, o tráfego para o prefixo vai ao originador falso. Aqui, o Atacante o descarta (blackhole), o que torna a indisponibilidade visível.",
    "observe": [
      "Na Captura: o AS64666 envia ao ISP B um UPDATE de 203.0.113.0/24 com AS_PATH 64666.",
      "Na Tabela BGP do ISP B: duas rotas de clientes com AS_PATH de mesmo tamanho; vence a do Atacante no desempate por router ID.",
      "No desenho: os AS que passaram a usar a rota falsa ficam em vermelho. O ISP A e o Trânsito mantêm o caminho legítimo.",
      "No tráfego de teste Conteúdo → Cliente, ele segue Conteúdo, ISP B, Atacante e é descartado."
    ],
    "cols": [
      "Mensagem",
      "AS_PATH",
      "Quem envia"
    ],
    "msgs": [
      [
        "UPDATE legítimo",
        "64510",
        "Cliente, para o ISP A e o ISP B"
      ],
      [
        "UPDATE falso",
        "64666",
        "Atacante, para o ISP B"
      ],
      [
        "Tráfego IP",
        "desviado e descartado",
        "Conteúdo, pelo caminho que o ISP B escolheu"
      ]
    ],
    "why": "O alcance do sequestro depende de quem aceita a rota falsa, e não de quem a originou. As defesas atuam na importação: filtro de prefixos no provedor do atacante e validação de origem (RPKI) em qualquer AS. Incidentes reais costumam ser erros de configuração, não ataques, e causam indisponibilidade em larga escala."
  },
  "hijack-filter": {
    "short": "O provedor aceita de cada cliente só os prefixos dele.",
    "concept": "O provedor monta, a partir dos registros de roteamento (IRR) e do contrato, a lista de prefixos que cada cliente pode anunciar, e rejeita o resto. O ISP B só aceita do Atacante prefixos do <b>cone de clientes</b> dele (nenhum), então a rota falsa é barrada na entrada, no primeiro salto, antes de se espalhar.",
    "observe": [
      "Na Tabela BGP do ISP B: a rota do Atacante aparece como rejeitada pelo filtro de prefixos de clientes.",
      "Nenhum AS usa a rota falsa e o tráfego Conteúdo → Cliente é entregue.",
      "Com o filtro no Trânsito (troque o controle), o ISP B volta a aceitar a rota, e o Trânsito não consegue distinguir o Atacante do Cliente, porque os dois estão no cone do ISP B."
    ],
    "cols": [
      "Onde o filtro está",
      "Efeito",
      "Por quê"
    ],
    "msgs": [
      [
        "ISP B (provedor do Atacante)",
        "barra o anúncio falso",
        "o Atacante não tem direito sobre o prefixo"
      ],
      [
        "Trânsito (provedor do ISP B)",
        "não barra",
        "o prefixo do Cliente pertence ao cone do ISP B"
      ],
      [
        "Nenhum",
        "o desvio acontece",
        "nada confere a origem"
      ]
    ],
    "why": "O filtro só funciona na borda: precisa estar no provedor direto de quem anuncia. Depende de listas atualizadas e não escala para a Internet inteira, por isso é complementado pelo RPKI."
  },
  "hijack-rov": {
    "short": "O ROA diz quem pode originar o prefixo; o roteador confere.",
    "concept": "No <b>RPKI</b> (RFC 6811), o dono do prefixo publica um <b>ROA</b> com o AS autorizado a originá-lo. Um roteador com <b>validação de origem (ROV)</b> compara o AS de origem de cada rota (o último do AS_PATH) com o ROA e rejeita as inválidas. O ROA de 203.0.113.0/24 autoriza só o AS64510, então a rota do AS64666 é inválida.",
    "observe": [
      "Na Tabela BGP do ISP B: a rota do Atacante rejeitada como RPKI inválido, com a origem recebida e a autorizada.",
      "Na aba Comandos, com o ISP B em foco, <code>show ip bgp 203.0.113.0</code> mostra a rota rejeitada.",
      "Com o ROV só no ISP A, o ISP A se protege, mas o Conteúdo, que aprende a rota pelo ISP B, continua desviado."
    ],
    "cols": [
      "Prefixo",
      "ROA: AS autorizado",
      "Resultado para o AS64666"
    ],
    "msgs": [
      [
        "203.0.113.0/24",
        "AS64510",
        "inválida: origem diferente"
      ],
      [
        "198.51.100.0/24",
        "AS64511",
        "sem anúncio de outra origem"
      ]
    ],
    "why": "O ROV só protege quem o aplica, e o benefício cresce com a adoção. Ele valida a origem, não o caminho: não detecta uma rota vazada nem um AS_PATH forjado (para isso existem ASPA e BGPsec)."
  },
  "route-leak": {
    "short": "O ISP B repassa a um peer uma rota que aprendeu de outro peer.",
    "concept": "Um <b>vazamento de rota</b> acontece quando um AS repassa uma rota além do que sua relação comercial permite. O ISP B aprendeu 198.51.100.0/24 do peer Conteúdo e a repassa ao ISP A, também peer, quando por valley-free ela só poderia ir para clientes. O ISP A passa a ter um caminho que não deveria existir.",
    "observe": [
      "Na Captura: o ISP B anuncia 198.51.100.0/24 ao ISP A, com AS_PATH 64501 64511.",
      "Na Tabela BGP do ISP A: duas rotas, a do Trânsito (provedor, LOCAL_PREF 100) e a vazada pelo ISP B (peer, LOCAL_PREF 150). A vazada vence.",
      "No tráfego de teste ISP A → Conteúdo, ele passa a ir pelo ISP B, em vez do Trânsito.",
      "Com o LOCAL_PREF por relação comercial desligado, a rota vazada perde no desempate, e o vazamento passa despercebido no tráfego."
    ],
    "cols": [
      "Caminho no ISP A",
      "LOCAL_PREF",
      "Resultado"
    ],
    "msgs": [
      [
        "pelo Trânsito (provedor)",
        "100",
        "perde"
      ],
      [
        "pelo ISP B (peer, vazada)",
        "150",
        "melhor: LOCAL_PREF maior"
      ]
    ],
    "why": "O ISP B passa a carregar tráfego de que não foi contratado, e o ISP A usa um caminho que não pagou nem negociou. Defesa: o ISP A filtra o que aceita do peer ao cone de clientes dele (barra a rota vazada); no protocolo, os papéis BGP com atributo OTC (RFC 9234) detectam o vazamento, mas dependem de os dois lados implementarem."
  },
  "route-flap": {
    "short": "O prefixo oscila e força reconvergências repetidas.",
    "concept": "No <b>route flapping</b>, uma rota alterna entre disponível e indisponível. Cada mudança gera UPDATEs ou withdraws que recalculam caminhos em vários AS e podem causar perda intermitente. O <b>flap damping</b> (RFC 2439) suprime um prefixo que oscila demais: depois de algumas retiradas, o vizinho deixa de aceitá-lo por um tempo.",
    "observe": [
      "Na Captura: duas sequências de retirada seguidas de novo anúncio.",
      "No log: cada ciclo e a convergência acumulada.",
      "Com o damping ligado: o número de mensagens cai, mas o prefixo do Cliente fica suprimido nos provedores. Compare o tráfego Conteúdo → Cliente."
    ],
    "cols": [
      "Mensagem",
      "Efeito",
      "Quem envia"
    ],
    "msgs": [
      [
        "UPDATE (withdraw)",
        "retira 203.0.113.0/24",
        "Cliente e AS que perderam o caminho"
      ],
      [
        "UPDATE",
        "anuncia de novo",
        "Cliente e AS que recuperaram o caminho"
      ]
    ],
    "why": "O damping contém a instabilidade, mas pune também o prefixo legítimo: ele fica fora do ar até a penalidade decair. Por isso o RIPE-580 e a RFC 7196 recomendam usá-lo, se for o caso, só com parâmetros conservadores."
  }
};
