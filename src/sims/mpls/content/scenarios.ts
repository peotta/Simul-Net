// Cenários e documentação do simulador de MPLS.
import type { ScenarioDef, ScenarioDoc } from '../../../sim-core/ui';

const base = { service: 'ip', php: 'implicit', prop: true };

export const stageTitles: Record<string, string> = {
  ldp: 'LDP: Hello, sessões, rótulos e LSP',
  dados: 'Plano de dados: push, swap e pop de um ping',
  ttl: 'TTL e traceroute pelo núcleo MPLS',
  falha: 'Falha de enlace e reconvergência do LSP',
};

export const scenarios: ScenarioDef[] = [
  { id: 'ldp', g: 'LDP e LSP', sub: 'ldp', label: 'Montagem do LSP', set: { ...base }, what: '<p>Acompanhe as quatro fases: <b>Discovery</b> (Hello em UDP 646), <b>Sessão</b> (TCP 646), <b>Mapping</b> (distribuição de rótulos) e <b>LSP</b> (LFIB instalada).</p><p>Depois escolha um LSR em <b>Ver LIB / LFIB do LSR</b> e compare a LIB, com os rótulos de todos os vizinhos, com a LFIB, que guarda só o do próximo salto. A aba LIB / LFIB acompanha o relógio: as tabelas se preenchem conforme as fases terminam.</p>' },
  { id: 'ping', g: 'LDP e LSP', sub: 'dados', label: 'Push, swap e pop', set: { ...base }, what: '<p>Com os LSPs instalados, o H-A envia um ping ao H-B. Na aba Captura, acompanhe cada operação: o PE1 faz <b>push</b>, os P fazem <b>swap</b> e o penúltimo salto faz <b>pop</b>.</p><p>Troque o sentido para H-B → H-A e repita: a volta usa outro LSP, com outros rótulos.</p>' },
  { id: 'semldp', g: 'LDP e LSP', sub: 'dados', label: 'Ping antes do LDP', set: { ...base, ctl: 'semldp' }, what: '<p>O IGP já convergiu, mas o LDP ainda não distribuiu rótulos. O ping segue por <b>roteamento IP comum</b>, salto a salto, sem pilha de rótulos.</p><p>Compare com o cenário Push, swap e pop: as mesmas máquinas, o mesmo destino, outro plano de dados.</p>' },
  { id: 'explicit', g: 'Rótulo do egresso', sub: 'dados', label: 'explicit-null', set: { ...base, php: 'explicit' }, what: '<p>O PE de saída anuncia o rótulo 0 (explicit-null) para as próprias FECs. Rode o ping e veja, na Captura, o último enlace levar o <b>rótulo 0</b> até o PE2, que o remove.</p>' },
  { id: 'nophp', g: 'Rótulo do egresso', sub: 'dados', label: 'Sem PHP', set: { ...base, php: 'none' }, what: '<p>O PE2 recebe o pacote ainda com o rótulo que ele mesmo anunciou e faz duas consultas: remove o rótulo e depois consulta o IP.</p><p>Compare onde o pop acontece nos três modos de rótulo do egresso.</p>' },
  { id: 'uniform', g: 'TTL', sub: 'ttl', label: 'TTL Uniform', set: { ...base }, what: '<p>Com a propagação de TTL, o TTL do IP é copiado para o rótulo e <b>cada LSR do núcleo aparece</b> no traceroute. Os P respondem com a pilha de rótulos recebida (RFC 4950).</p>' },
  { id: 'pipe', g: 'TTL', sub: 'ttl', label: 'TTL Pipe', set: { ...base, prop: false }, what: '<p>Sem a propagação, o rótulo começa com TTL 255 e <b>só os PEs aparecem</b> no traceroute.</p><p>Rode também o ping no modo Plano de dados e compare o TTL recebido com o do modelo Uniform.</p>' },
  { id: 'vpn-ldp', g: 'Serviços', sub: 'ldp', label: 'L3VPN: MP-BGP e rótulos VPN', set: { ...base, service: 'vpn' }, what: '<p>Além do LDP, na fase Mapping os PEs trocam por <b>MP-BGP</b> as rotas VPNv4 da VRF CLIENTE, cada uma com um <b>rótulo VPN</b>.</p><p>As redes dos clientes não entram no IGP nem nas FECs do LDP: os P não as conhecem.</p>' },
  { id: 'vpn', g: 'Serviços', sub: 'dados', label: 'L3VPN: pilha de dois rótulos', set: { ...base, service: 'vpn' }, what: '<p>Rode o ping e veja, na Captura, a pilha de <b>dois rótulos</b>: transporte e VPN.</p><p>Os P só olham o rótulo de transporte: não conhecem as redes dos clientes.</p>' },
  { id: 'vpn-sem', g: 'Serviços', sub: 'dados', label: 'L3VPN sem LDP: o PE descarta', set: { ...base, service: 'vpn', ctl: 'semldp' }, what: '<p>Sem LDP e sem MP-BGP, o PE1 não tem rota VPN nem LSP até o PE2. Diferente do IP sobre MPLS, o ping <b>não segue por roteamento comum</b>: o PE o descarta.</p>' },
  { id: 'failover', g: 'Falhas', sub: 'falha', label: 'Falha de enlace', set: { ...base, fail: 'L4' }, what: '<p>Um primeiro ping percorre PE1, P1, P3 e PE2. O enlace <b>L4 (P1 / P3)</b> cai, o OSPF reconverge e um segundo ping segue por outro caminho, com outros rótulos, sem esperar nova sinalização LDP.</p><p>Troque o enlace que cai e veja quando o caminho muda.</p>' },
];

export const groupDoc: Record<string, string> = {
  'LDP e LSP': 'Como o plano de controle (LDP sobre o IGP) monta os caminhos rotulados e como o plano de dados os percorre.',
  'Rótulo do egresso': 'O rótulo que o PE de saída anuncia para as próprias FECs define onde o último rótulo é removido.',
  TTL: 'Se o TTL do IP é copiado para o rótulo, o núcleo aparece ou some no traceroute do cliente.',
  Serviços: 'O MPLS usado para separar clientes sobre o mesmo núcleo: a VPN de camada 3.',
  Falhas: 'Como os LSPs reagem a mudanças de topologia.',
};

export const scenDoc: Record<string, ScenarioDoc> = {
  ldp: {
    short: 'O LDP descobre vizinhos, abre sessões e distribui rótulos.',
    concept: 'O MPLS encaminha pacotes por <b>rótulos</b> curtos em vez de consultar o endereço IP em cada salto. O <b>LDP</b> (RFC 5036) distribui esses rótulos: cada LSR descobre os vizinhos, abre uma sessão TCP com cada um e anuncia um rótulo local para cada destino (<b>FEC</b>) que conhece pelo IGP. O caminho rotulado resultante é o <b>LSP</b>.',
    observe: ['No diagrama: Discovery, Sessão, Mapping e LSP, uma fase após a outra.', 'Na aba LIB / LFIB: a LIB guarda o rótulo de cada vizinho; a LFIB usa só o do próximo salto do IGP.', 'No log: em cada par, o LSR com a maior loopback abre a sessão TCP.'],
    msgs: [['LDP Hello', 'descobre vizinhos (UDP 646, 224.0.0.2)', 'todos os LSRs'], ['Initialization e KeepAlive', 'abrem e mantêm a sessão (TCP 646)', 'cada par de vizinhos'], ['Label Mapping', 'anuncia a FEC e o rótulo local', 'todos os LSRs']],
    why: 'Sem LDP não há rótulos, e o tráfego segue por roteamento IP comum (ou é descartado, na L3VPN). O LDP depende do IGP: só existem rótulos para destinos que o OSPF conhece.',
  },
  ping: {
    short: 'O pacote atravessa o núcleo trocando de rótulo a cada salto.',
    concept: 'No plano de dados, o PE de entrada classifica o pacote em uma FEC e empilha o rótulo (<b>push</b>). Cada P olha só o rótulo do topo e o troca pelo rótulo que o próximo salto anunciou (<b>swap</b>), sem consultar o IP. No fim do LSP, o rótulo é removido (<b>pop</b>) e o pacote volta a ser IP.',
    observe: ['Na aba Captura: a pilha de rótulos muda a cada enlace.', 'Na aba Mensagem: o cabeçalho de rótulo (Label, TC, S e TTL, RFC 3032).', 'Na aba Experimento: as operações da ida e da volta, roteador por roteador.'],
    cols: ['Operação', 'O que faz', 'Onde'],
    msgs: [['push', 'empilha o rótulo da FEC', 'PE de entrada'], ['swap', 'troca o rótulo do topo', 'cada P'], ['pop', 'remove o rótulo', 'penúltimo salto (PHP)']],
    why: 'Comutar por rótulo permite engenharia de tráfego, VPNs e caminhos independentes do destino IP; o núcleo nem precisa conhecer as redes dos clientes.',
  },
  semldp: {
    short: 'Sem rótulos, o pacote segue por roteamento IP comum.',
    concept: 'O MPLS é construído sobre o IGP. Enquanto o LDP não distribui rótulos, cada roteador encaminha o pacote por <b>consulta IP</b> (maior prefixo) e o núcleo funciona como uma rede IP comum. Os rótulos só aparecem depois que o LDP instala a LFIB.',
    observe: ['Na Captura: a coluna de pilha mostra IP em todos os enlaces.', 'O TTL do IP cai a cada salto, inclusive nos P.', 'Compare com o cenário Push, swap e pop.'],
    cols: ['Operação', 'O que faz', 'Onde'],
    msgs: [['consulta IP (LPM)', 'escolhe o próximo salto pelo maior prefixo', 'cada roteador'], ['sem rótulo', 'o pacote não leva pilha MPLS', 'todos os enlaces']],
    why: 'Mostra que o MPLS é uma camada de encaminhamento sobre o IGP, não um substituto dele: se o LDP falha, o IP continua funcionando (no IP sobre MPLS).',
  },
  explicit: {
    short: 'O rótulo 0 chega ao egresso e preserva a marcação de QoS.',
    concept: 'Com <b>explicit-null</b> (rótulo 0 no IPv4), o penúltimo salto troca o rótulo por 0 em vez de removê-lo. O pacote chega ao egresso ainda rotulado, o que preserva o campo <b>TC</b> (antigo EXP), usado para QoS, até o último salto.',
    observe: ['Na Captura: swap para 0 no último enlace antes do PE2.', 'O PE2 remove o rótulo 0 e consulta o IP.', 'Compare com o cenário Push, swap e pop (implicit-null).'],
    cols: ['Operação', 'O que faz', 'Onde'],
    msgs: [['swap para 0', 'troca pelo explicit-null', 'penúltimo salto'], ['pop 0', 'remove o rótulo 0', 'PE de saída']],
    why: 'Provedores usam explicit-null quando a marcação de QoS do núcleo precisa valer até a borda.',
  },
  nophp: {
    short: 'O egresso recebe o próprio rótulo e faz duas consultas.',
    concept: 'Sem PHP, o egresso anuncia um rótulo próprio para as suas FECs. O rótulo chega até ele, que faz o pop e depois consulta o IP: são <b>duas consultas</b> no mesmo roteador.',
    observe: ['Na Captura: o último enlace ainda leva um rótulo comum, da faixa do PE2 (601 a 699).', 'No log: o PE2 faz o pop e a consulta IP.', 'Na aba LIB / LFIB do PE2: o rótulo local anunciado para as próprias FECs.'],
    cols: ['Operação', 'O que faz', 'Onde'],
    msgs: [['swap', 'troca para o rótulo do PE2', 'P3 ou P4'], ['pop', 'remove o próprio rótulo', 'PE2']],
    why: 'O PHP (penultimate hop popping) existe justamente para evitar essa consulta dupla no egresso.',
  },
  uniform: {
    short: 'O TTL do IP vai para o rótulo e os P aparecem no traceroute.',
    concept: 'No modelo <b>Uniform</b> (RFC 3443), o PE copia o TTL do IP para o rótulo na entrada e de volta na saída. Cada P decrementa o TTL do rótulo, então o traceroute enxerga todos os saltos do núcleo. Quando o TTL expira dentro do LSP, o ICMP Time Exceeded leva a pilha de rótulos recebida (RFC 4950).',
    observe: ['Na aba Terminal: os P aparecem com a anotação &lt;MPLS:L=...&gt;.', 'Cada sonda mostra o ICMP Time Exceeded seguindo adiante pelo LSP até o egresso.', 'Na aba Experimento: cada salto com a pilha devolvida no ICMP.'],
    msgs: [['UDP', 'sondas com TTL 1, 2, 3...', 'o host de origem'], ['Time Exceeded', 'com a pilha de rótulos (RFC 4950)', 'cada LSR']],
    why: 'Facilita o diagnóstico do núcleo, mas revela a topologia interna do provedor a qualquer cliente.',
  },
  pipe: {
    short: 'O rótulo começa com TTL 255 e o núcleo some.',
    concept: 'No modelo <b>Pipe</b> (<code>no mpls ip propagate-ttl</code>), o rótulo começa com TTL 255, independente do TTL do IP. O núcleo inteiro conta como um único salto para o cliente.',
    observe: ['Na aba Terminal: o traceroute vai do PE1 direto ao PE2.', 'Compare com o cenário TTL Uniform.', 'No modo Plano de dados, o ping mostra TTL recebido 62: só os PEs decrementaram.'],
    msgs: [['UDP', 'sondas com TTL 1, 2, 3...', 'o host de origem'], ['Time Exceeded', 'só dos PEs', 'PE1 e PE2']],
    why: 'Esconde a topologia do provedor dos clientes. É uma escolha comum em redes de operadoras.',
  },
  'vpn-ldp': {
    short: 'Os PEs trocam rotas VPNv4 e rótulos VPN por MP-BGP.',
    concept: 'Na <b>L3VPN</b> (RFC 4364), cada cliente tem uma tabela própria (<b>VRF</b>) nos PEs. As rotas dos clientes trocam de PE por <b>MP-BGP</b> (família VPNv4), cada uma com um <b>rótulo VPN</b>. O LDP continua distribuindo só os rótulos de transporte para as loopbacks.',
    observe: ['Na fase Mapping: a mensagem MP-BGP UPDATE entre PE1 e PE2, atravessando o núcleo.', 'Nas FECs do LDP: só as seis loopbacks, sem as redes dos clientes.', 'Nos rótulos VPN: 190 (do PE1) e 690 (do PE2), cada um da faixa do próprio PE.'],
    msgs: [['Label Mapping', 'rótulos de transporte para as loopbacks', 'todos os LSRs'], ['MP-BGP UPDATE', 'rota VPNv4, RD, next hop e rótulo VPN', 'PE1 e PE2']],
    why: 'Os P não participam do BGP dos clientes: a tabela de rotas de cada cliente fica só nos PEs, o que permite redes de clientes com endereços repetidos.',
  },
  vpn: {
    short: 'Dois rótulos: transporte até o PE de saída e VPN até a VRF.',
    concept: 'Na <b>L3VPN</b> (RFC 4364), o pacote atravessa o núcleo com dois rótulos: o externo (transporte, do LDP) leva até o PE de saída; o interno (VPN, aprendido por MP-BGP) indica a VRF.',
    observe: ['Na Captura: a pilha [transporte | VPN], por exemplo [206 | 690].', 'Com PHP, o penúltimo salto remove só o rótulo de transporte; o rótulo VPN chega ao PE2.', 'Na aba Mensagem: duas entradas MPLS, só a última com S = 1.'],
    cols: ['Operação', 'O que faz', 'Onde'],
    msgs: [['push', 'transporte + VPN', 'PE de entrada'], ['swap', 'troca só o rótulo de transporte', 'cada P'], ['pop VPN', 'consulta a VRF do cliente', 'PE de saída']],
    why: 'Permite atender vários clientes, até com endereços repetidos, sobre o mesmo núcleo. A separação é lógica, não criptográfica: o PE nunca deve aceitar pacotes rotulados vindos do cliente.',
  },
  'vpn-sem': {
    short: 'Sem rota VPN e sem LSP, o PE descarta o pacote.',
    concept: 'Na L3VPN as redes dos clientes existem só nas VRFs dos PEs. Sem o MP-BGP e o LDP, o PE de entrada não sabe qual é o PE de saída nem tem rótulo de transporte até ele. Como os P não conhecem rotas de clientes, <b>não há roteamento comum</b> para recorrer.',
    observe: ['No diagrama: o pacote chega ao PE1 e não sai dele.', 'Na aba Experimento: o motivo do descarte.', 'Compare com o cenário Ping antes do LDP, no IP sobre MPLS.'],
    msgs: [['Echo Request', 'enviado pelo host ao gateway', 'o host de origem'], ['descarte', 'sem rota VPNv4 nem LSP', 'PE de entrada']],
    why: 'Na L3VPN, uma falha do LDP ou do MP-BGP interrompe o serviço do cliente, ao contrário do IP sobre MPLS, que cai de volta para o IP.',
  },
  failover: {
    short: 'O IGP reconverge e a LFIB troca de rótulo na hora.',
    concept: 'Quando um enlace cai, o IGP reconverge e cada LSR passa a usar outro próximo salto. Graças à <b>retenção liberal</b>, os rótulos dos outros vizinhos já estavam na LIB, então a LFIB muda na hora. A sessão LDP do enlace caído termina e leva junto os rótulos aprendidos por ela.',
    observe: ['No diagrama: o Hello sem resposta, a reconvergência e o segundo ping por outro caminho.', 'Na aba Experimento: o LSP de ida antes e depois da falha.', 'Na aba LIB / LFIB do PE1: o próximo salto do LSP muda de P1 para P2.'],
    msgs: [['LDP', 'sessão P1 / P3 encerrada', 'P1 e P3'], ['Novo LSP', 'via P2 e P4', 'PE1 até PE2']],
    why: 'A convergência do MPLS depende do IGP. Em produção, mecanismos como a sincronização LDP-IGP e o Fast Reroute reduzem a perda durante a troca.',
  },
};
