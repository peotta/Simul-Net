// Palco do simulador OSI, no lugar do diagrama de sequência e da topologia.
// Vista 1: quatro pilhas de camadas (cliente, switch, roteador, servidor) e a PDU descendo, atravessando o cabo e subindo.
// Vista 2: o encapsulamento aninhado da PDU atual (quadro, pacote, segmento, dados), com o texto do passo.
// Tudo é função pura do trace e do relógio (em linhas do trace): a posição da PDU é interpolada entre quadros-chave,
// de modo que o Passo, a pausa e a velocidade da bancada funcionam sem estado próprio.
import { esc, type Trace } from '../../sim-core';
import { LAYER_NAME, type FrameRec, type Step } from './modes';

const W = 850;
const H = 440;
const BOX_W = 180;
const BOX_H = 32;
const PITCH = 42;
const TOP = 56;
const CABLE_Y = 404;
const NODES = ['cli', 'sw', 'rt', 'srv'] as const;
const X: Record<string, number> = { cli: 110, sw: 320, rt: 530, srv: 740 };
const TITLE: Record<string, string> = { cli: 'Cliente', sw: 'Switch', rt: 'Roteador', srv: 'Servidor' };
const HAS: Record<string, number[]> = { cli: [1, 2, 3, 4, 5, 6, 7], sw: [1, 2], rt: [1, 2, 3], srv: [1, 2, 3, 4, 5, 6, 7] };
const layerY = (l: number): number => TOP + (7 - l) * PITCH + BOX_H / 2;
const CLS: Record<number, string> = { 1: 'osi-l1', 2: 'osi-l2', 3: 'osi-l3', 4: 'osi-l4', 5: 'osi-l7', 6: 'osi-l7', 7: 'osi-l7' };

/** Camadas que a PDU carrega: 2 (cabeçalho Ethernet, etiqueta e FCS), 3 (IP), 4 (TCP) e 7 (dados, que incluem as camadas 5 e 6). */
const ALL = [2, 3, 4, 7];
const setOfStep = (s: Step): number[] => {
  if (s.dir === 'down') {
    const lo = Math.min(...s.layers);
    return lo >= 5 ? [7] : lo === 4 ? [4, 7] : lo === 3 ? [3, 4, 7] : ALL;
  }
  if (s.dir === 'up') {
    const m = Math.max(...s.layers);
    return m >= 4 ? [7] : m === 3 ? [4, 7] : m === 2 ? [3, 4, 7] : ALL;
  }
  return s.layers.includes(3) ? [3, 4, 7] : ALL;
};

interface KF {
  r: number;
  ord: number;
  x: number;
  y: number;
  set: number[];
  step: number;
  frame: number;
}

const cache = new WeakMap<Trace, KF[]>();

function keyframes(tr: Trace): KF[] {
  const hit = cache.get(tr);
  if (hit) return hit;
  const steps = (tr.raw.steps || []) as Step[];
  const frames = (tr.raw.frames || []) as FrameRec[];
  const sentAt = frames.map((f) => tr.msgs[f.mid].tSend);
  const frameOfStep = (s: Step): number => {
    if (!frames.length) return 0;
    if (s.dir === 'down') {
      const j = sentAt.findIndex((t) => t >= s.t - 1e-9);
      return j < 0 ? frames.length - 1 : j;
    }
    let j = 0;
    sentAt.forEach((t, i) => {
      if (t <= s.t + 1e-9) j = i;
    });
    return j;
  };
  const kfs: KF[] = [];
  steps.forEach((s, i) => kfs.push({ r: tr.events[i].r as number, ord: 1, x: X[s.who], y: s.layers.reduce((a, l) => a + layerY(l), 0) / s.layers.length, set: setOfStep(s), step: i, frame: frameOfStep(s) }));
  frames.forEach((f, j) => {
    const m = tr.msgs[f.mid];
    kfs.push({ r: m.rS as number, ord: 2, x: X[f.from], y: CABLE_Y, set: ALL, step: -1, frame: j });
    kfs.push({ r: m.rA as number, ord: 0, x: X[f.to], y: CABLE_Y, set: ALL, step: -1, frame: j });
  });
  kfs.sort((a, b) => a.r - b.r || a.ord - b.ord);
  cache.set(tr, kfs);
  return kfs;
}

const SEG: { k: string; l: number; w: number; t: string }[] = [
  { k: 'eth', l: 2, w: 22, t: 'Eth' },
  { k: 'vlan', l: 2, w: 14, t: 'Q' },
  { k: 'ip', l: 3, w: 22, t: 'IP' },
  { k: 'tcp', l: 4, w: 28, t: 'TCP' },
  { k: 'app', l: 7, w: 40, t: 'HTTP' },
  { k: 'fcs', l: 2, w: 20, t: 'FCS' },
];

const hx = (n: number, w: number): string => '0x' + (n >>> 0).toString(16).padStart(w, '0');
const bin8 = (n: number): string => n.toString(2).padStart(8, '0');
const ease = (f: number): number => f * f * (3 - 2 * f);

export function stage(tr: Trace, clock: number): string {
  const frames = (tr.raw.frames || []) as FrameRec[];
  const steps = (tr.raw.steps || []) as Step[];
  const kfs = keyframes(tr);
  if (!kfs.length || !frames.length) return '<p>Sem dados.</p>';

  let k = 0;
  kfs.forEach((q, i) => {
    if (q.r <= clock + 1e-9) k = i;
  });
  const A = kfs[k];
  const B = kfs[k + 1] || A;
  const span = B.r - A.r;
  // suave dentro de um nó (de um passo ao seguinte); linear nos trechos do cabo, para o quadro não parar a cada quadro-chave
  const u = k + 1 < kfs.length && span > 0 && clock > A.r ? Math.min(1, (clock - A.r) / span) : 0;
  const f = A.step >= 0 && B.step >= 0 ? ease(u) : u;
  const px = A.x + (B.x - A.x) * f;
  const py = A.y + (B.y - A.y) * f;
  const al: Record<number, number> = {};
  ALL.forEach((l) => {
    const a = (A.set.includes(l) ? 1 : 0) * (1 - f) + (B.set.includes(l) ? 1 : 0) * f;
    al[l] = Math.max(0, Math.min(1, a));
  });
  const fr = frames[(f < 0.5 ? A : B).frame];
  // passo atual: o último quadro-chave de passo já alcançado
  let cur = -1;
  for (let i = k; i >= 0; i--) {
    if (kfs[i].step >= 0) {
      cur = kfs[i].step;
      break;
    }
  }
  const st = cur >= 0 ? steps[cur] : steps[0];
  const onCable = py > layerY(1) + 12;

  // ---- vista 1: as pilhas ----
  let svg = '<svg class="osi-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pilhas de camadas OSI do cliente, do switch, do roteador e do servidor, com a unidade de dados em trânsito"><title>Pilhas de camadas e a PDU em trânsito</title>';
  NODES.forEach((n) => {
    svg += '<text class="osi-node" x="' + X[n] + '" y="24" text-anchor="middle">' + esc(TITLE[n]) + '</text>';
    [7, 6, 5, 4, 3, 2, 1].forEach((l) => {
      const y = layerY(l) - BOX_H / 2;
      const has = HAS[n].includes(l);
      const hot = has && Math.abs(px - X[n]) < BOX_W / 2 + 4 && Math.abs(py - layerY(l)) <= BOX_H / 2 + 2;
      svg += '<rect class="osi-lay ' + CLS[l] + (has ? '' : ' osi-none') + (hot ? ' osi-hot' : '') + '" x="' + (X[n] - BOX_W / 2) + '" y="' + y + '" width="' + BOX_W + '" height="' + BOX_H + '" rx="6"/>';
      svg += '<text class="osi-lt' + (has ? '' : ' osi-dim') + '" x="' + (X[n] - BOX_W / 2 + 10) + '" y="' + (y + BOX_H / 2 + 5) + '">' + l + ' ' + esc(LAYER_NAME[l]) + '</text>';
    });
    // porta de rede ligada ao cabo
    svg += '<line class="osi-wire" x1="' + X[n] + '" y1="' + (layerY(1) + BOX_H / 2) + '" x2="' + X[n] + '" y2="' + CABLE_Y + '"/>';
  });
  // cabos entre nós vizinhos
  const links: [string, string, string][] = [['cli', 'sw', 'LAN'], ['sw', 'rt', tr.raw.vlan ? 'tronco 802.1Q' : 'LAN'], ['rt', 'srv', 'WAN']];
  links.forEach(([a, b, t]) => {
    svg += '<line class="osi-wire osi-cable" x1="' + X[a] + '" y1="' + CABLE_Y + '" x2="' + X[b] + '" y2="' + CABLE_Y + '"/>';
    svg += '<text class="osi-cap" x="' + (X[a] + X[b]) / 2 + '" y="' + (CABLE_Y + 22) + '" text-anchor="middle">' + esc(t) + '</text>';
  });
  svg += '<text class="osi-cap" x="8" y="' + (CABLE_Y + 22) + '">cabo (camada 1)</text>';

  // a PDU: tiras coloridas, uma por camada presente, que crescem ao entrar e encolhem ao sair
  const segs = SEG.filter((s) => s.k !== 'vlan' || fr.vid !== null).map((s) => ({ ...s, a: al[s.l] }));
  const total = segs.reduce((a, s) => a + s.w * s.a, 0);
  // dentro de uma pilha a tira vai para a direita da caixa, para não cobrir o nome da camada; no cabo fica centrada
  const shift = 26 * Math.max(0, Math.min(1, (CABLE_Y - 8 - py) / 24));
  const cx = px + shift;
  let sx = cx - total / 2;
  const SH = 22;
  segs.forEach((s) => {
    const w = s.w * s.a;
    if (w < 0.5) return;
    svg += '<rect class="osi-seg ' + CLS[s.l] + '" x="' + sx.toFixed(1) + '" y="' + (py - SH / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + SH + '" rx="3"/>';
    if (s.a > 0.85) svg += '<text class="osi-st" x="' + (sx + w / 2).toFixed(1) + '" y="' + (py + 4).toFixed(1) + '" text-anchor="middle">' + s.t + '</text>';
    sx += w;
  });
  const name = onCable ? 'bits' : st.pdu;
  svg += '<text class="osi-pdu" x="' + cx.toFixed(1) + '" y="' + (py - SH / 2 - 6).toFixed(1) + '" text-anchor="middle">' + esc(name) + '</text>';
  if (onCable) {
    const bits = ['10101010', '10101011', ...fr.bytes.slice(0, 2).map(bin8)].join(' ');
    svg += '<text class="osi-bits" x="' + cx.toFixed(1) + '" y="' + (py + SH / 2 + 14).toFixed(1) + '" text-anchor="middle">' + bits + '</text>';
  }
  svg += '</svg>';

  // ---- vista 2: o encapsulamento aninhado ----
  const L2 = fr.sizes.l2;
  const nodeNow = NODES.reduce((b, n) => (Math.abs(X[n] - px) < Math.abs(X[b] - px) ? n : b), NODES[0]);
  const lines: Record<number, [string, string[]]> = {
    2: ['Camada 2: quadro (' + L2 + ' bytes)', ['MAC de destino ' + fr.dmac, 'MAC de origem ' + fr.smac, fr.vid !== null ? 'etiqueta 802.1Q, VLAN ' + fr.vid : 'sem etiqueta de VLAN', 'FCS ' + hx(fr.fcs, 8)]],
    3: ['Camada 3: pacote (' + fr.sizes.l3 + ' bytes)', ['IP ' + fr.sip + ' para ' + fr.dip, 'TTL ' + fr.ttl + ', checksum ' + hx(fr.ipSum, 4)]],
    4: ['Camada 4: segmento (' + fr.sizes.l4 + ' bytes)', ['portas ' + fr.sport + ' para ' + fr.dport, 'seq ' + fr.seq + ', ack ' + fr.ack + ', ' + fr.flags]],
    7: ['Camadas 5 a 7: dados (' + fr.sizes.app + ' bytes)', [fr.http, 'texto ASCII, sem TLS']],
  };
  const open: number[] = ALL.filter((l) => al[l] > 0.02);
  let onion = '';
  open.forEach((l) => {
    const pct = Math.round(al[l] * 100);
    onion += '<div class="osi-box ' + CLS[l] + '" style="--a:' + pct + '%"><b>' + esc(lines[l][0]) + '</b>' + lines[l][1].map((t) => '<div class="meaning">' + esc(t) + '</div>').join('');
  });
  onion += '</div>'.repeat(open.length);
  if (!open.length) onion = '<p class="meaning">Nenhuma PDU neste instante.</p>';
  const aside =
    '<aside class="osi-onion" aria-label="Encapsulamento da PDU atual"><h3>Encapsulamento agora</h3><p class="meaning">Em ' + esc(TITLE[nodeNow]) + (onCable ? ', no cabo' : ', ' + esc(st.pdu)) + '. Quadro ' + fr.hop + ' de ' + fr.of + ' da ' + (fr.dir === 'req' ? 'requisição' : 'resposta') + '.</p>' + onion + '<p class="osi-now"><b>O que acontece:</b> ' + esc(st.text) + '</p></aside>';

  return '<div class="osi-stage"><div class="osi-stack">' + svg + '</div>' + aside + '</div>';
}
