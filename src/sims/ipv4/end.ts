// Motor do IPv4, modo "end" (endereçamento): como o host A decide se o destino está no mesmo enlace ou atrás do gateway,
// e o que o roteador faz com cada tipo de endereço (RFC 1122, seção 3.3.1.1; RFC 1812; RFC 6890).
//   - destino na mesma sub-rede (endereço e máscara do host): o host resolve o MAC do próprio destino (ARP);
//   - destino fora da sub-rede: o host resolve o MAC do gateway e envia a ele; sem gateway válido, o pacote nem sai;
//   - endereços especiais têm regras próprias: broadcast limitado e dirigido, link-local e blocos reservados.
// O roteador não tem rota padrão: o que sobra sem rota recebe ICMP 3/0. As tabelas ARP do roteador já estão preenchidas.
// Os endereços são privados (RFC 1918) e de documentação (RFC 5737). Não há tráfego real.
import { COLORS as C0, newTrace, type Column, type Field, type Message, type StateDef, type Trace } from '../../sim-core';
import { bcastOf, classify, inNet, ipv4Header, lookup, netOf, routeText, type Route } from './model';

export interface EndParams {
  hop: number;
  dest: 'b' | 'srv' | 'srv200' | 'srv31' | 'other' | 'bcast' | 'lbcast' | 'dbcast' | 'll' | 'cgnat' | 'doc';
  mask: number;
  gw: 'ok' | 'none' | 'outside';
  ovl: boolean;
  dbfw: boolean;
}

export const A_IP = '192.168.10.10';
export const E_DEST = { b: '192.168.10.20', srv: '10.20.0.50', srv200: '10.20.0.200', srv31: '10.20.1.1', other: '192.168.20.7', bcast: '192.168.10.255', lbcast: '255.255.255.255', dbcast: '10.20.0.255', ll: '169.254.10.5', cgnat: '100.64.5.5', doc: '192.0.2.7' } as const;
const GW_IP = { ok: '192.168.10.1', outside: '192.168.11.1' } as const;
const MAC = { a: '00:00:5e:00:53:0a', b: '00:00:5e:00:53:14', r: '00:00:5e:00:53:01', s: '00:00:5e:00:53:32' } as const;
const BC = 'ff:ff:ff:ff:ff:ff';
const TRIES = 3;

export const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'dec', label: 'Decisão do host A' },
  { key: 'rota', label: 'Decisão do roteador' },
  { key: 'res', label: 'Resultado' },
];

/** Tabela do roteador: interfaces conectadas, e a interface eth2 sobreposta quando o cenário a liga. */
export function routerTable(P: Pick<EndParams, 'ovl'>): Route[] {
  const t: Route[] = [
    { net: '192.168.10.0', len: 24, kind: 'conn', iface: 'eth0', proto: 'C', ad: 0, metric: 0 },
    { net: '10.20.0.0', len: 24, kind: 'conn', iface: 'eth1', proto: 'C', ad: 0, metric: 0 },
    { net: '10.20.1.0', len: 31, kind: 'conn', iface: 'eth3', proto: 'C', ad: 0, metric: 0 },
  ];
  if (P.ovl) t.push({ net: '10.20.0.128', len: 25, kind: 'conn', iface: 'eth2', proto: 'C', ad: 0, metric: 0 });
  return t;
}

/** Hosts atrás de cada interface do roteador. */
const HOST_ON: Record<string, string> = { '10.20.0.50': 'eth1', '10.20.0.200': 'eth1', '10.20.1.1': 'eth3', '192.168.10.20': 'eth0' };

function run(P: EndParams): Trace {
  const dst = E_DEST[P.dest];
  const COLS: Column[] = [
    { key: 'a', label: 'Host A', sub: 'origem', addr: A_IP + '/' + P.mask },
    { key: 'b', label: 'Host B', sub: 'mesma LAN', addr: E_DEST.b + '/24' },
    { key: 'r', label: 'Roteador', sub: 'gateway', addr: '192.168.10.1' },
    { key: 's', label: P.dest === 'srv31' ? 'SRV (/31)' : 'Servidor', sub: 'rede 10.20', addr: dst },
  ];
  const tr = newTrace(COLS, STATES, P.hop * 2);
  const RT = routerTable(P);
  const cls = classify(dst);
  const onLink = inNet(dst, A_IP, P.mask);
  const R: Record<string, any> = { P, dst, cls, onLink, gwIp: P.gw === 'none' ? null : GW_IP[P.gw], rt: RT, rl: null, result: '', arpTries: 0, bcastA: bcastOf(A_IP, P.mask), netA: netOf(A_IP, P.mask), pk: [] };
  let idc = 0x2a10;

  const eth = (d: string, s: string): Field[] => [{ sec: 'Ethernet II' }, ['Destino', d, d === BC ? 'broadcast: todos os hosts do enlace recebem' : 'MAC do próximo salto'], ['Origem', s, '']];
  function ip(from: 'a' | 'b' | 'r' | 's', to: 'a' | 'b' | 'r' | 's', src: string, d: string, ttl: number, type: 'req' | 'rep' | 'err', dmac: string, smac: string, info: string, about: string, par = false): Message {
    const id = idc++;
    const len = type === 'err' ? 56 : 84;
    const h = ipv4Header({ len, id, ttl, proto: 1, src, dst: d });
    const code = type === 'req' ? '8/0 (Echo Request)' : type === 'rep' ? '0/0 (Echo Reply)' : '3/x (Destination Unreachable)';
    const m = tr.add(from, to, {
      label: (type === 'req' ? 'Echo Request' : type === 'rep' ? 'Echo Reply' : 'Dest. Unreachable') + ' para ' + d, proto: 'ICMP', color: type === 'err' ? C0.bad : type === 'rep' ? C0.data : C0.plain, len, info, about, par,
      phaseName: type === 'req' ? 'Pacote IP' : type === 'rep' ? 'Resposta' : 'Aviso ICMP',
      fields: [...eth(dmac, smac), { sec: 'IPv4 (RFC 791)' }, ['TTL', String(ttl), 'decrementado por cada roteador'], ['Checksum do cabeçalho', '0x' + h.sum.toString(16).padStart(4, '0'), 'RFC 1071'], ['Origem', src, ''], ['Destino', d, ''], { sec: 'ICMP (RFC 792)' }, ['Tipo e código', code, '']],
      route: [from, to],
    });
    R.pk.push({ m: m.id, ttl, src, dst: d, id });
    return m;
  }
  function arp(from: 'a' | 'b' | 'r' | 's', to: 'a' | 'b' | 'r' | 's', op: 1 | 2, who: string, tell: string, text: string, lost = false): Message {
    const req = op === 1;
    return tr.add(from, to, {
      label: req ? 'ARP: quem tem ' + who + '?' : 'ARP: ' + who + ' está em ' + tell, proto: 'ARP', color: req ? C0.plain : C0.data, len: 42, info: text, about: text, lost, phaseName: 'ARP',
      fields: [{ sec: 'Ethernet II' }, ['Destino', req ? BC : tell, ''], { sec: 'ARP (RFC 826)' }, ['Operação', req ? '1 (requisição)' : '2 (resposta)', ''], ['IP procurado', who, '']],
    });
  }
  const ev = (t: number, w: string, text: string, k = ''): void => tr.ev(t, w, text, k);

  tr.st(0, 'phase', 'decisão', 'warn');
  tr.st(0, 'dec', '-', 'closed');
  tr.st(0, 'rota', '-', 'closed');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.mile(0, 'Decisão', 'host A');
  tr.phase('Decisão do host', 'dec');
  const mk = (txt: string): string => A_IP + '/' + P.mask + ' contra ' + dst + ': ' + txt;
  ev(0, 'a', 'Ping para ' + dst + ' (' + cls.nome + ')', '');
  tr.lg(0, 'Host A (' + A_IP + '/' + P.mask + '): ping para ' + dst + ', ' + cls.nome + ' (' + cls.rfc + ').', 'sys');

  const fin = (res: string, label: string, cls2: string): void => {
    R.result = res;
    tr.st(tr.t, 'res', label, cls2);
    tr.st(tr.t, 'phase', 'fim', 'closed');
    tr.mile(tr.t, 'Fim', label);
  };

  // 1. broadcasts no próprio enlace: limitado ou da própria sub-rede
  if (dst === E_DEST.lbcast || dst === R.bcastA) {
    const lim = dst === E_DEST.lbcast;
    ev(0.5, 'a', lim ? 'Broadcast limitado: vai a todos do enlace' : 'Broadcast da própria sub-rede: vai a todos do enlace', 'warn');
    tr.st(0.5, 'dec', lim ? 'broadcast limitado' : 'broadcast da sub-rede', 'warn');
    tr.t = 1;
    ip('a', 'b', A_IP, dst, 64, 'req', BC, MAC.a, 'Quadro em broadcast', 'O destino IP é de broadcast, então o quadro vai ao MAC ff:ff:ff:ff:ff:ff e todos os hosts do enlace o recebem.', true);
    ip('a', 'r', A_IP, dst, 64, 'req', BC, MAC.a, 'Quadro em broadcast', 'O roteador também recebe o quadro, porque faz parte do enlace.');
    ev(tr.t, 'b', 'Ignora o ping para broadcast (padrão do Linux: icmp_echo_ignore_broadcasts)', '');
    ev(tr.t, 'r', lim ? 'Broadcast limitado nunca é encaminhado: fica neste enlace (RFC 919)' : 'Pertence à rede do próprio enlace: não há o que encaminhar', 'warn');
    tr.lg(tr.t, 'Broadcast em ' + dst + ': ' + (lim ? 'limitado ao enlace (RFC 919).' : 'recebido por todos da sub-rede ' + R.netA + '/' + P.mask + '.') + ' Hosts podem ignorar o eco (RFC 1122, seção 3.2.2.6).', 'conn');
    fin(lim ? 'lbcast' : 'bcast', 'ficou no enlace, sem resposta', 'warn');
    tr.raw = R;
    return tr;
  }

  /** Controle: o ping ao host B, na mesma sub-rede, continua funcionando mesmo quando o gateway está errado. */
  const localPing = (): void => {
    tr.t = 1;
    tr.phase('Controle: ping ao host B', 'ctl');
    arp('a', 'b', 1, E_DEST.b, MAC.b, 'O host A pergunta a todos o MAC de ' + E_DEST.b + '.');
    arp('b', 'a', 2, E_DEST.b, MAC.b, E_DEST.b + ' responde com o próprio MAC.');
    ip('a', 'b', A_IP, E_DEST.b, 64, 'req', MAC.b, MAC.a, 'Entrega direta no enlace', 'O destino está na mesma sub-rede: nenhum gateway é necessário.');
    ip('b', 'a', E_DEST.b, A_IP, 64, 'rep', MAC.a, MAC.b, 'Resposta direta', 'O enlace local funciona.');
    ev(tr.t, 'a', 'O enlace local funciona: só o que está fora dele falha', 'ok');
  };

  // 2. decisão do host: mesmo enlace ou gateway
  let nextIp: string = dst;
  let nextKey: 'b' | 'r' = 'b';
  let nextMac: string = MAC.b;
  if (onLink) {
    ev(0.5, 'a', mk('mesma sub-rede (' + R.netA + '/' + P.mask + '): entrega direta, sem gateway'), 'ok');
    tr.st(0.5, 'dec', 'no mesmo enlace: ARP do destino', 'est');
  } else if (P.gw === 'none') {
    ev(0.5, 'a', mk('fora da sub-rede e sem gateway configurado'), 'bad');
    ev(1, 'a', 'Rede inalcançável (ENETUNREACH): nenhum pacote sai do host', 'bad');
    tr.lg(0.5, 'Host A: sem rota para ' + dst + ' (sem rota padrão). O sistema recusa o envio.', 'err');
    tr.st(1, 'dec', 'sem rota: nada é enviado', 'bad');
    localPing();
    fin('nonet', 'rede inalcançável no host', 'bad');
    tr.raw = R;
    return tr;
  } else if (P.gw === 'outside') {
    ev(0.5, 'a', mk('fora da sub-rede, e o gateway ' + GW_IP.outside + ' também está fora dela'), 'bad');
    ev(1, 'a', 'O gateway não é alcançável diretamente: a rota é inválida e o pacote não sai', 'bad');
    tr.lg(0.5, 'Host A: o gateway ' + GW_IP.outside + ' não pertence à sub-rede ' + R.netA + '/' + P.mask + '. O Linux rejeita essa rota ("Nexthop has invalid gateway").', 'err');
    tr.st(1, 'dec', 'gateway fora da sub-rede', 'bad');
    localPing();
    fin('badgw', 'gateway inválido', 'bad');
    tr.raw = R;
    return tr;
  } else {
    nextIp = GW_IP.ok;
    nextKey = 'r';
    nextMac = MAC.r;
    ev(0.5, 'a', mk('fora da sub-rede: o próximo salto é o gateway ' + GW_IP.ok), 'warn');
    tr.st(0.5, 'dec', 'fora do enlace: ARP do gateway', 'warn');
  }
  tr.lg(0.5, 'Host A: ' + (onLink ? 'destino no mesmo enlace.' : 'destino fora do enlace, próximo salto ' + nextIp + '.'), 'conn');
  tr.t = 1;

  // 3. ARP do próximo salto
  const present = onLink ? dst === E_DEST.b : true;
  tr.phase('ARP do próximo salto', 'arp');
  if (present) {
    arp('a', nextKey, 1, nextIp, nextMac, 'O host A pergunta a todos o MAC de ' + nextIp + '.', false);
    arp(nextKey, 'a', 2, nextIp, nextMac, nextIp + ' responde com o próprio MAC.', false);
  } else {
    for (let n = 1; n <= TRIES; n++) {
      const q = arp('a', 'r', 1, nextIp, '', 'Requisição ' + n + ' de ' + TRIES + ': ninguém tem ' + nextIp + ' neste enlace.', false);
      R.arpTries = n;
      ev(q.tSend, 'a', 'ARP sem resposta (tentativa ' + n + ' de ' + TRIES + ')', 'warn');
      if (n < TRIES) tr.wait(1000);
    }
    ev(tr.t, 'a', 'Host inalcançável: ' + dst + ' está na máscara do host, mas ninguém responde por ele', 'bad');
    tr.lg(tr.t, 'Host A: ARP de ' + dst + ' sem resposta. A máscara larga demais faz o host tratar como vizinho quem está atrás do roteador.', 'err');
    tr.st(tr.t, 'dec', 'ARP sem resposta', 'bad');
    fin('arpfail', 'host inalcançável (ARP)', 'bad');
    tr.raw = R;
    return tr;
  }
  tr.st(tr.t, 'phase', 'envio', 'warn');

  // 4. o pacote IP segue ao próximo salto
  tr.phase('Pacote IP', 'ip');
  if (onLink) {
    ip('a', 'b', A_IP, dst, 64, 'req', nextMac, MAC.a, 'Entrega direta no enlace', 'O quadro vai ao MAC do próprio destino: não há roteador no caminho.');
    ev(tr.t, 'b', 'Recebe o Echo Request e responde', 'ok');
    ip('b', 'a', dst, A_IP, 64, 'rep', MAC.a, MAC.b, 'Resposta direta', 'A resposta volta direto, pelo mesmo enlace.');
    tr.lg(tr.t, 'Host A: resposta de ' + dst + ' (entrega direta, TTL 64).', 'conn');
    fin('ok', 'ping funcionou', 'est');
    tr.raw = R;
    return tr;
  }
  ip('a', 'r', A_IP, dst, 64, 'req', MAC.r, MAC.a, 'Para o gateway', 'O IP de destino é ' + dst + ', mas o MAC do quadro é o do gateway: o endereço físico vale só neste enlace, o IP vale fim a fim.');

  // 5. o roteador decide
  const unreach = (code: 0 | 1, text: string): void => {
    ev(tr.t, 'r', text, 'bad');
    tr.lg(tr.t, 'Roteador: ' + text, 'err');
    ip('r', 'a', GW_IP.ok, A_IP, 64, 'err', MAC.a, MAC.r, 'ICMP 3/' + code, 'O roteador avisa a origem de que não conseguiu entregar o pacote.');
    ev(tr.t, 'a', 'Recebe ICMP 3/' + code + ': ' + (code === 0 ? 'rede inalcançável' : 'host inalcançável'), 'bad');
    tr.st(tr.t, 'rota', code === 0 ? 'sem rota' : 'host não responde', 'bad');
    fin(code === 0 ? 'unreach' : 'hostunreach', code === 0 ? 'rede inalcançável (ICMP 3/0)' : 'host inalcançável (ICMP 3/1)', 'bad');
  };
  if (cls.nome === 'Link-local') {
    ev(tr.t, 'r', 'Endereço link-local nunca é encaminhado (RFC 3927, seção 2.7): descarta em silêncio', 'bad');
    tr.lg(tr.t, 'Roteador: ' + dst + ' é link-local e só vale no enlace de origem. Descartado.', 'loss');
    tr.st(tr.t, 'rota', 'link-local: descartado', 'bad');
    tr.wait(1000);
    ev(tr.t, 'a', 'Sem resposta: o ping expira (1 s)', 'bad');
    fin('dropped', 'descartado pelo roteador', 'bad');
    tr.raw = R;
    return tr;
  }
  const l = lookup(RT, dst);
  R.rl = { m: l.matches, w: l.winner };
  const w = l.winner >= 0 ? RT[l.winner] : null;
  ev(tr.t, 'r', w ? dst + ' casa com ' + l.matches.length + (l.matches.length === 1 ? ' rota' : ' rotas') + '; vence ' + w.net + '/' + w.len + ' (' + w.iface + ')' : dst + ' não casa com nenhuma rota (não há rota padrão)', w ? 'ok' : 'bad');
  tr.lg(tr.t, 'Roteador: ' + (w ? routeText(w) : 'sem rota para ' + dst), 'conn');
  tr.st(tr.t, 'rota', w ? routeText(w) : 'sem rota para ' + dst, w ? 'est' : 'bad');
  if (!w) return (unreach(0, 'Sem rota para ' + dst + ' (' + cls.nome + '): descarta e avisa a origem (ICMP 3/0)'), (tr.raw = R), tr);

  // broadcast dirigido a uma rede conectada ao roteador (RFC 2644)
  if (bcastOf(w.net, w.len) === dst && w.len < 31) {
    if (!P.dbfw) {
      ev(tr.t, 'r', 'Broadcast dirigido a ' + w.net + '/' + w.len + ': não é encaminhado por padrão (RFC 2644)', 'ok');
      tr.lg(tr.t, 'Roteador: descarta o broadcast dirigido a ' + dst + ' (no ip directed-broadcast, o padrão).', 'loss');
      tr.wait(1000);
      ev(tr.t, 'a', 'Sem resposta: o ping expira (1 s)', 'bad');
      fin('dbdrop', 'broadcast dirigido bloqueado', 'est');
    } else {
      ev(tr.t, 'r', 'Encaminhamento de broadcast dirigido ligado: o roteador converte em broadcast na rede ' + w.net + '/' + w.len, 'bad');
      ip('r', 's', A_IP, dst, 63, 'req', BC, MAC.r, 'Convertido em broadcast da LAN', 'O roteador entrega o pacote como quadro de broadcast: todos os hosts da rede 10.20.0.0/24 o recebem.');
      ev(tr.t, 's', 'Recebe o broadcast dirigido (e responderia à origem)', 'warn');
      tr.lg(tr.t, 'Roteador: broadcast dirigido encaminhado. Cada host da LAN pode responder, o que amplifica o tráfego sobre a origem (por isso a RFC 2644 o desliga).', 'loss');
      fin('dbfwd', 'broadcast dirigido encaminhado', 'bad');
    }
    tr.raw = R;
    return tr;
  }

  // entrega na rede conectada de maior prefixo
  const hostIf = HOST_ON[dst];
  if (hostIf !== w.iface) {
    for (let n = 1; n <= TRIES; n++) {
      ev(tr.t, 'r', 'ARP na ' + w.iface + ' por ' + dst + ': sem resposta (tentativa ' + n + ' de ' + TRIES + ')', 'warn');
      if (n < TRIES) tr.wait(1000);
    }
    const sobre = l.matches.length > 1;
    unreach(1, 'Host ' + dst + ' não responde na ' + w.iface + (sobre ? ': a rede ' + w.net + '/' + w.len + ' sobreposta tomou o lugar da rede onde o host está' : ''));
    tr.raw = R;
    return tr;
  }
  ip('r', 's', A_IP, dst, 63, 'req', MAC.s, MAC.r, 'Entrega na rede conectada', 'O roteador decrementa o TTL e entrega o pacote ao servidor, pelo MAC dele.');
  ev(tr.t, 's', 'Recebe o Echo Request e responde', 'ok');
  ip('s', 'r', dst, A_IP, 64, 'rep', MAC.r, MAC.s, 'Resposta ao roteador', 'O servidor responde ao seu gateway.');
  ip('r', 'a', dst, A_IP, 63, 'rep', MAC.a, MAC.r, 'Resposta ao host A', 'O roteador encaminha a resposta ao host A.');
  tr.lg(tr.t, 'Host A: resposta de ' + dst + ' (TTL 63: passou por um roteador).', 'conn');
  fin('ok', 'ping funcionou', 'est');
  tr.raw = R;
  return tr;
}

export function buildEnd(P: EndParams, _sub: string): Trace {
  const tr = run(P);
  const used = new Set<string>([...tr.msgs.flatMap((m) => [m.from, m.to]), ...tr.events.map((e) => e.who)]);
  tr.cols = tr.cols.filter((c) => c.key === 'a' || c.key === 'r' || used.has(c.key));
  return tr;
}
