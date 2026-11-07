// Motor do simulador OSI. Um quadro HTTP sai do cliente, atravessa um switch e um roteador, chega ao servidor e a
// resposta volta pelo mesmo caminho. Em cada nó, o motor registra o que cada camada faz (evento curto no
// diagrama, texto completo no log e no palco) e, em cada salto, o quadro completo com bytes reais (campos por camada).
// Modo único 'jor': a jornada, com ou sem etiqueta 802.1Q no enlace tronco.
// Simplificações: a conexão TCP já está estabelecida (sem handshake nem ACK puro), as tabelas ARP e MAC já estão
// preenchidas, não há TLS, nem fragmentação, nem NAT. Veja a aba Referência.
import { COLORS as C0, newTrace, type Column, type StateDef, type Trace } from '../../sim-core';
import { buildFrame, CLI_PORT, CLI_SEQ, httpBytes, httpRequest, httpResponse, NODE, SRV_PORT, SRV_SEQ, VLAN_ID, type Frame, type Spec } from './model';

export interface OsiParams {
  rtt: number;
  vlan: boolean;
}

export const C = { req: C0.plain, resp: C0.data } as const;

export const COLS: Column[] = [
  { key: 'cli', label: 'Cliente', sub: 'camadas 1 a 7', addr: NODE.cli.ip },
  { key: 'sw', label: 'Switch', sub: 'camadas 1 e 2' },
  { key: 'rt', label: 'Roteador', sub: 'camadas 1 a 3', addr: NODE.rtl.ip },
  { key: 'srv', label: 'Servidor', sub: 'camadas 1 a 7', addr: NODE.srv.ip },
];

export const STATES: StateDef[] = [
  { key: 'camada', label: 'Camada em ação' },
  { key: 'pdu', label: 'PDU em ação' },
  { key: 'ttl', label: 'TTL do pacote' },
  { key: 'situacao', label: 'Situação' },
];

export type Dir = 'down' | 'up' | 'fwd';
export interface Step {
  t: number;
  who: string;
  layers: number[];
  dir: Dir;
  pdu: string;
  /** Texto completo do que a camada faz neste passo (o mesmo do log). */
  text: string;
}
export interface FrameRec {
  mid: number;
  hop: number;
  of: number;
  from: string;
  to: string;
  dir: string;
  bytes: number[];
  segs: { key: string; layer: number; label: string; off: number; len: number }[];
  fcs: number;
  ipSum: number;
  ttl: number;
  dmac: string;
  smac: string;
  sip: string;
  dip: string;
  vid: number | null;
  id: number;
  sport: number;
  dport: number;
  seq: number;
  ack: number;
  flags: string;
  /** Primeira linha da mensagem HTTP. */
  http: string;
  sizes: Frame['sizes'];
}

const PDU: Record<number, string> = { 7: 'dados', 6: 'dados', 5: 'dados', 4: 'segmento', 3: 'pacote', 2: 'quadro', 1: 'bits' };
const NAME: Record<string, string> = { cli: 'Cliente', sw: 'Switch', rt: 'Roteador', srv: 'Servidor' };
export const LAYER_NAME: Record<number, string> = { 7: 'Aplicação', 6: 'Apresentação', 5: 'Sessão', 4: 'Transporte', 3: 'Rede', 2: 'Enlace', 1: 'Física' };
const STEP = 0.1;
const hex = (n: number, w: number): string => '0x' + (n >>> 0).toString(16).padStart(w, '0');

type Base = Omit<Spec, 'dmac' | 'smac' | 'vid' | 'ttl'>;
type Hop = { dmac: string; smac: string; vid: number | null; ttl: number };
type Dirn = 'req' | 'resp';
const PATH: Record<Dirn, string[]> = { req: ['cli', 'sw', 'rt', 'srv'], resp: ['srv', 'rt', 'sw', 'cli'] };

export function buildOsi(P: OsiParams, _sub: string): Trace {
  const tr = newTrace(COLS, STATES, P.rtt);
  const V = P.vlan ? VLAN_ID : null;
  const hopMs = Math.max(P.rtt / 8, 0.5);
  const steps: Step[] = [];
  const frames: FrameRec[] = [];
  const R: Record<string, any> = { sub: 'jor', vlan: !!P.vlan, steps, frames, result: 'ok' };
  tr.raw = R;

  /** Evento curto no diagrama, texto completo no log e estado da pilha. */
  const step = (who: string, layers: number[], dir: Dir, short: string, long: string): void => {
    const t = tr.t;
    tr.ev(t, who, short, '');
    tr.lg(t, NAME[who] + ', ' + long, dir === 'up' ? 'data' : 'conn');
    const pdu = layers.includes(2) ? 'quadro' : PDU[layers[0]];
    steps.push({ t, who, layers, dir, pdu, text: NAME[who] + ', ' + long });
    tr.st(t, 'camada', 'L' + layers.slice().sort().join(' e L'), 'warn');
    tr.st(t, 'pdu', pdu, '');
    tr.wait(STEP);
  };

  /** Descida pela pilha no emissor: cada camada acrescenta o seu cabeçalho. */
  const down = (who: string, f: Frame, nextHop: string): void => {
    const s = f.spec;
    const gen = who === 'cli' ? 'o navegador gera' : 'o servidor HTTP gera';
    const http = s.http as NonNullable<Spec['http']>;
    const shortHttp = http.start.startsWith('GET') ? http.start.slice(0, http.start.indexOf(' HTTP')) : http.start.slice(9);
    step(who, [7], 'down', 'L7 gera ' + shortHttp, 'camada 7 (aplicação): ' + gen + ' a mensagem "' + http.start + '" (' + f.sizes.app + ' bytes de texto ASCII). A PDU é a mensagem de dados.');
    step(who, [6, 5], 'down', 'L5 e L6 sem TLS', 'camadas 5 e 6 (sessão e apresentação): sem TLS, os dados seguem em texto puro, sem codificação nem cifra. No modelo OSI essas camadas existem, mas aqui não acrescentam cabeçalho nem bytes.');
    step(who, [4], 'down', 'L4 TCP: segmento', 'camada 4 (transporte): o TCP cria o segmento com portas ' + s.sport + ' e ' + s.dport + ', sequência ' + s.seq + ', confirmação ' + s.ack + ', flags ' + (s.flags || []).join(', ') + ', e calcula o checksum com o pseudo-cabeçalho IP (' + hex(f.l4Sum, 4) + '). A PDU agora é o segmento (' + f.sizes.l4 + ' bytes).');
    step(who, [3], 'down', 'L3 IP: pacote', 'camada 3 (rede): o IPv4 cria o pacote com origem ' + s.sip + ', destino ' + s.dip + ', TTL ' + s.ttl + ' e protocolo 6 (TCP), e calcula o checksum do cabeçalho (' + hex(f.ipSum, 4) + '). A PDU agora é o pacote (' + f.sizes.l3 + ' bytes).');
    step(who, [2], 'down', 'L2 Ethernet: quadro', 'camada 2 (enlace): a Ethernet cria o quadro com MAC de destino ' + s.dmac + ' (' + nextHop + '), MAC de origem ' + s.smac + ' e tipo 0x0800, e acrescenta o FCS ' + hex(f.fcs, 8) + ' ao final. A PDU agora é o quadro (' + f.sizes.l2 + ' bytes).');
    step(who, [1], 'down', 'L1 bits no meio', 'camada 1 (física): antepõe o preâmbulo e o SFD e transmite os ' + f.sizes.l2 + ' bytes do quadro como sinais no cabo, bit a bit. A PDU agora são os bits.');
  };

  /** Subida pela pilha no receptor: cada camada confere e retira o seu cabeçalho. */
  const up = (who: string, f: Frame, last: string): void => {
    const s = f.spec;
    step(who, [1], 'up', 'L1 recebe os bits', 'camada 1 (física): o receptor se sincroniza pelo preâmbulo, reconhece o SFD e entrega os ' + f.sizes.l2 + ' bytes do quadro à camada 2.');
    step(who, [2], 'up', 'L2 FCS confere', 'camada 2 (enlace): o FCS recalculado (' + hex(f.fcsCalc, 8) + ') confere com o recebido, o MAC de destino ' + s.dmac + ' é o desta interface e o tipo 0x0800 manda o conteúdo ao IPv4. O cabeçalho e o FCS são retirados e a PDU volta a ser o pacote.');
    step(who, [3], 'up', 'L3 IP confere', 'camada 3 (rede): o checksum do cabeçalho (' + hex(f.ipSum, 4) + ') confere, o IP de destino ' + s.dip + ' é o deste host e o protocolo 6 manda o conteúdo ao TCP. O cabeçalho IP é retirado e a PDU volta a ser o segmento.');
    step(who, [4], 'up', 'L4 TCP entrega', 'camada 4 (transporte): o checksum TCP (' + hex(f.l4Sum, 4) + ') confere e a porta ' + s.dport + ' pertence a um processo escutando. Os dados chegam em ordem (sequência ' + s.seq + ') e são entregues ao processo. O cabeçalho TCP é retirado.');
    step(who, [6, 5], 'up', 'L5 e L6 sem TLS', 'camadas 5 e 6 (sessão e apresentação): sem TLS, não há nada a decifrar nem a decodificar: os dados passam sem alteração.');
    step(who, [7], 'up', 'L7 aplicação recebe', last);
  };

  /** Switch: só lê a camada 2. */
  const swRelay = (f: Frame, next: Frame, toward: string): void => {
    const s = f.spec;
    const retag = (s.vid === null) !== (next.spec.vid === null) ? (next.spec.vid !== null ? 'add' : 'drop') : null;
    const sw = retag === 'add' ? 'L2: põe a etiqueta 802.1Q' : retag === 'drop' ? 'L2: tira a etiqueta 802.1Q' : 'L2: encaminha pelo MAC';
    step('sw', [1, 2], 'fwd', sw, 'camadas 1 e 2 (o switch só lê a camada 2): recebe os bits, confere o FCS (' + hex(f.fcsCalc, 8) + ', confere), aprende o MAC de origem ' + s.smac + ' nesta porta e encaminha pela porta do MAC de destino ' + s.dmac + ' (' + toward + '). Não olha o IP, o TTL nem a porta.' + (retag === 'add' ? ' Ao sair pelo enlace tronco, acrescenta a etiqueta 802.1Q (VLAN ' + VLAN_ID + ') e recalcula o FCS.' : retag === 'drop' ? ' Ao sair pela porta de acesso, retira a etiqueta 802.1Q e recalcula o FCS.' : ''));
  };

  /** Roteador: sobe a camada 2, decide na camada 3 e desce a camada 2 do próximo enlace. */
  const rtRelay = (fIn: Frame, fOut: Frame, toward: string, net: string): void => {
    const s = fIn.spec;
    step('rt', [1, 2], 'up', 'L1 e L2: recebe', 'camadas 1 e 2: recebe os bits, confere o FCS (' + hex(fIn.fcsCalc, 8) + ', confere), reconhece o próprio MAC de destino (' + s.dmac + ')' + (s.vid !== null ? ', retira a etiqueta 802.1Q da subinterface' : '') + ' e retira o cabeçalho Ethernet. A PDU volta a ser o pacote.');
    step('rt', [3], 'fwd', 'L3: TTL ' + s.ttl + ' para ' + fOut.spec.ttl, 'camada 3 (rede): confere o checksum do IP, decrementa o TTL de ' + s.ttl + ' para ' + fOut.spec.ttl + ' (RFC 1812, seção 5.3.1), recalcula o checksum do cabeçalho (' + hex(fIn.ipSum, 4) + ' para ' + hex(fOut.ipSum, 4) + ') e consulta a tabela de rotas: ' + net + ' sai pela interface ' + toward + '. O IP de origem e o de destino não mudam.');
    step('rt', [2, 1], 'down', 'L2 e L1: novo quadro', 'camadas 2 e 1: monta um quadro novo para o próximo enlace: MAC de origem ' + fOut.spec.smac + ', MAC de destino ' + fOut.spec.dmac + ' (da tabela ARP), novo FCS (' + hex(fOut.fcs, 8) + ') e transmite. Por isso o MAC muda em cada salto, e o IP não.');
  };

  const hopOf = (dir: Dirn, i: number): Hop => {
    if (dir === 'req') return [{ dmac: NODE.rtl.mac, smac: NODE.cli.mac, vid: null, ttl: 64 }, { dmac: NODE.rtl.mac, smac: NODE.cli.mac, vid: V, ttl: 64 }, { dmac: NODE.srv.mac, smac: NODE.rtw.mac, vid: null, ttl: 63 }][i];
    return [{ dmac: NODE.rtw.mac, smac: NODE.srv.mac, vid: null, ttl: 64 }, { dmac: NODE.cli.mac, smac: NODE.rtl.mac, vid: V, ttl: 63 }, { dmac: NODE.cli.mac, smac: NODE.rtl.mac, vid: null, ttl: 63 }][i];
  };

  /** Percorre o caminho de um segmento: descida no emissor, cada salto, o que cada nó faz e a subida no receptor. */
  const travel = (dir: Dirn, base: Base, o: { label: string; color: string; about: string; last: string }): void => {
    const nodes = PATH[dir];
    const n = nodes.length - 1;
    const built: Frame[] = [];
    for (let i = 0; i < n; i++) built.push(buildFrame({ ...base, ...hopOf(dir, i) }, built[i - 1] || null));
    down(nodes[0], built[0], dir === 'req' ? 'o gateway, porque o destino está em outra rede' : 'o roteador, o próximo salto de volta');
    for (let i = 0; i < n; i++) {
      const f = built[i];
      const s = f.spec;
      const m = tr.add(nodes[i], nodes[i + 1], {
        label: o.label,
        proto: 'HTTP',
        color: o.color,
        len: f.sizes.l2,
        dur: hopMs,
        proc: 0,
        fields: f.fields,
        info: 'salto ' + (i + 1) + ' de ' + n + ': ' + s.smac + ' para ' + s.dmac + (s.vid !== null ? ' (VLAN ' + s.vid + ')' : '') + ', IP ' + s.sip + ' para ' + s.dip + ', TTL ' + s.ttl + ', TCP ' + s.sport + ' para ' + s.dport + ' [' + (s.flags || []).join(', ') + ']',
        about: o.about,
        phaseName: dir,
        tags: ['salto ' + (i + 1) + '/' + n],
      });
      tr.st(m.tSend, 'ttl', String(s.ttl), '');
      frames.push({ mid: m.id, hop: i + 1, of: n, from: nodes[i], to: nodes[i + 1], dir, bytes: f.bytes, segs: f.segs, fcs: f.fcs, ipSum: f.ipSum, ttl: s.ttl, dmac: s.dmac, smac: s.smac, sip: s.sip, dip: s.dip, vid: s.vid, id: s.id, sport: s.sport as number, dport: s.dport as number, seq: s.seq as number, ack: s.ack as number, flags: (s.flags || []).join(', '), http: (s.http as NonNullable<Spec['http']>).start, sizes: f.sizes });
      const at = nodes[i + 1];
      if (i === n - 1) up(at, f, o.last);
      else if (at === 'sw') swRelay(f, built[i + 1], dir === 'req' ? 'porta do roteador' : 'porta do cliente');
      else if (dir === 'req') rtRelay(f, built[i + 1], 'da WAN (' + NODE.rtw.ip + ')', '198.51.100.0/24');
      else rtRelay(f, built[i + 1], 'da LAN (' + NODE.rtl.ip + ')', '192.0.2.0/24');
    }
  };

  tr.st(0, 'camada', '-', 'closed');
  tr.st(0, 'pdu', '-', 'closed');
  tr.st(0, 'ttl', '-', 'closed');
  tr.st(0, 'situacao', 'em curso', 'warn');
  tr.mile(0, 'Início', 'aplicação gera dados');

  const path = '/index.html';
  const reqHttp = httpRequest(path);
  const reqLen = httpBytes(reqHttp).length;
  const tcp = (from: 'cli' | 'srv', over: Partial<Spec>): Base => ({
    sip: from === 'cli' ? NODE.cli.ip : NODE.srv.ip,
    dip: from === 'cli' ? NODE.srv.ip : NODE.cli.ip,
    id: from === 'cli' ? 0x1a2b : 0x3c4d,
    l4: 'tcp',
    sport: from === 'cli' ? CLI_PORT : SRV_PORT,
    dport: from === 'cli' ? SRV_PORT : CLI_PORT,
    flags: ['PSH', 'ACK'],
    seq: from === 'cli' ? CLI_SEQ : SRV_SEQ,
    ack: from === 'cli' ? SRV_SEQ : CLI_SEQ + reqLen,
    win: 64240,
    ...over,
  });

  tr.phase('1. Requisição', 'req');
  travel('req', tcp('cli', { http: reqHttp }), {
    label: 'GET ' + path,
    color: C.req,
    about: 'Requisição HTTP em um segmento TCP, dentro de um pacote IPv4, dentro de um quadro Ethernet. A cada salto o quadro é refeito.',
    last: 'camada 7 (aplicação): o servidor HTTP lê "GET /index.html", encontra o recurso e prepara a resposta 200.',
  });
  tr.phase('2. Resposta', 'resp');
  travel('resp', tcp('srv', { http: httpResponse(200) }), {
    label: '200 OK',
    color: C.resp,
    about: 'Resposta HTTP pelo caminho inverso: o mesmo encapsulamento, com origem e destino trocados.',
    last: 'camada 7 (aplicação): o navegador recebe a mensagem "HTTP/1.1 200 OK" com o corpo "Ola, OSI!" e a exibe. A viagem de ida e volta está completa.',
  });
  tr.st(tr.t, 'situacao', 'resposta 200 recebida', 'est');
  tr.mile(tr.t, 'Fim', 'resposta 200 recebida');
  return tr;
}
