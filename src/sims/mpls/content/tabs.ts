// Abas próprias do simulador de MPLS: LIB / LFIB do LSR escolhido e Terminal (a saída do ping e do traceroute).
import { esc, type Trace } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import { fecFor, fecs, fmtL, HOSTS, igpNext, ipOn, linkBetween, localLabel, lsr, makeNet, neighbors, outLabel, sessionUp, vpnLabel, type Net } from '../model';
import type { TermLine } from '../modes';

const td = (cells: string[]): string => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';

/** Rede a mostrar no instante atual: no modo LDP, a fase que já terminou; na falha, a rede antes ou depois da queda. */
function netAt(tr: Trace, now: number): Net {
  const R = tr.raw;
  const net = R.net as Net;
  if (R.sub === 'ldp') {
    let step = 0;
    for (let k = 1; k <= 4; k++) if (now + 1e-9 >= R.tStep[k]) step = k;
    return makeNet({ ...net.cfg, step });
  }
  if (R.sub === 'falha' && now < R.tFail) return R.netBefore as Net;
  return net;
}

function lfibRows(net: Net, root: string): string[][] {
  const rows: string[][] = [];
  const { service } = net.cfg;
  if (lsr(root).role === 'PE') {
    HOSTS.filter((h) => h.pe !== root).forEach((h) => {
      if (service === 'vpn') {
        const fLo = fecs(net).find((f) => f.owner === h.pe && f.kind === 'loopback')!;
        const o = outLabel(net, root, fLo);
        rows.push(['IP (VRF CLIENTE)', h.net, 'push ' + (o.label !== 3 && o.label !== null ? o.label + ' + ' : '') + vpnLabel(h.pe), (o.label === null ? '-' : fmtL(o.label)) + ' / VPN ' + vpnLabel(h.pe), o.nh || '-']);
      } else {
        const f = fecFor(net, h.ip)!;
        const o = outLabel(net, root, f);
        rows.push(['IP', f.id, o.label === 3 ? 'sem rótulo (imp-null)' : o.label === null ? 'consulta IP' : 'push ' + o.label, o.label === null ? '-' : fmtL(o.label), o.nh || '-']);
      }
    });
    if (service === 'vpn') {
      const mine = HOSTS.find((h) => h.pe === root)!;
      rows.push([String(vpnLabel(root)), 'VRF CLIENTE ' + mine.net, 'pop e consulta na VRF', '-', mine.id]);
    }
  }
  fecs(net).forEach((f) => {
    const local = localLabel(net, root, f);
    if (f.owner === root) {
      if (local !== 3) rows.push([String(local), f.id, 'pop e consulta IP (egresso)', '-', 'local']);
      return;
    }
    const o = outLabel(net, root, f);
    if (!o.nh) rows.push([String(local), f.id, 'sem rota', '-', '-']);
    else if (o.label === null) rows.push([String(local), f.id, 'sem rótulo do vizinho', '-', o.nh]);
    else rows.push([String(local), f.id, o.label === 3 ? 'pop (PHP)' : 'swap', fmtL(o.label), o.nh + ' (' + ipOn(linkBetween(net, root, o.nh)!, o.nh) + ')']);
  });
  return rows;
}

const tabelas: TabDef = {
  id: 'tables',
  label: 'LIB / LFIB',
  render: (tr, ctx) => {
    const root = String(ctx.P.root || 'PE1');
    const net = netAt(tr, ctx.timeAt(ctx.c));
    const step = net.cfg.step;
    let h = '<h3>LFIB de ' + esc(root) + ' (usada no encaminhamento)</h3>';
    h += '<table class="sc-msgs"><thead><tr><th>Entrada</th><th>FEC</th><th>Operação</th><th>Saída</th><th>Próximo salto</th></tr></thead><tbody>';
    if (step < 4) h += '<tr><td colspan="5" class="meaning">A LFIB é instalada na última fase do LDP. Até lá, os pacotes são encaminhados por consulta IP salto a salto.</td></tr>';
    else lfibRows(net, root).forEach((r) => (h += td(r.map((c, i) => (i === 0 ? esc(c) : '<span class="meaning">' + esc(c) + '</span>')))));
    h += '</tbody></table>';
    h += '<h3>LIB de ' + esc(root) + ' (todos os rótulos recebidos, retenção liberal)</h3>';
    h += '<table class="sc-msgs"><thead><tr><th>FEC</th><th>Rótulo local</th><th>Rótulos recebidos (vizinho: rótulo)</th><th>Próximo salto IGP</th></tr></thead><tbody>';
    fecs(net).forEach((f) => {
      const nh = igpNext(net, root, f.owner);
      let remote = '-';
      if (step >= 3) {
        remote = neighbors(net, root).filter((n) => sessionUp(net, root, n.id)).map((n) => {
          const lab = n.id + ': ' + fmtL(localLabel(net, n.id, f));
          return n.id === nh ? '<b>' + lab + ' *</b>' : lab;
        }).join(', ') || '-';
      }
      h += td([esc(f.id), step >= 3 ? fmtL(localLabel(net, root, f)) : '-', '<span class="meaning">' + remote + '</span>', '<span class="meaning">' + (f.owner === root ? 'conectada' : nh || 'sem rota') + '</span>']);
    });
    h += '</tbody></table>';
    h += '<p>O asterisco marca o rótulo do próximo salto do IGP, o único que vai para a LFIB. Os demais ficam na LIB como reserva: se o IGP trocar de caminho, o rótulo novo já está lá.</p>';
    return h;
  },
};

const terminal: TabDef = {
  id: 'term',
  label: 'Terminal',
  subs: ['dados', 'ttl', 'falha'],
  render: (tr, ctx) => {
    const lines = (tr.raw.term || []) as TermLine[];
    const now = ctx.timeAt(ctx.c);
    const shown = lines.filter((l) => l.t <= now + 1e-9);
    const body = shown.map((l) => '<div' + (l.cls ? ' class="' + l.cls + '"' : '') + '>' + (esc(l.text) || '&nbsp;') + '</div>').join('');
    const who = String(tr.raw.dir);
    return '<h3>Terminal do ' + esc(who) + '</h3><pre class="term">' + (body || '<span class="t-dim">(aguardando)</span>') + '</pre><p class="muted">A saída aparece conforme as respostas chegam. Os tempos são simulados; o traceroute usa <code>-e</code> para exibir as extensões ICMP com a pilha de rótulos (RFC 4950).</p>';
  },
};

export const tabs: TabDef[] = [tabelas, terminal];
