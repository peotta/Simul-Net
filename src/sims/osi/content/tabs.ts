// Abas próprias do simulador OSI: bytes do quadro e comparação salto a salto (a pilha de camadas está no palco).
// Todas acompanham o relógio: mostram o quadro em trânsito no instante atual.
import { esc, type Trace } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import type { FrameRec } from '../modes';

const hex2 = (n: number): string => n.toString(16).padStart(2, '0');
const bin8 = (n: number): string => n.toString(2).padStart(8, '0');

/** Quadro em trânsito no instante dado: o último enviado até agora (ou o primeiro, antes de qualquer envio). */
function current(tr: Trace, now: number): FrameRec | null {
  const fr = (tr.raw.frames || []) as FrameRec[];
  if (!fr.length) return null;
  let cur = fr[0];
  fr.forEach((f) => {
    const m = tr.msgs[f.mid];
    if (m && m.tSend <= now + 1e-9) cur = f;
  });
  return cur;
}

const LAYER_CLS: Record<number, string> = { 1: 'osi-l1', 2: 'osi-l2', 3: 'osi-l3', 4: 'osi-l4', 7: 'osi-l7' };
const chip = (n: number, text: string): string => '<span class="osi-b ' + LAYER_CLS[n] + '">' + esc(text) + '</span>';
const legend = (): string => '<p class="osi-legend">' + [chip(7, 'camadas 5 a 7: aplicação'), chip(4, 'camada 4: transporte'), chip(3, 'camada 3: rede'), chip(2, 'camada 2: enlace'), chip(1, 'camada 1: física')].join(' ') + '</p>';
const dir = (f: FrameRec): string => (f.dir === 'req' ? 'requisição' : 'resposta');
const nodeName: Record<string, string> = { cli: 'cliente', sw: 'switch', rt: 'roteador', srv: 'servidor' };
const where = (f: FrameRec): string => dir(f) + ', salto ' + f.hop + ' de ' + f.of + ': ' + nodeName[f.from] + ' para ' + nodeName[f.to];

const bytes: TabDef = {
  id: 'bytes',
  label: 'Bytes do quadro',
  render: (tr, ctx) => {
    const f = current(tr, ctx.timeAt(ctx.c));
    if (!f) return '<h3>Bytes do quadro</h3><p>Nenhum quadro foi transmitido neste cenário.</p>';
    const layerAt: number[] = new Array(f.bytes.length).fill(2);
    f.segs.forEach((s) => {
      for (let i = s.off; i < s.off + s.len; i++) layerAt[i] = s.layer;
    });
    let h = '<h3>Bytes do quadro: ' + esc(where(f)) + '</h3>' + legend();
    h += '<p>O mesmo quadro, byte a byte, em hexadecimal. A cor indica a camada dona de cada byte.</p>';
    h += '<pre class="conf osi-hex">';
    for (let o = 0; o < f.bytes.length; o += 16) {
      h += '<span class="meaning">' + o.toString(16).padStart(4, '0') + '</span>  ';
      for (let i = o; i < Math.min(o + 16, f.bytes.length); i++) h += '<span class="osi-b ' + LAYER_CLS[layerAt[i]] + '">' + hex2(f.bytes[i]) + '</span> ';
      h += '\n';
    }
    h += '</pre>';
    h += '<h3>Onde está cada parte</h3><table class="sc-msgs"><thead><tr><th>Posição</th><th>Bytes</th><th>Camada</th><th>Parte</th></tr></thead><tbody>';
    f.segs.forEach((s) => {
      h += '<tr><td>' + s.off + '</td><td>' + s.len + '</td><td>' + chip(s.layer, s.layer === 7 ? '5 a 7' : String(s.layer)) + '</td><td class="meaning">' + esc(s.label) + '</td></tr>';
    });
    h += '</tbody></table>';
    const first = f.bytes.slice(0, 6).map(bin8).join(' ');
    h += '<h3>Camada 1: os bits</h3><p>Antes do quadro vão o preâmbulo (7 bytes <code>10101010</code>) e o SFD (<code>10101011</code>), que não fazem parte do quadro e não entram no FCS. Em seguida, os bytes acima viram sinais no cabo, na codificação do meio (por exemplo PAM-5 no 1000BASE-T). Os primeiros bits do quadro, o MAC de destino, são:</p><pre class="conf">' + chip(1, '10101010 x 7  10101011') + ' ' + chip(2, first) + '</pre>';
    return h;
  },
};

const salto: TabDef = {
  id: 'salto',
  label: 'Salto a salto',
  render: (tr, ctx) => {
    const fr = (tr.raw.frames || []) as FrameRec[];
    if (!fr.length) return '<h3>Salto a salto</h3><p>Nenhum quadro foi transmitido neste cenário.</p>';
    const cur = current(tr, ctx.timeAt(ctx.c));
    let h = '<h3>O que muda e o que não muda a cada salto</h3><p>Valores em negrito mudaram em relação ao salto anterior do mesmo sentido. O IP de origem, o IP de destino e as portas nunca mudam.</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Quadro</th><th>MAC de destino</th><th>MAC de origem</th><th>VLAN</th><th>IP de origem e destino</th><th>TTL</th><th>Checksum IP</th><th>FCS</th><th>Bytes</th></tr></thead><tbody>';
    fr.forEach((f, i) => {
      const p = i > 0 && fr[i - 1].dir === f.dir ? fr[i - 1] : null;
      const c = (v: string, w: string | undefined): string => (p && w !== v ? '<b>' + esc(v) + '</b>' : esc(v));
      const vid = f.vid === null ? '-' : String(f.vid);
      h += '<tr' + (cur && cur.mid === f.mid ? ' class="osi-cur"' : '') + '><td>' + esc(dir(f)) + ', salto ' + f.hop + '</td><td>' + c(f.dmac, p?.dmac) + '</td><td>' + c(f.smac, p?.smac) + '</td><td>' + c(vid, p ? (p.vid === null ? '-' : String(p.vid)) : undefined) + '</td><td>' + esc(f.sip + ' para ' + f.dip) + '</td><td>' + c(String(f.ttl), p ? String(p.ttl) : undefined) + '</td><td>' + c('0x' + f.ipSum.toString(16).padStart(4, '0'), p ? '0x' + p.ipSum.toString(16).padStart(4, '0') : undefined) + '</td><td>' + c('0x' + f.fcs.toString(16).padStart(8, '0'), p ? '0x' + p.fcs.toString(16).padStart(8, '0') : undefined) + '</td><td>' + f.sizes.l2 + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<h3>Quem muda o quê</h3><ul><li><b>Switch (camada 2):</b> só encaminha pelo MAC de destino. Muda o quadro apenas ao acrescentar ou retirar uma etiqueta 802.1Q, e então recalcula o FCS.</li><li><b>Roteador (camada 3):</b> decrementa o TTL, recalcula o checksum do IP e monta um quadro novo, com os MACs do próximo enlace e novo FCS.</li><li><b>Hosts (camadas 4 a 7):</b> só eles leem as portas e a mensagem da aplicação.</li></ul>';
    return h;
  },
};

export const tabs: TabDef[] = [bytes, salto];
