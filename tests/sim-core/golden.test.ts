// Impressões digitais (hash SHA-256) do comportamento dos simuladores nativos.
//
// O conteúdo de SSH, HTTPS e FTP foi portado do código legado e comparado com ele, cenário a cenário e em milhares de
// combinações de parâmetros. Depois da remoção do legado, estas impressões digitais preservam esse comportamento:
// qualquer alteração no trace, no texto do cenário, no Experimento ou nas abas muda o hash e falha o teste.
//
// Quando a mudança é intencional, regrave com:  UPDATE_GOLDEN=1 npx vitest run tests/sim-core/golden.test.ts
// e revise o diff de tests/sim-core/golden.json antes de versionar.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arpProtocol } from '../../src/sims/arp/protocol';
import { ftpProtocol } from '../../src/sims/ftp/protocol';
import { dhcpProtocol } from '../../src/sims/dhcp/protocol';
import { httpProtocol } from '../../src/sims/http-versoes/protocol';
import { natProtocol } from '../../src/sims/nat/protocol';
import { dnsProtocol } from '../../src/sims/dns/protocol';
import { firewallProtocol } from '../../src/sims/firewall/protocol';
import { stpProtocol } from '../../src/sims/stp/protocol';
import { vlanProtocol } from '../../src/sims/vlan/protocol';
import { switchingProtocol } from '../../src/sims/switching/protocol';
import { icmpProtocol } from '../../src/sims/icmp/protocol';
import { httpsProtocol } from '../../src/sims/https/protocol';
import { sshProtocol } from '../../src/sims/ssh/protocol';
import { prepare } from '../../src/sim-core';
import { scenarioParams, type Params, type ProtocolDef } from '../../src/sim-core/ui';

const FILE = join(__dirname, 'golden.json');
const UPDATE = !!process.env.UPDATE_GOLDEN;
const stored: Record<string, Record<string, string>> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : {};
const fresh: Record<string, Record<string, string>> = {};

// Relógio sintético: as abas só dependem de c e de timeAt(c).
const timeAt = (c: number) => c * 10;
const CLOCKS = [0, 5, 40, 120, 1e6];
const SAMPLES = 300;

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tudo o que o aluno vê de uma execução: trace, Experimento e abas próprias em vários instantes. */
function fingerprint(def: ProtocolDef, P: Params, sub: string, scen: ProtocolDef['scenarios'][number] | undefined): string {
  const tr = def.build(P, sub);
  const parts = [JSON.stringify(tr), def.explain(tr, P, scen)];
  if (scen && def.setup) parts.push(def.setup(scen));
  (def.tabs || []).forEach((tab) => CLOCKS.forEach((c) => parts.push(tab.render(tr, { c, timeAt, P }))));
  // prepare() também entra: as linhas do diagrama dependem dele
  prepare(tr);
  parts.push(JSON.stringify(tr.times));
  return sha(parts.join('\u0001'));
}

const SIMS: [string, ProtocolDef][] = [
  ['ssh', sshProtocol],
  ['https', httpsProtocol],
  ['ftp', ftpProtocol],
  ['arp', arpProtocol],
  ['icmp', icmpProtocol],
  ['dhcp', dhcpProtocol],
  ['http-versoes', httpProtocol],
  ['nat', natProtocol],
  ['dns', dnsProtocol],
  ['firewall', firewallProtocol],
  ['switching', switchingProtocol],
  ['stp', stpProtocol],
  ['vlan', vlanProtocol],
];

describe.each(SIMS)('impressões digitais: %s', (name, def) => {
  const got: Record<string, string> = (fresh[name] = {});

  def.scenarios.forEach((s) => {
    it(`cenário ${s.id}`, () => {
      const h = fingerprint(def, scenarioParams(def.controls, s), s.sub, s);
      got[s.id] = h;
      if (!UPDATE) expect(h, `o comportamento do cenário ${s.id} mudou`).toBe(stored[name]?.[s.id]);
    });
  });

  def.subs.forEach((sub, k) => {
    it(`${SAMPLES} combinações aleatórias do modo ${sub.key}`, () => {
      const rand = rng(1000 * (SIMS.findIndex((x) => x[0] === name) + 1) + k);
      const visible = def.controls.filter((c) => !c.subs || c.subs.includes(sub.key));
      const acc: string[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const P: Params = {};
        def.controls.forEach((c) => {
          const opts = c.type === 'check' ? [true, false] : (c.opts || []).map((o) => o[0]);
          P[c.id] = visible.includes(c) ? opts[Math.floor(rand() * opts.length)] : c.def;
        });
        acc.push(fingerprint(def, P, sub.key, undefined));
      }
      const h = sha(acc.join(','));
      got['amostra:' + sub.key] = h;
      if (!UPDATE) expect(h, `o comportamento do modo ${sub.key} mudou em alguma combinação`).toBe(stored[name]?.['amostra:' + sub.key]);
    });
  });

  it('textos fixos: Referência e documentação', () => {
    const h = sha(JSON.stringify({ r: def.reference, g: def.groupDoc, d: def.scenDoc, c: def.controls, s: def.scenarios }));
    got.textos = h;
    if (!UPDATE) expect(h, 'a Referência, a documentação, os controles ou os cenários mudaram').toBe(stored[name]?.textos);
  });
});

describe('gravação', () => {
  it('grava as impressões digitais quando UPDATE_GOLDEN está definido', () => {
    if (UPDATE) {
      writeFileSync(FILE, JSON.stringify(fresh, null, 2) + '\n', 'utf-8');
    } else {
      expect(Object.keys(stored).sort()).toEqual(SIMS.map(([name]) => name).sort());
    }
  });
});
