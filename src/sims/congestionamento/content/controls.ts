// Controles do painel do simulador de controle de congestionamento: o caminho (enlace, atraso, fila e perda),
// o teste (duração e mudança de capacidade) e os ajustes de cada algoritmo.
import type { ControlDef } from '../../../sim-core/ui';

export const controls: ControlDef[] = [
  {
    id: 'bw', num: true, grp: 'Caminho', label: 'Capacidade do enlace gargalo', type: 'select',
    opts: [[10, '10 Mbit/s'], [20, '20 Mbit/s'], [50, '50 Mbit/s']], def: 20,
    help: { t: 'Capacidade do gargalo', s: 'Taxa do enlace mais lento do caminho, que é o único ponto de fila do simulador.', p: ['O emissor não conhece essa taxa. Descobri-la, sem desperdiçar banda e sem encher a fila, é justamente o trabalho do controle de congestionamento.', 'Capacidade e RTT juntos definem o BDP (produto banda x atraso): quantos segmentos cabem "em voo" no caminho sem formar fila. Com 20 Mbit/s e 50 ms, o BDP é de cerca de 83 segmentos de 1500 bytes.'] },
  },
  {
    id: 'rtt', num: true, grp: 'Caminho', label: 'RTT de base (sem fila)', type: 'select',
    opts: [[20, '20 ms (rede metropolitana)'], [50, '50 ms (nacional)'], [100, '100 ms (intercontinental)'], [200, '200 ms (satélite ou rede ruim)']], def: 50,
    help: { t: 'RTT de base', s: 'Tempo de ida e volta quando a fila do gargalo está vazia.', p: ['Cada rodada do simulador dura um RTT. Quanto maior o RTT, mais lento é o crescimento da janela no tempo, e maior é o BDP.', 'O RTT medido pelo emissor é o RTT de base mais o atraso de fila: com a fila cheia, ele pode dobrar ou mais.'] },
  },
  {
    id: 'buf', num: true, grp: 'Caminho', label: 'Fila do gargalo (em BDP)', type: 'select', wide: true,
    opts: [[0.25, 'Rasa: 1/4 do BDP'], [1, 'Média: 1 BDP (regra clássica)'], [4, 'Funda: 4 BDP (bufferbloat)']], def: 1,
    help: { t: 'Tamanho da fila', s: 'Quantos segmentos o roteador do gargalo guarda antes de descartar (descarte no fim da fila, tail drop).', p: ['Fila rasa: o Reno e o CUBIC perdem utilização depois de cada redução da janela, porque a fila esvazia. Fila funda: a janela cresce muito antes da primeira perda, e o atraso (RTT) explode. Esse excesso de fila é o bufferbloat.', 'Um BDP de fila é a regra clássica para o Reno manter o enlace cheio depois de dividir a janela por dois. O BBR depende pouco do tamanho da fila, porque não usa a perda como sinal principal.'] },
  },
  {
    id: 'loss', num: true, grp: 'Caminho', label: 'Perda aleatória (não é congestionamento)', type: 'select', wide: true,
    opts: [[0, 'Nenhuma'], [0.1, '0,1%'], [1, '1%'], [5, '5%']], def: 0,
    help: { t: 'Perda aleatória', s: 'Parcela dos segmentos perdida por motivos que não são a fila cheia, como ruído em enlace sem fio.', p: ['Os algoritmos baseados em perda (Reno e CUBIC) tratam toda perda como sinal de congestionamento e reduzem a janela. Com perda aleatória, isso derruba a vazão muito abaixo da capacidade.', 'O BBR não reduz a janela por perdas isoladas. O BBR descrito no draft reage só quando a perda passa de 2% em uma sondagem de banda (BBR.LossThresh).'] },
  },
  {
    id: 'dur', num: true, grp: 'Teste', label: 'Duração da transferência', type: 'select',
    opts: [[10, '10 s'], [20, '20 s'], [40, '40 s']], def: 20,
    help: { t: 'Duração', s: 'Tempo da transferência longa simulada, sempre limitada pela rede e nunca pela aplicação.', p: ['O CUBIC e o BBR têm escalas de tempo de segundos (o CUBIC depende do tempo desde a última perda; o BBR sonda a banda a cada 2 a 3 s e o RTT mínimo a cada 10 s). Use 20 ou 40 s para ver mais de um ciclo.'] },
  },
  {
    id: 'shift', grp: 'Teste', label: 'Mudança de capacidade no meio do teste', type: 'select', wide: true,
    opts: [['none', 'Nenhuma'], ['up', 'Capacidade dobra'], ['down', 'Capacidade cai à metade']], def: 'none',
    help: { t: 'Mudança de capacidade', s: 'A metade do tempo, o enlace dobra de capacidade ou cai à metade.', p: ['Simula uma rota que muda, ou um enlace sem fio cuja taxa varia. Mostra como cada algoritmo descobre a nova capacidade: o Reno e o CUBIC por crescimento da janela, o BBR pela sondagem de banda (ProbeBW_UP).', 'Quando a capacidade cai, o BBR continua enviando com base no máximo recente de vazão e forma fila até a estimativa envelhecer.'] },
  },
  {
    id: 'iw', num: true, grp: 'Algoritmo', label: 'Janela inicial (IW)', type: 'select', adv: true,
    opts: [[1, '1 segmento'], [4, '4 segmentos'], [10, '10 segmentos (RFC 6928)']], def: 10,
    help: { t: 'Janela inicial', s: 'Quantos segmentos o emissor envia na primeira rodada, sem ter recebido nenhum ACK.', p: ['A RFC 5681 permitia até 4 segmentos; a RFC 6928 elevou o limite experimental para 10, valor usado hoje nos sistemas operacionais comuns. Uma janela inicial maior encurta o slow start.'] },
  },
  {
    id: 'sack', subs: ['reno', 'cubic', 'cmp'], grp: 'Algoritmo', label: 'Confirmação seletiva (SACK)', type: 'check', def: true,
    help: { t: 'SACK', s: 'O receptor informa quais blocos já recebeu além da lacuna (RFC 2018).', p: ['Com SACK, o emissor repõe todos os segmentos perdidos de uma rodada em uma só recuperação. Sem SACK (NewReno, RFC 6582), cada ACK parcial repõe um segmento por RTT.', 'No simulador, sem SACK uma rajada de 4 ou mais perdas na mesma janela termina em timeout (RTO), e 2 ou 3 perdas esticam a recuperação por uma rodada para cada perda.'] },
  },
  {
    id: 'fastConv', subs: ['cubic', 'cmp'], grp: 'Algoritmo', label: 'Fast convergence do CUBIC', type: 'check', def: false, adv: true,
    help: { t: 'Fast convergence', s: 'Reduz o Wmax quando uma perda chega antes de a janela recuperar o valor anterior (RFC 9438, seção 4.7).', p: ['Serve para ceder banda a fluxos novos quando há vários CUBIC no mesmo gargalo. A RFC recomenda desativar quando há um só fluxo, como neste simulador, e por isso o padrão é desligado. O efeito aqui é pequeno.'] },
  },
  {
    id: 'seed', num: true, grp: 'Algoritmo', label: 'Semente da perda aleatória', type: 'select', adv: true,
    opts: [[7, 'Semente 7'], [13, 'Semente 13'], [42, 'Semente 42']], def: 7,
    help: { t: 'Semente', s: 'Escolhe a sequência de perdas aleatórias.', p: ['A mesma semente produz sempre as mesmas perdas, o que permite comparar algoritmos nas mesmas condições. Sem perda aleatória, a semente só afeta o intervalo entre as sondagens do BBR.'] },
  },
];
