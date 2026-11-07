// Montagem do trace do simulador de ataques e defesas TCP/UDP: converte a simulação por ciclos em mensagens
// (pacotes iguais de um ciclo viram uma seta), estados da telemetria, marcos da resposta a incidente e log.
import { newTrace, type Column, type Field, type StateDef, type Trace } from '../../sim-core';
import { DEFENSES, PLACE, VICTIM } from './content/data';
import { CYCLE_MS, ctxOf, simulate, type AtkParams, type Pkt } from './model';

export type { AtkParams };

export const C = { attack: '#E2574C', blocked: '#5FD4C0', resp: '#F2A65A', legit: '#6FB8E8', legitDrop: '#5B7399' };

export const NODE_NAME: Record<string, string> = { attacker: 'Atacante', edge: 'ISP (borda da origem)', reflector: 'Refletor', upstream: 'Operadora', firewall: 'Firewall / IDS', server: 'Vítima', client: 'Cliente' };

const STATES: StateDef[] = [
  { key: 'gen', label: 'Ataque rumo à vítima' },
  { key: 'blk', label: 'Neutralizados' },
  { key: 'dlv', label: 'Chegaram à vítima' },
  { key: 'load', label: 'Carga no servidor' },
  { key: 'svc', label: 'Serviço legítimo' },
  { key: 'alr', label: 'Alertas IDS' },
  { key: 'prot', label: 'Proteção efetiva' },
  { key: 'up', label: 'Mitigação upstream' },
];

const TAG: Record<string, string> = { sys: 'sys', blocked: 'conn', alert: 'loss', 'ir-log': 'data' };

const OFFSET: Record<string, [number, number]> = { attack: [0, 250], request: [0, 250], response: [300, 250], scan: [300, 250], legit: [150, 300], 'legit-fp': [150, 300], 'legit-sat': [150, 300] };

const pct = (v: number): string => Math.round(v * 100) + '%';

function pktFields(p: Pkt, P: AtkParams, sid: string): { fields: Field[]; info: string; color: string; lost: boolean; tags: string[] } {
  const X = ctxOf(P, sid);
  const route = p.route.map((k) => NODE_NAME[k]).join(' → ');
  const fields: Field[] = [{ sec: 'Pacotes agrupados do ciclo' }, ['Tipo', p.label, ''], ['Quantidade', String(p.count), 'pacotes iguais, com o mesmo trajeto e o mesmo desfecho, neste ciclo'], ['Trajeto', route, '']];
  const tags: string[] = [];
  if (p.kind === 'legit') {
    fields.push(['Desfecho', 'atendida', 'o cliente 198.51.100.77 acessa o serviço durante todo o experimento']);
    return { fields, info: 'requisição legítima atendida', color: C.legit, lost: false, tags };
  }
  if (p.kind === 'legit-fp') {
    fields.push(['Desfecho', 'descartada por falso positivo', 'o custo da defesa: um cliente real foi tratado como atacante']);
    fields.push(['Controle', DEFENSES[p.fpBy as string].name, X.fpNoteOf(p.fpBy as string) || '']);
    return { fields, info: 'falso positivo: ' + DEFENSES[p.fpBy as string].name, color: C.legitDrop, lost: true, tags: ['falso positivo'] };
  }
  if (p.kind === 'legit-sat') {
    fields.push(['Desfecho', 'descartada por saturação', 'o servidor sem recursos não atende nem o cliente legítimo']);
    return { fields, info: 'descartada por saturação do servidor', color: C.legitDrop, lost: true, tags: ['saturação'] };
  }
  if (p.kind === 'scan') {
    fields.push(['Desfecho', 'resposta ao scanner', 'a vítima respondeu à sonda: o atacante aprende algo sobre a rede']);
    return { fields, info: 'resposta que revela o estado da porta', color: C.resp, lost: false, tags };
  }
  const isResp = p.kind === 'response';
  if (!p.by) {
    if (p.kind === 'request') fields.push(['Desfecho', 'chegou ao refletor', 'cada requisição não barrada vira ' + X.s.factor + ' resposta(s) contra a vítima']);
    else fields.push(['Desfecho', 'chegou à vítima', 'nenhum controle ativo neutralizou estes pacotes']);
    const info = p.kind === 'request' ? 'requisição com origem falsificada chegou ao refletor' : isResp ? 'resposta amplificada chegou à vítima' : 'tráfego de ataque chegou à vítima';
    return { fields, info, color: isResp ? C.resp : C.attack, lost: false, tags: ['ataque'] };
  }
  const id = p.by;
  fields.push(['Desfecho', 'neutralizado', 'descartado em ' + PLACE[X.placeOf(id)]]);
  fields.push(['Controle', DEFENSES[id].name, X.whyOf(id)]);
  fields.push(['Eficácia neste cenário', pct(X.ctl(id).w), 'chance de o controle neutralizar um pacote sozinho (valor didático)']);
  return { fields, info: 'neutralizado por ' + DEFENSES[id].name, color: C.blocked, lost: true, tags: ['neutralizado'] };
}

export function buildAtaques(P: AtkParams, sub: string): Trace {
  const sim = simulate(P, sub);
  const { s, sid } = sim;
  const X = ctxOf(P, sid);
  const reflect = s.mode === 'reflect';
  const cols: Column[] = [{ key: 'attacker', label: s.multi ? 'Botnet' : 'Atacante', sub: s.multi ? 'milhares de IPs' : '198.51.100.x' }];
  if (reflect) cols.push({ key: 'edge', label: 'ISP', sub: 'borda da origem' }, { key: 'reflector', label: 'Refletor', sub: '192.0.2.53' });
  cols.push({ key: 'upstream', label: 'Operadora', sub: 'upstream' }, { key: 'firewall', label: 'FW / IDS', sub: 'borda da vítima' }, { key: 'server', label: 'Vítima', sub: VICTIM }, { key: 'client', label: 'Cliente', sub: '198.51.100.77' });
  const tr = newTrace(cols, STATES, 300);
  const total = sim.cycles.length;
  tr.raw = { sub, P, sid, sim, end: total * CYCLE_MS };

  const initial = (key: string, val: string): void => tr.st(0, key, val, '');
  ['gen', 'blk', 'dlv'].forEach((k) => initial(k, '0'));
  initial('load', '0%');
  initial('svc', '-');
  initial('alr', '0');
  initial('prot', '0%');
  initial('up', X.isOn('upstream') ? (X.alwaysOn ? 'ativa desde o início' : 'ainda não acionada') : 'desligada');
  tr.mile(0, 'Preparação', sim.ir.prepared ? 'controles prontos' : 'sem controles essenciais');
  const endOf = (tick: number): number => (tick - 1) * CYCLE_MS + 700;
  if (sim.ir.detect !== null) tr.mile(endOf(sim.ir.detect), 'Detecção e análise', 'ciclo ' + sim.ir.detect);
  if (sim.ir.contain !== null) tr.mile(endOf(sim.ir.contain), 'Contenção', 'ciclo ' + sim.ir.contain);
  if (sim.ir.recover !== null) tr.mile(endOf(sim.ir.recover), 'Erradicação e recuperação', 'ciclo ' + sim.ir.recover);
  if (sim.ir.post) tr.mile(total * CYCLE_MS - 20, 'Pós-incidente', 'lições na aba Experimento');

  tr.lg(0, 'Cenário carregado: ' + s.title + '. Vítima ' + VICTIM + ', intensidade ' + P.intensity + ', ' + total + ' ciclos.', 'sys');
  if (!sim.startControls.length) tr.lg(0, 'Nenhum controle defensivo ativo.', 'sys');
  sim.startControls.forEach((id) => {
    let msg = 'Defesa ativa: ' + DEFENSES[id].name + (X.ctl(id).w > 0 ? ' (atua em: ' + PLACE[X.placeOf(id)] + ').' : ' (sem efeito neste cenário).');
    if (id === 'upstream') msg += X.alwaysOn ? ' Contrato always-on: ativa desde o início.' : ' A operadora só é acionada depois do ciclo ' + X.upCall + '.';
    tr.lg(0, msg, 'sys');
  });
  if (sim.upstreamCall !== null) tr.lg(sim.upstreamCall * CYCLE_MS - 20, 'Chamado aberto com a operadora; 6 ciclos até a regra entrar em vigor (ciclo ' + (sim.upstreamCall + 6) + ').', 'sys');

  sim.cycles.forEach((c) => {
    const base = (c.tick - 1) * CYCLE_MS;
    c.pkts.forEach((p) => {
      const [off, dur] = OFFSET[p.kind];
      const f = pktFields(p, P, sid);
      const label = p.count > 1 ? p.label + ' ×' + p.count : p.label;
      tr.add(p.from, p.to, { at: base + off, dur, par: true, color: f.color, proto: s.proto, len: 0, label, info: label + ': ' + f.info, fields: f.fields, tags: f.tags, lost: f.lost, route: p.route, kind: p.kind, count: p.count, by: p.by || '', cycle: c.tick });
      if (p.by) tr.ev(base + off + dur, p.to, p.count + ' × ' + p.label + ' barrado: ' + DEFENSES[p.by].name, '');
      else if (p.fpBy) tr.ev(base + off + dur, p.to, 'falso positivo: ' + DEFENSES[p.fpBy].name, '');
    });
    c.logs.forEach((l) => tr.lg(base + l.off, '[' + String(c.tick).padStart(3, '0') + '] ' + l.text, TAG[l.tag] || 'sys'));
    const m = c.snap;
    const t = base + 700;
    tr.st(t, 'gen', reflect ? m.generated + ' (+' + m.reqs + ' req., ' + m.reqBlocked + ' barradas)' : String(m.generated), '');
    tr.st(t, 'blk', String(m.blocked), m.blocked ? 'est' : '');
    tr.st(t, 'dlv', String(m.delivered), m.delivered ? 'bad' : '');
    tr.st(t, 'load', Math.round(m.load) + '%' + (m.demand > 100.5 ? ' (demanda ' + Math.round(m.demand) + '%)' : ''), m.load > 70 ? 'bad' : m.load < 35 ? 'est' : '');
    const svc = m.legitSent ? Math.round((m.legitServed / m.legitSent) * 100) : null;
    tr.st(t, 'svc', svc === null ? '-' : svc + '%', svc === null ? '' : svc >= 95 ? 'est' : svc >= 75 ? '' : 'bad');
    tr.st(t, 'alr', String(m.alerts), '');
    tr.st(t, 'prot', pct(m.prot), '');
    if (X.isOn('upstream') && !X.alwaysOn) tr.st(t, 'up', m.upLeft > 0 ? 'acionando: ' + m.upLeft + ' ciclo(s)' : X.upReady(c.tick) ? 'filtrando' : 'ainda não acionada', '');
    else if (X.isOn('upstream')) tr.st(t, 'up', 'filtrando', '');
  });

  tr.t = total * CYCLE_MS;
  tr.lg(total * CYCLE_MS, 'Fim da simulação.', 'sys');
  return tr;
}
