import { describe, expect, it } from 'vitest';
import { CATEGORIES, simsByCategory } from '../src/sims/registry';

describe('ordem dos simuladores na categoria', () => {
  it('lista os disponíveis antes dos em breve', () => {
    for (const c of CATEGORIES) {
      const st = simsByCategory(c.id).map((s) => s.status === 'available');
      const primeiroEmBreve = st.indexOf(false);
      if (primeiroEmBreve >= 0) expect(st.slice(primeiroEmBreve).every((x) => !x), c.id).toBe(true);
    }
  });
});
