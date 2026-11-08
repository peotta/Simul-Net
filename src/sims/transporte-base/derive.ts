// Base comum dos simuladores de TCP e de UDP: o motor (sim.ts, modes.ts) e os conteúdos são compartilhados, e cada
// simulador escolhe os modos (subs) que apresenta. Os cenários e os textos de cada modo ficam em um só lugar.
import type { ControlDef, ScenarioDef, ScenarioDoc, TabDef } from '../../sim-core/ui';
import { controls as allControls } from './content/controls';
import { groupDoc as allGroupDoc, scenDoc as allScenDoc, scenarios as allScenarios } from './content/scenarios';
import { tabs as allTabs } from './content/tabs';

export interface Derived {
  controls: ControlDef[];
  scenarios: ScenarioDef[];
  groupDoc: Record<string, string>;
  scenDoc: Record<string, ScenarioDoc>;
  tabs: TabDef[];
}

/** Texto de um cenário que muda de um simulador para o outro (o resto vem da base). */
export interface ScenarioOverride {
  what: string;
  doc: ScenarioDoc;
}

/**
 * Seleciona os controles, cenários, grupos, documentação e abas dos modos dados. Os controles que só servem a
 * outros modos saem; os que não declaram modos valem para todos.
 */
export function derive(subs: string[], override: Record<string, ScenarioOverride> = {}): Derived {
  const mine = (s: string): boolean => subs.includes(s);
  const scenarios = allScenarios.filter((s) => mine(s.sub)).map((s) => (override[s.id] ? { ...s, what: override[s.id].what } : s));
  const ids = new Set(scenarios.map((s) => s.id));
  const groups = new Set(scenarios.map((s) => s.g));
  const scenDoc: Record<string, ScenarioDoc> = {};
  Object.keys(allScenDoc).forEach((id) => {
    if (ids.has(id)) scenDoc[id] = override[id] ? override[id].doc : allScenDoc[id];
  });
  const groupDoc: Record<string, string> = {};
  Object.keys(allGroupDoc).forEach((g) => {
    if (groups.has(g)) groupDoc[g] = allGroupDoc[g];
  });
  return {
    controls: allControls.filter((c) => !c.subs || c.subs.some(mine)).map((c) => (c.subs ? { ...c, subs: c.subs.filter(mine) } : c)),
    scenarios,
    groupDoc,
    scenDoc,
    tabs: allTabs.filter((t) => !t.subs || t.subs.some(mine)).map((t) => (t.subs ? { ...t, subs: t.subs.filter(mine) } : t)),
  };
}
