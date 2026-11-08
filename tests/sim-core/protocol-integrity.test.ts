// Integridade interna dos módulos nativos: vale para qualquer ProtocolDef registrado em src/sims/native.ts.
import { describe, expect, it } from 'vitest';
import { scenarioParams, type ProtocolDef } from '../../src/sim-core/ui';
import { NATIVE } from '../../src/sims/native';

// Travessão longo e meia-risca (escritos por código para o próprio arquivo não conter os caracteres).
const FORBIDDEN_DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

const modules = await Promise.all(Object.entries(NATIVE).map(async ([id, load]) => [id, (await load()).default] as [string, ProtocolDef]));

describe.each(modules)('módulo nativo %s', (_id, def) => {
  const subKeys = def.subs.map((s) => s.key);

  it('controles: ids únicos, padrões válidos e modos existentes', () => {
    const ids = def.controls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    def.controls.forEach((c) => {
      (c.subs || []).forEach((s) => expect(subKeys, `controle ${c.id}`).toContain(s));
      if (c.type === 'check') expect(typeof c.def, `controle ${c.id}`).toBe('boolean');
      else expect((c.opts || []).map((o) => String(o[0])), `controle ${c.id}`).toContain(String(c.def));
    });
  });

  it('cenários: ids únicos, modo válido, parâmetros existentes, valores permitidos e documentação completa', () => {
    const ids = def.scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const byId = new Map(def.controls.map((c) => [c.id, c]));
    def.scenarios.forEach((s) => {
      expect(subKeys, `cenário ${s.id}`).toContain(s.sub);
      expect(def.scenDoc[s.id], `falta scenDoc de ${s.id}`).toBeDefined();
      expect(def.groupDoc[s.g], `falta groupDoc de ${s.g}`).toBeDefined();
      Object.entries(s.set || {}).forEach(([k, v]) => {
        const c = byId.get(k);
        expect(c, `cenário ${s.id}: parâmetro ${k} não existe`).toBeDefined();
        if (c!.type === 'check') expect(typeof v).toBe('boolean');
        else expect((c!.opts || []).map((o) => String(o[0])), `cenário ${s.id}: valor de ${k}`).toContain(String(v));
      });
    });
    Object.keys(def.scenDoc).forEach((id) => expect(ids, `scenDoc órfão: ${id}`).toContain(id));
  });

  it('modos: o cenário inicial de cada modo existe e pertence a ele', () => {
    def.subs.forEach((s) => {
      const sc = def.scenarios.find((x) => x.id === s.default);
      expect(sc, `modo ${s.key}`).toBeDefined();
      expect(sc!.sub).toBe(s.key);
      expect(def.stageTitle ? def.stageTitle(s.key) : 'x').toBeTruthy();
    });
  });

  it('abas próprias: ids únicos e modos válidos', () => {
    const ids = (def.tabs || []).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    (def.tabs || []).forEach((t) => (t.subs || []).forEach((s) => expect(subKeys, `aba ${t.id}`).toContain(s)));
  });

  it('todo cenário gera um trace com mensagens e textos sem travessão longo nem meia-risca', () => {
    def.scenarios.forEach((s) => {
      const P = scenarioParams(def.controls, s);
      const tr = def.build(P, s.sub);
      expect(tr.msgs.length, `cenário ${s.id}`).toBeGreaterThan(0);
      const html = [def.explain(tr, P, s), def.setup ? def.setup(s) : '', ...(def.tabs || []).map((t) => t.render(tr, { c: 1e6, timeAt: (c) => c * 10, P }))].join('\n');
      expect(FORBIDDEN_DASHES.test(html), `cenário ${s.id}`).toBe(false);
    });
    expect(FORBIDDEN_DASHES.test(JSON.stringify({ c: def.controls, s: def.scenarios, g: def.groupDoc, d: def.scenDoc, r: def.reference, f: def.fundamentacao ?? '' }))).toBe(false);
  });
});
