// Abas próprias do simulador de BGP: sessões, tabela BGP e comandos do roteador do AS em foco.
// Todas acompanham o relógio: mostram o estado da última foto cujo instante já passou.
import { esc, type Trace } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import { ASES, HOLD, KEEPALIVE, LOSE_TXT, PREFIXES, REL_TXT, WIN_TXT, asName, ipOn, neighbors, relOf, type Cand, type Link, type Net, type Snap } from '../model';

const td = (cells: string[]): string => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
const m = (t: string): string => '<span class="meaning">' + t + '</span>';

function snapAt(tr: Trace, now: number): Snap {
  const snaps = tr.raw.snaps as Snap[];
  let k = 0;
  snaps.forEach((s, i) => {
    if (s.t <= now + 1e-9) k = i;
  });
  return snaps[k];
}

const hms = (s: number): string => {
  const v = Math.max(0, Math.round(s));
  return [Math.floor(v / 3600), Math.floor(v / 60) % 60, v % 60].map((x) => String(x).padStart(2, '0')).join(':');
};

const relText = (l: Link): string => (l.rel === 'peer' ? 'peering' : ASES[l.a].name + ' é provedor de ' + ASES[l.b].name);

function stateHtml(s: Snap['sessions'][number]): string {
  if (!s.up) return '<span class="state-down">enlace caído</span>';
  if (s.silent && s.state === 'Idle') return '<span class="state-down">Idle (hold timer expirou)</span>';
  if (s.silent) return '<span class="state-down">Established (sem KEEPALIVE)</span>';
  const c = s.state === 'Established' ? 'state-est' : s.state === 'Idle' ? 'state-idle' : 'state-mid';
  return '<span class="' + c + '">' + esc(s.state) + '</span>';
}

const sessoes: TabDef = {
  id: 'sessoes',
  label: 'Sessões',
  render: (tr, ctx) => {
    const snap = snapAt(tr, ctx.timeAt(ctx.c));
    const net = tr.raw.net as Net;
    let h = '<h3>Sessões BGP</h3><p>Instante: ' + esc(snap.label) + '.</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Sessão</th><th>Relação</th><th>Endereços</th><th>Estado</th><th>Hold time</th><th>Prefixos recebidos</th><th>Mensagens enviadas</th></tr></thead><tbody>';
    net.links.forEach((l) => {
      const s = snap.sessions.find((x) => x.id === l.id) as Snap['sessions'][number];
      h += td([
        esc(ASES[l.a].name + ' ↔ ' + ASES[l.b].name), m(esc(relText(l))), esc(l.ipA + ' / ' + l.ipB), stateHtml(s), s.est ? HOLD + ' s (keepalive ' + KEEPALIVE + ' s)' : '-',
        esc(ASES[l.a].name + ': ' + s.ra + ' | ' + ASES[l.b].name + ': ' + s.rb), esc(ASES[l.a].name + ': ' + s.sa + ' | ' + ASES[l.b].name + ': ' + s.sb),
      ]);
    });
    return h + '</tbody></table><p>O BGP não descobre vizinhos sozinho: cada sessão é configurada à mão, nos dois lados. As rotas só são trocadas em Established.</p>';
  },
};

function row(x: string, r: Cand, first: boolean, p: string, net: Net): string {
  const from = r.local ? 'origem local' : ASES[r.from as string].name + ' (' + REL_TXT[relOf(net, x, r.from as string)] + ')';
  const why = r.rej ? 'rejeitada: ' + r.rej.why : r.best ? 'melhor: ' + WIN_TXT[r.reason as string] : 'perdeu: ' + LOSE_TXT[r.reason as string];
  return td([r.best ? '<b>*&gt;</b>' : '*', first ? p : '', esc(r.nh), esc(from), String(r.lp), r.path.length ? r.path.join(' ') : '(vazio)', m(esc(why))]);
}

const tabela: TabDef = {
  id: 'bgp',
  label: 'Tabela BGP',
  render: (tr, ctx) => {
    const root = String(ctx.P.root || 'D');
    const snap = snapAt(tr, ctx.timeAt(ctx.c));
    const net = tr.raw.net as Net;
    let h = '<h3>Tabela BGP de ' + esc(asName(root)) + ', router ID ' + ASES[root].rid + '</h3><p>Instante: ' + esc(snap.label) + '.</p>';
    h += '<table class="sc-msgs"><thead><tr><th></th><th>Prefixo</th><th>Next hop</th><th>Aprendida de</th><th>LOCAL_PREF</th><th>AS_PATH</th><th>Decisão</th></tr></thead><tbody>';
    PREFIXES.forEach((p) => {
      const c = snap.tables[root][p];
      if (!c.length) h += '<tr><td></td><td>' + p + '</td><td colspan="5">' + m('sem rota' + (snap.sessions.every((s) => !s.est) ? ' (as rotas chegam na fase UPDATE)' : '')) + '</td></tr>';
      else c.forEach((r, i) => (h += row(root, r, i === 0, p, net)));
    });
    return h + '</tbody></table><p>* é um caminho válido e *&gt; é o melhor, o único que o AS usa e repassa. As rotas rejeitadas pelas defesas aparecem com o motivo.</p>';
  },
};

function show(snap: Snap, x: string): string[] {
  const o: string[] = [];
  const upd = snap.updates + 1;
  o.push('BGP table version is ' + upd + ', local router ID is ' + ASES[x].rid, 'Status codes: * valid, > best', 'Origin codes: i - IGP', '', '     Network            Next Hop            Metric LocPrf Weight Path');
  let total = 0;
  PREFIXES.forEach((p) => {
    const c = snap.tables[x][p].filter((r) => !r.rej);
    if (c.length) total++;
    c.forEach((r, i) => o.push(' ' + (r.best ? '*>' : '* ') + '  ' + (i === 0 ? p : '').padEnd(19) + r.nh.padEnd(20) + '0'.padStart(6) + ' ' + (r.lp !== 100 ? String(r.lp) : '').padStart(6) + ' ' + (r.local ? '32768' : '0').padStart(6) + ' ' + (r.path.length ? r.path.join(' ') + ' ' : '') + 'i'));
  });
  o.push('', 'Total number of prefixes ' + total);
  return o;
}

function summary(snap: Snap, x: string, net: Net): string[] {
  const o = ['BGP router identifier ' + ASES[x].rid + ', local AS number ' + ASES[x].asn, '', 'Neighbor        V    AS MsgRcvd MsgSent Up/Down  State/PfxRcd'];
  neighbors(net, x).forEach((v) => {
    const l = v.link;
    const s = snap.sessions.find((k) => k.id === l.id) as Snap['sessions'][number];
    const mine = l.a === x ? s.sa : s.sb;
    const theirs = l.a === x ? s.sb : s.sa;
    const got = l.a === x ? s.ra : s.rb;
    const st = s.est ? String(got) : !s.up || s.silent || s.state === 'Idle' ? 'Idle' : 'Active';
    o.push(ipOn(l, v.id).padEnd(16) + '4 ' + String(ASES[v.id].asn).padStart(5) + ' ' + String(theirs).padStart(7) + ' ' + String(mine).padStart(7) + ' ' + (s.est ? hms(snap.clock - s.upSince) : 'never').padEnd(9) + st.padStart(12));
  });
  return o;
}

function neighborsOut(snap: Snap, x: string, net: Net): string[] {
  const o: string[] = [];
  neighbors(net, x).forEach((v) => {
    const l = v.link;
    const s = snap.sessions.find((k) => k.id === l.id) as Snap['sessions'][number];
    o.push('BGP neighbor is ' + ipOn(l, v.id) + ', remote AS ' + ASES[v.id].asn + ', external link (' + REL_TXT[relOf(net, x, v.id)] + ')');
    o.push('  BGP version 4, remote router ID ' + ASES[v.id].rid);
    o.push('  BGP state = ' + (s.est ? 'Established, up for ' + hms(snap.clock - s.upSince) : !s.up ? 'Idle (enlace caído)' : s.silent ? 'Idle (hold timer expirou)' : s.state));
    o.push('  Hold time is ' + HOLD + ', keepalive interval is ' + KEEPALIVE + ' seconds', '');
  });
  return o;
}

function prefixOut(snap: Snap, x: string, p: string, net: Net): string[] {
  const c = snap.tables[x][p];
  if (!c.length) return ['% Network not in table'];
  const valid = c.filter((r) => !r.rej);
  const o = ['BGP routing table entry for ' + p, 'Paths: (' + valid.length + ' available' + (valid.length ? ', best #1' : '') + (c.length > valid.length ? ', ' + (c.length - valid.length) + ' rejected' : '') + ')'];
  c.forEach((r) => {
    o.push('  ' + (r.local ? 'Local' : r.path.join(' ')));
    if (r.local) o.push('    0.0.0.0 from 0.0.0.0 (' + ASES[x].rid + ')');
    else {
      const l = net.links.find((k) => (k.a === x && k.b === r.from) || (k.b === x && k.a === r.from)) as Link;
      o.push('    ' + r.nh + ' from ' + ipOn(l, r.from as string) + ' (' + ASES[r.from as string].rid + ')');
    }
    o.push('      Origin IGP, metric 0, localpref ' + r.lp + (r.local ? ', weight 32768, valid, sourced, local' : ', valid, external') + (r.best ? ', best' : ''));
    o.push('      ! simulador: ' + (r.rej ? 'rejeitada (' + r.rej.why + ')' : r.best ? 'melhor por ' + WIN_TXT[r.reason as string] : 'perdeu por ' + LOSE_TXT[r.reason as string]));
  });
  return o;
}

const comandos: TabDef = {
  id: 'comandos',
  label: 'Comandos',
  render: (tr, ctx) => {
    const x = String(ctx.P.root || 'D');
    const snap = snapAt(tr, ctx.timeAt(ctx.c));
    const net = tr.raw.net as Net;
    const prompt = 'as' + ASES[x].asn + '#';
    const block = (cmd: string, lines: string[]): string => '<pre class="term">' + esc(prompt + ' ' + cmd + '\n' + lines.join('\n')) + '</pre>';
    let h = '<h3>Roteador de ' + esc(asName(x)) + '</h3><p>Saída dos comandos no instante: ' + esc(snap.label) + '. Os textos seguem o formato do Cisco IOS; as linhas que começam com <code>! simulador</code> são explicações do simulador, não da saída real.</p>';
    h += block('show ip bgp', show(snap, x));
    h += block('show ip bgp summary', summary(snap, x, net));
    h += block('show ip bgp neighbors', neighborsOut(snap, x, net));
    PREFIXES.forEach((p) => {
      h += block('show ip bgp ' + p.split('/')[0], prefixOut(snap, x, p, net));
    });
    return h;
  },
};

export const tabs: TabDef[] = [sessoes, tabela, comandos];
