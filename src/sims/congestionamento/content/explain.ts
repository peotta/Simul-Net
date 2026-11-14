// Texto da aba Experimento e do cabeçalho do cenário do simulador de controle de congestionamento.
import type { Trace } from '../../../sim-core';
import { scenarioParams, type ScenarioDef } from '../../../sim-core/ui';
import { ALGO_NAME, num1, type Algo, type CongParams, type Flow } from '../engine';
import { controls } from './controls';

const b = (x: string): string => '<b>' + x + '</b>';
const ms = (v: number): string => num1(v) + ' ms';
const SHIFT: Record<string, string> = { none: '', up: 'a capacidade dobra no meio do teste', down: 'a capacidade cai à metade no meio do teste' };

/** Texto "Configuração do cenário": o que o cenário define. */
export function setup(s: ScenarioDef): string {
  const P = scenarioParams(controls, s) as unknown as CongParams;
  const p = [P.bw + ' Mbit/s', 'RTT de ' + P.rtt + ' ms', 'fila de ' + (P.buf === 1 ? '1 BDP' : P.buf === 4 ? '4 BDP (funda)' : '1/4 do BDP (rasa)'), P.loss ? 'perda aleatória de ' + num1(P.loss) + '%' : 'sem perda aleatória', P.dur + ' s'];
  if (SHIFT[P.shift]) p.push(SHIFT[P.shift]);
  if (s.sub !== 'bbr') {
    p.push(P.sack ? 'com SACK' : 'sem SACK');
    if (P.iw !== 10) p.push('janela inicial de ' + P.iw);
  }
  return p.join('; ');
}

function steps(f: Flow): string[] {
  const out: string[] = [];
  const evs = f.rounds.filter((r) => r.ev);
  const take = evs.length > 14 ? [...evs.slice(0, 8), ...evs.slice(-4)] : evs;
  take.forEach((r, i) => {
    if (evs.length > 14 && i === 8) out.push('...');
    out.push(num1(r.t) + ' ms: ' + r.ev + '.');
  });
  return out;
}

function concepts(algo: Algo, P: CongParams, f: Flow): string {
  const s = f.stats;
  const items: string[] = [];
  if (algo === 'reno') {
    items.push('O ' + b('Reno') + ' faz ' + b('AIMD') + ': soma 1 segmento por RTT e divide a janela por 2 na perda (RFC 5681).');
    if (s.rtos) items.push('Houve ' + b(s.rtos + (s.rtos === 1 ? ' timeout' : ' timeouts')) + ': sem dados suficientes para 3 ACKs duplicados, ou sem SACK diante de uma rajada, o emissor espera o RTO e volta a 1 segmento.');
    if (P.loss > 0) items.push('A ' + b('perda aleatória') + ' é lida como congestionamento: a vazão foi de ' + b(num1(s.goodput) + ' Mbit/s') + ' em um enlace de ' + P.bw + ' Mbit/s.');
    if (P.buf >= 4) items.push('Com fila funda, o RTT médio foi de ' + b(ms(s.avgRtt)) + ' para um RTT de base de ' + P.rtt + ' ms: ' + b('bufferbloat') + '.');
  } else if (algo === 'cubic') {
    items.push('O ' + b('CUBIC') + ' cresce pela função W(t) = C (t - K)^3 + Wmax (C = 0,4) e reduz a janela em 30% na perda (β = 0,7), conforme a RFC 9438.');
    items.push('O crescimento depende do ' + b('tempo desde a última perda') + ', e não do número de RTTs, o que favorece caminhos longos.');
    if (P.loss > 0) items.push('Perda aleatória de ' + num1(P.loss) + '%: ainda trata cada perda como congestionamento (vazão de ' + b(num1(s.goodput) + ' Mbit/s') + ').');
    if (P.buf >= 4) items.push('Com fila funda, o RTT médio foi de ' + b(ms(s.avgRtt)) + ': o CUBIC também enche o buffer.');
  } else {
    items.push('O ' + b('BBR') + ' estima a banda do gargalo (BtlBw) e o RTT mínimo (RTprop) e limita os dados em voo a cerca de 2 x BDP, sem depender da perda como sinal principal.');
    items.push('As fases: ' + b('Startup') + ' (dobra a cada rodada), ' + b('Drain') + ' (esvazia a fila), ' + b('ProbeBW') + ' (sonda a cada 2 a 3 s) e ' + b('ProbeRTT') + ' (a cada 10 s, renova o RTT mínimo). O BBR ainda é um Internet-Draft.');
    items.push('RTT médio de ' + b(ms(s.avgRtt)) + ' para um RTT de base de ' + P.rtt + ' ms: a fila fica curta.');
    if (P.loss > 0) items.push('Com perda aleatória de ' + num1(P.loss) + '%, a vazão foi de ' + b(num1(s.goodput) + ' Mbit/s') + (P.loss <= 2 ? ': perdas abaixo de 2% não reduzem o modelo.' : '.'));
  }
  return '<ul>' + items.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
}

function next(algo: Algo | 'cmp', P: CongParams): string {
  const out: string[] = [];
  if (algo !== 'cmp') out.push('Passe para o modo <b>Comparação</b> com os mesmos parâmetros e veja os três algoritmos lado a lado.');
  if (P.loss === 0) out.push('Escolha <b>perda aleatória de 1%</b> e compare a vazão do Reno e do CUBIC com a do BBR.');
  if (P.buf < 4) out.push('Escolha a fila <b>funda (4 BDP)</b> e observe o RTT na aba Vazão e atraso.');
  if (P.buf > 0.25) out.push('Escolha a fila <b>rasa (1/4 do BDP)</b> e veja a utilização do Reno cair.');
  if (P.shift === 'none') out.push('Faça a <b>capacidade dobrar</b> no meio do teste e compare como cada algoritmo descobre a banda nova.');
  if (P.bw < 50 || P.rtt < 200) out.push('Use <b>50 Mbit/s, 200 ms e fila rasa</b> (caminho longo e largo) e veja o Reno se recuperar devagar.');
  return '<ul>' + out.slice(0, 4).map((t) => '<li>' + t + '</li>').join('') + '</ul>';
}

export function explain(tr: Trace, P0: CongParams): string {
  const R = tr.raw;
  if (!R || !R.flows) return '';
  const P = R.P as CongParams;
  void P0;
  const flows = R.flows as Flow[];
  const sub = R.sub as Algo | 'cmp';
  const title = sub === 'cmp' ? 'Reno, CUBIC e BBR no mesmo caminho' : ALGO_NAME[sub];
  let h = '<h3>Experimento: ' + title + '</h3>';
  h += '<p><b>Objetivo.</b> Observar como ' + (sub === 'cmp' ? 'três algoritmos de controle de congestionamento do TCP' : 'o ' + ALGO_NAME[sub]) + ' descobre a capacidade do caminho e o que isso custa em atraso, perdas e vazão. Modelo: uma transferência longa por um gargalo com fila finita.</p>';
  h += '<h3>Configuração</h3><p>Enlace de <b>' + P.bw + ' Mbit/s</b>, RTT de base de <b>' + P.rtt + ' ms</b> (BDP de ' + num1(R.bdp0 as number) + ' segmentos de 1500 bytes), fila de <b>' + (R.buf as number) + ' segmentos</b> (' + P.buf + ' BDP), ' + (P.loss ? 'perda aleatória de <b>' + num1(P.loss) + '%</b>' : 'sem perda aleatória') + ', duração de ' + P.dur + ' s' + (SHIFT[P.shift] ? '; ' + SHIFT[P.shift] : '') + '.</p>';
  flows.forEach((f) => {
    const s = f.stats;
    const st = steps(f);
    h += '<h3>' + (sub === 'cmp' ? ALGO_NAME[f.algo] + ': ' : '') + 'O que aconteceu</h3>' + (st.length ? '<ol>' + st.map((t) => '<li>' + t + '</li>').join('') + '</ol>' : '<p>Nenhum evento além do crescimento da janela.</p>');
    h += '<h3>' + (sub === 'cmp' ? ALGO_NAME[f.algo] + ': ' : '') + 'Resultados</h3><ul>';
    h += '<li>Vazão média: <b>' + num1(s.goodput) + ' Mbit/s</b> (utilização de ' + num1(s.util * 100) + '%).</li>';
    h += '<li>RTT médio de <b>' + ms(s.avgRtt) + '</b> e máximo de ' + ms(s.maxRtt) + '; fila média de ' + num1(s.avgQ) + ' segmentos.</li>';
    h += '<li>Segmentos perdidos: <b>' + s.lostSegs + '</b> de ' + Math.round(s.sentSegs) + ' enviados; reduções por perda: ' + s.lossEvents + (s.rtos ? ' (timeouts: ' + s.rtos + ')' : '') + '.</li>';
    h += '<li>Tempo até 90% da capacidade: <b>' + (s.t90 === null ? 'não chegou' : ms(s.t90)) + '</b>.</li></ul>';
  });
  h += '<p class="muted">Modelo por rodadas (uma por RTT), com fila no gargalo e valores ilustrativos. Serve para comparar o comportamento dos algoritmos, não para prever uma rede real.</p>';
  h += '<h3>Conceitos observados</h3>' + (sub === 'cmp' ? flows.map((f) => '<p><b>' + ALGO_NAME[f.algo] + '</b></p>' + concepts(f.algo, P, f)).join('') : concepts(sub, P, flows[0]));
  h += '<h3>Para explorar em seguida</h3>' + next(sub, P);
  return h;
}
