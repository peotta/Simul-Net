// Motor puro do simulador de ataques e defesas TCP/UDP: o mesmo modelo por ciclos do simulador legado,
// executado de uma vez. Cada ciclo sorteia os pacotes de ataque, passa cada um pelas defesas em camadas
// e atualiza a carga do servidor, o serviço legítimo e a linha do tempo de resposta a incidente.
import { DEFAULT_LOG, DEFAULT_WHY_NOT, DEFENSES, ORDER, PLACE, SCEN, UPSTREAM_DELAY, VICTIM } from './content/data';

export interface Defense {
  name: string;
  at: string;
  fp: number;
  fpNote?: string;
}

export interface CtlInfo {
  w: number;
  why?: string;
  cfg?: string;
  log?: string;
  at?: string;
}

export interface ScenData {
  title: string;
  short?: string;
  proto: 'TCP' | 'UDP';
  mode: 'direct' | 'scan' | 'reflect';
  packet: string;
  response: string;
  factor: number;
  key: string[];
  description: string;
  indicators: string[];
  mitigations: string[];
  residual: string;
  evidence: string[];
  controls: Record<string, CtlInfo>;
  multi?: boolean;
  scale?: number;
  loadW?: number;
  linkLoad?: number;
  every?: number;
  fp?: Record<string, { p: number; note: string }>;
}

export interface AtkParams {
  attackTcp: string;
  attackUdp: string;
  intensity: number;
  cycles: number;
  rateLimit: boolean;
  stateful: boolean;
  antiSpoof: boolean;
  synCookies: boolean;
  ids: boolean;
  tls: boolean;
  hardening: boolean;
  /** 'off', 'on' (always-on) ou o ciclo depois do qual a operadora é acionada. */
  upstream: string;
}

export const DEFENSE_IDS = Object.keys(DEFENSES);
export const SEED = 20240601;
export const CYCLE_MS = 1000;

export type PktKind = 'attack' | 'request' | 'response' | 'scan' | 'legit' | 'legit-fp' | 'legit-sat';

/** Pacotes iguais de um ciclo (mesmo trajeto e mesmo desfecho) são agrupados em uma mensagem. */
export interface Pkt {
  kind: PktKind;
  from: string;
  to: string;
  route: string[];
  label: string;
  count: number;
  /** Controle que neutralizou o pacote; sem o campo, o pacote seguiu. */
  by?: string;
  /** Controle que causou o falso positivo (legítimo descartado). */
  fpBy?: string;
}

export interface Snap {
  tick: number;
  generated: number;
  blocked: number;
  delivered: number;
  load: number;
  demand: number;
  legitSent: number;
  legitServed: number;
  alerts: number;
  reqs: number;
  reqBlocked: number;
  byControl: Record<string, number>;
  prot: number;
  /** Ciclos que faltam para a operadora agir (0 quando já age ou não foi pedida). */
  upLeft: number;
}

export interface CycleLog {
  text: string;
  tag: string;
  off: number;
}

export interface Cycle {
  tick: number;
  pkts: Pkt[];
  logs: CycleLog[];
  snap: Snap;
}

export interface Ir {
  prepared: boolean;
  detect: number | null;
  detectBy: string;
  contain: number | null;
  recover: number | null;
  post: boolean;
}

export interface Sim {
  sid: string;
  s: ScenData;
  cycles: Cycle[];
  ir: Ir;
  startControls: string[];
  peakLoad: number;
  peakDemand: number;
  saturatedCycles: number;
  fpDrops: number;
  fpBy: Record<string, number>;
  satDrops: number;
  linkTotal: number;
  upstreamCall: number | null;
}

export const scenarioOf = (P: AtkParams, sub: string): string => {
  const id = sub === 'udp' ? P.attackUdp : P.attackTcp;
  return SCEN[id] ? id : sub === 'udp' ? 'udp-flood' : 'syn-flood';
};

/** Regras do cenário e das defesas escolhidas, em função do ciclo (a mitigação upstream demora a agir). */
export function ctxOf(P: AtkParams, sid: string) {
  const s = SCEN[sid];
  const up = String(P.upstream || 'off');
  const upCall = up === 'off' || up === 'on' ? 0 : Number(up);
  const alwaysOn = up === 'on';
  const isOn = (id: string): boolean => (id === 'upstream' ? up !== 'off' : !!(P as any)[id]);
  const upReady = (tick: number): boolean => isOn('upstream') && (alwaysOn || tick - upCall >= UPSTREAM_DELAY);
  const effective = (id: string, tick: number): boolean => (id === 'upstream' ? upReady(tick) : isOn(id));
  const ctl = (id: string): CtlInfo => s.controls[id] || { w: 0 };
  const whyOf = (id: string): string => ctl(id).why || DEFAULT_WHY_NOT[id];
  const fpOf = (id: string): number => (s.fp && s.fp[id] ? s.fp[id].p : DEFENSES[id].fp);
  const fpNoteOf = (id: string): string | undefined => (s.fp && s.fp[id] ? s.fp[id].note : DEFENSES[id].fpNote);
  const placeOf = (id: string): string => {
    if (ctl(id).at) return ctl(id).at as string;
    if (s.mode === 'reflect' && id === 'antiSpoof') return 'edge';
    if (s.mode === 'reflect' && id === 'hardening') return 'reflector';
    return DEFENSES[id].at;
  };
  const protection = (eff: boolean, tick: number): number => 1 - DEFENSE_IDS.reduce((acc, id) => acc * ((eff ? effective(id, tick) : isOn(id)) ? 1 - ctl(id).w : 1), 1);
  const postureOk = (tick: number): boolean => s.key.every((id) => effective(id, tick)) && protection(true, tick) >= 0.85;
  return { s, up, upCall, alwaysOn, isOn, upReady, effective, ctl, whyOf, fpOf, fpNoteOf, placeOf, protection, postureOk };
}

export const intensityLabel = (n: number): string => ['muito baixa', 'baixa', 'moderada', 'alta', 'muito alta'][n - 1] || '';

export function attackCount(s: ScenData, intensity: number, tick: number): number {
  if (s.every) return tick % s.every === 0 ? 1 : 0;
  return Math.max(1, Math.round(intensity * (s.scale || 1))) + (s.factor > 1 ? 1 : 0);
}

export function simulate(P: AtkParams, sub: string): Sim {
  const sid = scenarioOf(P, sub);
  const X = ctxOf(P, sid);
  const { s } = X;
  const intensity = Math.min(5, Math.max(1, Math.round(Number(P.intensity)) || 3));
  const total = Math.min(60, Math.max(1, Math.round(Number(P.cycles)) || 20));

  let seed = SEED;
  const rand = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rnd = (a: number, b: number): number => a + Math.floor(rand() * (b - a + 1));
  const fmt = (text: string): string => {
    const v: Record<string, string | number> = { src: '198.51.100.' + rnd(2, 254), refl: '192.0.2.' + rnd(2, 254), sport: rnd(1024, 65535), dport: rnd(1, 1024), seq: rnd(1e8, 4e9), seq1: 0, pct: rnd(70, 99), rand: Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[rnd(0, 35)]).join('') };
    v.seq1 = Number(v.seq) + 1;
    return text.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
  };
  const filterPacket = (order: string[], tick: number): string | null => {
    for (const id of order) if (X.effective(id, tick) && rand() < X.ctl(id).w) return id;
    return null;
  };

  const M = { generated: 0, blocked: 0, delivered: 0, load: 0, demand: 0, alerts: 0, legitSent: 0, legitServed: 0, byControl: {} as Record<string, number>, reqs: 0, reqBlocked: 0 };
  const sim: Sim = { sid, s, cycles: [], ir: { prepared: false, detect: null, detectBy: '', contain: null, recover: null, post: false }, startControls: DEFENSE_IDS.filter(X.isOn), peakLoad: 0, peakDemand: 0, saturatedCycles: 0, fpDrops: 0, fpBy: {}, satDrops: 0, linkTotal: 0, upstreamCall: X.up !== 'off' && X.up !== 'on' && X.upCall < total ? X.upCall : null };
  let upstreamAnnounced = false;

  for (let tick = 1; tick <= total; tick++) {
    const pk = new Map<string, Pkt>();
    const logs: CycleLog[] = [];
    const log = (text: string, tag: string, off: number): void => void logs.push({ text, tag, off });
    const add = (kind: PktKind, from: string, to: string, route: string[], label: string, by?: string, fpBy?: string): void => {
      const key = [kind, from, to, by || '', fpBy || ''].join('|');
      const cur = pk.get(key);
      if (cur) cur.count++;
      else pk.set(key, { kind, from, to, route, label, count: 1, by, fpBy });
    };
    const perPacket = (2 + intensity * 0.8) * (s.loadW || 1);
    const count = attackCount(s, intensity, tick);
    let passed = 0;
    let linkHits = 0;
    let idsHit = false;
    let lastBy: string | null = null;

    if (X.isOn('upstream') && X.upReady(tick) && !upstreamAnnounced) {
      upstreamAnnounced = true;
      if (X.ctl('upstream').w > 0) log('Operadora: mitigação ativa para ' + VICTIM + ' (FlowSpec / scrubbing).', 'blocked', 0);
    }
    const arrive = (): void => {
      M.delivered++;
      if (M.delivered === 1 || M.delivered % 10 === 0) log('Tráfego de ataque alcançou o host vítima (' + M.delivered + ').', 'alert', 400);
    };
    const blockReq = (id: string): void => {
      M.reqBlocked++;
      M.byControl[id] = (M.byControl[id] || 0) + 1;
      lastBy = id;
    };
    const block = (id: string): void => {
      M.blocked++;
      M.byControl[id] = (M.byControl[id] || 0) + 1;
      lastBy = id;
      if (id === 'ids') idsHit = true;
      if (id !== 'upstream' && X.placeOf(id) !== 'edge' && X.placeOf(id) !== 'reflector') linkHits++;
    };

    for (let i = 0; i < count; i++) {
      if (s.mode === 'reflect') M.reqs++;
      else M.generated++;
      rand();
      rand(); // posição de origem do pacote na animação do legado: mantém a mesma sequência de sorteios
      rand(); // velocidade
      if (s.mode === 'reflect') {
        const by = filterPacket(ORDER.req, tick);
        if (by && X.placeOf(by) === 'edge') {
          add('request', 'attacker', 'edge', ['attacker', 'edge'], s.packet, by);
          blockReq(by);
        } else if (by) {
          add('request', 'attacker', 'reflector', ['attacker', 'edge', 'reflector'], s.packet, by);
          blockReq(by);
        } else {
          add('request', 'attacker', 'reflector', ['attacker', 'edge', 'reflector'], s.packet);
          passed++;
        }
      } else {
        const by = filterPacket(ORDER.direct, tick);
        const place = by ? X.placeOf(by) : null;
        if (place === 'upstream') add('attack', 'attacker', 'upstream', ['attacker', 'upstream'], s.packet, by as string);
        else if (place === 'server') add('attack', 'attacker', 'server', ['attacker', 'upstream', 'firewall', 'server'], s.packet, by as string);
        else if (by) add('attack', 'attacker', 'firewall', ['attacker', 'upstream', 'firewall'], s.packet, by);
        else {
          add('attack', 'attacker', 'server', ['attacker', 'upstream', 'firewall', 'server'], s.packet);
          passed++;
          arrive();
        }
        if (by) block(by);
      }
    }

    if (s.mode === 'reflect') {
      const responses = passed * s.factor;
      let passedResponses = 0;
      linkHits = 0;
      for (let i = 0; i < responses; i++) {
        M.generated++;
        const by = filterPacket(ORDER.resp, tick);
        if (by === 'upstream') add('response', 'reflector', 'upstream', ['reflector', 'upstream'], s.response, by);
        else if (by) add('response', 'reflector', 'firewall', ['reflector', 'upstream', 'firewall'], s.response, by);
        else {
          add('response', 'reflector', 'server', ['reflector', 'upstream', 'firewall', 'server'], s.response);
          passedResponses++;
          arrive();
        }
        if (by) block(by);
      }
      sim.linkTotal += linkHits;
      M.demand += (passedResponses + linkHits * (s.linkLoad || 0)) * (1.5 + intensity * 0.5);
      M.load = Math.min(100, M.demand);
      passed = passedResponses;
    } else {
      if (s.mode === 'scan' && passed > 0) add('scan', 'server', 'attacker', ['server', 'firewall', 'upstream', 'attacker'], s.response);
      sim.linkTotal += linkHits;
      M.demand += (passed + linkHits * (s.linkLoad || 0)) * perPacket;
      M.load = Math.min(100, M.demand);
      if (s.linkLoad && linkHits && tick % 5 === 0) log('Enlace de entrada: tráfego descartado no firewall ainda consumiu a banda até ele.', 'alert', 450);
    }

    if (tick % Math.max(2, 6 - intensity) === 0) {
      M.legitSent++;
      const fp = ['upstream', 'ids', 'rateLimit'].find((id) => X.effective(id, tick) && rand() < X.fpOf(id));
      const saturated = !fp && M.load > 70 && rand() < (M.load - 70) / 30;
      if (fp) {
        add('legit-fp', 'client', 'firewall', ['client', 'firewall'], s.proto, undefined, fp);
        sim.fpDrops++;
        sim.fpBy[fp] = (sim.fpBy[fp] || 0) + 1;
        log('Falso positivo: ' + DEFENSES[fp].name + ' descartou um cliente legítimo (' + X.fpNoteOf(fp) + ').', 'alert', 500);
      } else if (saturated) {
        add('legit-sat', 'client', 'server', ['client', 'firewall', 'server'], s.proto);
        sim.satDrops++;
        log('Servidor saturado: requisição legítima descartada por falta de recursos.', 'alert', 500);
      } else {
        add('legit', 'client', 'server', ['client', 'firewall', 'server'], s.proto);
        M.legitServed++;
      }
    }

    if (idsHit) M.alerts++;
    if (idsHit && tick % 2 === 0) log(fmt(X.ctl('ids').log || 'suricata: padrão de ' + s.title + ' correlacionado contra ' + VICTIM), 'blocked', 600);
    else if (lastBy && tick % 3 === 0) log(fmt(X.ctl(lastBy).log || DEFAULT_LOG[lastBy]), 'blocked', 600);
    else if (passed > 0 && tick % 2 === 0) log(fmt(s.evidence[rnd(0, s.evidence.length - 1)]), 'alert', 600);

    sim.peakLoad = Math.max(sim.peakLoad, M.load);
    sim.peakDemand = Math.max(sim.peakDemand, M.demand);
    if (M.load > 70) sim.saturatedCycles++;
    M.demand = Math.max(0, M.demand * 0.85 - 1);
    M.load = Math.min(100, M.demand);

    // Resposta a incidente (NIST SP 800-61): preparação, detecção, contenção e recuperação.
    const ir = sim.ir;
    if (tick === 1) {
      ir.prepared = X.postureOk(tick);
      if (ir.prepared) log('[IR] Preparação: controles essenciais já estavam ativos quando o ataque começou.', 'ir-log', 700);
    }
    if (ir.detect === null && (idsHit || M.load >= 60)) {
      ir.detect = tick;
      ir.detectBy = idsHit ? 'alerta do IDS/IPS' : 'monitoramento de disponibilidade (carga acima de 60%)';
      log('[IR] Detecção e análise: incidente identificado por ' + ir.detectBy + '.', 'ir-log', 700);
    }
    if (ir.contain === null && X.postureOk(tick) && (ir.detect !== null || ir.prepared)) {
      ir.contain = tick;
      log('[IR] Contenção: controles essenciais efetivos, proteção de ' + Math.round(X.protection(true, tick) * 100) + '%.', 'ir-log', 700);
    }
    if (ir.recover === null && ir.contain !== null && M.load < 30) {
      ir.recover = tick;
      log('[IR] Recuperação: carga normalizada (' + Math.round(M.load) + '%), serviço restabelecido.', 'ir-log', 700);
    }

    sim.cycles.push({
      tick,
      pkts: Array.from(pk.values()),
      logs,
      snap: { tick, generated: M.generated, blocked: M.blocked, delivered: M.delivered, load: M.load, demand: M.demand, legitSent: M.legitSent, legitServed: M.legitServed, alerts: M.alerts, reqs: M.reqs, reqBlocked: M.reqBlocked, byControl: { ...M.byControl }, prot: X.protection(true, tick), upLeft: X.isOn('upstream') && !X.upReady(tick) && X.ctl('upstream').w > 0 ? UPSTREAM_DELAY - (tick - X.upCall) : 0 },
    });
  }
  sim.ir.post = sim.ir.recover !== null || sim.ir.prepared;
  return sim;
}

export { DEFENSES, PLACE, UPSTREAM_DELAY, VICTIM };
