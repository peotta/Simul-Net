// Gráficos Mermaid (xychart) da documentação: calculados pelo próprio motor do simulador.
import { scenarioParams, type ScenarioDef } from '../../../sim-core/ui';
import { ALGO_NAME, bufferSegs, normalize, runFlow, type Algo, type CongParams, type Round } from '../engine';
import { controls } from './controls';

export const BASE: CongParams = { bw: 20, rtt: 50, buf: 1, loss: 0, dur: 20, shift: 'none', iw: 10, sack: true, fastConv: false, seed: 7 };

const COR: Record<Algo, string> = { reno: '#dd2e44', cubic: '#2f80ed', bbr: '#2e9e4f' };
const QUADRADO: Record<Algo, string> = { reno: '🟥', cubic: '🟦', bbr: '🟩' };
const LARANJA = '#f4900c';
const PRETO = '#24292f';

/** Média ponderada pela duração das rodadas, em janelas de `passo` segundos. */
function porJanela(rounds: Round[], dur: number, passo: number, val: (r: Round) => number): number[] {
  const out: number[] = [];
  for (let s = 0; s < dur - 1e-9; s += passo) {
    let soma = 0;
    let peso = 0;
    rounds.forEach((r) => {
      const ov = Math.min(r.t + r.dur, (s + passo) * 1000) - Math.max(r.t, s * 1000);
      if (ov > 0) {
        soma += val(r) * ov;
        peso += ov;
      }
    });
    out.push(peso ? Math.round((soma / peso) * 10) / 10 : 0);
  }
  return out;
}

interface Linha {
  cor: string;
  v: number[];
}

function xychart(titulo: string, eixoY: string, passo: number, dur: number, linhas: Linha[], topo: number): string {
  return [
    '```mermaid',
    '%%{init: {"xyChart": {"width": 900, "height": 560}, "themeVariables": {"xyChart": {"plotColorPalette": "' + linhas.map((l) => l.cor).join(', ') + '"}}}}%%',
    'xychart-beta',
    '  title "' + titulo + '"',
    '  x-axis "Tempo (s)" ' + passo + ' --> ' + dur,
    '  y-axis "' + eixoY + '" 0 --> ' + topo,
    ...linhas.map((l) => '  line [' + l.v.join(', ') + ']'),
    '```',
  ].join('\n');
}

const teto = (linhas: Linha[], folga: number): number => {
  const m = Math.max(...linhas.map((l) => Math.max(...l.v))) * folga;
  const passo = m > 200 ? 50 : m > 40 ? 10 : 5;
  return Math.ceil(m / passo) * passo;
};

/** Vazão dos três algoritmos contra a capacidade, no caminho `o` (sobre o caminho de referência). */
export function graficoVazao(titulo: string, o: Partial<CongParams>): string {
  const P = normalize({ ...BASE, ...o });
  const passo = P.dur > 20 ? 2 : 1;
  const flows = (['reno', 'cubic', 'bbr'] as Algo[]).map((a) => runFlow(a, P).rounds);
  const linhas: Linha[] = (['reno', 'cubic', 'bbr'] as Algo[]).map((a, i) => ({ cor: COR[a], v: porJanela(flows[i], P.dur, passo, (r) => r.rate) }));
  linhas.push({ cor: PRETO, v: porJanela(flows[0], P.dur, passo, (r) => r.cap) });
  return ['**Legenda:** 🟥 Reno · 🟦 CUBIC · 🟩 BBR · ⬛ capacidade do enlace', '', xychart(titulo, 'Vazão (Mbit/s)', passo, P.dur, linhas, teto(linhas, 1.1))].join('\n');
}

/** Gráfico do cenário: a janela de um algoritmo (o dente de serra, no Reno) ou a vazão dos três (Comparação). */
export function scenarioChart(s: ScenarioDef): string {
  const P = normalize(scenarioParams(controls, s) as unknown as CongParams);
  const sh = P.shift === 'up' ? ', a capacidade dobra aos ' + P.dur / 2 + ' s' : P.shift === 'down' ? ', a capacidade cai à metade aos ' + P.dur / 2 + ' s' : '';
  if (s.sub === 'cmp') {
    const g = graficoVazao('Vazão: ' + P.bw + ' Mbit/s, RTT de ' + P.rtt + ' ms' + sh, P as Partial<CongParams>);
    return g + '\n\n*Gráfico do cenário (vazão).* Vazão média por janela de tempo do Reno, do CUBIC e do BBR no mesmo caminho, calculada pelo motor do simulador. Corresponde à aba Vazão e atraso.';
  }
  const algo = s.sub as Algo;
  const r = runFlow(algo, P).rounds;
  const passo = Math.max(0.1, Math.round((P.dur / 80) * 10) / 10);
  const bdp = r[0].bdp;
  const fila = bufferSegs(P);
  const linhas: Linha[] = [
    { cor: COR[algo], v: porJanela(r, P.dur, passo, (q) => q.cwnd) },
    { cor: LARANJA, v: porJanela(r, P.dur, passo, (q) => q.bdp) },
    { cor: PRETO, v: porJanela(r, P.dur, passo, (q) => q.bdp + fila) },
  ];
  const nome = ALGO_NAME[algo];
  const lim = algo === 'bbr' ? 'limite de dados em voo (cwnd) do BBR' : 'janela de congestionamento (cwnd) do ' + nome;
  const g = xychart('Janela: ' + P.bw + ' Mbit/s, RTT de ' + P.rtt + ' ms, fila de ' + Math.round(fila) + ' segm.' + sh, 'Segmentos', passo, P.dur, linhas, teto(linhas, 1.1));
  const leg = '**Legenda:** ' + QUADRADO[algo] + ' ' + lim + ' · 🟧 BDP (' + Math.round(bdp) + ' segm.) · ⬛ BDP mais fila (' + Math.round(bdp + fila) + ' segm.), o limite antes da perda';
  return leg + '\n\n' + g + '\n\n*Gráfico do cenário (janela).* Evolução da janela média por janela de tempo, no mesmo caminho do cenário, calculada pelo motor do simulador. Acima da linha preta há perda por estouro da fila. Corresponde à aba Janela e fila.';
}
