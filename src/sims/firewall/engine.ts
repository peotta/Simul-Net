// Motor do Firewall: filtragem sem estado (lista de regras), filtragem com estado (tabela de conexões), zonas
// (interna, DMZ e externa) e filtro de origem (anti-spoofing; BCP 38). Função pura: dados os parâmetros, devolve o Trace.
// É um modelo didático, não um produto: não há NAT, fragmentação, IPv6, inspeção de aplicação nem desempenho, e os
// tempos de expiração são ilustrativos (cada produto usa os seus). Os nomes dos estados se inspiram nos do TCP (RFC 9293,
// seção 3.3.2) e nos que firewalls com estado costumam mostrar, sem serem idênticos: o firewall os deduz dos pacotes que vê. Endereços de documentação (RFC 5737).
import { COLORS as C0, newTrace, type Column, type Field, type StateDef, type Trace } from '../../sim-core';

export type Zone = 'int' | 'dmz' | 'ext';
export type Proto = 'tcp' | 'udp' | 'icmp';

export interface FwParams {
  rtt: number;
  // Filtro sem estado
  aFluxo: 'tcp' | 'udp' | 'fora';
  aRetorno: 'porta' | 'ack' | 'nenhum';
  aOrdem: 'correta' | 'invertida';
  aPolitica: 'deny' | 'permit';
  // Filtro com estado
  eFluxo: 'tcp' | 'tcp-fim' | 'espuria' | 'udp' | 'icmp' | 'cheia';
  eAtraso: 'rapida' | 'tardia';
  eLimite: number;
  // Perímetro com DMZ
  dFluxo: 'pub' | 'ext-int' | 'admin' | 'lateral' | 'egresso';
  dDmzInt: 'negar' | 'permissiva';
  dEgresso: 'negar' | 'permitir';
  // Forja, varredura e taxa
  fFluxo: 'forja-in' | 'forja-out' | 'varredura' | 'rajada' | 'cego';
  fAntispoof: boolean;
  fResp: 'descartar' | 'rejeitar';
  fTaxa: boolean;
}

export const ADDR = {
  int: '192.0.2.10',
  db: '192.0.2.20',
  web: '198.51.100.80',
  cli: '203.0.113.10',
  srv: '203.0.113.50',
  falso: '203.0.113.77',
  fwI: '192.0.2.1',
  fwD: '198.51.100.1',
  fwE: '203.0.113.1',
} as const;

export const ZN: Record<Zone, string> = { int: 'interna', dmz: 'DMZ', ext: 'externa' };
const ZNET: Record<Zone, string> = { int: '192.0.2.0/24', dmz: '198.51.100.0/24', ext: 'fora das duas redes' };
export const zoneOf = (ip: string): Zone => (ip.startsWith('192.0.2.') ? 'int' : ip.startsWith('198.51.100.') ? 'dmz' : 'ext');

export const STATES: StateDef[] = [
  { key: 'phase', label: 'Fase' },
  { key: 'last', label: 'Última decisão' },
  { key: 'tab', label: 'Conexões na tabela' },
  { key: 'neg', label: 'Pacotes negados' },
];

export interface Pkt {
  src: string;
  dst: string;
  proto: Proto;
  sport?: number;
  dport?: number;
  flags?: string;
  icmp?: 'echo' | 'reply';
  /** Interface (zona) por onde o pacote chega ao firewall. */
  inIf: Zone;
}

export interface Sel { zone?: Zone; ip?: string }
export interface Rule {
  n: number;
  act: 'permit' | 'deny';
  proto: 'ip' | Proto;
  from?: Zone;
  src?: Sel;
  dst?: Sel;
  sport?: number;
  dport?: number[];
  ack?: boolean;
  /** Novas conexões por segundo e por origem. */
  limit?: number;
}

const selTxt = (s?: Sel): string => (!s ? 'qualquer' : s.ip ? s.ip : ZN[s.zone!]);

/** Texto genérico de uma regra (não é a sintaxe de nenhum produto). */
export function ruleText(r: Rule): string {
  let t = (r.act === 'permit' ? 'permitir ' : 'negar ') + (r.proto === 'ip' ? 'qualquer protocolo' : r.proto);
  t += ', origem ' + selTxt(r.src) + ', destino ' + selTxt(r.dst);
  if (r.from) t += ', pela interface ' + ZN[r.from];
  if (r.sport !== undefined) t += ', porta de origem ' + r.sport;
  if (r.dport) t += ', porta de destino ' + r.dport.join(' ou ');
  if (r.ack) t += ', com o flag ACK';
  if (r.limit) t += ', até ' + r.limit + ' novas conexões por segundo por origem';
  return t;
}

const selOk = (s: Sel | undefined, ip: string) => !s || (s.ip ? s.ip === ip : zoneOf(ip) === s.zone);
function matches(r: Rule, p: Pkt): boolean {
  if (r.proto !== 'ip' && r.proto !== p.proto) return false;
  if (r.from && r.from !== p.inIf) return false;
  if (!selOk(r.src, p.src) || !selOk(r.dst, p.dst)) return false;
  if (r.sport !== undefined && r.sport !== p.sport) return false;
  if (r.dport && !(p.dport !== undefined && r.dport.includes(p.dport))) return false;
  if (r.ack && !(p.flags ?? '').includes('ACK')) return false;
  return true;
}

export interface RuleSet { rules: Rule[]; policy: 'permit' | 'deny'; stateful: boolean }

type RuleSpec = Omit<Rule, 'n'>;
const number = (l: RuleSpec[]): Rule[] => l.map((r, i) => ({ ...r, n: i + 1 }));

/** Lista de regras de cada modo, na ordem em que o firewall as avalia. */
export function rulesFor(P: FwParams, sub: string): RuleSet {
  const I: Sel = { zone: 'int' };
  const D: Sel = { zone: 'dmz' };
  const E: Sel = { zone: 'ext' };
  const web: Sel = { ip: ADDR.web };
  if (sub === 'acl') {
    const saida: RuleSpec = { act: 'permit', proto: 'tcp', src: I, dport: [443] };
    const larga: RuleSpec = { act: 'deny', proto: 'tcp', src: I };
    const retorno: RuleSpec | null = P.aRetorno === 'porta' ? { act: 'permit', proto: 'tcp', dst: I, sport: 443 } : P.aRetorno === 'ack' ? { act: 'permit', proto: 'tcp', dst: I, ack: true } : null;
    const list: RuleSpec[] = [...(P.aOrdem === 'invertida' ? [larga] : []), saida, ...(retorno ? [retorno] : [])];
    return { rules: number(list), policy: P.aPolitica, stateful: false };
  }
  if (sub === 'est') {
    return {
      rules: number([
        { act: 'permit', proto: 'tcp', src: I, dport: [443] },
        { act: 'permit', proto: 'udp', src: I, dport: [53] },
        { act: 'permit', proto: 'icmp', src: I },
      ]),
      policy: 'deny',
      stateful: true,
    };
  }
  if (sub === 'dmz') {
    return {
      rules: number([
        { act: 'permit', proto: 'tcp', src: E, dst: web, dport: [80, 443] },
        { act: 'permit', proto: 'tcp', src: I, dst: web, dport: [22, 443] },
        { act: 'permit', proto: 'tcp', src: I, dst: E, dport: [80, 443] },
        { act: 'permit', proto: 'udp', src: I, dst: E, dport: [53] },
        { act: P.dDmzInt === 'permissiva' ? 'permit' : 'deny', proto: 'ip', src: D, dst: I },
        P.dEgresso === 'permitir' ? { act: 'permit', proto: 'tcp', src: D, dst: E, dport: [80, 443] } : { act: 'deny', proto: 'ip', src: D, dst: E },
      ]),
      policy: 'deny',
      stateful: true,
    };
  }
  return {
    rules: number([
      { act: 'permit', proto: 'tcp', src: E, dst: web, dport: [80, 443], limit: P.fTaxa ? 3 : undefined },
      { act: 'permit', proto: 'tcp', from: 'int', dst: E, dport: [443] },
      { act: 'permit', proto: 'udp', from: 'int', dst: E, dport: [53] },
      { act: 'permit', proto: 'tcp', src: I, dst: web, dport: [443] },
    ]),
    policy: 'deny',
    stateful: true,
  };
}

export interface Conn {
  id: number;
  proto: Proto;
  a: { ip: string; port: number };
  b: { ip: string; port: number };
  state: string;
  /** Instante (ms) em que a entrada expira se nada passar por ela. */
  exp: number;
  finBy?: 'a' | 'b';
}
export interface ConnEv { t: number; op: 'set' | 'del'; c: Conn; why?: string }
export interface Hit { t: number; n: number; ok: boolean; via: string }

/** Tempos de expiração por estado (ms). Valores ilustrativos: cada produto usa os seus. */
export const EXP: Record<string, number> = { SYN_SENT: 60000, SYN_RECV: 60000, ESTABLISHED: Infinity, FIN_WAIT: 30000, TIME_WAIT: 5000, NEW: 30000, REPLIED: 30000 };
const EXP_ICMP = 10000;

export function fmtTime(ms: number): string {
  const f = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (ms < 1000) return f(ms) + 'ms';
  return f(ms / 1000) + 's';
}

type X = Record<string, any>;
const C = (key: string, label: string, sub: string, addr: string): Column => ({ key, label, sub, addr });

export const COL = {
  int: C('int', 'Host interno', 'zona interna', ADDR.int),
  db: C('db', 'Servidor interno', 'zona interna', ADDR.db),
  web: C('web', 'Servidor web', 'zona DMZ', ADDR.web),
  cli: C('ext', 'Cliente externo', 'Internet', ADDR.cli),
  srv: C('ext', 'Servidor externo', 'Internet', ADDR.srv),
};
const fwCol = (zones: 2 | 3): Column => C('fw', 'Firewall', zones === 2 ? 'duas zonas' : 'três zonas', zones === 2 ? ADDR.fwI + ' | ' + ADDR.fwE : ADDR.fwI + ' | ' + ADDR.fwD + ' | ' + ADDR.fwE);

export function columnsFor(P: FwParams, sub: string): Column[] {
  if (sub === 'acl') return P.aFluxo === 'fora' ? [COL.cli, fwCol(2), COL.int] : [COL.int, fwCol(2), COL.srv];
  if (sub === 'est') return P.eFluxo === 'espuria' ? [COL.int, fwCol(2), COL.cli] : [COL.int, fwCol(2), COL.srv];
  if (sub === 'dmz') {
    const f = fwCol(3);
    return { pub: [COL.cli, f, COL.web], 'ext-int': [COL.cli, f, COL.int], admin: [COL.int, f, COL.web], lateral: [COL.web, f, COL.db], egresso: [COL.web, f, COL.srv] }[P.dFluxo];
  }
  const f = fwCol(3);
  if (P.fFluxo === 'forja-in') return [COL.cli, f, COL.web, COL.int];
  if (P.fFluxo === 'forja-out') return [COL.int, f, COL.srv];
  return [COL.cli, f, COL.web];
}

interface Ep { ip: string; port: number }
const ep = (ip: string, port: number): Ep => ({ ip, port });

const portName = (p?: number) => ({ 22: 'SSH', 53: 'DNS', 80: 'HTTP', 443: 'HTTPS', 3389: 'RDP', 5432: 'banco de dados', 23: 'Telnet' } as Record<number, string>)[p ?? 0] ?? '';

function header(p: Pkt): Field[] {
  const note = (ip: string) => 'zona ' + ZN[zoneOf(ip)] + ' (' + ZNET[zoneOf(ip)] + ')';
  const f: Field[] = [{ sec: 'IPv4' }, ['Origem', p.src, note(p.src)], ['Destino', p.dst, note(p.dst)], ['Protocolo', { tcp: 'TCP (6)', udp: 'UDP (17)', icmp: 'ICMP (1)' }[p.proto], '']];
  if (p.proto === 'tcp') {
    f.push({ sec: 'TCP' }, ['Porta de origem', String(p.sport), ''], ['Porta de destino', String(p.dport), portName(p.dport)], ['Flags', p.flags ?? '', p.flags === 'SYN' ? 'pedido de nova conexão' : p.flags === 'SYN+ACK' ? 'resposta ao pedido' : '']);
  } else if (p.proto === 'udp') {
    f.push({ sec: 'UDP' }, ['Porta de origem', String(p.sport), ''], ['Porta de destino', String(p.dport), portName(p.dport)]);
  } else {
    f.push({ sec: 'ICMP' }, ['Tipo', p.icmp === 'echo' ? '8 (Echo Request)' : '0 (Echo Reply)', ''], ['Identificador', String(p.sport), 'liga a resposta ao pedido']);
  }
  return f;
}

const label = (p: Pkt): string => (p.proto === 'tcp' ? p.flags ?? '' : p.proto === 'udp' ? 'UDP ' + p.dport : p.icmp === 'echo' ? 'Echo Request' : 'Echo Reply');
const info = (p: Pkt): string => (p.proto === 'icmp' ? p.src + ' → ' + p.dst : p.src + ':' + p.sport + ' → ' + p.dst + ':' + p.dport);

interface Verdict { ok: boolean; via: 'antispoof' | 'estado' | 'regra' | 'politica' | 'invalido' | 'tabela' | 'taxa'; n?: number; why: string }
const V = (ok: boolean, via: Verdict['via'], why: string, n?: number): Verdict => ({ ok, via, why, n });

interface SendOpts { label?: string; enc?: boolean; about?: string; len?: number }

export function buildFirewall(P: FwParams, sub: string): Trace {
  const set = rulesFor(P, sub);
  const tr = newTrace(columnsFor(P, sub), STATES, P.rtt);
  const half = tr.ow / 2;
  const table: Conn[] = [];
  const conns: ConnEv[] = [];
  const hits: Hit[] = [];
  const attempts = new Map<string, number[]>();
  const R: X = { P, sub, rules: set.rules, policy: set.policy, stateful: set.stateful, conns, hits, permit: 0, deny: 0, result: '' };
  tr.raw = R;
  let nextId = 1;
  const limit = sub === 'est' && P.eFluxo === 'cheia' ? P.eLimite : 1000;

  const snap = (c: Conn): Conn => ({ ...c, a: { ...c.a }, b: { ...c.b } });
  const tabState = (t: number) => tr.st(t, 'tab', table.length + (table.length === 1 ? ' entrada' : ' entradas'), table.length ? 'est' : 'closed');
  const drop = (c: Conn, t: number, why: string) => {
    table.splice(table.indexOf(c), 1);
    conns.push({ t, op: 'del', c: snap(c), why });
    tabState(t);
  };
  /** Remove as entradas cujo prazo venceu até o instante t, registrando o instante real do vencimento. */
  const sweep = (t: number) => {
    for (const c of [...table].filter((x) => x.exp <= t).sort((a, b) => a.exp - b.exp)) {
      drop(c, c.exp, 'expirou por inatividade');
      tr.ev(c.exp, 'fw', 'Entrada expirou: ' + connText(c), 'warn');
      tr.lg(c.exp, 'Firewall: a entrada ' + connText(c) + ' expirou (prazo ilustrativo).', 'sys');
    }
  };
  const expOf = (c: Conn) => (c.proto === 'icmp' ? EXP_ICMP : EXP[c.state] ?? Infinity);
  const find = (p: Pkt): { c: Conn; fwd: boolean } | undefined => {
    for (const c of table) {
      if (c.proto !== p.proto) continue;
      if (c.a.ip === p.src && c.a.port === p.sport && c.b.ip === p.dst && c.b.port === p.dport) return { c, fwd: true };
      if (c.b.ip === p.src && c.b.port === p.sport && c.a.ip === p.dst && c.a.port === p.dport) return { c, fwd: false };
    }
    return undefined;
  };
  const advance = (c: Conn, p: Pkt, fwd: boolean, t: number) => {
    const before = c.state;
    const F = p.flags ?? '';
    if (p.proto === 'tcp') {
      if (F.includes('RST')) return drop(c, t, 'conexão encerrada por RST');
      if (c.state === 'SYN_SENT' && !fwd && F === 'SYN+ACK') c.state = 'SYN_RECV';
      else if (c.state === 'SYN_RECV' && fwd && F.includes('ACK')) c.state = 'ESTABLISHED';
      else if (F.includes('FIN')) {
        if (c.state === 'ESTABLISHED') { c.state = 'FIN_WAIT'; c.finBy = fwd ? 'a' : 'b'; }
        else if (c.state === 'FIN_WAIT' && c.finBy !== (fwd ? 'a' : 'b')) c.state = 'TIME_WAIT';
      }
    } else if (p.proto === 'udp') {
      if (!fwd && c.state === 'NEW') c.state = 'REPLIED';
    } else if (!fwd && p.icmp === 'reply') {
      return drop(c, t, 'resposta recebida');
    }
    c.exp = t + expOf(c);
    if (c.state !== before) conns.push({ t, op: 'set', c: snap(c) });
  };

  const decide = (p: Pkt, t: number): Verdict => {
    sweep(t);
    if (sub === 'def' && P.fAntispoof) {
      const z = zoneOf(p.src);
      if (p.inIf === 'ext' && z !== 'ext') return V(false, 'antispoof', 'a origem ' + p.src + ' é da zona ' + ZN[z] + ', mas o pacote chegou pela interface externa (filtro de origem)');
      if (p.inIf === 'int' && z !== 'int') return V(false, 'antispoof', 'a origem ' + p.src + ' não é da zona interna, mas o pacote chegou pela interface interna (filtro de origem, BCP 38)');
    }
    if (set.stateful) {
      const hit = find(p);
      if (hit) {
        advance(hit.c, p, hit.fwd, t);
        return V(true, 'estado', 'o pacote pertence a uma conexão registrada (' + hit.c.state + ')');
      }
      if ((p.proto === 'tcp' && p.flags !== 'SYN') || (p.proto === 'icmp' && p.icmp === 'reply')) return V(false, 'invalido', 'o pacote não pertence a nenhuma conexão registrada (fora de estado)');
    }
    const r = set.rules.find((x) => matches(x, p));
    const v = r
      ? V(r.act === 'permit', 'regra', 'regra ' + r.n + ': ' + ruleText(r), r.n)
      : V(set.policy === 'permit', 'politica', set.policy === 'permit' ? 'nenhuma regra casou e a política padrão é permitir' : 'nenhuma regra casou e a política padrão é negar (negação implícita)');
    if (v.ok && set.stateful && ((p.proto === 'tcp' && p.flags === 'SYN') || p.proto === 'udp' || (p.proto === 'icmp' && p.icmp === 'echo'))) {
      if (r?.limit) {
        const recent = (attempts.get(p.src) ?? []).filter((x) => x > t - 1000);
        if (recent.length >= r.limit) return V(false, 'taxa', 'a regra ' + r.n + ' permite até ' + r.limit + ' novas conexões por segundo por origem, e ' + p.src + ' já usou o limite', r.n);
        attempts.set(p.src, [...recent, t]);
      }
      if (table.length >= limit) return V(false, 'tabela', 'a tabela de conexões está cheia (' + limit + ' entradas): nenhuma conexão nova é aceita', v.n);
      const c: Conn = { id: nextId++, proto: p.proto, a: { ip: p.src, port: p.sport ?? 0 }, b: { ip: p.dst, port: p.dport ?? 0 }, state: p.proto === 'tcp' ? 'SYN_SENT' : 'NEW', exp: 0 };
      c.exp = t + expOf(c);
      table.push(c);
      conns.push({ t, op: 'set', c: snap(c) });
    }
    return v;
  };

  const verdictWord = (v: Verdict) => (v.ok ? 'permitido' : 'negado');

  /** Um pacote até o firewall e, se permitido, do firewall ao destino. Devolve se foi encaminhado. */
  const send = (from: string, to: string, p: Pkt, o: SendOpts = {}): boolean => {
    const t1 = tr.t + half;
    const v = decide(p, t1);
    const lab = o.label ?? label(p);
    const inf = info(p);
    const dec: Field[] = [
      { sec: 'Decisão do firewall' },
      ['Interface de entrada', ZN[p.inIf], 'zona de onde o pacote chegou'],
      ['Resultado', verdictWord(v), v.why, v.ok ? 'chk-ok' : 'chk-bad'],
    ];
    tr.add(from, 'fw', {
      label: lab, info: inf, proto: p.proto.toUpperCase(), len: o.len ?? 60, enc: !!o.enc, color: v.ok ? (o.enc ? C0.enc : C0.plain) : C0.bad, lost: !v.ok, dur: half, proc: 0.2,
      fields: [...header(p), ...dec], tags: v.ok ? [] : ['descartado pelo firewall'], phaseName: 'Chegada ao firewall',
      about: o.about ?? (v.ok ? 'O firewall avaliou o pacote e o permitiu: ' + v.why + '.' : 'O firewall descartou o pacote: ' + v.why + '.'),
    });
    hits.push({ t: t1, n: v.n ?? 0, ok: v.ok, via: v.via });
    R[v.ok ? 'permit' : 'deny']++;
    tr.ev(t1, 'fw', (v.ok ? 'Permite ' : 'Nega ') + lab + (v.n ? ' (regra ' + v.n + ')' : v.via === 'estado' ? ' (estado)' : v.via === 'politica' ? ' (política)' : ' (' + v.via + ')'), v.ok ? 'ok' : 'bad');
    tr.lg(t1, 'Firewall: ' + lab + ' ' + inf + ' ' + verdictWord(v) + '. ' + v.why + '.', v.ok ? 'conn' : 'fail');
    tr.st(t1, 'last', verdictWord(v) + (v.n ? ' (regra ' + v.n + ')' : ''), v.ok ? 'est' : 'bad');
    tr.st(t1, 'neg', String(R.deny), R.deny ? 'warn' : 'closed');
    tabState(t1);
    if (!v.ok) return false;
    tr.add('fw', to, {
      label: lab, info: inf, proto: p.proto.toUpperCase(), len: o.len ?? 60, enc: !!o.enc, color: o.enc ? C0.enc : C0.data, dur: half, fields: [...header(p), { sec: 'Encaminhamento' }, ['Observação', 'encaminhado pelo firewall', 'o pacote não é alterado: este firewall não faz NAT']],
      phaseName: 'Encaminhado', about: 'Pacote encaminhado pelo firewall ao destino, sem alteração.',
    });
    return true;
  };

  const pkt = (proto: Proto, s: Ep, d: Ep, extra: Partial<Pkt> = {}): Pkt => ({ proto, src: s.ip, dst: d.ip, sport: s.port, dport: d.port, inIf: zoneOf(s.ip), ...extra });
  const tcp = (s: Ep, d: Ep, flags: string, extra: Partial<Pkt> = {}): Pkt => pkt('tcp', s, d, { flags, ...extra });

  /** Abertura TCP: SYN, SYN+ACK e ACK. Com tries > 1, o SYN é retransmitido após 1 s (RFC 6298, seção 2, regra 2.1). */
  const open = (ck: string, sk: string, c: Ep, s: Ep, tries = 1): boolean => {
    for (let k = 0; k < tries; k++) {
      if (k > 0) {
        tr.ev(tr.t, ck, 'Sem resposta em 1 s: retransmite o SYN', 'warn');
        tr.wait(1000);
      }
      if (!send(ck, sk, tcp(c, s, 'SYN'), { about: k ? 'Retransmissão do SYN depois de 1 s sem resposta (RFC 6298, seção 2, regra 2.1).' : undefined })) continue;
      if (!send(sk, ck, tcp(s, c, 'SYN+ACK'))) continue;
      send(ck, sk, tcp(c, s, 'ACK'));
      tr.ev(tr.t, ck, 'Conexão estabelecida', 'ok');
      return true;
    }
    tr.ev(tr.t, ck, 'Conexão não estabelecida (tempo esgotado)', 'bad');
    return false;
  };
  const dataPair = (ck: string, sk: string, c: Ep, s: Ep, req: string, resp: string, enc: boolean) => {
    send(ck, sk, tcp(c, s, 'PSH+ACK'), { label: req, enc, len: 300 });
    send(sk, ck, tcp(s, c, 'PSH+ACK'), { label: resp, enc, len: 900 });
  };
  const close = (ck: string, sk: string, c: Ep, s: Ep) => {
    send(ck, sk, tcp(c, s, 'FIN+ACK'));
    send(sk, ck, tcp(s, c, 'FIN+ACK'));
    send(ck, sk, tcp(c, s, 'ACK'));
  };
  const end = () => { sweep(tr.t); };

  const I = ep(ADDR.int, 49152);
  const SRV = (port: number) => ep(ADDR.srv, port);
  const CLI = (port: number) => ep(ADDR.cli, port);
  const WEB = (port: number) => ep(ADDR.web, port);

  tr.st(0, 'phase', 'início', 'warn');
  tr.st(0, 'last', '-', 'closed');
  tr.st(0, 'tab', set.stateful ? '0 entradas' : 'sem estado', 'closed');
  tr.st(0, 'neg', '0', 'closed');
  tr.mile(0, 'Início', sub === 'acl' ? 'filtro sem estado' : 'filtro com estado');
  tr.lg(0, 'Firewall com ' + set.rules.length + (set.rules.length === 1 ? ' regra' : ' regras') + ' e política padrão de ' + (set.policy === 'permit' ? 'permitir' : 'negar') + (set.stateful ? ', com tabela de conexões.' : ', sem tabela de conexões (cada pacote é avaliado sozinho).'), 'sys');

  if (sub === 'acl') {
    if (P.aFluxo === 'tcp') {
      tr.phase('1. Abertura da conexão TCP de dentro para fora', 'open');
      const ok = open('int', 'ext', I, SRV(443), 2);
      if (ok) {
        tr.phase('2. Troca de dados', 'data');
        dataPair('int', 'ext', I, SRV(443), 'Requisição (HTTPS)', 'Resposta (HTTPS)', true);
        R.result = 'ok';
      } else R.result = P.aRetorno === 'nenhum' ? 'sem-retorno' : 'ordem';
    } else if (P.aFluxo === 'udp') {
      tr.phase('1. Consulta DNS de dentro para fora (UDP 53)', 'dns');
      const q = pkt('udp', ep(ADDR.int, 53001), SRV(53));
      const ok = send('int', 'ext', q, { label: 'Consulta DNS' });
      if (ok) send('ext', 'int', pkt('udp', SRV(53), ep(ADDR.int, 53001)), { label: 'Resposta DNS' });
      else tr.ev(tr.t, 'int', 'Sem resposta: tempo esgotado', 'bad');
      R.result = P.aPolitica === 'permit' ? 'politica-permit' : 'implicita';
    } else {
      tr.phase('2. Pacote de fora com porta de origem 443 para a porta 22 do host interno', 'fora');
      tr.ev(0, 'ext', 'Envia SYN com porta de origem 443', 'warn');
      const ok = open('ext', 'int', CLI(443), ep(ADDR.int, 22));
      R.result = ok ? 'fraco' : P.aRetorno === 'ack' ? 'ack-barra' : 'fora-barrado';
    }
  } else if (sub === 'est') {
    const f = P.eFluxo;
    if (f === 'tcp' || f === 'tcp-fim') {
      tr.phase('1. Abertura da conexão (SYN_SENT, SYN_RECV e ESTABLISHED)', 'open');
      open('int', 'ext', I, SRV(443));
      tr.phase('2. Troca de dados', 'data');
      dataPair('int', 'ext', I, SRV(443), 'Requisição (HTTPS)', 'Resposta (HTTPS)', true);
      if (f === 'tcp-fim') {
        tr.phase('3. Encerramento (FIN_WAIT e TIME_WAIT)', 'close');
        close('int', 'ext', I, SRV(443));
        tr.wait(6000);
        tr.phase('4. Expiração da entrada', 'exp');
        end();
        R.result = 'fim';
      } else R.result = 'tcp';
    } else if (f === 'espuria') {
      tr.phase('1. Tráfego de fora que não corresponde a nenhuma conexão', 'esp');
      tr.ev(0, 'ext', 'Envia pacotes sem que o host interno tenha iniciado nada', 'warn');
      send('ext', 'int', tcp(CLI(443), ep(ADDR.int, 49152), 'SYN+ACK'));
      send('ext', 'int', tcp(CLI(443), ep(ADDR.int, 49152), 'ACK'));
      send('ext', 'int', tcp(CLI(40000), ep(ADDR.int, 3389), 'SYN'));
      R.result = 'espuria';
    } else if (f === 'udp') {
      tr.phase('1. Consulta DNS (UDP 53)', 'q');
      const q = pkt('udp', ep(ADDR.int, 53001), SRV(53));
      send('int', 'ext', q, { label: 'Consulta DNS' });
      if (P.eAtraso === 'tardia') {
        tr.phase('2. A resposta demora mais que a validade da entrada', 'late');
        tr.wait(40000);
      } else tr.phase('2. A resposta chega dentro da validade', 'resp');
      const ok = send('ext', 'int', pkt('udp', SRV(53), ep(ADDR.int, 53001)), { label: 'Resposta DNS' });
      if (!ok) tr.ev(tr.t, 'int', 'Sem resposta: tempo esgotado', 'bad');
      R.result = ok ? 'udp' : 'udp-tardia';
    } else if (f === 'icmp') {
      tr.phase('1. Ping de dentro para fora', 'ping');
      const echo = pkt('icmp', ep(ADDR.int, 7001), ep(ADDR.srv, 7001), { icmp: 'echo' });
      send('int', 'ext', echo);
      send('ext', 'int', pkt('icmp', ep(ADDR.srv, 7001), ep(ADDR.int, 7001), { icmp: 'reply' }));
      tr.phase('2. Segunda resposta com o mesmo identificador', 'dup');
      send('ext', 'int', pkt('icmp', ep(ADDR.srv, 7001), ep(ADDR.int, 7001), { icmp: 'reply' }), { about: 'Resposta repetida: a entrada do pedido já foi usada e removida.' });
      R.result = 'icmp';
    } else {
      tr.phase('1. Conexões que ficam semiabertas (o servidor não responde)', 'syn');
      for (let k = 0; k < 6; k++) {
        send('int', 'ext', tcp(ep(ADDR.int, 49152 + k), SRV(443), 'SYN'));
      }
      tr.ev(tr.t, 'ext', 'Não responde: as entradas ficam em SYN_SENT', 'warn');
      R.result = R.deny > 0 ? 'cheia' : 'nao-cheia';
    }
  } else if (sub === 'dmz') {
    const f = P.dFluxo;
    if (f === 'pub') {
      tr.phase('1. Cliente da Internet acessa o servidor web da DMZ', 'pub');
      if (open('ext', 'web', CLI(50100), WEB(443))) { tr.phase('2. Troca de dados', 'data'); dataPair('ext', 'web', CLI(50100), WEB(443), 'Requisição (HTTPS)', 'Resposta (HTTPS)', true); }
      R.result = 'pub';
    } else if (f === 'ext-int') {
      tr.phase('1. Cliente da Internet tenta chegar à rede interna (porta 3389)', 'in');
      open('ext', 'int', CLI(50200), ep(ADDR.int, 3389), 2);
      R.result = 'ext-int';
    } else if (f === 'admin') {
      tr.phase('1. Administrador interno acessa o servidor web da DMZ (porta 22)', 'adm');
      if (open('int', 'web', ep(ADDR.int, 49300), WEB(22))) { tr.phase('2. Sessão', 'data'); dataPair('int', 'web', ep(ADDR.int, 49300), WEB(22), 'Sessão (SSH)', 'Sessão (SSH)', true); }
      R.result = 'admin';
    } else if (f === 'lateral') {
      tr.phase('1. Servidor web (suposto comprometido) tenta chegar ao banco de dados interno', 'lat');
      const ok = open('web', 'db', ep(ADDR.web, 52000), ep(ADDR.db, 5432), 2);
      if (ok) { tr.phase('2. Consulta ao banco de dados', 'data'); dataPair('web', 'db', ep(ADDR.web, 52000), ep(ADDR.db, 5432), 'Consulta SQL', 'Resultado', false); }
      R.result = ok ? 'lateral-livre' : 'lateral-barrado';
    } else {
      tr.phase('1. Servidor web tenta abrir uma conexão para a Internet (porta 443)', 'out');
      const ok = open('web', 'ext', ep(ADDR.web, 52100), SRV(443), 2);
      R.result = ok ? 'egresso-livre' : 'egresso-barrado';
    }
  } else {
    const f = P.fFluxo;
    if (f === 'forja-in') {
      tr.phase('1. Pacote vindo da Internet com origem do endereço interno ' + ADDR.int, 'forja');
      tr.ev(0, 'ext', 'Envia SYN com origem ' + ADDR.int + ' (endereço da zona interna)', 'warn');
      const syn = tcp(ep(ADDR.int, 40000), WEB(443), 'SYN', { inIf: 'ext' });
      if (send('ext', 'web', syn)) {
        tr.phase('2. O servidor responde ao dono verdadeiro do endereço', 'back');
        send('web', 'int', tcp(WEB(443), ep(ADDR.int, 40000), 'SYN+ACK'));
        tr.ev(tr.t, 'int', 'Recebe SYN+ACK de uma conexão que não abriu e responde com RST', 'warn');
        send('int', 'web', tcp(ep(ADDR.int, 40000), WEB(443), 'RST'));
        R.result = 'forja-passou';
      } else R.result = 'forja-barrada';
    } else if (f === 'forja-out') {
      tr.phase('1. Pacote saindo com origem que não pertence à rede interna', 'saida');
      tr.ev(0, 'int', 'Envia um pacote com origem ' + ADDR.falso + ' (não é da zona interna)', 'warn');
      const ok = send('int', 'ext', pkt('udp', ep(ADDR.falso, 53000), SRV(53), { inIf: 'int' }), { label: 'UDP 53 (origem forjada)' });
      if (ok) tr.ev(tr.t, 'ext', 'Recebe o pacote; a resposta irá ao dono de ' + ADDR.falso + ', e não a quem o enviou', 'warn');
      R.result = ok ? 'saida-passou' : 'saida-barrada';
    } else if (f === 'varredura') {
      tr.phase('1. Um host da Internet sonda cinco portas do servidor web', 'scan');
      tr.ev(0, 'ext', 'Envia SYN para as portas 22, 23, 80, 443 e 3389', 'warn');
      [22, 23, 80, 443, 3389].forEach((port, i) => {
        const c = CLI(50000 + i);
        if (send('ext', 'web', tcp(c, WEB(port), 'SYN'))) send('web', 'ext', tcp(WEB(port), c, 'SYN+ACK'));
        else if (P.fResp === 'rejeitar') {
          const dec: Field[] = [{ sec: 'Resposta do firewall' }, ['Origem', ADDR.web, 'o firewall responde no lugar do destino'], ['Destino', c.ip, ''], ['Porta de origem', String(port), ''], ['Porta de destino', String(c.port), ''], ['Flags', 'RST+ACK', 'recusa explícita da conexão']];
          tr.add('fw', 'ext', { label: 'RST (recusado)', info: ADDR.web + ':' + port + ' → ' + c.ip + ':' + c.port, proto: 'TCP', len: 54, color: C0.bad, fields: dec, phaseName: 'Resposta de recusa', about: 'O firewall recusa a conexão com um RST em vez de descartar em silêncio.' });
        }
      });
      tr.ev(tr.t, 'ext', P.fResp === 'rejeitar' ? 'Portas 22, 23 e 3389: recusadas (RST). Portas 80 e 443: abertas' : 'Portas 22, 23 e 3389: sem resposta. Portas 80 e 443: abertas', 'warn');
      R.result = P.fResp === 'rejeitar' ? 'varredura-reject' : 'varredura-drop';
    } else if (f === 'rajada') {
      tr.phase('1. Rajada de seis pedidos de conexão da mesma origem', 'burst');
      tr.ev(0, 'ext', 'Envia seis SYN seguidos para a porta 443', 'warn');
      for (let k = 0; k < 6; k++) {
        const c = CLI(50001 + k);
        if (send('ext', 'web', tcp(c, WEB(443), 'SYN'))) send('web', 'ext', tcp(WEB(443), c, 'SYN+ACK'));
      }
      R.result = P.fTaxa ? 'rajada-limitada' : 'rajada-livre';
    } else {
      tr.phase('1. Conexão HTTPS permitida pela regra', 'open');
      if (open('ext', 'web', CLI(50100), WEB(443))) {
        tr.phase('2. Conteúdo cifrado atravessa o firewall', 'data');
        dataPair('ext', 'web', CLI(50100), WEB(443), 'Requisição HTTPS (cifrada)', 'Resposta HTTPS (cifrada)', true);
        tr.ev(tr.t, 'fw', 'Vê só IP, protocolo, portas e estado: o conteúdo cifrado não é inspecionado', 'warn');
      }
      R.result = 'cego';
    }
  }

  tr.st(tr.t, 'phase', 'concluído', 'est');
  tr.mile(tr.t, 'Fim', R.deny ? R.deny + (R.deny === 1 ? ' negado' : ' negados') : 'tudo permitido');
  return tr;
}

export function connText(c: Conn): string {
  return c.proto.toUpperCase() + ' ' + c.a.ip + (c.proto === 'icmp' ? '' : ':' + c.a.port) + ' → ' + c.b.ip + (c.proto === 'icmp' ? '' : ':' + c.b.port);
}

/** Entradas da tabela no instante dado, reconstruídas a partir do diário de eventos. */
export function connsAt(tr: Trace, nowMs: number): Conn[] {
  const evs = ((tr.raw.conns || []) as ConnEv[]).map((e, i) => ({ e, i })).filter(({ e }) => e.t <= nowMs + 1e-9).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  const map = new Map<number, Conn>();
  evs.forEach(({ e }) => (e.op === 'del' ? map.delete(e.c.id) : map.set(e.c.id, e.c)));
  return Array.from(map.values());
}
