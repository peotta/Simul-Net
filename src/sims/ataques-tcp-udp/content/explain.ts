// Texto da aba Experimento e do cabeçalho do cenário do simulador de ataques e defesas TCP/UDP.
import { esc, plural, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import { attackCount, ctxOf, DEFENSE_IDS, intensityLabel, type AtkParams, type Sim } from '../model';
import { DEFENSES, SCEN, UPSTREAM_DELAY, VICTIM } from './data';

const names = (ids: string[]): string => ids.map((id) => '<b>' + esc(DEFENSES[id].name) + '</b>').join(', ').replace(/, ([^,]*)$/, ' e $1');
const pct = (a: number, b: number): string => (b ? Math.round((a / b) * 100) : 0) + '%';
const ul = (a: string[]): string => '<ul>' + a.map((t) => '<li>' + t + '</li>').join('') + '</ul>';

/** Texto "Configuração do cenário". */
export function setup(s: ScenarioDef): string {
  const d = SCEN[s.id];
  const tipo = s.id === 'dns-water-torture' ? 'via resolvedores legítimos' : d.mode === 'reflect' ? 'reflexão, fator ' + d.factor + 'x' : d.mode === 'scan' ? 'varredura' : d.multi ? 'ataque distribuído' : 'ataque direto';
  return 'Tipo: <code>' + esc(tipo) + '</code> | vítima <code>' + VICTIM + '</code> | marque os controles no painel lateral: cada mudança executa a simulação de novo.';
}

const RELATED: Record<string, string> = { 'syn-flood': 'slowloris', slowloris: 'syn-flood', 'ack-scan': 'slow-scan', 'slow-scan': 'udp-scan', 'udp-flood': 'botnet', botnet: 'udp-flood', amplification: 'reflection', reflection: 'amplification', 'dns-water-torture': 'botnet', 'rst-injection': 'session-hijack', 'session-hijack': 'rst-injection', 'udp-scan': 'ack-scan' };

export function explain(tr: Trace): string {
  const P = tr.raw.P as AtkParams;
  const sim = tr.raw.sim as Sim;
  const { s, sid, ir } = sim;
  const X = ctxOf(P, sid);
  const last = sim.cycles[sim.cycles.length - 1].snap;
  const tick = sim.cycles.length;
  const intensity = Number(P.intensity);
  const start = sim.startControls;

  let h = '<p><b>Objetivo.</b> Observar como o ataque <b>' + esc(s.title) + '</b> afeta a vítima ' + VICTIM + ' e descobrir quais controles defensivos o neutralizam, em que ponto da rede eles atuam e quanto custam ao usuário legítimo.</p>';

  h += '<h3>Configuração</h3><p>Intensidade <b>' + intensity + ' (' + intensityLabel(intensity) + ')</b>: ';
  if (s.every) h += 'uma sonda a cada ' + s.every + ' ciclos, de propósito abaixo dos limiares de detecção.';
  else h += 'cerca de ' + plural(attackCount(s, intensity, 1), 'pacote', 'pacotes') + ' de ataque por ciclo' + (s.multi ? ', vindos de milhares de origens diferentes' : '') + '.';
  if (s.mode === 'reflect') h += ' Cada requisição que alcança o refletor gera ' + plural(s.factor, 'resposta', 'respostas') + ' contra a vítima (fator de amplificação ' + s.factor + 'x).';
  h += ' Um cliente legítimo (198.51.100.77) acessa o serviço durante todo o experimento.</p>';
  h += '<p>' + (start.length ? 'Controles ativos: ' + names(start) + '.' : 'O experimento rodou <b>sem nenhum controle defensivo</b>.');
  if (start.includes('upstream')) h += X.alwaysOn ? ' A mitigação upstream estava ativa desde o início (contrato always-on).' : ' A operadora foi acionada depois do ciclo ' + X.upCall + ' e passou a agir no ciclo ' + (X.upCall + UPSTREAM_DELAY) + '.';
  h += '</p>';
  const inert = start.filter((id) => !(X.ctl(id).w > 0));
  if (inert.length) h += '<p>Sem efeito neste ataque: ' + names(inert) + '. O motivo está na aba Efeito dos controles.</p>';

  h += '<h3>O que aconteceu</h3><p>Em <b>' + plural(tick, 'ciclo', 'ciclos') + '</b>, ';
  if (s.mode === 'reflect') h += 'o atacante enviou ' + plural(last.reqs, 'requisição', 'requisições') + ' com a origem falsificada aos refletores; ' + last.reqBlocked + ' ' + (last.reqBlocked === 1 ? 'foi barrada' : 'foram barradas') + ' antes de virar resposta. As demais provocaram <b>' + plural(last.generated, 'resposta', 'respostas') + '</b> contra a vítima (fator ' + s.factor + 'x)';
  else h += 'o atacante enviou <b>' + plural(last.generated, 'pacote', 'pacotes') + '</b> contra a vítima';
  h += '. Desse tráfego rumo à vítima, <b>' + last.blocked + ' (' + pct(last.blocked, last.generated) + ')</b> ' + (last.blocked === 1 ? 'foi neutralizado' : 'foram neutralizados') + ' e <b>' + last.delivered + '</b> ' + (last.delivered === 1 ? 'chegou' : 'chegaram') + ' à vítima.</p>';
  const used = Object.keys(last.byControl).sort((a, b) => last.byControl[b] - last.byControl[a]);
  if (used.length) h += '<p>Contribuição de cada controle:</p>' + ul(used.map((id) => '<b>' + esc(DEFENSES[id].name) + '</b>: ' + last.byControl[id] + ' (' + pct(last.byControl[id], last.blocked + last.reqBlocked) + ' do que foi barrado' + (s.mode === 'reflect' && (id === 'antiSpoof' || id === 'hardening') ? ', ainda como requisição' : '') + ').'));
  else h += '<p>Nenhum pacote foi neutralizado: ' + (start.length ? 'os controles ativos não atuam sobre este ataque.' : 'não havia controles ativos.') + '</p>';
  h += '<p>Carga no servidor: pico de <b>' + Math.round(sim.peakLoad) + '%</b>' + (sim.peakDemand > 100.5 ? ' (a demanda chegou a ' + Math.round(sim.peakDemand) + '% da capacidade: o excedente não é processado e vira descarte)' : '') + (sim.saturatedCycles ? ', com ' + plural(sim.saturatedCycles, 'ciclo', 'ciclos') + ' acima de 70% (saturação)' : ', sem chegar à saturação') + '; ao final, ' + Math.round(last.load) + '%.';
  if (sim.linkTotal && s.linkLoad) h += ' Mesmo os ' + plural(sim.linkTotal, 'pacote descartado', 'pacotes descartados') + ' no firewall ou no host consumiram banda do enlace até lá; só o que é filtrado na operadora não ocupa o enlace.';
  h += '</p>';
  if (last.legitSent) {
    h += '<p>Serviço legítimo: <b>' + last.legitServed + ' de ' + last.legitSent + '</b> requisições atendidas (' + pct(last.legitServed, last.legitSent) + ').';
    if (sim.satDrops) h += ' ' + plural(sim.satDrops, 'foi perdida', 'foram perdidas') + ' por saturação do servidor.';
    const fps = Object.keys(sim.fpBy);
    if (fps.length) h += ' ' + plural(sim.fpDrops, 'foi descartada', 'foram descartadas') + ' por falso positivo de ' + names(fps) + ': o custo da defesa.';
    if (!sim.satDrops && !sim.fpDrops) h += ' Nenhum cliente foi prejudicado.';
    h += '</p>';
  }
  const parts: string[] = [];
  parts.push(ir.prepared ? 'os controles essenciais já estavam prontos quando o ataque começou (preparação)' : 'o ataque começou sem os controles essenciais');
  parts.push(ir.detect !== null ? 'detecção no ciclo ' + ir.detect + ' por ' + ir.detectBy + ', MTTD de ' + plural(Math.max(0, ir.detect - 1), 'ciclo', 'ciclos') : 'o incidente <b>não foi detectado</b>');
  if (ir.contain !== null) parts.push('contenção no ciclo ' + ir.contain + (ir.detect !== null && ir.contain >= ir.detect ? ', MTTC de ' + plural(ir.contain - ir.detect, 'ciclo', 'ciclos') : ''));
  else parts.push('ainda <b>sem contenção</b>');
  if (ir.recover !== null) parts.push('recuperação no ciclo ' + ir.recover);
  h += '<p>Resposta a incidente: ' + parts.join('; ') + '.</p>';

  const items: string[] = [];
  const unused = s.key.filter((id) => !X.isOn(id));
  if (unused.length) items.push('O controle essencial deste cenário (' + names(unused) + ') <b>não foi usado</b>: sem ele, os demais controles só reduzem o ataque em parte.');
  if (s.mode === 'reflect') items.push('Na reflexão, a vítima recebe tráfego de IPs legítimos (os refletores). Por isso o anti-spoofing só funciona na <b>borda da rede de origem</b> (BCP 38), e o refletor é desarmado na própria configuração do serviço.');
  if (s.linkLoad && sim.linkTotal) items.push('Descartar no firewall não devolve a banda: o enlace até ele já foi consumido. Em ataques volumétricos, a filtragem precisa acontecer <b>antes</b> do enlace, na operadora.');
  if (sim.fpDrops) items.push('Todo controle tem custo. Limiares agressivos e bloqueios por origem geram <b>falsos positivos</b> e descartam usuários reais; calibre e monitore.');
  if (ir.detect === null && tick > 3) items.push('Bloquear não é o mesmo que detectar. Sem IDS/IPS ou monitoramento, o ataque pode ser contido (ou continuar) sem que ninguém saiba.');
  if (!items.length) items.push('Os controles usados foram os esperados para este ataque; veja na aba Cenário o risco residual.');
  h += '<h3>Conceitos observados</h3>' + ul(items);

  const next: string[] = [];
  if (unused.length) next.push('Ative ' + names(unused) + ' e execute de novo: compare a carga de pico e o serviço legítimo.');
  else if (DEFENSE_IDS.filter(X.isOn).length > s.key.length) next.push('Desative tudo menos ' + names(s.key) + ' e veja se a postura continua adequada com menos custo.');
  else next.push('Desative ' + names(s.key) + ' e observe quanto tempo a carga leva para saturar.');
  if (!X.isOn('ids') && X.ctl('ids').w > 0) next.push('Ative o <b>IDS/IPS</b> para que o incidente seja detectado e compare o MTTD.');
  if (X.ctl('upstream').w > 0) next.push(X.isOn('upstream') && !X.alwaysOn ? 'Troque para a mitigação upstream <b>ativa desde o início</b> (always-on) e compare o MTTC.' : 'Escolha a mitigação upstream <b>acionada depois do ciclo 3</b> para ver o atraso de acionamento.');
  if (intensity < 5 && !s.every) next.push('Suba a intensidade para ' + (intensity + 1) + ' e verifique se a mesma defesa ainda segura o ataque.');
  const rel = RELATED[sid];
  if (rel) next.push('Compare com o cenário <b>' + esc(SCEN[rel].short || SCEN[rel].title) + '</b>: ' + esc(SCEN[rel].description.split('. ')[0].replace(/\.$/, '')) + '.');
  h += '<h3>Para explorar em seguida</h3>' + ul(next.slice(0, 4));
  return h;
}
