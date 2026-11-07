// Abas próprias do simulador de TCP e UDP: Resultados e os gráficos (cwnd e vídeo).
// Os gráficos são SVG montados em texto e acompanham o relógio: a curva aparece até o instante atual.
import { esc, type Trace } from '../../../sim-core';
import type { TabDef, TabContext } from '../../../sim-core/ui';

const td = (cells: string[]): string => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
const txt = (x: number, y: number, s: string, anchor = 'middle'): string => '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" class="axis-label">' + esc(s) + '</text>';

const resultados: TabDef = {
  id: 'resultados',
  label: 'Resultados',
  render: (tr) => {
    const R = tr.raw;
    const sims = R.sims as any[];
    if (R.sub === 'cmp') {
      const a = sims[0].raw;
      const b = sims[1].raw;
      const N = R.P.N;
      const rows = [
        ['Tempo até o fim', Math.round(sims[0].end) + ' ms (inclui handshake e encerramento)', Math.round(b.time) + ' ms'],
        ['Dados entregues à aplicação', a.delivered + ' de ' + N, b.delivered + ' de ' + N],
        ['Perdas na rede', String(a.lost), String(b.lost)],
        ['Perdas percebidas pela aplicação', '0 (todas recuperadas)', String(N - b.delivered)],
        ['Ordem de entrega', esc(a.order), esc(b.order)],
        ['Retransmissões', String(a.retx), '0'],
        ['Conexão', 'handshake (1 RTT) e encerramento', 'nenhuma'],
      ];
      return '<h3>Resultados: TCP e UDP</h3><table class="sc-msgs"><thead><tr><th>Métrica</th><th>TCP</th><th>UDP</th></tr></thead><tbody>' + rows.map(td).join('') + '</tbody></table><p>Mesma rede e mesmas perdas (mesma semente): o TCP termina depois, mas entrega tudo e em ordem; o UDP termina antes e entrega o que chegou. A escolha depende da aplicação.</p>';
    }
    const s = sims[0].stats as Record<string, unknown>;
    return '<h3>Resultados</h3><table class="sc-msgs"><thead><tr><th>Métrica</th><th>Valor</th></tr></thead><tbody>' + Object.keys(s).map((k) => td([esc(k), esc(String(s[k]))])).join('') + '</tbody></table>';
  },
};

const L = 48;
const RT = 880;
const T = 14;

/** Cursor e área revelada até o instante atual. */
function reveal(id: string, x0: number, x1: number, now: number, t0: number, t1: number, bottom: number): { clip: string; cursor: string } {
  const x = x0 + ((Math.max(t0, Math.min(t1, now)) - t0) / (t1 - t0)) * (x1 - x0);
  return {
    clip: '<clipPath id="' + id + '"><rect x="' + (x0 - 2) + '" y="0" width="' + (x - x0 + 2).toFixed(1) + '" height="260"/></clipPath>',
    cursor: '<line x1="' + x.toFixed(1) + '" y1="' + T + '" x2="' + x.toFixed(1) + '" y2="' + bottom + '" style="stroke:var(--muted)"/>',
  };
}

function cwndChart(tr: Trace, ctx: TabContext): string {
  const sim = (tr.raw.sims as any[]).find((s) => s.samples.length);
  if (!sim) return '<p>O UDP não tem controle de congestionamento: não existe cwnd.</p>';
  const S = sim.samples as any[];
  const B = 222;
  const t0 = S[0].t;
  const t1 = Math.max(sim.end, t0 + 1);
  const maxC = Math.max(...S.map((s) => s.cwnd));
  const ss = S.map((s) => s.ssthresh).filter((v) => v <= maxC * 2);
  const yMax = Math.ceil(Math.max(maxC, ss.length ? Math.max(...ss) : 0, 4) * 1.15);
  const X = (t: number): number => L + ((t - t0) / (t1 - t0)) * (RT - L);
  const Y = (v: number): number => B - (Math.min(v, yMax) / yMax) * (B - T);
  let g = '';
  const ys = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].find((v) => yMax / v <= 8) || 5000;
  for (let v = 0; v <= yMax; v += ys) g += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + RT + '" y2="' + Y(v) + '" style="stroke:var(--border-soft)"/>' + txt(L - 6, Y(v) + 4, String(v), 'end');
  const tst = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].find((s) => (t1 - t0) / s <= 9) || 100000;
  for (let t = Math.ceil(t0 / tst) * tst; t <= t1; t += tst) g += txt(X(t), B + 16, t + ' ms');
  const now = ctx.timeAt(ctx.c);
  const rv = reveal('rv-cwnd', L, RT, now, t0, t1, B);
  const path = (k: string): string => S.map((s, i) => (i === 0 ? 'M' + X(s.t).toFixed(1) + ',' + Y(s[k]).toFixed(1) : 'H' + X(s.t).toFixed(1) + 'V' + Y(s[k]).toFixed(1))).join('') + 'H' + X(t1).toFixed(1);
  let mk = 0;
  let marks = '';
  S.forEach((s) => {
    if ((s.ev === 'fast retransmit' || s.ev === 'RTO' || s.ev === 'sonda de cauda') && mk++ < 40) {
      marks += '<line x1="' + X(s.t).toFixed(1) + '" y1="' + T + '" x2="' + X(s.t).toFixed(1) + '" y2="' + B + '" style="stroke:var(--muted-line);stroke-dasharray:3,4"/>' + txt(X(s.t) + 4, T + 10, s.ev === 'RTO' ? 'RTO' : s.ev === 'sonda de cauda' ? 'TLP' : '3 dup ACKs', 'start');
    }
  });
  const note = S.some((s) => s.ssthresh > yMax) ? txt(RT, T + 26, S[0].ssthresh >= 1000 ? 'ssthresh inicial: sem limite (acima da escala)' : 'ssthresh inicial (' + S[0].ssthresh + ') acima da escala', 'end') : '';
  const cur = S.reduce((a, s) => (s.t <= now ? s : a), S[0]);
  const svg = '<svg class="chart" viewBox="0 0 900 250" role="img" aria-label="Gráfico da janela de congestionamento (cwnd) e do ssthresh ao longo do tempo"><defs>' + rv.clip + '</defs>' + g +
    '<g clip-path="url(#rv-cwnd)">' + marks + '<path d="' + path('ssthresh') + '" fill="none" style="stroke:var(--chart-ssthresh);stroke-width:2px;stroke-dasharray:6,4"/><path d="' + path('cwnd') + '" fill="none" style="stroke:var(--chart-cwnd);stroke-width:2px"/></g>' + note + rv.cursor + '</svg>';
  const leg = '<div class="chart-legend"><span><i style="border-color:var(--chart-cwnd)"></i>cwnd (segmentos)</span><span><i style="border-color:var(--chart-ssthresh);border-top-style:dashed"></i>ssthresh</span><span>Linhas pontilhadas: perda detectada (3 dup ACKs, TLP ou RTO)</span></div>';
  const kt = Math.max(1, Math.ceil(S.length / 300));
  let rows = '';
  S.forEach((s, i) => {
    if (i % kt && !s.ev) return;
    rows += td([s.t.toFixed(1), String(s.cwnd), String(s.ssthresh), String(s.flight), String(s.rto), esc(String(s.ev || ''))]);
  });
  return '<h3>Janela de congestionamento (cwnd)</h3><p>Instante atual: ' + Math.round(now) + ' ms. Neste instante: cwnd ' + cur.cwnd + ', ssthresh ' + (cur.ssthresh >= 1000 ? 'sem limite' : cur.ssthresh) + ', ' + cur.flight + ' em voo.</p>' + leg + '<div class="chart-wrap">' + svg + '</div>' +
    '<details class="chart-table"><summary>Ver os valores do gráfico em tabela</summary><table class="sc-msgs"><thead><tr><th>Tempo (ms)</th><th>cwnd</th><th>ssthresh</th><th>Em voo</th><th>RTO (ms)</th><th>Evento</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
}

function videoChart(tr: Trace, ctx: TabContext): string {
  const sim = (tr.raw.sims as any[])[0];
  if (!sim.vsamples) return '<p>O gráfico de vídeo só existe no modo UDP: vídeo.</p>';
  const P = tr.raw.P;
  const S = sim.vsamples as any[];
  const fr = sim.frames as any[];
  const B = 172;
  const F0 = 190;
  const F1 = 212;
  const t0 = 0;
  const t1 = Math.max(sim.end, 1);
  const capK = P.bw * 1000;
  const peak = Math.max(...S.map((s) => Math.max(s.sent, s.recv)));
  const yMax = Math.max(capK, peak) * 1.1;
  const X = (t: number): number => L + ((t - t0) / (t1 - t0)) * (RT - L);
  const Y = (v: number): number => B - (Math.min(v, yMax) / yMax) * (B - T);
  let g = '';
  const ys = [100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000].find((v) => yMax / v <= 6) || 50000;
  for (let v = 0; v <= yMax; v += ys) g += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + RT + '" y2="' + Y(v) + '" style="stroke:var(--border-soft)"/>' + txt(L - 6, Y(v) + 4, String(v), 'end');
  const tst = [250, 500, 1000, 2000, 5000].find((s) => (t1 - t0) / s <= 10) || 10000;
  for (let t = 0; t <= t1; t += tst) g += txt(X(t), F1 + 16, t + ' ms');
  const now = ctx.timeAt(ctx.c);
  const rv = reveal('rv-vid', L, RT, now, t0, t1, F1);
  const path = (k: string): string => S.map((s, i) => (i === 0 ? 'M' + X(s.t).toFixed(1) + ',' + Y(s[k]).toFixed(1) : 'H' + X(s.t).toFixed(1) + 'V' + Y(s[k]).toFixed(1))).join('') + 'H' + X(t1).toFixed(1);
  const col: Record<string, string> = { ok: 'var(--teal)', artefatos: 'var(--amber)', congelado: 'var(--red)' };
  const fw = Math.max(0.6, X(40) - X(0));
  const strip = fr.map((f) => '<rect x="' + X(f.play - 40).toFixed(1) + '" y="' + F0 + '" width="' + fw.toFixed(1) + '" height="' + (F1 - F0) + '" style="fill:' + col[f.status] + ';opacity:.85"/>').join('');
  const svg = '<svg class="chart" viewBox="0 0 900 250" role="img" aria-label="Gráfico da taxa de vídeo enviada e entregue a tempo, com a faixa de estado dos quadros exibidos"><defs>' + rv.clip + '</defs>' + g +
    '<line x1="' + L + '" y1="' + Y(capK) + '" x2="' + RT + '" y2="' + Y(capK) + '" style="stroke:var(--muted);stroke-dasharray:6,4;stroke-width:1.5px"/>' +
    '<g clip-path="url(#rv-vid)"><path d="' + path('sent') + '" fill="none" style="stroke:var(--blue);stroke-width:2px"/><path d="' + path('recv') + '" fill="none" style="stroke:var(--amber);stroke-width:2px"/>' + strip + '</g>' +
    txt(RT, F0 - 4, 'quadros exibidos', 'end') + rv.cursor + '</svg>';
  const leg = '<div class="chart-legend"><span><i style="border-color:var(--blue)"></i>enviado (kbit/s)</span><span><i style="border-color:var(--amber)"></i>entregue a tempo (kbit/s)</span><span><i style="border-color:var(--muted);border-top-style:dashed"></i>capacidade do enlace</span><span>Faixa inferior: quadros exibidos (verde = ok, âmbar = artefatos, vermelho = congelado)</span></div>';
  const rows = S.map((s) => td([String(s.t), String(Math.round(s.sent)), String(Math.round(s.recv))])).join('');
  return '<h3>Taxa do vídeo e estado dos quadros</h3><p>Instante atual: ' + Math.round(now) + ' ms.</p>' + leg + '<div class="chart-wrap">' + svg + '</div>' +
    '<details class="chart-table"><summary>Ver os valores do gráfico em tabela</summary><table class="sc-msgs"><thead><tr><th>Tempo (ms)</th><th>Enviado (kbit/s)</th><th>Entregue a tempo (kbit/s)</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
}

const janela: TabDef = { id: 'cwnd', label: 'Janela (cwnd)', subs: ['tcp', 'dl', 'cmp'], render: cwndChart };
const video: TabDef = { id: 'video', label: 'Taxa do vídeo', subs: ['vid'], render: videoChart };

export const tabs: TabDef[] = [janela, video, resultados];
