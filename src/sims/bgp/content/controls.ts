// Controles do painel do simulador de BGP.
import type { ControlDef } from '../../../sim-core/ui';

const SEC = ['seguranca'];
const ROT = ['rotas'];
const EVT = ['sessao', 'rotas'];

export const controls: ControlDef[] = [
  {
    id: 'dir', grp: 'Teste', label: 'Sentido do tráfego', type: 'select', wide: true, def: 'DC',
    opts: [['DC', 'Conteúdo → Cliente'], ['CD', 'Cliente → Conteúdo'], ['AD', 'ISP A → Conteúdo']],
    help: { t: 'Sentido do tráfego', s: 'Quem envia o tráfego de teste no fim da simulação.', p: ['<b>ISP A → Conteúdo:</b> mostra o caminho de um provedor, útil no cenário de vazamento de rota.', '<b>Conteúdo → Cliente:</b> o tráfego entra no AS do Cliente. O caminho depende do que o Cliente anuncia (AS-path prepend, anúncio do prefixo).', '<b>Cliente → Conteúdo:</b> o tráfego sai do AS do Cliente. O caminho depende da política de saída (LOCAL_PREF).', 'Cada AS decide sozinho o próximo salto, consultando o melhor caminho da própria tabela BGP.'] },
  },
  {
    id: 'root', grp: 'Foco', label: 'AS em foco', type: 'select', wide: true, def: 'D',
    opts: [['T', 'Trânsito (AS64496)'], ['A', 'ISP A (AS64500)'], ['B', 'ISP B (AS64501)'], ['C', 'Cliente (AS64510)'], ['D', 'Conteúdo (AS64511)'], ['M', 'Atacante (AS64666)']],
    help: { t: 'AS em foco', s: 'AS cuja tabela aparece nas abas Tabela BGP e Comandos.', p: ['Define de qual roteador vêm a aba Tabela BGP e a saída dos comandos (<code>show ip bgp</code>, <code>summary</code> e <code>neighbors</code>).', 'As abas acompanham o relógio: mostram a tabela do AS escolhido no instante em que o diagrama está.'] },
  },
  {
    id: 'lpA', subs: ROT, grp: 'Política do Cliente', label: 'LOCAL_PREF das rotas do ISP A', type: 'select', num: true, wide: true, def: 100,
    opts: [[100, '100 (padrão)'], [200, '200 (preferir o ISP A)']],
    help: { t: 'LOCAL_PREF das rotas do ISP A', s: 'Preferência do Cliente pelas rotas vindas do ISP A.', p: ['<b>100 (padrão):</b> as rotas do ISP A e do ISP B empatam nesse critério, e a decisão passa para o AS_PATH.', '<b>200:</b> o Cliente prefere o ISP A mesmo que o AS_PATH seja mais longo, porque o LOCAL_PREF é avaliado primeiro.', 'O LOCAL_PREF vale só dentro do AS: não é enviado aos vizinhos, e por isso nenhum UPDATE sai do Cliente. Controla o tráfego que <b>sai</b>.'] },
  },
  {
    id: 'prependB', subs: ROT, grp: 'Política do Cliente', label: 'AS-path prepend para o ISP B', type: 'select', num: true, wide: true, def: 0,
    opts: [[0, 'nenhum'], [1, '1 vez'], [3, '3 vezes']],
    help: { t: 'AS-path prepend para o ISP B', s: 'Repete o AS do Cliente no anúncio enviado ao ISP B.', p: ['O Cliente acrescenta o próprio número de AS várias vezes ao AS_PATH do anúncio dirigido ao ISP B, deixando aquele caminho mais longo.', 'Quem compara o AS_PATH passa a preferir o caminho pelo ISP A. Controla o tráfego que <b>entra</b>.', 'Funciona como sugestão: AS que decidem por LOCAL_PREF ignoram o prepend.'] },
  },
  {
    id: 'ev', subs: EVT, grp: 'Evento', label: 'Evento depois da convergência', type: 'select', wide: true, def: 'none',
    opts: [['none', 'Nenhum'], ['down', 'Queda de enlace'], ['hold', 'Vizinho silencioso (hold timer)'], ['retirar', 'Cliente retira o prefixo']],
    help: { t: 'Evento depois da convergência', s: 'O que acontece depois que a rede converge.', p: ['<b>Queda de enlace:</b> a interface cai, a sessão termina na hora (fast-external-fallover) e cada lado descarta as rotas aprendidas pelo outro.', '<b>Vizinho silencioso:</b> um lado trava e para de enviar KEEPALIVE, mas o enlace continua ativo. Só o hold timer de 180 s percebe, e ele envia NOTIFICATION.', '<b>Retirada do prefixo:</b> o Cliente deixa de anunciar 203.0.113.0/24, e a retirada (withdraw) se espalha pela rede.'] },
  },
  {
    id: 'link', subs: EVT, grp: 'Evento', label: 'Enlace do evento', type: 'select', wide: true, def: 'L5',
    opts: [['L1', 'L1: Trânsito / ISP A'], ['L2', 'L2: Trânsito / ISP B'], ['L3', 'L3: ISP A / ISP B (peering)'], ['L4', 'L4: ISP A / Cliente'], ['L5', 'L5: ISP B / Cliente'], ['L6', 'L6: Trânsito / Conteúdo'], ['L7', 'L7: ISP B / Conteúdo (peering)'], ['L8', 'L8: ISP B / Atacante']],
    help: { t: 'Enlace do evento', s: 'O enlace que cai ou cujo vizinho silencia.', p: ['No vizinho silencioso, o lado que trava é o primeiro AS do nome do enlace e quem detecta é o segundo. Em L5, o ISP B trava e o Cliente detecta.', 'Não vale para a retirada do prefixo, que não usa enlace.'] },
  },
  {
    id: 'attack', subs: SEC, grp: 'Ataque', label: 'Problema de segurança', type: 'select', wide: true, def: 'hijack',
    opts: [['none', 'Nenhum (só as defesas ligadas)'], ['hijack', 'Sequestro de prefixo'], ['route-leak', 'Vazamento de rota'], ['route-flap', 'Flapping de rota']],
    help: { t: 'Problema de segurança', s: 'O anúncio indevido ou a instabilidade que a simulação injeta.', p: ['<b>Sequestro:</b> o Atacante (AS64666), cliente do ISP B, origina 203.0.113.0/24, prefixo do Cliente.', '<b>Vazamento:</b> o ISP B repassa ao ISP A uma rota de 198.51.100.0/24 aprendida de um peer, o que a política valley-free proíbe.', '<b>Flapping:</b> o Cliente retira e anuncia de novo o prefixo, em dois ciclos.'] },
  },
  {
    id: 'relLP', subs: SEC, grp: 'Defesas', label: 'LOCAL_PREF por relação comercial', type: 'check', def: false,
    help: { t: 'LOCAL_PREF por relação comercial', s: 'Prefere rotas de clientes, depois de peers, depois de provedores.', p: ['Ligado, todo AS atribui LOCAL_PREF 200 às rotas de clientes, 150 às de peers e 100 às de provedores: prefere a rota que lhe rende dinheiro ou custa menos. É a prática comum das operadoras.', 'Desligado, todas as rotas têm LOCAL_PREF 100 e a decisão passa para o AS_PATH. Isso simplifica os cenários de seleção de caminho, mas esconde o efeito de um vazamento de rota.'] },
  },
  {
    id: 'rov', subs: SEC, grp: 'Defesas', label: 'RPKI / ROV', type: 'select', wide: true, def: 'off',
    opts: [['off', 'desligado'], ['B', 'só no ISP B'], ['A', 'só no ISP A'], ['ABT', 'ISP A, ISP B e Trânsito'], ['ALL', 'todos os AS']],
    help: { t: 'RPKI / ROV', s: 'Rejeita rotas cuja origem não bate com o ROA.', p: ['O dono do prefixo publica um ROA com o AS autorizado a originá-lo (RFC 6811). Um AS com <b>validação de origem</b> rejeita rotas cujo último AS do AS_PATH é outro.', 'Escolha onde a validação está ativa. Ela protege quem a aplica: um AS sem ROV continua aceitando rotas inválidas.', 'Valida só a origem; não detecta um AS_PATH forjado nem uma rota vazada.'] },
  },
  {
    id: 'cust', subs: SEC, grp: 'Defesas', label: 'Filtro de prefixos de clientes', type: 'select', wide: true, def: 'off',
    opts: [['off', 'desligado'], ['B', 'no ISP B'], ['T', 'no Trânsito'], ['ALL', 'ISP A, ISP B e Trânsito']],
    help: { t: 'Filtro de prefixos de clientes', s: 'O provedor aceita de cada cliente só os prefixos dele.', p: ['O provedor aceita de um cliente apenas prefixos pertencentes ao <b>cone de clientes</b> dele (o próprio cliente e quem está abaixo), como as listas feitas com registros IRR.', 'Precisa estar no provedor <b>direto</b> do AS que anuncia. Um filtro mais acima não distingue os clientes de um mesmo cone.'] },
  },
  {
    id: 'peer', subs: SEC, grp: 'Defesas', label: 'Filtro de rotas de peers', type: 'select', wide: true, def: 'off',
    opts: [['off', 'desligado'], ['A', 'no ISP A'], ['ALL', 'ISP A, ISP B e Conteúdo']],
    help: { t: 'Filtro de rotas de peers', s: 'De um peer, aceita só o cone de clientes dele.', p: ['Um peer só deveria anunciar rotas próprias e de seus clientes. O filtro rejeita o resto, o que barra <b>vazamentos de rota</b>.', 'Não barra um sequestro que parta de dentro do cone do peer: o prefixo do Cliente pertence ao cone do ISP B, mesmo quando é o Atacante que o anuncia.'] },
  },
  {
    id: 'damp', subs: SEC, grp: 'Defesas', label: 'Flap damping nos provedores', type: 'check', def: false,
    help: { t: 'Flap damping nos provedores', s: 'Suprime prefixos que oscilam demais.', p: ['Depois de duas retiradas do mesmo prefixo pelo mesmo vizinho, o AS passa a rejeitar o prefixo desse vizinho (RFC 2439).', 'Reduz a instabilidade que se espalha, mas também tira do ar um prefixo legítimo até a penalidade decair. Só afeta o cenário de flapping.'] },
  },
];
