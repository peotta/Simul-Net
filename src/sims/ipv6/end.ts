// Motor do IPv6, modo "end" (endereçamento e SLAAC): como o host A forma os próprios endereços e o que faz com cada tipo de
// destino.
//   - o host cria o endereço de enlace local fe80::/10 com o identificador de interface e o testa por DAD, a detecção de
//     duplicidade (RFC 4862, seções 5.3 e 5.4);
//   - pede e recebe um Router Advertisement (RFC 4861, seções 4.1 e 4.2) e, se o prefixo é /64 e a flag A está ligada, forma o
//     endereço global por SLAAC (RFC 4862, seção 5.5.3), que também passa por DAD;
//   - o destino decide o caminho: vizinho (Neighbor Discovery), roteador padrão (aprendido pelo RA), multicast do enlace, e
//     os casos em que o pacote não sai ou o roteador o recusa (ICMPv6 1/0 e 1/2, RFC 4443, seção 3.1).
// Os endereços são de documentação (RFC 3849) e locais únicos (RFC 4193). Não há tráfego real.
import { COLORS as C0, newTrace, type Column, type Field, type Message, type StateDef, type Trace } from '../../sim-core';
import { classify6, eui64, iidText, linkLocalOf, mcastMac6, solicited6, withPrefix } from './model';

export interface EndParams {
  hop: number;
  iid: 'eui64' | 'priv';
  ra: boolean;
  pfx: number;
  aflag: boolean;
  dad: 'ok' | 'conflict';
  dest: 'b' | 'llr' | 'srv' | 'mc' | 'ula';
}

export const MAC = { a: '00:00:5e:00:53:0a', b: '00:00:5e:00:53:14', r: '00:00:5e:00:53:01', s: '00:00:5e:00:53:32' } as const;
export const PREFIX = '2001:db8:10:1::';
export const R_LL = 'fe80::1';
export const R_GUA = '2001:db8:10:1::1';
export const B_IP = '2001:db8:10:1::20';
export const B_LL = linkLocalOf(eui64(MAC.b));
export const S_IP = '2001:db8:20:2::50';
export const ULA_IP = 'fd12:3456:789a:1::50';
/** Identificador temporário de exemplo (RFC 8981): não deriva do MAC. */
export const PRIV_IID = 0x8b3a41c2f09d1e77n;
const ALL_NODES = 'ff02::1';
const ALL_ROUTERS = 'ff02::2';
const UNSPEC = '::';
const TRIES_RS = 3;

export const E_DEST = { b: B_IP, llr: R_LL, srv: S_IP, mc: ALL_NODES, ula: ULA_IP } as const;

export const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'll', label: 'Endereço de enlace local' },
  { key: 'gua', label: 'Endereço global' },
  { key: 'res', label: 'Resultado' },
];

/** O identificador de interface de A, conforme o modo escolhido. */
export const iidOf = (m: EndParams['iid']): bigint => (m === 'eui64' ? eui64(MAC.a) : PRIV_IID);

const NAMES: Record<number, string> = { 128: 'Echo Request', 129: 'Echo Reply', 133: 'Router Solicitation', 134: 'Router Advertisement', 135: 'Neighbor Solicitation', 136: 'Neighbor Advertisement', 1: 'Destination Unreachable' };

function run(P: EndParams): Trace {
  const dst = E_DEST[P.dest];
  const COLS: Column[] = [
    { key: 'a', label: 'Host A', sub: 'origem', addr: 'fe80::...' },
    { key: 'b', label: 'Host B', sub: 'mesma LAN', addr: B_IP },
    { key: 'r', label: 'Roteador', sub: 'gateway', addr: R_LL },
    { key: 's', label: 'Servidor', sub: 'rede 2001:db8:20:2::/64', addr: S_IP },
  ];
  const tr = newTrace(COLS, STATES, P.hop * 2);
  const iid = iidOf(P.iid);
  const A_LL = linkLocalOf(iid);
  const R: Record<string, any> = { P, dst, dstType: classify6(dst), mac: MAC.a, iidMode: P.iid, iid: iidText(iid), ll: A_LL, gua: null as null | string, prefix: PREFIX, plen: P.pfx, aflag: P.aflag, gotRa: false, slaac: '', why: '', defRouter: false, onLink: false, dadLl: 'ok', dadGua: '', cache: [] as string[], src: A_LL, result: '', pk: [] };
  tr.cols[0].addr = A_LL;

  const ev = (t: number, w: string, text: string, k = ''): void => tr.ev(t, w, text, k);
  const fin = (res: string, label: string, cls: string): void => {
    R.result = res;
    tr.st(tr.t, 'res', label, cls);
    tr.st(tr.t, 'phase', 'fim', 'closed');
    tr.mile(tr.t, 'Fim', label);
  };
  const macOf = (k: string): string => (MAC as Record<string, string>)[k];

  interface O {
    label: string;
    src: string;
    dst: string;
    hl: number;
    ty: number;
    co?: number;
    plen: number;
    color: string;
    info: string;
    about: string;
    dmac: string;
    par?: boolean;
    lost?: boolean;
    extra?: Field[];
    phase: string;
  }
  function m6(from: 'a' | 'b' | 'r' | 's', to: 'a' | 'b' | 'r' | 's', o: O): Message {
    const co = o.co ?? 0;
    const fields: Field[] = [
      { sec: 'Ethernet II' }, ['Destino', o.dmac, o.dmac.startsWith('33:33') ? 'MAC multicast: 33:33 e os 32 bits finais do endereço IPv6' : 'MAC do próximo salto'], ['Origem', macOf(from), ''],
      { sec: 'IPv6 (RFC 8200)' }, ['Hop Limit', String(o.hl), o.hl === 255 ? 'o valor 255 prova que a mensagem veio do mesmo enlace (RFC 4861, seção 7.1)' : 'cada roteador o decrementa'], ['Origem', o.src, ''], ['Destino', o.dst, ''],
      { sec: 'ICMPv6 (RFC 4443)' }, ['Tipo e código', o.ty + '/' + co, NAMES[o.ty] || ''],
      ...(o.extra || []),
    ];
    const m = tr.add(from, to, { label: o.label, proto: 'ICMPv6', color: o.color, len: 40 + o.plen, info: o.info, about: o.about, par: o.par, lost: o.lost, phaseName: o.phase, fields, route: [from, to] });
    R.pk.push({ m: m.id, hl: o.hl, src: o.src, dst: o.dst, plen: o.plen, ty: o.ty, co });
    return m;
  }

  // ---- 1. endereço de enlace local e DAD ----
  tr.st(0, 'phase', 'enlace local', 'warn');
  tr.st(0, 'll', 'tentativo', 'warn');
  tr.st(0, 'gua', '-', 'closed');
  tr.st(0, 'res', 'em andamento', 'warn');
  tr.mile(0, 'Enlace local', 'DAD');
  tr.phase('Endereço de enlace local e DAD', 'dad1');
  ev(0, 'a', 'A interface sobe: o host forma ' + A_LL + ' (fe80::/10 com o identificador de interface ' + iidText(iid) + ')', '');
  tr.lg(0, 'Host A: endereço de enlace local ' + A_LL + ', formado com ' + (P.iid === 'eui64' ? 'o EUI-64 modificado do MAC ' + MAC.a + ' (insere ff:fe e inverte o bit U/L, RFC 4291, apêndice A).' : 'um identificador temporário, que não deriva do MAC (RFC 8981).'), 'sys');
  tr.t = 0.5;
  const dadNs = (target: string, why: string): void => {
    const sol = solicited6(target);
    m6('a', 'b', { label: 'DAD: alguém usa ' + target + '?', src: UNSPEC, dst: sol, hl: 255, ty: 135, plen: 24, color: C0.plain, par: true, phase: 'DAD', dmac: mcastMac6(sol), info: 'Neighbor Solicitation de DAD (' + why + ')', about: 'Antes de usar o endereço, o host pergunta a todos do enlace se alguém já o usa. A origem é o endereço não especificado (::), porque o endereço ainda é tentativo, e o destino é o endereço multicast de nó solicitado.', extra: [['Endereço alvo', target, 'o endereço que está sendo testado (tentativo)']] });
    m6('a', 'r', { label: 'DAD: alguém usa ' + target + '?', src: UNSPEC, dst: sol, hl: 255, ty: 135, plen: 24, color: C0.plain, phase: 'DAD', dmac: mcastMac6(sol), info: 'Neighbor Solicitation de DAD (' + why + ')', about: 'O roteador também faz parte do enlace e recebe a mesma pergunta.', extra: [['Endereço alvo', target, '']] });
  };
  dadNs(A_LL, 'enlace local');
  tr.wait(1000);
  ev(tr.t, 'a', 'Sem resposta em 1 s (RetransTimer): ' + A_LL + ' não é duplicado e passa a preferido', 'ok');
  tr.lg(tr.t, 'Host A: DAD concluída sem NA (DupAddrDetectTransmits = 1, RFC 4862, seção 5.1). ' + A_LL + ' é preferido.', 'conn');
  tr.st(tr.t, 'll', A_LL, 'est');

  // ---- 2. descoberta do roteador ----
  tr.st(tr.t, 'phase', 'roteador', 'warn');
  tr.phase('Descoberta do roteador', 'rs');
  const rsOnce = (n: number): void => {
    m6('a', 'r', { label: 'RS: há roteadores?', src: A_LL, dst: ALL_ROUTERS, hl: 255, ty: 133, plen: 16, color: C0.plain, phase: 'RS', dmac: mcastMac6(ALL_ROUTERS), info: 'Router Solicitation ' + n + ' de ' + (P.ra ? 1 : TRIES_RS), about: 'O host pede um Router Advertisement agora, sem esperar o próximo envio periódico. O destino é o grupo multicast de todos os roteadores do enlace.', extra: [['Opção 1', 'endereço de enlace de origem ' + MAC.a, '']] });
  };
  if (P.ra) {
    rsOnce(1);
    const pfxOk = P.pfx === 64;
    m6('r', 'a', {
      label: 'RA: prefixo ' + PREFIX + '/' + P.pfx, src: R_LL, dst: ALL_NODES, hl: 255, ty: 134, plen: 64, color: C0.data, phase: 'RA', dmac: mcastMac6(ALL_NODES),
      info: 'Router Advertisement com o prefixo ' + PREFIX + '/' + P.pfx + (P.aflag ? ', flag A ligada' : ', flag A desligada'),
      about: 'O roteador anuncia o prefixo da rede, se ele serve para SLAAC (flag A) e se está no mesmo enlace (flag L), e se é roteador padrão (tempo de vida). A resposta pode ser unicast ao solicitante; o simulador usa o multicast de todos os nós.',
      extra: [['Tempo de vida do roteador', '1800 s', 'diferente de zero: este é um roteador padrão'], ['Opção 3, prefixo', PREFIX + '/' + P.pfx, 'flags L = 1 (no enlace) e A = ' + (P.aflag ? '1' : '0') + ' (SLAAC)'], ['Tempos de vida do prefixo', 'válido 2592000 s, preferido 604800 s', ''], ['Opção 1', 'endereço de enlace do roteador ' + MAC.r, 'o host guarda a entrada do roteador na tabela de vizinhos, sem precisar perguntar'], ['Opção 5', 'MTU 1500', '']],
    });
    R.gotRa = true;
    R.defRouter = true;
    R.cache.push(R_LL);
    R.onLink = true;
    ev(tr.t, 'a', 'RA recebido: roteador padrão ' + R_LL + ' (tempo de vida 1800 s), prefixo ' + PREFIX + '/' + P.pfx + ' no enlace', 'ok');
    tr.lg(tr.t, 'Host A: RA de ' + R_LL + '. O host cria a rota padrão via ' + R_LL + ' e guarda o MAC do roteador (opção de endereço de enlace).', 'conn');
    // 3. SLAAC
    tr.phase('SLAAC', 'slaac');
    if (!P.aflag) {
      R.slaac = 'aflag';
      R.why = 'a flag A do prefixo está desligada: o host não forma endereço automaticamente';
      ev(tr.t, 'a', 'Flag A desligada: o prefixo só informa o que é do enlace, e o host não forma endereço global (RFC 4862, seção 5.5.3, passo a)', 'warn');
    } else if (!pfxOk) {
      R.slaac = 'plen';
      R.why = 'prefixo /' + P.pfx + ' mais identificador de 64 bits não soma 128 bits';
      ev(tr.t, 'a', 'Prefixo /' + P.pfx + ' + identificador de 64 bits não soma 128: o RA é ignorado para SLAAC (RFC 4862, seção 5.5.3)', 'bad');
    } else {
      const g = withPrefix(PREFIX, iid);
      R.slaacAddr = g;
      ev(tr.t, 'a', 'Forma ' + g + ' (prefixo /64 do RA e o mesmo identificador de interface)', 'ok');
      tr.lg(tr.t, 'Host A: SLAAC. Prefixo ' + PREFIX + '/64 + identificador ' + iidText(iid) + ' = ' + g + ' (tentativo).', 'sys');
      tr.st(tr.t, 'gua', g + ' (tentativo)', 'warn');
      tr.phase('DAD do endereço global', 'dad2');
      dadNs(g, 'endereço global');
      if (P.dad === 'conflict') {
        m6('b', 'a', { label: 'NA: ' + g + ' já é meu', src: g, dst: ALL_NODES, hl: 255, ty: 136, plen: 32, color: C0.bad, phase: 'DAD', dmac: mcastMac6(ALL_NODES), info: 'Neighbor Advertisement: o endereço está em uso', about: 'O host B já usa este endereço e responde ao multicast de todos os nós. A flag S fica desligada, porque a resposta não é a uma solicitação com origem conhecida.', extra: [['Flags', 'O', 'S = 0: resposta a um DAD, enviada a todos os nós'], ['Opção 2', 'endereço de enlace do alvo ' + MAC.b, '']] });
        R.dadGua = 'conflict';
        R.slaac = 'dup';
        R.why = 'o host B já usa ' + g + ' (DAD detectou duplicidade)';
        ev(tr.t, 'a', 'DAD: o endereço ' + g + ' já está em uso. Não é atribuído à interface (RFC 4862, seção 5.4.5)', 'bad');
        tr.lg(tr.t, 'Host A: duplicidade detectada em ' + g + '. O endereço global não é usado, e o de enlace local continua válido.', 'err');
        tr.st(tr.t, 'gua', 'duplicado: não usado', 'bad');
      } else {
        tr.wait(1000);
        R.dadGua = 'ok';
        R.gua = g;
        R.slaac = 'ok';
        ev(tr.t, 'a', 'Sem resposta em 1 s: ' + g + ' é único e passa a preferido', 'ok');
        tr.lg(tr.t, 'Host A: endereço global ' + g + ' ativo.', 'conn');
        tr.st(tr.t, 'gua', g, 'est');
        R.src = g;
      }
    }
  } else {
    for (let n = 1; n <= TRIES_RS; n++) {
      rsOnce(n);
      ev(tr.t, 'a', 'RS sem resposta (tentativa ' + n + ' de ' + TRIES_RS + ')', 'warn');
      if (n < TRIES_RS) tr.wait(4000);
    }
    tr.wait(1000);
    R.slaac = 'nora';
    R.why = 'nenhum roteador respondeu: não há prefixo nem roteador padrão';
    ev(tr.t, 'a', 'Nenhum RA: o host fica só com o endereço de enlace local, sem roteador padrão (RFC 4861, seção 6.3.7)', 'bad');
    tr.lg(tr.t, 'Host A: sem RA depois de ' + TRIES_RS + ' solicitações (intervalo de 4 s). Só há endereço de enlace local.', 'err');
    tr.st(tr.t, 'gua', 'sem RA: nenhum', 'bad');
  }

  // ---- 4. o ping ----
  const src: string = R.src;
  tr.st(tr.t, 'phase', 'ping', 'warn');
  tr.mile(tr.t, 'Ping', 'destino');
  tr.phase('Ping', 'ping');
  const dtype = classify6(dst);
  ev(tr.t, 'a', 'Ping para ' + dst + ' (' + dtype.nome + '), com origem ' + src, '');
  tr.lg(tr.t, 'Host A: ping para ' + dst + ', ' + dtype.nome + ' (' + dtype.rfc + '), com origem ' + src + '.', 'sys');

  const echo = (from: 'a' | 'b' | 'r' | 's', to: 'a' | 'b' | 'r' | 's', s: string, d: string, hl: number, req: boolean, dmac: string, info: string, about: string, par = false): Message =>
    m6(from, to, { label: (req ? 'Echo Request para ' : 'Echo Reply de ') + (req ? d : s), src: s, dst: d, hl, ty: req ? 128 : 129, plen: 56, color: req ? C0.plain : C0.data, phase: req ? 'Ida' : 'Volta', dmac, info, about, par });

  /** Resolve o MAC de um vizinho: sem entrada na tabela, Neighbor Solicitation e Advertisement. */
  const neigh = (k: 'b' | 'r', target: string, mac: string, srcAddr: string): void => {
    if (R.cache.includes(target)) {
      ev(tr.t, 'a', 'O MAC de ' + target + ' já está na tabela de vizinhos (veio no RA): não precisa perguntar', 'ok');
      return;
    }
    const sol = solicited6(target);
    tr.phase('Neighbor Discovery', 'nd');
    m6('a', k, { label: 'NS: quem tem ' + target + '?', src: srcAddr, dst: sol, hl: 255, ty: 135, plen: 32, color: C0.plain, phase: 'ND', dmac: mcastMac6(sol), info: 'Neighbor Solicitation', about: 'O host pergunta, no endereço de nó solicitado, qual é o MAC de ' + target + '. Só os nós com os mesmos 24 bits finais recebem a pergunta.', extra: [['Endereço alvo', target, ''], ['Opção 1', 'endereço de enlace de origem ' + MAC.a, '']] });
    m6(k, 'a', { label: 'NA: ' + target + ' está em ' + mac, src: target, dst: srcAddr, hl: 255, ty: 136, plen: 32, color: C0.data, phase: 'ND', dmac: MAC.a, info: 'Neighbor Advertisement', about: 'O alvo responde por unicast com o próprio MAC.', extra: [['Flags', 'R, S, O', ''], ['Opção 2', 'endereço de enlace do alvo ' + mac, '']] });
    R.cache.push(target);
    tr.phase('Ping', 'ping');
  };

  if (P.dest === 'mc') {
    ev(tr.t, 'a', 'ff02::1 é o grupo de todos os nós do enlace: o quadro vai ao MAC multicast 33:33:00:00:00:01', 'warn');
    echo('a', 'b', src, ALL_NODES, 64, true, mcastMac6(ALL_NODES), 'Echo Request em multicast', 'O destino é o grupo de todos os nós: todo host e todo roteador do enlace recebem o pedido. O IPv6 não tem broadcast, e este é o equivalente.', true);
    echo('a', 'r', src, ALL_NODES, 64, true, mcastMac6(ALL_NODES), 'Echo Request em multicast', 'O roteador também faz parte do grupo.');
    ev(tr.t, 'b', 'Responde ao multicast, com origem no próprio endereço unicast (RFC 4443, seção 4.2)', 'ok');
    echo('b', 'a', B_LL, src, 64, false, MAC.a, 'Resposta unicast do host B', 'A origem da resposta é um endereço unicast da interface que recebeu o pedido.');
    echo('r', 'a', R_LL, src, 64, false, MAC.a, 'Resposta unicast do roteador', 'O roteador responde do mesmo modo.');
    tr.lg(tr.t, 'Host A: duas respostas ao ping para ff02::1, de ' + B_LL + ' e de ' + R_LL + '. Ao contrário do IPv4, o eco para o multicast de todos os nós costuma ser respondido.', 'conn');
    fin('mc', 'respostas de todos os nós', 'est');
    tr.raw = R;
    return tr;
  }

  if (P.dest === 'llr') {
    ev(tr.t, 'a', 'Destino de enlace local: está no mesmo enlace, e a origem escolhida é de enlace local', 'ok');
    neigh('r', R_LL, MAC.r, A_LL);
    echo('a', 'r', A_LL, R_LL, 64, true, MAC.r, 'Entrega direta no enlace', 'O destino é o roteador, no mesmo enlace: nenhum roteamento é necessário.');
    echo('r', 'a', R_LL, A_LL, 64, false, MAC.a, 'Resposta direta', 'A resposta volta direto.');
    tr.lg(tr.t, 'Host A: resposta de ' + R_LL + '.', 'conn');
    fin('ok', 'ping funcionou', 'est');
    tr.raw = R;
    return tr;
  }

  const onLinkDest = P.dest === 'b';
  // sem prefixo e sem roteador padrão, o host não tem rota para um endereço global
  if (!R.gotRa) {
    ev(tr.t, 'a', 'Sem prefixo no enlace e sem roteador padrão, o host não tem rota para ' + dst, 'bad');
    ev(tr.t, 'a', 'Rede inalcançável (ENETUNREACH): nenhum pacote sai do host', 'bad');
    tr.lg(tr.t, 'Host A: sem rota para ' + dst + '. O sistema recusa o envio.', 'err');
    fin('nonet', 'rede inalcançável no host', 'bad');
    tr.raw = R;
    return tr;
  }

  if (onLinkDest) {
    ev(tr.t, 'a', 'O prefixo ' + PREFIX + '/64 está no enlace (flag L do RA): ' + dst + ' é vizinho, entrega direta', 'ok');
    neigh('b', B_IP, MAC.b, src);
    echo('a', 'b', src, B_IP, 64, true, MAC.b, 'Entrega direta no enlace', 'O destino está no mesmo prefixo: o quadro vai ao MAC do próprio host B.');
    echo('b', 'a', B_IP, src, 64, false, MAC.a, 'Resposta direta', 'A resposta volta direto.');
    tr.lg(tr.t, 'Host A: resposta de ' + B_IP + ' (entrega direta).', 'conn');
    fin('ok', 'ping funcionou', 'est');
    tr.raw = R;
    return tr;
  }

  // destino remoto: o primeiro salto é o roteador padrão
  ev(tr.t, 'a', dst + ' está fora do prefixo do enlace: o próximo salto é o roteador padrão ' + R_LL, 'warn');
  neigh('r', R_LL, MAC.r, src);
  echo('a', 'r', src, dst, 64, true, MAC.r, 'Para o roteador padrão', 'O IP de destino é ' + dst + ', mas o MAC do quadro é o do roteador: o endereço físico vale só neste enlace, o IP vale fim a fim.');
  const err = (code: 0 | 2, text: string, label: string, short: string): void => {
    ev(tr.t, 'r', text, 'bad');
    tr.lg(tr.t, 'Roteador: ' + text, 'err');
    m6('r', 'a', { label: 'ICMPv6 1/' + code + ' ' + (code === 0 ? 'sem rota' : 'além do escopo'), src: R_GUA, dst: src, hl: 64, ty: 1, co: code, plen: 104, color: C0.bad, phase: 'Aviso ICMPv6', dmac: MAC.a, info: 'Destination Unreachable, código ' + code, about: 'O roteador avisa a origem de que não encaminhou o pacote, e inclui o máximo do pacote original (RFC 4443, seção 2.4).' });
    ev(tr.t, 'a', 'Recebe ICMPv6 1/' + code + ': ' + short, 'bad');
    fin(code === 0 ? 'noroute' : 'scope', label, 'bad');
  };
  // a origem de enlace local não passa do enlace (RFC 4291, seção 2.5.6; RFC 4443, seção 3.1, código 2)
  if (classify6(src).nome === 'Link-local') {
    err(2, 'Origem ' + src + ' é de enlace local e o destino ' + dst + ' está além do enlace: o roteador não encaminha (RFC 4291, seção 2.5.6) e responde 1/2', 'além do escopo da origem (ICMPv6 1/2)', 'destino além do escopo da origem');
    tr.raw = R;
    return tr;
  }
  if (P.dest === 'ula') {
    ev(tr.t, 'r', dst + ' é um endereço local único (RFC 4193): o roteador não tem rota para ele', 'bad');
    err(0, 'Sem rota para ' + dst + ' (' + dtype.nome + '): descarta e avisa a origem (ICMPv6 1/0)', 'sem rota (ICMPv6 1/0)', 'sem rota para o destino');
    tr.raw = R;
    return tr;
  }
  ev(tr.t, 'r', dst + ' casa com a rota 2001:db8:20:2::/64 (conectada, eth1)', 'ok');
  tr.lg(tr.t, 'Roteador: ' + dst + ' pertence a 2001:db8:20:2::/64, conectada na eth1. O MAC do servidor já está na tabela de vizinhos do roteador.', 'conn');
  echo('r', 's', src, dst, 63, true, MAC.s, 'Entrega na rede conectada', 'O roteador decrementa o Hop Limit e entrega o pacote ao servidor, pelo MAC dele.');
  ev(tr.t, 's', 'Recebe o Echo Request e responde', 'ok');
  echo('s', 'r', dst, src, 64, false, MAC.r, 'Resposta ao roteador', 'O servidor responde ao seu gateway.');
  echo('r', 'a', dst, src, 63, false, MAC.a, 'Resposta ao host A', 'O roteador encaminha a resposta ao host A.');
  tr.lg(tr.t, 'Host A: resposta de ' + dst + ' (Hop Limit 63: passou por um roteador).', 'conn');
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
