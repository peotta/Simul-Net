// Abas próprias do IPv6: a busca na tabela de rotas (encaminhamento), a anatomia dos endereços (endereçamento e SLAAC) e o
// cabeçalho fixo do pacote em trânsito. Todas acompanham o relógio e mostram o instante atual.
import { esc, type Trace } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import { bin6, classify6, commonBits6, fmt6, full6, groups6, ipv6Header, mcastMac6, parse6, routeText6, scope6, solicited6, TIPOS6, type Route6 } from '../model';
import type { LookupRec, PktRec } from '../fwd';
import { NODE_LABEL } from '../fwd';
import { iidOf, MAC, PREFIX, type EndParams } from '../end';

/** Os 128 bits em oito grupos de 16, com os `len` primeiros em negrito (o prefixo comparado). */
function bits(ip: string, len: number): string {
  const raw = bin6(ip).replace(/ /g, '');
  let out = '';
  for (let i = 0; i < 128; i++) out += (i > 0 && i % 16 === 0 ? ' ' : '') + (i < len ? '<b>' + raw[i] + '</b>' : raw[i]);
  return out;
}

const routeTable = (t: Route6[], dst: string, matches: number[], winner: number): string => {
  let h = '<table class="sc-msgs"><thead><tr><th>Rota</th><th>Origem</th><th>Saída</th><th>Bits em comum</th><th>Casa</th></tr></thead><tbody>';
  t.forEach((r, i) => {
    const m = matches.includes(i);
    h += '<tr' + (i === winner ? ' class="osi-cur"' : '') + '><td>' + esc(r.net + '/' + r.len) + '</td><td class="meaning">' + (r.proto === 'C' ? 'conectada' : 'estática') + '</td><td class="meaning">' + esc(r.kind === 'conn' ? r.iface : r.via + ' (' + r.iface + ')') + '</td><td>' + Math.min(commonBits6(dst, r.net), r.len) + ' de ' + r.len + '</td><td>' + (i === winner ? '<b>vence</b>' : m ? 'casa' : 'não') + '</td></tr>';
  });
  return h + '</tbody></table>';
};

function currentLookup(tr: Trace, now: number): LookupRec | null {
  const lk = (tr.raw.lk || []) as LookupRec[];
  let cur: LookupRec | null = null;
  lk.forEach((l) => {
    if (l.t <= now + 1e-9) cur = l;
  });
  return cur;
}

const rotas: TabDef = {
  id: 'rotas',
  label: 'Tabela de rotas',
  subs: ['fwd'],
  render: (tr, ctx) => {
    const lk = (tr.raw.lk || []) as LookupRec[];
    const T = (tr.raw.tables || {}) as Record<string, Route6[]>;
    const cur = currentLookup(tr, ctx.timeAt(ctx.c));
    if (!cur) return '<h3>Tabela de rotas</h3><p>Nenhuma busca na tabela ainda. Avance a simulação: a cada salto, o roteador procura o destino na própria tabela.</p>';
    const tb = T[cur.n];
    let h = '<h3>Busca em ' + esc(NODE_LABEL[cur.n]) + ': destino ' + esc(cur.d) + '</h3>';
    h += '<p>' + esc(cur.note) + '.</p>';
    h += routeTable(tb, cur.d, cur.m, cur.w);
    h += '<h3>Comparação bit a bit</h3><p>Um prefixo /N casa quando os N primeiros bits do destino são iguais aos da rota. Em negrito, os bits comparados. São 128 bits, em oito grupos de 16.</p><pre class="conf">';
    h += 'destino  ' + bits(cur.d, cur.w >= 0 ? tb[cur.w].len : 0) + '\n          ' + esc(cur.d) + '\n';
    cur.m.forEach((i) => {
      h += 'rota /' + String(tb[i].len).padEnd(3) + bits(tb[i].net, tb[i].len) + '\n          ' + esc(tb[i].net + '/' + tb[i].len) + (i === cur.w ? '  vence' : '') + '\n';
    });
    h += '</pre>';
    h += '<h3>Todas as buscas</h3><table class="sc-msgs"><thead><tr><th>Nó</th><th>Destino</th><th>Rota escolhida</th></tr></thead><tbody>';
    lk.forEach((l) => {
      const r = l.w >= 0 ? routeText6(T[l.n][l.w]) : 'sem rota';
      h += '<tr' + (l === cur ? ' class="osi-cur"' : '') + '><td>' + esc(NODE_LABEL[l.n]) + '</td><td>' + esc(l.d) + '</td><td class="meaning">' + esc(r) + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<p>Leitura: <b>C</b> conectada, <b>S</b> estática.</p>';
    return h;
  },
};

const row = (k: string, v: string): string => '<tr><td>' + k + '</td><td class="meaning">' + esc(v) + '</td></tr>';

const enderecos: TabDef = {
  id: 'enderecos',
  label: 'Endereços',
  subs: ['end'],
  render: (tr) => {
    const R = tr.raw;
    if (!R.dst) return '<h3>Endereços</h3><p>Esta aba vale para o modo Endereçamento e SLAAC.</p>';
    const P = R.P as EndParams;
    const iid = iidOf(P.iid);
    const dst = R.dst as string;
    let h = '<h3>Anatomia do endereço de enlace local do host A</h3><table class="sc-msgs"><tbody>';
    h += row('MAC', MAC.a) + row('Identificador de interface', P.iid === 'eui64' ? 'EUI-64 modificado: ' + groups6(iid).slice(4).map((x) => x.toString(16).padStart(4, '0')).join(':') : 'temporário: ' + groups6(iid).slice(4).map((x) => x.toString(16).padStart(4, '0')).join(':') + ' (não deriva do MAC)') + row('Endereço de enlace local', R.ll) + row('Forma completa', full6(parse6(R.ll)));
    h += '</tbody></table>';
    if (P.iid === 'eui64') {
      const b = MAC.a.split(':');
      const flip = (parseInt(b[0], 16) ^ 2).toString(16).padStart(2, '0');
      h += '<h3>Como o EUI-64 nasce do MAC</h3><pre class="conf">MAC            ' + b.join(':') + '\n1. inverte o bit U/L do primeiro byte: ' + b[0] + ' vira ' + flip + '\n2. insere ff:fe no meio dos seis bytes\nidentificador  ' + flip + b[1] + ':' + b[2] + 'ff:fe' + b[3] + ':' + b[4] + b[5] + '</pre><p>O MAC aparece dentro do endereço, o que permite rastrear o dispositivo. A RFC 8981 define o endereço temporário para evitar isso.</p>';
    }
    h += '<h3>Endereço global (SLAAC)</h3>';
    if (R.gua) {
      h += '<pre class="conf">prefixo        ' + bits(PREFIX, 64) + '\nidentificador  ' + bin6(R.gua).split(' ').slice(4).join(' ') + '\nendereço       ' + esc(R.gua) + '</pre><p>64 bits do prefixo anunciado mais 64 bits do identificador de interface somam 128. A DAD confirmou que o endereço é único.</p>';
    } else {
      h += '<p><span class="chk-bad">Nenhum endereço global.</span> ' + esc(R.why || 'o host não chegou a formar um endereço global') + '.</p>';
    }
    h += '<h3>Nó solicitado e MAC multicast</h3><table class="sc-msgs"><tbody>';
    h += row('Nó solicitado de ' + (R.gua || R.ll), solicited6(R.gua || R.ll)) + row('MAC multicast do nó solicitado', mcastMac6(solicited6(R.gua || R.ll))) + row('Todos os nós, ff02::1', mcastMac6('ff02::1')) + row('Todos os roteadores, ff02::2', mcastMac6('ff02::2'));
    h += '</tbody></table><p>O endereço de nó solicitado usa ff02::1:ff e os 24 bits finais do endereço unicast. Só os nós com esses mesmos 24 bits escutam o grupo, e o MAC de destino é 33:33 seguido dos 32 bits finais.</p>';
    const c = classify6(dst);
    h += '<h3>Que endereço é o destino?</h3><table class="sc-msgs"><tbody>' + row('Destino', dst + ' (forma completa: ' + full6(parse6(dst)) + ')') + row('Bloco', c.nome + ' (' + c.net + '/' + c.len + ')') + row('Definido em', c.rfc) + row('Escopo', c.nome === 'Multicast' ? scope6(dst) : c.ambito) + row('Roteável na internet', c.publico ? 'sim' : 'não') + row('Observação', c.nota) + '</tbody></table>';
    h += '<h3>Tipos de endereço do simulador</h3><table class="sc-msgs"><thead><tr><th>Bloco</th><th>Nome</th><th>Definido em</th></tr></thead><tbody>';
    TIPOS6.forEach((s) => {
      h += '<tr' + (c.net === s.net && c.len === s.len ? ' class="osi-cur"' : '') + '><td>' + esc(s.net + '/' + s.len) + '</td><td class="meaning">' + esc(s.nome) + '</td><td class="meaning">' + esc(s.rfc) + '</td></tr>';
    });
    h += '</tbody></table><p>O unicast global (2000::/3) é o que sobra: tudo o que não cai nos blocos acima.</p>';
    return h;
  },
};

const hex2 = (n: number): string => n.toString(16).padStart(2, '0');

const cabecalho: TabDef = {
  id: 'cabecalho',
  label: 'Cabeçalho IPv6',
  render: (tr, ctx) => {
    const pk = (tr.raw.pk || []) as PktRec[];
    const now = ctx.timeAt(ctx.c);
    let idx = -1;
    pk.forEach((p, i) => {
      const m = tr.msgs[p.m];
      if (m && m.tSend <= now + 1e-9) idx = i;
    });
    if (idx < 0) return '<h3>Cabeçalho IPv6</h3><p>Nenhum pacote IPv6 foi enviado ainda. Avance a simulação para ver o cabeçalho do pacote em trânsito.</p>';
    const p = pk[idx];
    const prev = idx > 0 && pk[idx - 1].src === p.src && pk[idx - 1].dst === p.dst ? pk[idx - 1] : null;
    const b = ipv6Header({ plen: p.plen, nh: 58, hl: p.hl, src: p.src, dst: p.dst });
    const hx = (from: number, to: number): string => b.slice(from, to).map(hex2).join(' ');
    const hlCh = prev && prev.hl !== p.hl;
    const m = tr.msgs[p.m];
    let h = '<h3>Cabeçalho do pacote: ' + esc(m ? m.label : '') + '</h3><p>' + esc(p.src) + ' para ' + esc(p.dst) + '. O cabeçalho tem sempre 40 bytes e não tem opções: o que for extra vai em cabeçalhos de extensão.</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Bytes</th><th>Campo</th><th>Valor</th></tr></thead><tbody>';
    const r = (bytes: string, f: string, v: string, hl = false): string => '<tr><td><code>' + bytes + '</code></td><td>' + f + '</td><td class="meaning">' + (hl ? '<b>' + esc(v) + '</b>' : esc(v)) + '</td></tr>';
    h += r(hx(0, 4), 'Versão, classe de tráfego e rótulo de fluxo', '6, 0 e 0 (os 4 primeiros bits valem 6)');
    h += r(hx(4, 6), 'Comprimento da carga', p.plen + ' bytes (tudo depois do cabeçalho)');
    h += r(hex2(b[6]), 'Próximo cabeçalho', '58 (ICMPv6)');
    h += r(hex2(b[7]), 'Hop Limit', String(p.hl) + (hlCh ? ' (era ' + prev!.hl + ' no salto anterior)' : ''), !!hlCh);
    h += r(hx(8, 24), 'Origem', fmt6(parse6(p.src)));
    h += r(hx(24, 40), 'Destino', fmt6(parse6(p.dst)));
    h += '</tbody></table>';
    h += '<p>Ao contrário do IPv4, <b>não há checksum</b> no cabeçalho: quando o Hop Limit cai, nada precisa ser recalculado. A integridade da carga fica com o protocolo de cima, e o ICMPv6 inclui o endereço de origem e o de destino (pseudocabeçalho) no próprio checksum (RFC 8200, seção 8.1; RFC 4443, seção 2.3). Os roteadores também não fragmentam: só a origem.</p>';
    return h;
  },
};

export const tabs: TabDef[] = [rotas, enderecos, cabecalho];
