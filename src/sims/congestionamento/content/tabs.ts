// Abas próprias do simulador de controle de congestionamento: os gráficos (janela e fila; vazão e atraso) e os
// resultados dos três algoritmos. Os gráficos são SVG montado em texto e acompanham o relógio: a curva aparece
// até o instante atual.
import { esc, type Trace } from '../../../sim-core';
import type { TabContext, TabDef } from '../../../sim-core/ui';
import { ALGO_NAME, capacityAt, num1, runFlow, toMbps, type Algo, type CongParams, type Flow, type Round } from '../engine';

const L = 52;
const RT = 880;
const T = 14;
const B = 214;
const COLORS: Record<Algo, string> = { reno: 'var(--amber)', cubic: 'var(--blue)', bbr: 'var(--teal)' };

const td = (cells: string[]): string => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
const txt = (x: number, y: number, s: string, anchor = 'middle'): string => '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" class="axis-label">' + esc(s) + '</text>';

interface Series {
  label: string;
  color: string;
  dash?: string;
  /** Pontos (ms, valor) em degraus: o valor vale até o próximo instante. */
  pts: [number, number][];
}

const nice = (max: number, parts: number): number => {
  const raw = max / parts;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return ([1, 2, 5, 10].find((m) => m * p >= raw) as number) * p;
};

function chart(id: string, aria: string, series: Series[], yMax: number, tEnd: number, now: number, yLabel: string): string {
  const X = (t: number): number => L + (t / tEnd) * (RT - L);
  const Y = (v: number): number => B - (Math.min(v, yMax) / yMax) * (B - T);
  const ys = nice(yMax, 6);
  let g = '';
  for (let v = 0; v <= yMax; v += ys) g += '<line x1="' + L + '" y1="' + Y(v).toFixed(1) + '" x2="' + RT + '" y2="' + Y(v).toFixed(1) + '" style="stroke:var(--border-soft)"/>' + txt(L - 6, Y(v) + 4, String(Math.round(v * 10) / 10), 'end');
  const ts = nice(tEnd, 8);
  for (let t = 0; t <= tEnd; t += ts) g += txt(X(t), B + 16, (t / 1000).toString().replace('.', ',') + ' s');
  const cx = X(Math.max(0, Math.min(tEnd, now)));
  const clip = '<clipPath id="' + id + '"><rect x="' + (L - 2) + '" y="0" width="' + (cx - L + 2).toFixed(1) + '" height="260"/></clipPath>';
  const path = (s: Series): string => s.pts.map(([t, v], i) => (i === 0 ? 'M' : 'L') + X(t).toFixed(1) + ',' + Y(v).toFixed(1)).join('');
  const lines = series.map((s) => '<path d="' + path(s) + '" fill="none" style="stroke:' + s.color + ';stroke-width:2px;' + (s.dash ? 'stroke-dasharray:' + s.dash : '') + '"/>').join('');
  return '<div class="chart-wrap"><svg class="chart" viewBox="0 0 900 250" role="img" aria-label="' + esc(aria) + '"><defs>' + clip + '</defs>' + g + txt(L, T - 3, yLabel, 'start') +
    '<g clip-path="url(#' + id + ')">' + lines + '</g><line x1="' + cx.toFixed(1) + '" y1="' + T + '" x2="' + cx.toFixed(1) + '" y2="' + B + '" style="stroke:var(--muted)"/></svg></div>';
}

const legend = (series: Series[], extra = ''): string => '<div class="chart-legend">' + series.map((s) => '<span><i style="border-color:' + s.color + ';' + (s.dash ? 'border-top-style:dashed' : '') + '"></i>' + esc(s.label) + '</span>').join('') + extra + '</div>';

function table(head: string[], rows: string[][]): string {
  return '<details class="chart-table"><summary>Ver os valores do gráfico em tabela</summary><table class="sc-msgs"><thead><tr>' + head.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.map(td).join('') + '</tbody></table></details>';
}

const flowsOf = (tr: Trace): Flow[] => (tr.raw.flows || []) as Flow[];
const pr = (tr: Trace): CongParams => tr.raw.P as CongParams;
const sampleRows = (rounds: Round[], max = 200): Round[] => {
  const k = Math.max(1, Math.ceil(rounds.length / max));
  return rounds.filter((r, i) => i % k === 0 || r.ev);
};
const stepPts = (rounds: Round[], f: (r: Round) => number): [number, number][] => rounds.map((r) => [r.t, f(r)] as [number, number]);

const janela: TabDef = {
  id: 'janela',
  label: 'Janela e fila',
  render: (tr, ctx: TabContext) => {
    const flows = flowsOf(tr);
    if (!flows.length) return '';
    const P = pr(tr);
    const tEnd = tr.raw.end as number;
    const now = ctx.timeAt(ctx.c);
    const bdpS: Series = { label: 'BDP (cabe sem fila)', color: 'var(--muted)', dash: '6,4', pts: [] };
    const fullS: Series = { label: 'BDP + fila (acima disso há perda)', color: 'var(--red)', dash: '2,4', pts: [] };
    const bufSegs = tr.raw.buf as number;
    const first = flows[0].rounds;
    bdpS.pts = first.map((r) => [r.t, r.bdp] as [number, number]);
    fullS.pts = first.map((r) => [r.t, r.bdp + bufSegs] as [number, number]);
    const series: Series[] = flows.map((f) => ({ label: (f.algo === 'bbr' ? 'BBR: limite de dados em voo' : ALGO_NAME[f.algo] + ': cwnd') + ' (segmentos)', color: COLORS[f.algo], pts: stepPts(f.rounds, (r) => r.cwnd) }));
    const yMax = Math.max(...flows.flatMap((f) => f.rounds.map((r) => Math.min(r.cwnd, 3 * (r.bdp + bufSegs)))), ...first.map((r) => r.bdp + bufSegs)) * 1.12;
    const all = [...series, bdpS, fullS];
    const cur = flows.map((f) => {
      const r = f.rounds.reduce((a, x) => (x.t <= now ? x : a), f.rounds[0]);
      return ALGO_NAME[f.algo] + ': janela ' + num1(r.cwnd) + ', fila ' + num1(r.q) + ' de ' + bufSegs + ' segmentos';
    });
    const fq = flows.length === 1 ? flows[0] : null;
    let h = '<h3>Janela de congestionamento e fila no gargalo</h3><p>Instante atual: ' + Math.round(now) + ' ms. ' + esc(cur.join('. ')) + '.</p>' + legend(all) +
      chart('rv-janela', 'Gráfico da janela de congestionamento ao longo do tempo, com o BDP e o limite da fila do gargalo', all, yMax, tEnd, now, 'segmentos de 1500 bytes');
    if (fq) {
      const qs: Series = { label: 'Fila no gargalo (segmentos)', color: 'var(--chart-ssthresh)', pts: stepPts(fq.rounds, (r) => r.q) };
      h += '<h3>Fila no gargalo</h3>' + legend([qs], '<span>Limite da fila: ' + bufSegs + ' segmentos (' + P.buf + ' BDP)</span>') +
        chart('rv-fila', 'Gráfico da ocupação da fila do gargalo ao longo do tempo', [qs, { label: 'Limite da fila', color: 'var(--red)', dash: '2,4', pts: fq.rounds.map((r) => [r.t, bufSegs] as [number, number]) }], bufSegs * 1.15, tEnd, now, 'segmentos');
    }
    const rows = sampleRows(flows[0].rounds).map((r) => {
      const cells = [num1(r.t), ...flows.map((f) => { const x = f.rounds.find((z) => z.k === r.k) || r; return num1(x.cwnd); }), num1(r.q), esc(r.ev)];
      return cells;
    });
    return h + table(['Tempo (ms)', ...flows.map((f) => ALGO_NAME[f.algo] + ' (segmentos)'), 'Fila (do 1º fluxo)', 'Evento'], rows);
  },
};

const vazao: TabDef = {
  id: 'vazao',
  label: 'Vazão e atraso',
  render: (tr, ctx: TabContext) => {
    const flows = flowsOf(tr);
    if (!flows.length) return '';
    const P = pr(tr);
    const tEnd = tr.raw.end as number;
    const now = ctx.timeAt(ctx.c);
    const capS: Series = { label: 'Capacidade do enlace', color: 'var(--muted)', dash: '6,4', pts: flows[0].rounds.map((r) => [r.t, r.cap] as [number, number]) };
    const rate: Series[] = flows.map((f) => ({ label: ALGO_NAME[f.algo] + ': vazão entregue (Mbit/s)', color: COLORS[f.algo], pts: stepPts(f.rounds, (r) => r.rate) }));
    const baseS: Series = { label: 'RTT de base (' + P.rtt + ' ms)', color: 'var(--muted)', dash: '6,4', pts: flows[0].rounds.map((r) => [r.t, P.rtt] as [number, number]) };
    const rtts: Series[] = flows.map((f) => ({ label: ALGO_NAME[f.algo] + ': RTT medido (ms)', color: COLORS[f.algo], pts: stepPts(f.rounds, (r) => r.rtt) }));
    const yR = Math.max(...flows[0].rounds.map((r) => r.cap)) * 1.12;
    const yT = Math.max(...flows.flatMap((f) => f.rounds.map((r) => r.rtt)), P.rtt) * 1.12;
    const rows = sampleRows(flows[0].rounds).map((r) => [num1(r.t), ...flows.map((f) => { const x = f.rounds.find((z) => z.k === r.k) || r; return num1(x.rate) + ' / ' + num1(x.rtt); }), num1(r.cap)]);
    return '<h3>Vazão entregue</h3><p>Instante atual: ' + Math.round(now) + ' ms. A vazão colada na capacidade é o objetivo; o que muda é o custo em atraso.</p>' + legend([...rate, capS]) +
      chart('rv-vazao', 'Gráfico da vazão entregue de cada algoritmo e da capacidade do enlace ao longo do tempo', [...rate, capS], yR, tEnd, now, 'Mbit/s') +
      '<h3>Atraso (RTT medido)</h3>' + legend([...rtts, baseS]) +
      chart('rv-rtt', 'Gráfico do RTT medido de cada algoritmo ao longo do tempo, com o RTT de base', [...rtts, baseS], yT, tEnd, now, 'ms') +
      table(['Tempo (ms)', ...flows.map((f) => ALGO_NAME[f.algo] + ' (Mbit/s / ms)'), 'Capacidade (Mbit/s)'], rows);
  },
};

const cache = new Map<string, Flow[]>();
function allFlows(P: CongParams): Flow[] {
  const key = JSON.stringify(P);
  let f = cache.get(key);
  if (!f) {
    if (cache.size > 40) cache.clear();
    f = (['reno', 'cubic', 'bbr'] as Algo[]).map((a) => runFlow(a, P));
    cache.set(key, f);
  }
  return f;
}

const pct = (v: number): string => num1(v * 100) + '%';

const resultados: TabDef = {
  id: 'resultados',
  label: 'Resultados',
  render: (tr) => {
    if (!tr.raw.P) return '';
    const P = pr(tr);
    const cur = tr.raw.sub as string;
    const F = allFlows(P);
    const rows = F.map((f) => {
      const s = f.stats;
      const name = cur === f.algo ? '<b>' + ALGO_NAME[f.algo] + '</b> (modo atual)' : ALGO_NAME[f.algo];
      return td([name, num1(s.goodput) + ' Mbit/s', pct(s.util), num1(s.avgRtt) + ' ms', num1(s.maxRtt) + ' ms', num1(s.avgQ) + ' segm.', String(s.lossEvents), String(s.rtos), s.t90 === null ? 'não chegou' : num1(s.t90 / 1000) + ' s']);
    }).join('');
    const cap = toMbps(capacityAt(P, 0));
    return '<h3>Resultados dos três algoritmos, com os mesmos parâmetros</h3><table class="sc-msgs"><thead><tr><th>Algoritmo</th><th>Vazão média</th><th>Utilização</th><th>RTT médio</th><th>RTT máximo</th><th>Fila média</th><th>Reduções por perda</th><th>Timeouts</th><th>Tempo até 90% da capacidade</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p>Enlace de ' + num1(cap) + ' Mbit/s' + (P.shift === 'up' ? ' (dobra no meio do teste)' : P.shift === 'down' ? ' (cai à metade no meio do teste)' : '') + ', RTT de base de ' + P.rtt + ' ms, fila de ' + num1(tr.raw.buf as number) + ' segmentos, perda aleatória de ' + num1(P.loss) + '% e duração de ' + P.dur + ' s. Utilização é a vazão média dividida pela capacidade média do enlace.</p>' +
      '<p class="muted">Cada algoritmo roda sozinho em uma cópia do caminho: o resultado não mede a competição entre eles. Modelo por rodadas, com valores ilustrativos: compare os algoritmos entre si, não com uma rede real.</p>';
  },
};

export const tabs: TabDef[] = [janela, vazao, resultados];
