// Abas próprias do IPv4: a busca na tabela de rotas (encaminhamento), a conta de endereço e máscara (endereçamento)
// e o cabeçalho do pacote em trânsito. Todas acompanham o relógio e mostram o instante atual.
import { esc, type Trace } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import { bcastOf, bin32, classify, commonBits, hostCount, inNet, ipv4Header, maskStr, netOf, routeText, SPECIAL, toInt, toStr, type Route } from '../model';
import type { LookupRec, PktRec } from '../fwd';
import { NODE_LABEL } from '../fwd';

/** Os 32 bits em grupos de oito, com os `len` primeiros em negrito (o prefixo comparado). */
function bits(ip: string, len: number): string {
  const raw = bin32(ip).replace(/\./g, '');
  let out = '';
  for (let i = 0; i < 32; i++) out += (i > 0 && i % 8 === 0 ? ' ' : '') + (i < len ? '<b>' + raw[i] + '</b>' : raw[i]);
  return out;
}

const routeTable = (t: Route[], dst: string, matches: number[], winner: number): string => {
  let h = '<table class="sc-msgs"><thead><tr><th>Rota</th><th>Origem</th><th>Saída</th><th>AD / métrica</th><th>Bits em comum</th><th>Casa</th></tr></thead><tbody>';
  t.forEach((r, i) => {
    const m = matches.includes(i);
    const origem = r.proto === 'C' ? 'conectada' : r.proto === 'S' ? 'estática' : 'OSPF';
    h += '<tr' + (i === winner ? ' class="osi-cur"' : '') + '><td>' + esc(r.net + '/' + r.len) + '</td><td class="meaning">' + origem + '</td><td class="meaning">' + esc(r.kind === 'conn' ? r.iface : r.kind === 'blackhole' ? 'descarte' : r.via + ' (' + r.iface + ')') + '</td><td>' + (r.proto === 'C' ? '-' : r.ad + ' / ' + r.metric) + '</td><td>' + Math.min(commonBits(dst, r.net), r.len) + ' de ' + r.len + '</td><td>' + (i === winner ? '<b>vence</b>' : m ? 'casa' : 'não') + '</td></tr>';
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
    const T = (tr.raw.tables || {}) as Record<string, Route[]>;
    const cur = currentLookup(tr, ctx.timeAt(ctx.c));
    if (!cur) return '<h3>Tabela de rotas</h3><p>Nenhuma busca na tabela ainda. Avance a simulação: a cada salto, o roteador procura o destino na própria tabela.</p>';
    const tb = T[cur.n];
    let h = '<h3>Busca em ' + esc(NODE_LABEL[cur.n]) + ': destino ' + esc(cur.d) + '</h3>';
    h += '<p>' + esc(cur.note) + '.</p>';
    h += routeTable(tb, cur.d, cur.m, cur.w);
    h += '<h3>Comparação bit a bit</h3><p>Um prefixo /N casa quando os N primeiros bits do destino são iguais aos da rota. Em negrito, os bits comparados.</p><pre class="conf">';
    h += 'destino  ' + bits(cur.d, cur.w >= 0 ? tb[cur.w].len : 0) + '  ' + esc(cur.d) + '\n';
    cur.m.forEach((i) => {
      h += 'rota /' + String(tb[i].len).padEnd(2) + ' ' + bits(tb[i].net, tb[i].len) + '  ' + esc(tb[i].net + '/' + tb[i].len) + (i === cur.w ? '  vence' : '') + '\n';
    });
    h += '</pre>';
    h += '<h3>Todas as buscas</h3><table class="sc-msgs"><thead><tr><th>Nó</th><th>Destino</th><th>Rota escolhida</th></tr></thead><tbody>';
    lk.forEach((l) => {
      const r = l.w >= 0 ? routeText(T[l.n][l.w]) : 'sem rota';
      h += '<tr' + (l === cur ? ' class="osi-cur"' : '') + '><td>' + esc(NODE_LABEL[l.n]) + '</td><td>' + esc(l.d) + '</td><td class="meaning">' + esc(r) + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<p>Leitura: <b>C</b> conectada, <b>S</b> estática, <b>O</b> OSPF. Entre colchetes, [distância administrativa/métrica].</p>';
    return h;
  },
};

const range = (net: string, len: number): string => {
  if (len >= 32) return net + ' (um só endereço)';
  if (len === 31) return net + ' e ' + toStr(toInt(net) + 1) + ' (os dois são de hosts, RFC 3021)';
  return toStr(toInt(net) + 1) + ' a ' + toStr(toInt(bcastOf(net, len)) - 1);
};

const enderecos: TabDef = {
  id: 'enderecos',
  label: 'Endereços',
  subs: ['end'],
  render: (tr) => {
    const R = tr.raw;
    if (!R.dst) return '<h3>Endereços</h3><p>Esta aba vale para o modo Endereçamento.</p>';
    const P = R.P as { mask: number; ovl: boolean };
    const dst = R.dst as string;
    const A = '192.168.10.10';
    let h = '<h3>Host A: ' + A + '/' + P.mask + '</h3><table class="sc-msgs"><tbody>';
    const row = (k: string, v: string): string => '<tr><td>' + k + '</td><td class="meaning">' + esc(v) + '</td></tr>';
    h += row('Máscara', maskStr(P.mask) + ' (/' + P.mask + ')') + row('Rede', netOf(A, P.mask) + '/' + P.mask) + row('Broadcast da sub-rede', bcastOf(A, P.mask)) + row('Endereços de hosts', range(netOf(A, P.mask), P.mask) + '; ' + hostCount(P.mask) + ' no total');
    h += '</tbody></table>';
    h += '<h3>O teste do host: o destino está na minha rede?</h3><pre class="conf">';
    h += 'destino       ' + bits(dst, 32) + '  ' + esc(dst) + '\n';
    h += 'máscara       ' + bits(maskStr(P.mask), 32) + '  ' + esc(maskStr(P.mask)) + '\n';
    h += 'destino E máscara  ' + bits(netOf(dst, P.mask), 32) + '  ' + esc(netOf(dst, P.mask)) + '\n';
    h += 'rede de A     ' + bits(netOf(A, P.mask), 32) + '  ' + esc(netOf(A, P.mask)) + '\n</pre>';
    const on = inNet(dst, A, P.mask);
    h += '<p>' + (on ? '<span class="chk-ok">Iguais:</span> o destino está no mesmo enlace e o host o alcança diretamente, por ARP.' : '<span class="chk-bad">Diferentes:</span> o destino está em outra rede e o host precisa de um gateway.') + '</p>';
    const c = classify(dst);
    h += '<h3>Que endereço é este?</h3><table class="sc-msgs"><tbody>' + row('Bloco', c.nome + (c.len ? ' (' + c.net + '/' + c.len + ')' : '')) + row('Definido em', c.rfc) + row('Roteável na internet', c.publico ? 'sim' : 'não') + row('Observação', c.nota) + '</tbody></table>';
    if (dst === '10.20.1.1') h += '<h3>O enlace /31</h3><p>A rede 10.20.1.0/31 tem dois endereços: ' + esc(range('10.20.1.0', 31)) + '. Não há endereço de rede nem de broadcast. Um /30 gastaria quatro endereços para o mesmo enlace.</p>';
    const rt = (R.rt || []) as Route[];
    if (P.ovl) {
      const lk = R.rl as { m: number[]; w: number } | null;
      h += '<h3>Redes conectadas do roteador</h3>' + (lk ? routeTable(rt, dst, lk.m, lk.w) : '<p>O pacote não chegou ao roteador neste cenário.</p>');
      h += '<p>As redes 10.20.0.0/24 e 10.20.0.128/25 se sobrepõem. Para um endereço entre 10.20.0.128 e 10.20.0.255, as duas casam, e vence o prefixo mais longo.</p>';
    }
    h += '<h3>Blocos de uso especial</h3><table class="sc-msgs"><thead><tr><th>Bloco</th><th>Nome</th><th>Definido em</th></tr></thead><tbody>';
    SPECIAL.forEach((s) => {
      h += '<tr' + (c.net === s.net && c.len === s.len ? ' class="osi-cur"' : '') + '><td>' + esc(s.net + '/' + s.len) + '</td><td class="meaning">' + esc(s.nome) + '</td><td class="meaning">' + esc(s.rfc) + '</td></tr>';
    });
    h += '</tbody></table>';
    return h;
  },
};

const hex2 = (n: number): string => n.toString(16).padStart(2, '0');

const cabecalho: TabDef = {
  id: 'cabecalho',
  label: 'Cabeçalho IPv4',
  render: (tr, ctx) => {
    const pk = (tr.raw.pk || []) as PktRec[];
    const now = ctx.timeAt(ctx.c);
    let idx = -1;
    pk.forEach((p, i) => {
      const m = tr.msgs[p.m];
      if (m && m.tSend <= now + 1e-9) idx = i;
    });
    if (idx < 0) return '<h3>Cabeçalho IPv4</h3><p>Nenhum pacote IP foi enviado ainda. Avance a simulação para ver o cabeçalho do pacote em trânsito.</p>';
    const p = pk[idx];
    const prev = idx > 0 && pk[idx - 1].src === p.src && pk[idx - 1].dst === p.dst ? pk[idx - 1] : null;
    const H = ipv4Header({ len: p.len, id: p.id, ttl: p.ttl, proto: 1, src: p.src, dst: p.dst });
    const b = H.bytes;
    const hx = (from: number, to: number): string => b.slice(from, to).map(hex2).join(' ');
    const ttlCh = prev && prev.ttl !== p.ttl;
    const sumCh = !!prev && ipv4Header({ len: prev.len, id: prev.id, ttl: prev.ttl, proto: 1, src: prev.src, dst: prev.dst }).sum !== H.sum;
    const m = tr.msgs[p.m];
    let h = '<h3>Cabeçalho do pacote: ' + esc(m ? m.label : '') + '</h3><p>' + esc(p.src) + ' para ' + esc(p.dst) + '. O cabeçalho tem 20 bytes (sem opções).</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Bytes</th><th>Campo</th><th>Valor</th></tr></thead><tbody>';
    const r = (bytes: string, f: string, v: string, hl = false): string => '<tr><td><code>' + bytes + '</code></td><td>' + f + '</td><td class="meaning">' + (hl ? '<b>' + esc(v) + '</b>' : esc(v)) + '</td></tr>';
    h += r(hex2(b[0]), 'Versão e IHL', '4 e 5 (cabeçalho de 5 palavras de 32 bits)');
    h += r(hex2(b[1]), 'DSCP e ECN', '0');
    h += r(hx(2, 4), 'Comprimento total', p.len + ' bytes');
    h += r(hx(4, 6), 'Identificação', '0x' + (p.id).toString(16));
    h += r(hx(6, 8), 'Flags e deslocamento', 'sem DF, sem MF, deslocamento 0');
    h += r(hex2(b[8]), 'TTL', String(p.ttl) + (ttlCh ? ' (era ' + prev!.ttl + ' no salto anterior)' : ''), !!ttlCh);
    h += r(hex2(b[9]), 'Protocolo', '1 (ICMP)');
    h += r(hx(10, 12), 'Checksum do cabeçalho', '0x' + H.sum.toString(16).padStart(4, '0') + (sumCh ? ' (mudou, porque o TTL mudou)' : ''), sumCh);
    h += r(hx(12, 16), 'Origem', p.src);
    h += r(hx(16, 20), 'Destino', p.dst);
    h += '</tbody></table>';
    h += '<p>O checksum é o complemento de um da soma dos 10 pares de bytes do cabeçalho (RFC 1071). Como o TTL cai a cada roteador, o roteador <b>recalcula</b> o checksum a cada salto. Origem, destino e identificação não mudam no caminho.</p>';
    return h;
  },
};

export const tabs: TabDef[] = [rotas, enderecos, cabecalho];
