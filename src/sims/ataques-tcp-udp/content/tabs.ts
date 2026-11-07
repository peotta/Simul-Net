// Abas próprias do simulador de ataques e defesas TCP/UDP: efeito dos controles, configuração de referência e avaliação.
// Todas acompanham o relógio: mostram o estado da última foto de ciclo cujo instante já passou.
import { esc } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import { ctxOf, CYCLE_MS, DEFENSE_IDS, type AtkParams, type Sim, type Snap } from '../model';
import { DEFENSES, PLACE } from './data';

const td = (cells: string[]): string => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';

/** Foto do último ciclo já concluído no instante dado (null antes do primeiro ciclo). */
function snapAt(sim: Sim, now: number): Snap | null {
  let k = -1;
  sim.cycles.forEach((c, i) => {
    if ((c.tick - 1) * CYCLE_MS + 700 <= now + 1e-9) k = i;
  });
  return k < 0 ? null : sim.cycles[k].snap;
}

const efeito: TabDef = {
  id: 'efeito',
  label: 'Efeito dos controles',
  render: (tr, ctx) => {
    const P = tr.raw.P as AtkParams;
    const sim = tr.raw.sim as Sim;
    const X = ctxOf(P, sim.sid);
    const snap = snapAt(sim, ctx.timeAt(ctx.c));
    let h = '<h3>Efeito dos controles em ' + esc(sim.s.title) + '</h3><p>A eficácia é a chance de o controle neutralizar um pacote sozinho; controles combinados formam a defesa em profundidade. A coluna Neutralizados conta o que cada controle barrou até o instante atual.</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Controle</th><th>Eficácia</th><th>Onde atua</th><th>Neutralizados</th><th>Por que</th></tr></thead><tbody>';
    DEFENSE_IDS.slice()
      .sort((a, b) => X.ctl(b).w - X.ctl(a).w)
      .forEach((id) => {
        const w = X.ctl(id).w;
        const tags = (sim.s.key.includes(id) ? ' <span class="tag">essencial</span>' : '') + (X.isOn(id) ? ' <span class="tag">ativo</span>' : '') + (X.fpOf(id) >= 0.1 ? ' <span class="tag">alto falso positivo</span>' : '');
        const cost = X.fpOf(id) >= 0.1 ? ' Custo neste cenário: ' + X.fpNoteOf(id) + '.' : '';
        h += td([esc(DEFENSES[id].name) + tags, Math.round(w * 100) + '%', w > 0 ? esc(PLACE[X.placeOf(id)]) : '-', w > 0 ? String((snap && snap.byControl[id]) || 0) : '-', '<span class="meaning">' + esc(X.whyOf(id) + cost) + '</span>']);
      });
    return h + '</tbody></table>';
  },
};

const configuracao: TabDef = {
  id: 'config',
  label: 'Configuração de referência',
  render: (tr) => {
    const P = tr.raw.P as AtkParams;
    const sim = tr.raw.sim as Sim;
    const X = ctxOf(P, sim.sid);
    const active = DEFENSE_IDS.filter((id) => X.isOn(id) && X.ctl(id).cfg);
    let h = '<h3>Configuração de referência</h3><p>Exemplos ilustrativos dos controles marcados. Confira a sintaxe e os parâmetros na documentação oficial do produto e da versão em uso antes de aplicá-los.</p>';
    if (!active.length) return h + '<pre class="term">' + esc('# Nenhum controle com configuração de referência ativo.\n# Comece pelo controle essencial deste cenário: ' + sim.s.key.map((id) => DEFENSES[id].name).join(' e ') + '.') + '</pre>';
    active.forEach((id) => {
      h += '<h4>' + esc(DEFENSES[id].name) + (X.ctl(id).w > 0 ? '' : ' (não resolve este ataque, veja a aba Efeito dos controles)') + '</h4><pre class="term">' + esc(X.ctl(id).cfg as string) + '</pre>';
    });
    return h;
  },
};

const avaliacao: TabDef = {
  id: 'avaliacao',
  label: 'Avaliação',
  render: (tr, ctx) => {
    const P = tr.raw.P as AtkParams;
    const sim = tr.raw.sim as Sim;
    const X = ctxOf(P, sim.sid);
    const s = sim.s;
    const now = ctx.timeAt(ctx.c);
    const p = X.protection(false, 0);
    const active = DEFENSE_IDS.filter(X.isOn);
    const missing = s.key.filter((id) => !X.isOn(id));
    const useless = active.filter((id) => !(X.ctl(id).w > 0));
    const costly = active.filter((id) => X.fpOf(id) > 0);
    let verdict = 'Postura insuficiente';
    let cls = 'chk-bad';
    if (!missing.length && p >= 0.85) {
      verdict = 'Postura adequada';
      cls = 'chk-ok';
    } else if (p >= 0.5) verdict = 'Postura parcial';
    const items: string[] = [];
    if (!active.length) items.push('Nenhum controle ativo: todo o tráfego de ataque chega à vítima.');
    missing.forEach((id) => items.push('Falta o controle essencial: ' + esc(DEFENSES[id].name) + '.'));
    if (active.length && !missing.length) items.push('Controles essenciais presentes: ' + s.key.map((id) => esc(DEFENSES[id].name)).join(', ') + '.');
    if (useless.length) items.push('Sem efeito neste ataque: ' + useless.map((id) => esc(DEFENSES[id].name)).join(', ') + '. O motivo está na aba Efeito dos controles.');
    costly.forEach((id) => items.push('Custo de ' + esc(DEFENSES[id].name) + ': ' + esc(X.fpNoteOf(id) || '') + '. Calibre limiares e monitore falsos positivos.'));
    items.push('O relato da execução (MTTD, MTTC e lições) está na aba Experimento.');
    let h = '<h3>Avaliação da postura defensiva</h3><p><b class="' + cls + '">' + verdict + '</b> | proteção estimada ' + Math.round(p * 100) + '%</p><ul>' + items.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
    const at = (tick: number | null): boolean => tick !== null && (tick - 1) * CYCLE_MS + 700 <= now + 1e-9;
    const ir = sim.ir;
    const row = (name: string, when: string, done: boolean): string => td([esc(name), when, done ? '<span class="chk-ok">concluída</span>' : '-']);
    h += '<h3>Resposta a incidente (NIST SP 800-61)</h3><table class="sc-msgs"><thead><tr><th>Fase</th><th>Quando</th><th>Situação neste instante</th></tr></thead><tbody>';
    h += row('Preparação', ir.prepared ? 'controles prontos' : 'sem controles essenciais', true);
    h += row('Detecção e análise', ir.detect !== null ? 'ciclo ' + ir.detect : 'não detectado', at(ir.detect));
    h += row('Contenção', ir.contain !== null ? 'ciclo ' + ir.contain : 'não ocorreu', at(ir.contain));
    h += row('Erradicação e recuperação', ir.recover !== null ? 'ciclo ' + ir.recover : 'não ocorreu', at(ir.recover));
    h += row('Pós-incidente', ir.post ? 'lições registradas' : '-', ir.post && now >= sim.cycles.length * CYCLE_MS - 20);
    return h + '</tbody></table>';
  },
};

export const tabs: TabDef[] = [efeito, configuracao, avaliacao];

