// Motor do simulador de BGP: sessões, troca de UPDATEs até convergir, evento (queda, silêncio ou retirada),
// ataque com defesas e tráfego de teste. Um único percurso monta a linha do tempo; os três modos só diferem
// nos parâmetros que usam. Os dados brutos ficam em tr.raw.
import { COLORS, newTrace, plural, type Column, type Field, type StateDef, type Trace } from '../../sim-core';
import {
  AS_ORDER, ASES, COL_ORDER, HOLD, KEEPALIVE, PREFIXES, VICTIM, bestOf, chainText, clearRibs, computeRound, defenseText, deliver, forward, ipNum, ipOn, linkBetween, newNet, other,
  prefixOf, rejectOf, rejectionList, snapshot, usesFalse, WIN_TXT, DEF_BY, established,
  type Attack, type Cand, type Defense, type Link, type Net, type Snap, type Upd,
} from './model';

export const C = { open: COLORS.plain as string, tcp: COLORS.tcp as string, upd: '#B48EF0', wd: COLORS.bad as string, data: COLORS.data as string };

const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'sess', label: 'Sessões' },
  { key: 'res', label: 'Resultado' },
];

export interface BgpParams {
  dir: string;
  lpA: number;
  prependB: number;
  ev: 'none' | 'down' | 'hold' | 'retirar';
  link: string;
  attack: Attack;
  relLP: boolean;
  rov: string;
  cust: string;
  peer: string;
  damp: boolean;
  root: string;
}

export interface Stats {
  rounds: number;
  updates: number;
  withdraws: number;
  loops: number;
  rejects: number;
  flaps?: number;
}

const CP = 2; // atraso dos enlaces nas mensagens (ms)
const STEP = CP + 0.6;
const MS_HOLD = HOLD * 1000;

const COLS: Column[] = COL_ORDER.map((id) => ({ key: id, label: ASES[id].name, sub: 'AS' + ASES[id].asn, addr: ASES[id].rid }));

// ---- Campos das mensagens ----

function updLen(m: Upd): number {
  if (!m.route) return 19 + 2 + 4 + 2;
  return 19 + 2 + 2 + 4 + (5 + 4 * m.route.path.length) + 7 + 4;
}

function updFields(m: Upd): Field[] {
  const f: Field[] = [{ sec: 'BGP UPDATE (tipo 2)' }, ['Tipo', '2 (UPDATE)', 'Anuncia ou retira rotas.'], ['Length', updLen(m) + ' bytes', 'Tamanho total da mensagem, cabeçalho incluído.']];
  if (!m.route) {
    f.push(['Withdrawn Routes', m.prefix, 'Prefixo retirado: o vizinho deixa de alcançá-lo por este AS.']);
    f.push(['Path Attributes', '(vazio)', 'Uma retirada não leva atributos.']);
    return f;
  }
  f.push(['Withdrawn Routes', '(nenhuma)', 'Nada é retirado nesta mensagem.']);
  f.push(['ORIGIN', 'IGP (0)', 'Como o prefixo entrou no BGP: aqui, anunciado pela rede de origem.']);
  f.push(['AS_PATH', 'AS_SEQUENCE ' + m.route.path.join(' '), 'AS atravessados, do mais recente ao de origem. Cada AS acrescenta o próprio número ao anunciar.']);
  f.push(['NEXT_HOP', m.route.nh, 'Endereço do AS vizinho no enlace: para onde mandar o tráfego deste prefixo.']);
  f.push(['NLRI', m.prefix, 'Prefixo anunciado (Network Layer Reachability Information).']);
  return f;
}

function openFields(x: string): Field[] {
  return [
    { sec: 'BGP OPEN (tipo 1)' },
    ['Tipo', '1 (OPEN)', 'Primeira mensagem da sessão.'],
    ['Version', '4', 'BGP-4.'],
    ['My Autonomous System', '23456 (AS_TRANS) / AS' + ASES[x].asn + ' na capacidade', 'Com ASN de 4 bytes (RFC 6793), o campo de 2 bytes leva AS_TRANS e o número real vai na capacidade.'],
    ['Hold Time', HOLD + ' s', 'Tempo máximo sem receber mensagens antes de derrubar a sessão. Vale o menor valor entre os dois lados.'],
    ['BGP Identifier', ASES[x].rid, 'Router ID: identifica o roteador e desempata decisões.'],
    ['Capacidades', 'IPv4 unicast, route refresh, ASN de 4 bytes', 'Recursos negociados para esta sessão.'],
  ];
}

const KA_FIELDS: Field[] = [{ sec: 'BGP KEEPALIVE (tipo 4)' }, ['Tipo', '4 (KEEPALIVE)', 'Confirma o OPEN e, depois, mostra que o vizinho continua vivo.'], ['Length', '19 bytes', 'Só o cabeçalho: marcador de 16 bytes, tamanho e tipo.']];

const MARKER: Field = ['Marker', '16 bytes com todos os bits em 1', 'Delimita o início de cada mensagem BGP.'];

interface Ctx {
  tr: Trace;
  net: Net;
  R: Record<string, any>;
  updates: number;
}

function send(c: Ctx, from: string, to: string, at: number, o: { color: string; proto: string; len: number; label: string; info: string; about: string; fields: Field[]; phaseName: string; tags?: string[] }) {
  const l = linkBetween(c.net, from, to);
  const base: Field[] = [{ sec: 'IP / TCP' }, ['Endereços', ipOn(l, from) + ' → ' + ipOn(l, to) + ', porta 179', 'O BGP roda sobre TCP: a entrega confiável e em ordem fica com o transporte.'], ['Enlace', l.id]];
  c.tr.add(from, to, { at, dur: CP, par: true, color: o.color, proto: o.proto, len: o.len, label: o.label, info: o.info, about: o.about, fields: [...base, ...(o.proto === 'BGP' ? [MARKER] : []), ...o.fields], phaseName: o.phaseName, tags: o.tags || [] });
  l.sent[from] = (l.sent[from] || 0) + 1;
}

const sessCount = (net: Net): string => net.links.filter(established).length + ' de ' + net.links.length + ' Established';

function snap(c: Ctx, t: number, label: string, converged = false) {
  (c.R.snaps as Snap[]).push(snapshot(c.net, t, label, c.updates, converged));
}

function phaseStart(c: Ctx, label: string, key: string, state: string, cls = 'warn') {
  c.tr.phase(label, key);
  c.tr.st(c.tr.t, 'phase', state, cls);
}

// ---- Fases da sessão ----

function tcpPhase(c: Ctx, ls: Link[]) {
  const { tr, net } = c;
  phaseStart(c, 'TCP', 'tcp', 'TCP (porta 179)');
  tr.lg(tr.t, 'Fase TCP: em cada enlace, um dos vizinhos abre uma conexão TCP para a porta 179 do outro. Se os dois abrirem ao mesmo tempo, fica a conexão iniciada pelo maior BGP Identifier (RFC 4271, seção 6.8).', 'sys');
  const t0 = tr.t;
  const steps: [string, string, string][] = [['SYN', 'SYN :179', 'Abre a conexão TCP com a porta 179 do vizinho.'], ['SYN-ACK', 'SYN-ACK', 'O vizinho aceita a conexão.'], ['ACK', 'ACK', 'Conexão TCP estabelecida.']];
  steps.forEach(([seg, label, mean], i) => {
    const at = t0 + i * STEP;
    ls.forEach((l) => {
      const act = ipNum(ASES[l.a].rid) > ipNum(ASES[l.b].rid) ? l.a : l.b;
      const pas = other(l, act);
      const [from, to] = i === 1 ? [pas, act] : [act, pas];
      if (i === 0) l.state = 'Connect';
      send(c, from, to, at, { color: C.tcp, proto: 'TCP', len: 60, label, info: seg + (i === 0 ? ' para a porta 179' : ''), about: 'Antes de qualquer mensagem BGP, os vizinhos abrem uma conexão TCP (RFC 4271, seção 8.2.2: o estado Connect).', fields: [{ sec: 'TCP' }, ['Segmento', seg, mean]], phaseName: 'TCP' });
    });
  });
  tr.t = t0 + 3 * STEP;
  net.clock += 0.1;
  tr.st(tr.t, 'sess', ls.length + ' conexões TCP', 'warn');
  snap(c, tr.t, 'TCP: conexões abertas');
  tr.mile(tr.t, 'TCP', 'porta 179');
}

function openPhase(c: Ctx, ls: Link[]) {
  const { tr, net } = c;
  phaseStart(c, 'OPEN', 'open', 'OPEN (parâmetros)');
  tr.lg(tr.t, 'Fase OPEN: cada lado envia AS, hold time (' + HOLD + ' s), router ID e capacidades. Estado: OpenSent, e OpenConfirm ao receber o OPEN do vizinho.', 'conn');
  const t0 = tr.t;
  ls.forEach((l) => {
    l.state = 'OpenSent';
    [[l.a, l.b], [l.b, l.a]].forEach(([f, t]) => {
      send(c, f, t, t0, { color: C.open, proto: 'BGP', len: 29 + 20, label: 'OPEN', info: 'AS' + ASES[f].asn + ', hold ' + HOLD + ' s, ID ' + ASES[f].rid, about: 'Os dois lados enviam o OPEN ao mesmo tempo (RFC 4271, seção 4.2). Estados: OpenSent e, ao receber o do vizinho, OpenConfirm.', fields: openFields(f), phaseName: 'OPEN' });
    });
    l.state = 'OpenConfirm';
  });
  tr.t = t0 + STEP;
  net.clock += 0.1;
  tr.st(tr.t, 'sess', ls.length + ' em OpenConfirm', 'warn');
  snap(c, tr.t, 'OPEN trocados');
  tr.mile(tr.t, 'OPEN', 'parâmetros');
}

function keepalivePhase(c: Ctx, ls: Link[]) {
  const { tr, net } = c;
  phaseStart(c, 'KEEPALIVE', 'ka', 'KEEPALIVE (Established)');
  tr.lg(tr.t, 'Fase KEEPALIVE: cada lado confirma o OPEN recebido com um KEEPALIVE. As sessões chegam a Established.', 'conn');
  const t0 = tr.t;
  ls.forEach((l) => {
    [[l.a, l.b], [l.b, l.a]].forEach(([f, t]) => {
      send(c, f, t, t0, { color: C.open, proto: 'BGP', len: 19, label: 'KEEPALIVE', info: 'confirma o OPEN', about: 'O KEEPALIVE confirma o OPEN e leva a sessão a Established (RFC 4271, seção 4.4).', fields: KA_FIELDS, phaseName: 'KEEPALIVE' });
    });
    l.state = 'Established';
    l.upSince = net.clock;
  });
  tr.t = t0 + STEP;
  net.clock += 0.1;
  tr.st(tr.t, 'sess', sessCount(net), 'est');
  snap(c, tr.t, 'Established');
  tr.mile(tr.t, 'Established', 'KEEPALIVE');
}

// ---- Troca de UPDATEs ----

function newStats(): Stats {
  return { rounds: 0, updates: 0, withdraws: 0, loops: 0, rejects: 0 };
}

function converge(c: Ctx, label: string): Stats {
  const { tr, net } = c;
  const st = newStats();
  for (let guard = 0; guard < 25; guard++) {
    const msgs = computeRound(net);
    if (!msgs.length) break;
    st.rounds++;
    net.clock += 0.05;
    const t0 = tr.t;
    msgs.forEach((m) => {
      if (m.route) st.updates++;
      else st.withdraws++;
      c.updates++;
      send(c, m.from, m.to, t0, {
        color: m.route ? C.upd : C.wd,
        proto: 'BGP',
        len: updLen(m),
        label: m.route ? 'UPDATE' : 'WITHDRAW',
        info: m.route ? m.prefix + ' AS_PATH ' + m.route.path.join(' ') + ' NEXT_HOP ' + m.route.nh : 'withdraw ' + m.prefix,
        about: m.route ? 'O AS anuncia o melhor caminho que tem para o prefixo, depois de acrescentar o próprio número ao AS_PATH (RFC 4271, seção 5.1.2).' : 'O AS retira o prefixo: o vizinho deixa de ter esse caminho (RFC 4271, seção 4.3).',
        fields: updFields(m),
        phaseName: label,
      });
    });
    const tA = t0 + CP;
    msgs.forEach((m) => {
      deliver(net, m);
      const rj = m.route && !m.loop ? rejectOf(net, m.to, m.from, m.prefix, { path: m.route.path, damped: net.suppressed[m.to + '|' + m.from + '|' + m.prefix] }) : null;
      const to = ASES[m.to].name;
      const from = ASES[m.from].name;
      if (rj) {
        st.rejects++;
        tr.lg(tA, to + ' recebe ' + m.prefix + ' de ' + from + ' (AS_PATH ' + (m.route as { path: number[] }).path.join(' ') + ') e rejeita: ' + rj.why + '.', 'loss');
        tr.ev(tA, m.to, 'Rejeita ' + m.prefix + ' de ' + from + ': ' + rj.why, 'warn');
      } else if (m.loop) {
        st.loops++;
        tr.lg(tA, to + ' descarta a rota para ' + m.prefix + ' vinda de ' + from + ': o AS_PATH ' + (m.route as { path: number[] }).path.join(' ') + ' já contém AS' + ASES[m.to].asn + ' (prevenção de laço).', 'cc');
        tr.ev(tA, m.to, 'Descarta ' + m.prefix + ': o AS_PATH já contém AS' + ASES[m.to].asn + ' (laço)', 'warn');
      } else if (m.route) tr.lg(tA, from + ' anuncia ' + m.prefix + ' a ' + to + ': AS_PATH ' + m.route.path.join(' ') + ', NEXT_HOP ' + m.route.nh + '.', 'cc');
      else tr.lg(tA, from + ' retira ' + m.prefix + ' de ' + to + ' (withdraw).', 'loss');
    });
    tr.lg(tA, 'Rodada ' + st.rounds + ': ' + plural(msgs.length, 'mensagem', 'mensagens') + ' (' + label + ').', 'sys');
    tr.t = tA + 0.6;
    snap(c, tr.t, label + ', rodada ' + st.rounds);
  }
  return st;
}

function sum(a: Stats, b: Stats): Stats {
  return { rounds: a.rounds + b.rounds, updates: a.updates + b.updates, withdraws: a.withdraws + b.withdraws, loops: a.loops + b.loops, rejects: a.rejects + b.rejects, flaps: b.flaps ?? a.flaps };
}

const reasonOf = (r: Cand | null): string => (r && r.reason ? WIN_TXT[r.reason] : '');

// ---- Eventos ----

function linkName(net: Net, id: string): string {
  const l = net.links.find((x) => x.id === id) as Link;
  return ASES[l.a].name + ' / ' + ASES[l.b].name;
}

function eventPhase(c: Ctx, P: BgpParams): Stats | null {
  const { tr, net } = c;
  if (P.ev === 'none') return null;
  const l = net.links.find((x) => x.id === P.link) || net.links[4];
  const nm = ASES[l.a].name + ' / ' + ASES[l.b].name;
  let label = '';
  if (P.ev === 'down') {
    label = 'Queda do enlace ' + l.id;
    phaseStart(c, label, 'evento', 'enlace ' + l.id + ' caído', 'bad');
    l.up = false;
    l.silent = false;
    l.state = 'Idle';
    clearRibs(net, l);
    tr.ev(tr.t, l.a, 'Interface do enlace ' + l.id + ' cai: a sessão com ' + ASES[l.b].name + ' termina na hora', 'warn');
    tr.ev(tr.t, l.b, 'Interface do enlace ' + l.id + ' cai: a sessão com ' + ASES[l.a].name + ' termina na hora', 'warn');
    tr.lg(tr.t, 'Enlace ' + nm + ' caído. Com fast-external-fallover (padrão no Cisco IOS), a sessão BGP cai no mesmo instante e cada lado descarta as rotas aprendidas pelo outro.', 'loss');
    tr.t += 1;
  } else if (P.ev === 'hold') {
    label = 'Hold timer em ' + l.id;
    phaseStart(c, label, 'evento', 'sem KEEPALIVE', 'bad');
    l.silent = true;
    tr.ev(tr.t, l.a, 'Trava e deixa de enviar KEEPALIVE a ' + ASES[l.b].name + ', mas o enlace continua ativo', 'warn');
    tr.lg(tr.t, ASES[l.a].name + ' trava e deixa de enviar KEEPALIVE para ' + ASES[l.b].name + ', mas o enlace continua ativo: nada avisa a falha.', 'loss');
    snap(c, tr.t, 'Vizinho silencioso (' + l.id + ')');
    tr.t += MS_HOLD;
    net.clock += HOLD;
    tr.ev(tr.t, l.b, 'Hold timer de ' + HOLD + ' s expira: declara ' + ASES[l.a].name + ' morto', 'warn');
    tr.lg(tr.t, 'Hold timer de ' + HOLD + ' s expira em ' + ASES[l.b].name + '. Ele envia NOTIFICATION (código 4, Hold Timer Expired), encerra a sessão e descarta as rotas do vizinho.', 'loss');
    send(c, l.b, l.a, tr.t, {
      color: C.wd, proto: 'BGP', len: 21, label: 'NOTIFICATION', info: 'Hold Timer Expired (código 4)',
      about: 'Sem nenhuma mensagem dentro do hold time, o roteador envia NOTIFICATION e encerra a sessão (RFC 4271, seção 6.5).',
      fields: [{ sec: 'BGP NOTIFICATION (tipo 3)' }, ['Tipo', '3 (NOTIFICATION)', 'Informa um erro e encerra a sessão.'], ['Error Code', '4 (Hold Timer Expired)', 'Nenhuma mensagem chegou dentro do hold time.'], ['Error Subcode', '0', 'Sem detalhamento para este erro.']],
      phaseName: label,
    });
    tr.t += STEP;
    l.state = 'Idle';
    clearRibs(net, l);
  } else {
    label = 'Retirada de ' + VICTIM;
    phaseStart(c, label, 'evento', 'prefixo retirado', 'bad');
    net.policy.announce = false;
    tr.ev(tr.t, 'C', 'Deixa de anunciar ' + VICTIM, 'warn');
    tr.lg(tr.t, 'Cliente deixa de anunciar ' + VICTIM + ': a retirada se espalha pela rede.', 'loss');
    tr.t += 1;
  }
  snap(c, tr.t, label);
  tr.mile(tr.t, P.ev === 'down' ? 'Queda' : P.ev === 'hold' ? 'Hold timer' : 'Retirada', P.ev === 'retirar' ? VICTIM : l.id);
  const st = converge(c, label);
  tr.lg(tr.t, 'Reconvergência: ' + plural(st.rounds, 'rodada', 'rodadas') + ', ' + plural(st.updates, 'UPDATE', 'UPDATEs') + ' e ' + plural(st.withdraws, 'retirada', 'retiradas') + '.', 'cc');
  c.R.evLabel = P.ev === 'retirar' ? VICTIM : linkName(net, l.id);
  return st;
}

function flapPhase(c: Ctx): Stats {
  const { tr, net } = c;
  let st = newStats();
  tr.lg(tr.t, 'Ataque de flapping: o Cliente alterna anúncio e retirada do prefixo em dois ciclos.', 'loss');
  for (let cycle = 1; cycle <= 2; cycle++) {
    phaseStart(c, 'Flap ' + cycle, 'flap', 'flapping, ciclo ' + cycle, 'bad');
    net.policy.announce = false;
    tr.ev(tr.t, 'C', 'Retira ' + VICTIM + ' (ciclo ' + cycle + ')', 'warn');
    const out = converge(c, 'Flap ' + cycle + ': retirada');
    tr.lg(tr.t, 'Flap ' + cycle + ': ' + VICTIM + ' retirado da rede.', 'loss');
    net.policy.announce = true;
    tr.ev(tr.t, 'C', 'Anuncia ' + VICTIM + ' de novo (ciclo ' + cycle + ')', 'ok');
    const back = converge(c, 'Flap ' + cycle + ': novo anúncio');
    tr.lg(tr.t, 'Flap ' + cycle + ': ' + VICTIM + ' anunciado novamente.', 'cc');
    st = sum(sum(st, out), back);
  }
  st.flaps = 2;
  return st;
}

// ---- Tráfego ----

function trafficPhase(c: Ctx, dir: string) {
  const { tr, net, R } = c;
  const mp = ({ DC: ['D', 'C'], CD: ['C', 'D'], AD: ['A', 'D'] } as Record<string, string[]>)[dir] || ['D', 'C'];
  const src = mp[0];
  const dst = ASES[mp[1]].host as string;
  phaseStart(c, 'Tráfego ' + ASES[src].name + ' → ' + dst, 'trafego', 'tráfego de teste');
  tr.lg(tr.t, ASES[src].name + ' envia tráfego para ' + dst + ': cada AS consulta o melhor caminho para ' + prefixOf(dst) + ' e repassa ao próximo AS.', 'data');
  tr.ev(tr.t, src, 'Envia um pacote IP para ' + dst, '');
  const r = forward(net, src, dst);
  for (let i = 0; i + 1 < r.path.length; i++) {
    const a = r.path[i];
    const b = r.path[i + 1];
    tr.add(a, b, {
      dur: CP, color: C.data, proto: 'IPv4', len: 98, label: 'IP ' + dst,
      info: a === src ? 'pacote para ' + dst : ASES[a].name + ' encaminha para ' + ASES[b].name,
      about: 'Cada AS consulta o melhor caminho da própria tabela BGP e repassa ao próximo AS, sem conhecer o caminho inteiro.',
      fields: [{ sec: 'IPv4' }, ['Destino', dst], ['Próximo AS', ASES[b].name + ' (AS' + ASES[b].asn + ')'], ['Enlace', linkBetween(net, a, b).id]],
      phaseName: 'Tráfego',
    });
    tr.lg(tr.t, ASES[a].name + ' encaminha para ' + ASES[b].name + '.', 'data');
  }
  const last = r.path[r.path.length - 1];
  if (r.ok) {
    tr.ev(tr.t, last, 'Recebe o pacote: o prefixo é dele', 'ok');
    tr.lg(tr.t, 'Tráfego entregue: ' + r.path.map((x) => ASES[x].name).join(' → ') + '.', 'conn');
  } else if (r.attack === 'blackhole') {
    tr.ev(tr.t, last, 'Recebe o tráfego atraído pelo anúncio falso e o descarta (blackhole)', 'warn');
    tr.lg(tr.t, 'Tráfego atraído pelo anúncio falso: ' + r.path.map((x) => ASES[x].name).join(' → ') + '. O Atacante o descarta (blackhole).', 'loss');
  } else {
    tr.ev(tr.t, last, 'Sem rota para ' + prefixOf(dst) + ': descarta o pacote', 'warn');
    tr.lg(tr.t, 'Tráfego descartado em ' + ASES[last].name + ': não há rota para ' + prefixOf(dst) + '.', 'loss');
  }
  tr.t += 0.6;
  R.src = src;
  R.dstIp = dst;
  R.fwd = r;
  const txt = r.ok ? 'entregue' : r.attack === 'blackhole' ? 'desviado e descartado' : 'sem rota';
  tr.st(tr.t, 'res', txt, r.ok ? 'est' : 'bad');
  tr.st(tr.t, 'phase', 'concluído', r.ok ? 'est' : 'bad');
  tr.mile(tr.t, 'Tráfego: ' + txt, '');
}

// ---- Montagem ----

export function buildBgp(P: BgpParams, sub: string): Trace {
  const sec = sub === 'seguranca';
  const attack: Attack = sec ? P.attack : 'none';
  const defense: Defense = sec ? { rov: P.rov, cust: P.cust, peer: P.peer, damp: !!P.damp, relLP: !!P.relLP } : { rov: 'off', cust: 'off', peer: 'off', damp: false, relLP: false };
  const net = newNet({ lpA: sub === 'rotas' ? Number(P.lpA) : 100, prependB: sub === 'rotas' ? Number(P.prependB) : 0, announce: true }, attack, defense);
  const tr = newTrace(COLS, STATES, 20);
  const R: Record<string, any> = (tr.raw = { sub, snaps: [] as Snap[], net, attack, defense, root: P.root || 'D' });
  const c: Ctx = { tr, net, R, updates: 0 };

  tr.st(0, 'phase', 'Idle', 'warn');
  tr.st(0, 'sess', '0 de ' + net.links.length + ' Established', '');
  tr.st(0, 'res', 'em andamento', 'warn');
  snap(c, 0, 'Idle: nenhuma sessão ativa');
  tr.mile(0, 'Idle', 'sem sessões');
  tr.lg(0, 'Simulação iniciada. Nenhuma sessão ativa e nenhuma rota aprendida ainda.', 'sys');

  const ls = net.links.filter((l) => l.up && !l.silent);
  tcpPhase(c, ls);
  openPhase(c, ls);
  keepalivePhase(c, ls);

  phaseStart(c, 'UPDATE', 'update', 'UPDATE (rotas)');
  tr.lg(tr.t, 'Fase UPDATE: Cliente e Conteúdo anunciam seus prefixos. Cada AS escolhe o melhor caminho e o repassa conforme as relações comerciais, até nenhuma mudança restar.', 'cc');
  let st = converge(c, 'UPDATE');
  if (attack === 'route-flap') st = sum(st, flapPhase(c));
  tr.lg(tr.t, 'Convergência: ' + plural(st.rounds, 'rodada', 'rodadas') + ', ' + plural(st.updates, 'UPDATE', 'UPDATEs') + ' e ' + plural(st.withdraws, 'retirada', 'retiradas') + '.', 'cc');
  snap(c, tr.t, 'Rede convergida', true);
  tr.mile(tr.t, 'UPDATE', 'rotas trocadas');
  R.stats = st;
  R.dc0 = chainText(net, 'D', VICTIM);
  R.cd0 = chainText(net, 'C', PREFIXES[0]);
  R.dcWhy0 = reasonOf(bestOf(net, 'D', VICTIM).best);
  R.cdWhy0 = reasonOf(bestOf(net, 'C', PREFIXES[0]).best);

  R.evStats = sub === 'seguranca' ? null : eventPhase(c, { ...P, ev: P.ev || 'none' });
  R.ev = sub === 'seguranca' ? 'none' : P.ev || 'none';
  R.evLink = P.link;
  if (R.evStats) snap(c, tr.t, 'Rede reconvergida', true);

  R.dc = chainText(net, 'D', VICTIM);
  R.cd = chainText(net, 'C', PREFIXES[0]);
  trafficPhase(c, P.dir);
  snap(c, tr.t, 'Tráfego de teste', true);

  R.rejects = rejectionList(net);
  R.reach = AS_ORDER.filter((x) => x !== 'M' && usesFalse(net, x));
  R.suppressed = Object.keys(net.suppressed).length;
  const reasons = new Set<string>();
  AS_ORDER.forEach((x) => PREFIXES.forEach((p) => {
    const b = bestOf(net, x, p);
    if (b.cands.length > 1 && b.best) reasons.add(b.best.reason as string);
  }));
  R.reasons = Array.from(reasons);
  R.defText = defenseText(defense);
  R.tEnd = tr.t;
  R.lpA = net.policy.lpA;
  R.prependB = net.policy.prependB;
  R.retired = !net.policy.announce;
  R.keepalive = KEEPALIVE;
  return tr;
}

export { DEF_BY };
