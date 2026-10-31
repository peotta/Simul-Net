// Gera as páginas da wiki (Markdown) a partir do registro, dos módulos nativos e das páginas legadas.
// Uso: npm run wiki -- <pasta-de-saida>   (a pasta de saída recebe os .md; não é versionada aqui)
// Os nativos são lidos pelo Vite (módulos TypeScript); os legados são executados no jsdom e o texto
// de cada cenário é capturado da aba Cenário. Edições manuais nas páginas geradas são sobrescritas.
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// --docs: gera os documentos por simulador (docs/simuladores) em vez das páginas da wiki.
const DOCS = process.argv.includes('--docs');
const outArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!outArg) { console.error('Uso: npm run wiki -- <pasta-de-saida> [--docs]'); process.exit(1); }
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });

const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/') },
});

const ent = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** HTML restrito dos textos autorais para Markdown. */
function md(html = '') {
  let s = String(html);
  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, t) => {
    const rows = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
      [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => inline(c[1]).replace(/\|/g, '\\|')),
    );
    if (!rows.length) return '';
    const head = rows[0];
    const lines = ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |'];
    for (const r of rows.slice(1)) lines.push('| ' + r.join(' | ') + ' |');
    return '\n\n' + lines.join('\n') + '\n\n';
  });
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n\n#### ${inline(t)}\n\n`);
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, t) => {
    let n = 0;
    return '\n\n' + [...t.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => `${++n}. ${inline(m[1])}`).join('\n') + '\n\n';
  });
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, t) =>
    '\n\n' + [...t.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => `- ${inline(m[1])}`).join('\n') + '\n\n');
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n\n${inline(t)}\n\n`);
  s = inline(s);
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

function inline(html = '') {
  let s = String(html);
  s = s.replace(/<br\s*\/?>/gi, '  \n');
  s = s.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ent[m]);
  return s.trim();
}

const q = (v) => (typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v));

const { SIMS, CATEGORIES } = await server.ssrLoadModule('/src/sims/registry.ts');
const { NATIVE } = await server.ssrLoadModule('/src/sims/native.ts');

const CRED = 'Simul-Net é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).';
// Na wiki, o crédito vem do _Footer.md (não repetir no corpo); nos documentos, cada arquivo leva o seu.
const footer = DOCS ? `\n\n---\n\n*${CRED}*\n` : '\n';
/** Rebaixa os títulos da Referência para o nível 3 e os numera (<seção>.1, <seção>.2, ...), como as demais seções. */
const numberSubs = (text, sec) => {
  let n = 0;
  return text.replace(/^#{3,4} (.+)$/gm, (_, t) => `### ${sec}.${++n} ${t}`);
};

const pageName = (id) => (DOCS ? id : `simulador-${id}`);
const pageRef = (id) => (DOCS ? `${id}.md` : pageName(id));
const catTitle = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.title]));
const files = {};

const mmId = (k) => 'n_' + String(k).replace(/[^A-Za-z0-9_]/g, '_');
const mmText = (s) => String(s).replace(/"/g, '#quot;');

/** Converte a topologia do simulador (nós e enlaces) em um fluxograma Mermaid. As posições não são preservadas. */
function toMermaid(topo) {
  const L = ['flowchart LR'];
  for (const n of topo.nodes) {
    const t = `"${mmText(n.label)}${n.sub ? '<br/>' + mmText(n.sub) : ''}"`;
    const id = mmId(n.key);
    L.push('  ' + id + ({ switch: `{{${t}}}`, router: `(${t})`, cloud: `([${t}])` }[n.kind] ?? `[${t}]`));
  }
  const attackers = topo.nodes.filter((n) => n.kind === 'attacker').map((n) => mmId(n.key));
  for (const [a, b, o] of topo.links) {
    const lab = o?.label ? `"${mmText(o.label)}"` : o?.down ? '"caído"' : '';
    const dashed = o?.dashed || o?.down;
    L.push('  ' + mmId(a) + (dashed ? (lab ? ` -. ${lab} .- ` : ' -.- ') : (lab ? ` -- ${lab} --- ` : ' --- ')) + mmId(b));
  }
  if (attackers.length) {
    L.push('  classDef atacante fill:#fde2e2,stroke:#b42318,color:#111');
    L.push('  class ' + attackers.join(',') + ' atacante');
  }
  return L.join('\n');
}

const mmMsg = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/;/g, ',').replace(/#/g, 'nº ').replace(/\s+/g, ' ').trim().slice(0, 90);

// Âncora de um título, no padrão do GitHub: minúsculas, sem pontuação, espaços viram hífens.
const slug = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * Diagrama de sequência Mermaid de um cenário, a partir das mensagens do trace (mesma fonte do diagrama da bancada).
 * Devolve também os dados que alimentam a legenda da figura.
 */
function sequenceDiagram(def, s, base) {
  const tr = def.build({ ...base, ...(s.set ?? {}) }, s.sub);
  const L = ['sequenceDiagram'];
  for (const c of tr.cols) L.push(`  participant ${mmId(c.key)} as ${mmMsg(c.label)}${c.sub ? '<br/>' + mmMsg(c.sub) : ''}`);
  const msgs = [...tr.msgs].sort((a, b) => a.tSend - b.tSend || a.id - b.id);
  const phases = [...tr.phases].sort((a, b) => a.t - b.t);
  const first = mmId(tr.cols[0].key);
  const last = mmId(tr.cols[tr.cols.length - 1].key);
  let p = 0;
  for (const m of msgs) {
    while (p < phases.length && phases[p].t <= m.tSend + 1e-9) {
      L.push(`  Note over ${first},${last}: ${mmMsg(phases[p].label)}`);
      p++;
    }
    const text = mmMsg(m.label ?? m.info ?? m.proto) || 'mensagem';
    const arrow = m.lost ? '-x' : '->>';
    L.push(`  ${mmId(m.from)} ${arrow} ${mmId(m.to)}: ${m.enc ? '[cifrado] ' : ''}${text}`);
  }
  return {
    block: '```mermaid\n' + L.join('\n') + '\n```',
    parts: tr.cols.map((c) => mmMsg(c.label)),
    n: msgs.length,
    phases: phases.length,
    lost: msgs.filter((m) => m.lost).length,
    enc: msgs.filter((m) => m.enc).length,
  };
}

/** Texto da legenda de uma figura do tipo B (sequência). */
function sequenceCaption(num, nome, info, onde) {
  const extra = [info.phases ? `em ${pl(info.phases, 'fase', 'fases')}` : '', info.lost ? pl(info.lost, 'perdida', 'perdidas') : '', info.enc ? pl(info.enc, 'cifrada', 'cifradas') : ''].filter(Boolean);
  return `*Figura ${num} (Tipo B, sequência).* Mensagens do cenário "${nome}", na ordem do tempo, entre ${info.parts.join(', ')}: ${pl(info.n, 'mensagem', 'mensagens')}${extra.length ? ' (' + extra.join('; ') + ')' : ''}. ${onde}`;
}

const KIND_PT = { host: 'host', switch: 'switch', router: 'roteador', cloud: 'servidor ou rede externa', attacker: 'atacante' };

/** Seção "Como ler os diagramas": os tipos, a legenda de cada um e a lista de figuras. */
function howToRead(sec, usa, figs) {
  const L = [`## ${sec}. Como ler os diagramas\n`, 'Este documento usa até dois tipos de diagrama. Cada figura traz uma legenda com o tipo, o que mostra e a que modo ou cenário se refere.\n'];
  L.push('| Tipo | O que é | Vale para | Equivale, no simulador, a |', '| --- | --- | --- | --- |');
  if (usa.A) L.push('| A, topologia | Os elementos da rede e os enlaces que os ligam. É estático. | Um modo inteiro | A visão "Topologia" do quadro principal |');
  if (usa.B) L.push('| B, sequência | As mensagens na ordem do tempo, entre os participantes. É dinâmico. | Um único cenário, com a configuração indicada | Ao diagrama de sequência e à aba Captura |');
  L.push('', `### ${sec}.1 Legenda dos diagramas\n`);
  if (usa.A) {
    L.push('**Tipo A (topologia)**\n',
      '- Retângulo: host (computador ou servidor final).',
      '- Hexágono: switch.',
      '- Retângulo arredondado: roteador, ou dispositivo que encaminha ou traduz.',
      '- Estádio (cantos bem arredondados): servidor ou rede externa.',
      '- Retângulo vermelho: atacante (quando existe no modo).',
      '- Linha contínua: enlace. Linha tracejada: enlace alternativo, forjado ou caído, ou ainda relação de peering (no BGP), conforme o rótulo e o cenário.',
      '- O Mermaid posiciona os elementos automaticamente: o layout difere do simulador, as ligações não.\n');
  }
  if (usa.B) {
    L.push('**Tipo B (sequência)**\n',
      '- Cada coluna é um participante (cliente, servidor, roteador ou outro). O tempo corre de cima para baixo.',
      '- Seta cheia: mensagem enviada. Seta com X: mensagem perdida.',
      '- `[cifrado]` no início do rótulo: a mensagem viaja cifrada.',
      '- Faixa horizontal com texto: início de uma fase do cenário.',
      '- A ordem é a da aba Captura; os intervalos de tempo não são desenhados em escala.\n');
  }
  L.push(`### ${sec}.2 Lista de figuras\n`);
  for (const [tipo, titulo] of [['A', 'Tipo A (topologia)'], ['B', 'Tipo B (sequência)']]) {
    const lista = figs.filter((f) => f.tipo === tipo);
    if (!lista.length) continue;
    L.push(`**${titulo}**\n`);
    for (const f of lista) L.push(`- [Figura ${f.num}](#${slug(f.heading)}): ${f.titulo}`);
    L.push('');
  }
  return L;
}

/** Agrupa números inteiros em intervalos consecutivos: [1,2,3,5] com prefixo "6.1." vira "6.1.1 a 6.1.3; 6.1.5". */
function rangeText(prefix, nums) {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const runs = [];
  for (const n of s) {
    const last = runs[runs.length - 1];
    if (last && n === last[1] + 1) last[1] = n; else runs.push([n, n]);
  }
  return runs.map(([a, b]) => (a === b ? `${prefix}${a}` : b === a + 1 ? `${prefix}${a} e ${prefix}${b}` : `${prefix}${a} a ${prefix}${b}`)).join('; ');
}

/** Uma topologia por desenho distinto: percorre os cenários de cada modo e agrupa os que compartilham o mesmo desenho. */
function topologyData(def) {
  const base = Object.fromEntries(def.controls.map((c) => [c.id, c.def]));
  const out = [];
  for (const sub of def.subs) {
    const all = def.scenarios.filter((x) => x.sub === sub.key);
    const found = [];
    for (const s of all) {
      try {
        const topo = def.topology(sub.key, def.build({ ...base, ...(s.set ?? {}) }, sub.key));
        const nodes = new Set(topo.nodes.map((n) => [n.key, n.label, n.sub, n.kind].join('|')));
        const links = new Set(topo.links.map(([a, b, o]) => [a, b, o?.label, o?.dashed, o?.down].join('|')));
        const elems = topo.nodes.map((n) => mmMsg(n.label) + (n.sub ? ` (${mmMsg(n.sub)})` : ''));
        const dashed = topo.links.some(([, , o]) => o?.dashed || o?.down);
        found.push({ mm: toMermaid(topo), nodes, links, ids: [s.id], elems, dashed, size: nodes.size + links.size });
      } catch { /* cenário sem topologia gerável */ }
    }
    // Une as variantes que são subconjunto de outra (por exemplo, cenários em que só um dos hosts participa).
    const kept = [];
    for (const v of found.sort((a, b) => b.size - a.size)) {
      const host = kept.find((k) => [...v.nodes].every((n) => k.nodes.has(n)) && [...v.links].every((l) => k.links.has(l)));
      if (host) host.ids.push(...v.ids); else kept.push(v);
    }
    if (kept.length) out.push({ sub, total: all.length, kept });
  }
  return out;
}

function nativePage(sim, def) {
  const L = [];
  L.push(`# ${sim.title}\n`);
  L.push(`${sim.summary}\n`);
  L.push(`- **Categoria:** ${catTitle[sim.category]}`);
  L.push(`- **Motor:** nativo (TypeScript puro, apresentado pela bancada genérica)`);
  L.push(`- **Código-fonte:** \`src/sims/${sim.id === 'http-versoes' ? 'http-versoes' : sim.id}/\``);
  L.push(`- **RFCs e padrões:** ${def.rfcs.length ? def.rfcs.map(([n, t]) => `RFC ${n} (${t})`).join(', ') : sim.rfcs.join(', ')}`);
  if (sim.topics?.length) L.push(`- **Tópicos:** ${sim.topics.join('; ')}`);
  L.push('');

  // Numeração das seções (a de topologia só existe quando há desenho) e dos cenários, na ordem em que são exibidos.
  const topo = def.topology ? topologyData(def) : [];
  let n = 0;
  const S = { modos: ++n, ler: ++n, topo: topo.length ? ++n : 0, abas: ++n, conf: ++n, cen: ++n, ref: ++n };
  const order = def.subs.map((sub, i) => {
    const sc = def.scenarios.filter((s) => s.sub === sub.key);
    const list = [];
    for (const g of [...new Set(sc.map((s) => s.g))]) for (const s of sc.filter((x) => x.g === g)) list.push({ s, g });
    list.forEach((e, j) => { e.j = j + 1; e.num = `${S.cen}.${i + 1}.${j + 1}`; });
    return { sub, i, list, prefix: `${S.cen}.${i + 1}.` };
  });
  const numOf = Object.fromEntries(order.flatMap((o) => o.list.map((e) => [e.s.id, e])));
  const figs = [];
  const usa = { A: topo.length > 0, B: false };

  L.push(`## ${S.modos}. Modos\n`);
  L.push('| Modo | Cenário inicial | Cenários |', '| --- | --- | --- |');
  const byId = Object.fromEntries(def.scenarios.map((s) => [s.id, s]));
  for (const o of order) {
    const cen = o.list.length ? rangeText(o.prefix, o.list.map((e) => e.j)) : '-';
    L.push(`| ${o.sub.label} | ${byId[o.sub.default]?.label ?? o.sub.default} | ${cen} |`);
  }
  L.push('');

  const lerAt = L.length;

  if (topo.length) {
    L.push(`## ${S.topo}. Topologia\n`);
    L.push('Figuras do Tipo A, uma por modo (e uma por variante do desenho, quando a rede muda entre cenários). Foram geradas a partir da mesma definição de topologia que a bancada usa.\n');
    topo.forEach((t, k) => {
      const num = `${S.topo}.${k + 1}`;
      const heading = `${num} ${t.sub.label}`;
      L.push(`### ${heading}\n`);
      const cen = order.find((o) => o.sub.key === t.sub.key);
      t.kept.forEach((v, vi) => {
        const fnum = t.kept.length > 1 ? num + 'abcdefghij'[vi] : num;
        L.push('```mermaid\n' + v.mm + '\n```\n');
        const todos = v.ids.length === t.total;
        const rel = rangeText(cen.prefix, v.ids.map((id) => numOf[id].j));
        L.push(`*Figura ${fnum} (Tipo A, topologia).* Elementos do modo "${t.sub.label}": ${v.elems.join('; ')}.${v.dashed ? ' Linhas tracejadas: enlaces alternativos, forjados ou caídos.' : ''} Vale para ${todos ? 'todos os cenários do modo' : 'os cenários'} (${rel}).\n`);
        figs.push({ tipo: 'A', num: fnum, heading, titulo: `topologia do modo "${t.sub.label}"${t.kept.length > 1 ? ', variante ' + 'abcdefghij'[vi] : ''}` });
      });
    });
  }

  L.push(`## ${S.abas}. Abas da bancada\n`);
  const own = (def.tabs ?? []).map((t) => {
    const only = t.subs?.length ? ` (modos: ${t.subs.map((k) => def.subs.find((x) => x.key === k)?.label ?? k).join('; ')})` : '';
    return `${t.label}${only}`;
  });
  L.push(`Cenário, Captura, Mensagem${own.length ? ', ' + own.join(', ') : ''}, Experimento, Referência e Log.\n`);

  L.push(`## ${S.conf}. Configurações (campos do painel)\n`);
  const subLabel = (k) => def.subs.find((x) => x.key === k)?.label ?? k;
  [...new Set(def.controls.map((c) => c.grp))].forEach((g, gi) => {
    L.push(`### ${S.conf}.${gi + 1} ${g}\n`);
    for (const c of def.controls.filter((x) => x.grp === g)) {
      const opts = c.type === 'check' ? 'caixa de seleção' : (c.opts ?? []).map(([v, l]) => l).join('; ');
      const modos = c.subs?.length ? c.subs.map(subLabel).join('; ') : 'todos';
      L.push(`- **${c.label}**${c.adv ? ' (ajuste avançado)' : ''}. Valores: ${opts}. Padrão: ${c.type === 'check' ? q(c.def) : (c.opts?.find(([v]) => v === c.def)?.[1] ?? q(c.def))}. Modos: ${modos}.`);
      if (c.help) {
        if (c.help.s) L.push(`  - ${c.help.s}`);
        for (const p of c.help.p) L.push(`  - ${md(p).replace(/\n+/g, ' ')}`);
      }
    }
    L.push('');
  });

  L.push(`## ${S.cen}. Cenários\n`);
  const base = Object.fromEntries(def.controls.map((c) => [c.id, c.def]));
  for (const o of order) {
    L.push(`### ${S.cen}.${o.i + 1} Modo: ${o.sub.label}\n`);
    let curG;
    for (const { s, g, num } of o.list) {
      if (g !== curG) {
        curG = g;
        L.push(`> **Grupo:** ${g}\n`);
        if (def.groupDoc[g]) L.push(`${md(def.groupDoc[g])}\n`);
      }
      const d = def.scenDoc[s.id];
      const heading = `${num} ${s.label}`;
      L.push(`#### ${heading}\n`);
      if (d?.short) L.push(`*${md(d.short)}*\n`);
      const set = s.set ? Object.entries(s.set).map(([k, v]) => `${def.controls.find((c) => c.id === k)?.label ?? k} = ${q(v)}`).join('; ') : '';
      if (set) L.push(`**Configuração aplicada:** ${set}\n`);
      if (s.what) L.push(`${md(s.what)}\n`);
      if (d?.concept) L.push(`**Conceito.** ${md(d.concept)}\n`);
      if (d?.observe?.length) { L.push('**O que observar**\n'); for (const x of d.observe) L.push(`- ${md(x)}`); L.push(''); }
      try {
        const sd = sequenceDiagram(def, s, base);
        L.push(sd.block, '');
        const onde = `Corresponde ao diagrama de sequência e à aba Captura, no modo "${o.sub.label}", ${set ? 'com a configuração aplicada acima' : 'com a configuração padrão'}.`;
        L.push(sequenceCaption(num, s.label, sd, onde) + '\n');
        figs.push({ tipo: 'B', num, heading, titulo: `sequência de "${s.label}"` });
        usa.B = true;
      } catch { /* sem diagrama */ }
      if (d?.msgs?.length) {
        L.push(`**${d.msgsTitle ?? 'Mensagens'}**\n`);
        L.push('| Mensagem | Significado | Origem |', '| --- | --- | --- |');
        for (const m of d.msgs) L.push(`| ${m.map((c) => md(c).replace(/\|/g, '\\|')).join(' | ')} |`);
        L.push('');
      }
      if (d?.why) L.push(`**Por que importa.** ${md(d.why)}\n`);
    }
  }

  L.push(`## ${S.ref}. Referência\n`);
  L.push(numberSubs(md(def.reference), S.ref) + '\n');
  L.splice(lerAt, 0, ...howToRead(S.ler, usa, figs));
  return L.join('\n') + footer;
}

/**
 * Particularidades das páginas legadas. O TCP e UDP tem cinco modos escolhidos por botões (protocolo e
 * aplicação) e uma tabela de captura que o botão Passo revela; hosts nomeia os endereços da captura
 * (CLI e SRV nas constantes da página).
 */
const LEGACY = {
  'tcp-udp-simulator.html': {
    capture: true,
    hosts: { '192.168.10.10': 'Cliente', '203.0.113.80': 'Servidor' },
    modes: [
      { label: 'TCP: conexão', proto: 'tcp', sub: 0 },
      { label: 'TCP: download de arquivo', proto: 'tcp', sub: 1 },
      { label: 'UDP: fluxo de datagramas e DNS', proto: 'udp', sub: 0 },
      { label: 'UDP: vídeo em streaming', proto: 'udp', sub: 2 },
      { label: 'Comparação TCP x UDP', proto: 'cmp', sub: 0 },
    ],
  },
  // BGP e MPLS animam os pacotes com a Web Animations API e esperas por temporizador; no jsdom as duas são trocadas
  // por versões imediatas (`fast`). A captura vem de avançar as fases (`advance`, e `then` para um clique extra, como
  // o ping do MPLS); só entram na sequência os cenários de `seq`, e `row` converte cada linha da aba Captura em
  // [nº, tempo, origem, destino, tipo, '', informação] ou a descarta (a captura inteira do BGP tem mais de 70 mensagens).
  // `topos` lê as constantes da própria página, para os diagramas de topologia não divergirem dela.
  'bgp-simulator.html': {
    fast: true,
    advance: { id: 'btnAdvance', n: 4 },
    hosts: { Trânsito: 'AS64496', 'ISP A': 'AS64500', 'ISP B': 'AS64501', Cliente: 'AS64510', Conteúdo: 'AS64511', Atacante: 'AS64666' },
    topos: bgpTopos,
    seq: {
      'Estabelecimento da sessão': { link: 'L4', types: ['TCP', 'OPEN', 'KEEPALIVE'] },
      'Propagação do anúncio': { types: ['UPDATE'], prefix: '203.0.113.0/24' },
      'Sequestro de prefixo': { types: ['UPDATE'], prefix: '203.0.113.0/24' },
      'Vazamento de rota': { types: ['UPDATE'], prefix: '198.51.100.0/24' },
    },
    row: (c, p) => ((!p.link || c[2] === p.link) && p.types.includes(c[5]) && (!p.prefix || c[6].startsWith(p.prefix + ' ')) ? [c[0], c[1], c[3], c[4], c[5], '', c[6]] : null),
    filtro: (p, ids) => `Só as mensagens ${p.link ? `do enlace ${p.link} (${ids[p.link].join(' e ')})` : `do prefixo ${p.prefix}`}, do tipo ${p.types.join(', ')}, depois de avançar as quatro fases. `,
  },
  'mpls-simulator.html': {
    fast: true,
    advance: { id: 'btnAdvance', n: 4, then: 'btnPing' },
    hosts: { 'H-A': 'Host', 'H-B': 'Host', PE1: 'PE', PE2: 'PE', P1: 'P', P2: 'P', P3: 'P', P4: 'P' },
    topos: mplsTopos,
    seq: { 'Push, swap e pop': {}, 'explicit-null': {}, 'Sem PHP': {}, L3VPN: {} },
    // O enlace vem como "L1 PE1 → P1" (entre LSR) ou "H-A / PE1" (entre host e PE); o rótulo é a operação no emissor.
    row: (c) => {
      const m = c[2].match(/([\w-]+)\s*(?:→|\/)\s*([\w-]+)\s*$/);
      return m ? [c[0], c[1], m[1], m[2], '', '', `${/Echo (Request|Reply)/.exec(c[6])?.[0] ?? 'ICMP'}: ${c[5]}`] : null;
    },
    filtro: () => 'Mostra um ping do host H-A ao H-B (ida e volta), depois de avançar as quatro fases. ',
  },
  'router-simulator.html': {
    topos: routerTopos,
  },
  'tcp-udp-security-simulator.html': {
    topos: ataquesTopos,
  },
};

const readConst = (html, nome) => new Function('return ' + html.match(new RegExp(String.raw`const ${nome}\s*=\s*([\s\S]*?);\s*\n`))[1])();

/** BGP: seis sistemas autônomos (ASES) e os enlaces com a relação comercial (LINKS_INIT). */
function bgpTopos(html) {
  const ases = readConst(html, 'ASES');
  const links = readConst(html, 'LINKS_INIT');
  const kind = { M: 'attacker', C: 'host', D: 'host' };
  const nodes = Object.values(ases).map((a) => ({ key: a.id, label: a.name, sub: 'AS' + a.asn + (a.prefix ? ', ' + a.prefix : ''), kind: kind[a.id] ?? 'router' }));
  return {
    figs: [{
      titulo: `Topologia de ${nodes.length} sistemas autônomos`,
      curto: 'topologia dos seis sistemas autônomos',
      topo: { nodes, links: links.map(([, a, b, rel]) => [a, b, rel === 'peer' ? { label: 'peering', dashed: true } : { label: 'provedor: ' + ases[a].name }]) },
      texto: `${pl(nodes.length, 'sistema autônomo', 'sistemas autônomos')} e ${pl(links.length, 'enlace BGP', 'enlaces BGP')}: ${nodes.map((nd) => `${nd.label} (${nd.sub})`).join('; ')}. Linhas contínuas: relação de provedor e cliente, com o provedor indicado no rótulo. Linhas tracejadas: peering. Vale para todos os cenários; o Atacante só age nos cenários de segurança.`,
    }],
    ids: Object.fromEntries(links.map(([id, a, b]) => [id, [ases[a].name, ases[b].name]])),
  };
}

/** MPLS: seis LSR (LSRS), dois hosts (HOSTS) e os enlaces com custo IGP e atraso (LINKS_INIT). */
function mplsTopos(html) {
  const lsrs = readConst(html, 'LSRS');
  const hosts = readConst(html, 'HOSTS');
  const links = readConst(html, 'LINKS_INIT');
  const nodes = [
    ...lsrs.map((l) => ({ key: l.id, label: l.id, sub: (l.role === 'PE' ? 'PE' : 'P') + ', ' + l.lo, kind: 'router' })),
    ...hosts.map((h) => ({ key: h.id, label: h.id, sub: h.ip, kind: 'host' })),
  ];
  return {
    figs: [{
      titulo: `Topologia de ${lsrs.length} LSR e ${hosts.length} hosts`,
      curto: 'topologia do núcleo MPLS e dos hosts',
      topo: {
        nodes,
        links: [...links.map(([id, a, b, cost]) => [a, b, { label: `${id}, custo ${cost}` }]), ...hosts.map((h) => [h.id, h.pe, {}])],
      },
      texto: `${pl(lsrs.filter((l) => l.role === 'PE').length, 'roteador de borda (PE)', 'roteadores de borda (PE)')}, ${pl(lsrs.filter((l) => l.role !== 'PE').length, 'roteador de núcleo (P)', 'roteadores de núcleo (P)')} e ${pl(hosts.length, 'host', 'hosts')}. Cada enlace traz o identificador e o custo IGP; o endereço sob o nome é o de loopback do LSR (ou o IP do host). Os P encaminham por rótulos; o PE1 e o PE2 ligam as redes ${hosts.map((h) => h.net).join(' e ')}. Vale para todos os cenários.`,
    }],
    ids: {},
  };
}

/** Roteamento: rede de seis roteadores (OSPF em área única e RIPv2) e rede de nove roteadores em três áreas. */
function routerTopos(html) {
  const single = { r: readConst(html, 'routersSingle'), l: readConst(html, 'linksInitSingle'), h: readConst(html, 'hostsSingle') };
  const multi = { r: readConst(html, 'routersMulti'), l: readConst(html, 'linksInitMulti'), h: readConst(html, 'hostsMulti') };
  const hostLinks = (t) => t.h.map((h) => [h.id, h.attach, {}]);
  const hostNodes = (t) => t.h.map((h) => ({ key: h.id, label: h.id, sub: 'ligado a ' + h.attach, kind: 'host' }));
  return {
    figs: [
      {
        titulo: `Rede de ${single.r.length} roteadores (OSPF em área única e RIPv2)`,
        curto: 'rede de seis roteadores, OSPF em área única e RIPv2',
        topo: {
          nodes: [...single.r.map((r) => ({ key: r.id, label: r.id, kind: 'router' })), ...hostNodes(single)],
          links: [...single.l.map((l) => [l.a, l.b, { label: `${l.id}, custo ${l.cost}` }]), ...hostLinks(single)],
        },
        texto: `${pl(single.r.length, 'roteador', 'roteadores')}, ${pl(single.l.length, 'enlace', 'enlaces')} com custo OSPF e dois hosts. É a rede dos cenários de OSPF em área única e de RIPv2; o RIPv2 ignora os custos, porque a métrica dele é o número de saltos.`,
      },
      {
        titulo: `Rede de ${multi.r.length} roteadores em três áreas (OSPF multi-área)`,
        curto: 'rede de nove roteadores em três áreas',
        topo: {
          nodes: [...multi.r.map((r) => ({ key: r.id, label: r.id, sub: r.abr ? 'ABR, áreas ' + r.areas.join(' e ') : 'área ' + r.areas[0], kind: 'router' })), ...hostNodes(multi)],
          links: [...multi.l.map((l) => [l.a, l.b, { label: `custo ${l.cost}, área ${l.area}` }]), ...hostLinks(multi)],
        },
        texto: `${pl(multi.r.length, 'roteador', 'roteadores')} em três áreas: 1, 0 (backbone) e 2. Os roteadores de borda de área (ABR) pertencem a duas áreas e ligam cada área ao backbone. Cada enlace traz o custo e a área a que pertence. Vale para o cenário de OSPF multi-área.`,
      },
    ],
    ids: {},
  };
}

/**
 * Ataques em TCP e UDP: o desenho é feito em canvas, sem constantes de topologia; os nós vêm do literal de `nodes()` da
 * página e a variante de cada cenário, dos campos `mode` e `multi` da definição dele. As varreduras (`scan`) usam o
 * mesmo desenho do ataque direto.
 */
function ataquesTopos(html, { x, S }) {
  const no = (k) => {
    const m = html.match(new RegExp(`${k}: \{[^}]*?name: '([^']*)', ip: (VICTIM|'[^']*')`));
    return { name: m[1], ip: m[2] === 'VICTIM' ? html.match(/const VICTIM = '([^']*)'/)[1] : m[2].slice(1, -1) };
  };
  const [client, edge, firewall, reflector, server] = ['client', 'edge', 'firewall', 'reflector', 'server'].map(no);
  const upstream = { name: 'Operadora', ip: 'upstream' };
  // Variante de cada cenário, na ordem da página: [título, modo, multi].
  const defs = [...html.matchAll(/title: '([^']+)'[^\n]*?mode: '(\w+)'(, multi: true)?/g)].map((m) => ({ titulo: m[1], mode: m[2], multi: !!m[3] }));
  const faixa = (pred) => {
    const nums = defs.filter(pred).map((df) => x.scenarios.findIndex((s) => (s.title ?? s.label) === df.titulo) + 1).filter((v) => v > 0);
    return rangeText(`${S.cen}.`, nums);
  };
  const base = [
    { key: 'client', label: client.name, sub: client.ip, kind: 'host' },
    { key: 'fw', label: firewall.name, sub: firewall.ip, kind: 'router' },
    { key: 'srv', label: server.name, sub: server.ip, kind: 'host' },
    { key: 'up', label: upstream.name, sub: upstream.ip, kind: 'cloud' },
  ];
  const comum = [['client', 'fw', {}], ['fw', 'srv', {}]];
  const direto = (multi) => ({
    nodes: [{ key: 'atk', label: multi ? 'Botnet' : 'Atacante', sub: multi ? 'milhares de IPs' : '198.51.100.x', kind: 'attacker' }, ...base],
    links: [['atk', 'up', {}], ['up', 'fw', {}], ...comum],
  });
  return {
    figs: [
      {
        titulo: 'Ataque direto de uma origem',
        curto: 'ataque direto de uma origem',
        topo: direto(false),
        texto: `O atacante envia o tráfego à vítima pela operadora e pelo firewall e IDS da borda; o cliente legítimo usa o mesmo firewall. Vale para os cenários ${faixa((d) => d.mode !== 'reflect' && !d.multi)}, inclusive as varreduras, que usam o mesmo desenho.`,
      },
      {
        titulo: 'Ataque distribuído (botnet)',
        curto: 'ataque distribuído por uma botnet',
        topo: direto(true),
        texto: `O mesmo caminho, mas a origem é uma botnet, com milhares de endereços, o que impede o bloqueio por origem. Vale para o cenário ${faixa((d) => d.multi)}.`,
      },
      {
        titulo: 'Reflexão e amplificação',
        curto: 'reflexão e amplificação',
        topo: {
          nodes: [{ key: 'atk', label: 'Atacante', sub: '198.51.100.x', kind: 'attacker' }, { key: 'edge', label: edge.name, sub: edge.ip, kind: 'router' }, { key: 'refl', label: reflector.name, sub: reflector.ip, kind: 'host' }, ...base],
          links: [['atk', 'edge', {}], ['edge', 'refl', {}], ['refl', 'up', {}], ['up', 'fw', {}], ...comum],
        },
        texto: `O atacante envia requisições com a origem falsificada (o IP da vítima) ao serviço refletor, passando pela rede de origem (ISP). O refletor responde à vítima, por um caminho que passa pela operadora e pelo firewall, com tráfego maior que o das requisições. Vale para os cenários ${faixa((d) => d.mode === 'reflect')}.`,
      },
    ],
    ids: {},
  };
}

/** Diagrama de sequência a partir da tabela de captura: [nº, tempo, origem, destino, protocolo, tamanho, informação]. */
function captureSequence(rows, hosts = {}) {
  const ips = [];
  for (const r of rows) for (const ip of [r[2], r[3]]) if (!ips.includes(ip)) ips.push(ip);
  const id = (ip) => 'h_' + ip.replace(/[^A-Za-z0-9]/g, '_');
  const L = ['sequenceDiagram'];
  for (const ip of ips) L.push(`  participant ${id(ip)} as ${hosts[ip] ? hosts[ip] + '<br/>' : ''}${ip}`);
  for (const r of rows) L.push(`  ${id(r[2])} ${/perdid/i.test(r[6]) ? '-x' : '->>'} ${id(r[3])}: ${mmMsg(r[4] + ' ' + r[6])}`);
  return {
    block: '```mermaid\n' + L.join('\n') + '\n```',
    parts: ips.map((ip) => (hosts[ip] ? hosts[ip] + ' ' : '') + ip),
    n: rows.length,
    phases: 0,
    lost: rows.filter((r) => /perdid/i.test(r[6])).length,
    enc: 0,
  };
}

/** Executa uma página legada no jsdom e captura controles, ajuda, abas, cenários e referência. */
async function extractLegacy(file) {
  const cfg = LEGACY[file] ?? {};
  const html = fs.readFileSync(path.join(root, 'public', 'sims', file), 'utf8');
  const stub = new Proxy(function () {}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 0 }) : stub), set: () => true, apply: () => stub });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/' + file,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => stub;
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
      if (cfg.fast) {
        w.Element.prototype.animate = function () {
          const a = {};
          Object.defineProperty(a, 'onfinish', { set: (f) => setTimeout(f, 0) });
          return a;
        };
        const st = w.setTimeout.bind(w);
        w.setTimeout = (f) => st(f, 0);
      }
    },
  });
  const w = dom.window;
  const d = w.document;
  const r = { scenarios: [], groupDoc: {} };
  // Controles lidos antes de percorrer os cenários (cada cenário altera os valores). A ajuda vem do
  // balão que a própria página abre ao focar o campo.
  r.controls = [...d.querySelectorAll('label')].filter((l) => l.querySelector('select,input')).map((l) => {
    const ctl = l.querySelector('select,input');
    const c = l.cloneNode(true);
    c.querySelectorAll('select,input,option,.info').forEach((n) => n.remove());
    ctl.dispatchEvent(new w.Event('focus'));
    const box = d.getElementById('fieldHelp') ?? d.querySelector('.field-help');
    const help = box && box.style.display !== 'none' && box.innerHTML
      ? { t: box.querySelector('.fh-title')?.textContent.trim(), p: [...box.querySelectorAll('p')].map((p) => p.innerHTML) }
      : undefined;
    ctl.dispatchEvent(new w.Event('blur'));
    return {
      id: ctl.id,
      label: c.textContent.replace(/\s+/g, ' ').trim(),
      check: ctl.tagName === 'INPUT',
      opts: ctl.tagName === 'SELECT' ? [...ctl.options].map((o) => o.textContent.trim()) : [],
      def: ctl.tagName === 'SELECT' ? ctl.selectedOptions[0]?.textContent.trim() : (ctl.checked ? 'sim' : 'não'),
      help,
    };
  });
  const capRows = () => [...d.querySelectorAll('#capBody tr')].filter((tr) => !tr.classList.contains('placeholder-row'));
  for (const mode of cfg.modes ?? [{ label: '' }]) {
    if (mode.proto) {
      d.querySelector(`#protoSeg [data-proto="${mode.proto}"]`).click();
      const subs = [...d.querySelectorAll('#subSeg button')];
      if (subs[mode.sub]) subs[mode.sub].click();
    }
    let grp = '';
    for (const el of [...d.getElementById('scenRow').children]) {
      if (el.classList.contains('scen-group')) { grp = el.textContent.trim(); continue; }
      if (el.tagName !== 'BUTTON') continue;
      el.click();
      const body = d.getElementById('scenBody');
      const main = body.querySelector('.sc-main');
      let capture, seq;
      if (cfg.capture) {
        // Avança passo a passo até a captura parar de crescer (o motor calcula tudo de uma vez; o passo só revela).
        let stable = 0, prev = -1, i = 0;
        while (stable < 15 && i++ < 5000) {
          const b = d.getElementById('btnStep');
          if (!b || b.disabled) break;
          b.click();
          const n = capRows().length;
          stable = n === prev ? stable + 1 : 0;
          prev = n;
        }
        capture = capRows().map((tr) => [...tr.children].map((td) => td.textContent.trim()));
      } else if (cfg.advance && cfg.seq?.[el.textContent.trim()]) {
        // Avança as fases até o fim (e dá o clique extra, se houver) e guarda só as mensagens que `row` aceita.
        const pick = cfg.seq[el.textContent.trim()];
        const espera = async (btn) => {
          for (let w8 = 0; w8 < 800 && btn.disabled; w8++) await new Promise((res) => setTimeout(res, 25));
        };
        const btn = d.getElementById(cfg.advance.id);
        for (let k = 0; k < cfg.advance.n; k++) {
          btn.click();
          await espera(btn);
        }
        if (cfg.advance.then) {
          const extra = d.getElementById(cfg.advance.then);
          extra.click();
          await espera(extra);
          await new Promise((res) => setTimeout(res, 100));
        }
        capture = capRows()
          .map((tr) => [...tr.children].map((td) => td.textContent.trim()))
          .map((c) => cfg.row(c, pick))
          .filter(Boolean);
        seq = pick;
      }
      r.scenarios.push({
        mode: mode.label,
        group: grp,
        label: el.textContent.trim(),
        title: main?.querySelector('.sc-title')?.textContent.trim(),
        cmd: main?.querySelector('.sc-cmd')?.textContent.trim(),
        html: [...(main?.children ?? [])].filter((c) => !c.matches('.sc-kicker, .sc-title, .sc-cmd')).map((c) => c.outerHTML).join(''),
        capture,
        seq,
      });
      for (const h of body.querySelectorAll('.sc-side h4')) {
        const g = h.nextElementSibling;
        if (g?.classList.contains('sc-gdoc')) r.groupDoc[h.textContent.trim()] = g.innerHTML;
      }
    }
  }
  r.tabs = [...d.querySelectorAll('.tab-btn')].map((b) => b.textContent.trim());
  r.ref = d.querySelector('[data-tab-content="ref"] .tab-scroll')?.innerHTML ?? '';
  w.close();
  return r;
}

async function legacyPage(sim) {
  const x = await extractLegacy(sim.file);
  const L = [`# ${sim.title}\n`, `${sim.summary}\n`];
  L.push(`- **Categoria:** ${catTitle[sim.category]}`);
  L.push(`- **Motor:** legado (página autônoma em \`public/sims/${sim.file}\`, incorporada por \`iframe\`)`);
  L.push(`- **RFCs e padrões:** ${sim.rfcs.join(', ')}`);
  if (sim.topics?.length) L.push(`- **Tópicos:** ${sim.topics.join('; ')}`);
  L.push('');

  // Sequência (a partir da captura) só no TCP e UDP, no BGP e no MPLS; topologia só no BGP, no MPLS e no roteamento. A seção de leitura dos diagramas existe apenas quando há figuras.
  const cfgL = LEGACY[sim.file] ?? {};
  const hasB = x.scenarios.some((s) => s.capture?.length);
  const hasA = !!cfgL.topos;
  let n = 0;
  const S = { ler: hasB || hasA ? ++n : 0, topo: hasA ? ++n : 0, abas: ++n, conf: ++n, cen: ++n, ref: ++n };
  const figs = [];

  const lerAt = L.length;
  let topoInfo;
  if (hasA) {
    topoInfo = cfgL.topos(fs.readFileSync(path.join(root, 'public', 'sims', sim.file), 'utf8'), { x, S });
    L.push(`## ${S.topo}. Topologia\n`, 'Figuras do Tipo A, geradas a partir da mesma definição que a página usa para desenhar a rede.\n');
    topoInfo.figs.forEach((f, k) => {
      const num = `${S.topo}.${k + 1}`;
      const heading = `${num} ${f.titulo}`;
      L.push(`### ${heading}\n`, '```mermaid\n' + toMermaid(f.topo) + '\n```\n', `*Figura ${num} (Tipo A, topologia).* ${f.texto}\n`);
      figs.push({ tipo: 'A', num, heading, titulo: f.curto });
    });
  }
  L.push(`## ${S.abas}. Abas\n`, `${x.tabs.join(', ')}.\n`);

  L.push(`## ${S.conf}. Configurações (campos do painel)\n`);
  for (const c of x.controls) {
    const opts = c.check ? 'caixa de seleção' : c.opts.join('; ');
    L.push(`- **${c.label.replace(/ⓘ/g, '').trim()}**. Valores: ${opts}. Padrão: ${c.def}.`);
    for (const p of c.help?.p ?? []) L.push(`  - ${md(p).replace(/\n+/g, ' ')}`);
  }
  L.push('', `## ${S.cen}. Cenários\n`);
  let lastMode = null, last = '', m = 0, j = 0;
  const multi = x.scenarios.some((s) => s.mode);
  for (const s of x.scenarios) {
    if (multi && s.mode !== lastMode) { lastMode = s.mode; last = ''; m++; j = 0; L.push(`### ${S.cen}.${m} Modo: ${s.mode}\n`); }
    j++;
    const num = multi ? `${S.cen}.${m}.${j}` : `${S.cen}.${j}`;
    if (s.group !== last) {
      last = s.group;
      L.push(`> **Grupo:** ${s.group}\n`);
      if (x.groupDoc[s.group]) L.push(`${md(x.groupDoc[s.group])}\n`);
    }
    const heading = `${num} ${s.title ?? s.label}`;
    L.push(`${multi ? '####' : '###'} ${heading}\n`);
    if (s.cmd) L.push(`${md(s.cmd)}\n`);
    L.push(`${md(s.html.replace(/<h4>([\s\S]*?)<\/h4>/gi, '<p><b>$1.</b></p>'))}\n`);
    if (s.capture?.length) {
      const sd = captureSequence(s.capture, LEGACY[sim.file]?.hosts);
      const filtro = s.seq ? cfgL.filtro(s.seq, topoInfo.ids) : '';
      const onde = `${filtro}Corresponde à aba Captura${multi ? `, no modo "${s.mode}"` : ''}, na ordem em que os pacotes aparecem; os intervalos de tempo não estão em escala.`;
      L.push(sd.block, '', sequenceCaption(num, s.title ?? s.label, sd, onde) + '\n');
      figs.push({ tipo: 'B', num, heading, titulo: `sequência de "${s.title ?? s.label}"` });
    }
  }
  L.push(`## ${S.ref}. Referência\n`, numberSubs(md(x.ref), S.ref) + '\n');
  if (S.ler) L.splice(lerAt, 0, ...howToRead(S.ler, { A: hasA, B: hasB }, figs));
  return L.join('\n') + footer;
}

const avail = SIMS.filter((s) => s.status === 'available');
const planned = SIMS.filter((s) => s.status === 'planned');
let nNative = 0, nScen = 0;

for (const sim of avail) {
  if (sim.engine === 'nativo') {
    const def = (await NATIVE[sim.id]()).default;
    files[`${pageName(sim.id)}.md`] = nativePage(sim, def);
    nNative++; nScen += def.scenarios.length;
  } else {
    files[`${pageName(sim.id)}.md`] = await legacyPage(sim);
  }
}

// Índice de simuladores
{
  const L = ['# Simuladores\n', 'Lista dos simuladores do Simul-Net por categoria. A fonte única é `src/sims/registry.ts`.\n'];
  for (const c of CATEGORIES) {
    L.push(`## ${c.title}\n`, `${c.description}\n`);
    L.push('| Simulador | Motor | Situação | RFCs e padrões |', '| --- | --- | --- | --- |');
    for (const s of SIMS.filter((x) => x.category === c.id)) {
      const link = s.status === 'available' ? `[${s.title}](${pageRef(s.id)})` : s.title;
      L.push(`| ${link} | ${s.engine ?? '-'} | ${s.status === 'available' ? 'disponível' : 'planejado'} | ${s.rfcs.join(', ')} |`);
    }
    L.push('');
  }
  files['simuladores.md'] = L.join('\n') + footer;
}

// Arquitetura (cópia do docs/arquitetura.md)
{
  const a = fs.readFileSync(path.join(root, 'docs', 'arquitetura.md'), 'utf8');
  files['arquitetura.md'] = a.trimEnd() + footer;
}

// Home e barra lateral
{
  const L = ['# Simul-Net\n',
    'Simuladores visuais de redes e protocolos seguros, desenvolvidos para ensino e pesquisa na Universidade de Brasília (Departamento de Engenharia Elétrica). Projeto irmão: CryptoNet Lab.\n',
    '- **Site:** https://peotta.github.io/Simul-Net/',
    '- **Código:** https://github.com/peotta/Simul-Net\n',
    '## Como usar esta wiki\n',
    '- [Arquitetura](arquitetura): estrutura de pastas, registro, contrato do motor de simulação, testes e publicação.',
    '- [Simuladores](simuladores): índice por categoria, com o motor e as RFCs de cada um.',
    '- [Contribuindo](contribuindo): como criar ou alterar um simulador e como esta wiki é gerada.\n',
    '## Simuladores disponíveis\n'];
  for (const s of avail) L.push(`- [${s.title}](${pageName(s.id)}) (${s.engine})`);
  L.push('', `São ${avail.length} simuladores disponíveis (${nNative} nativos, com ${nScen} cenários documentados) e ${planned.length} planejados.`);
  files['Home.md'] = L.join('\n') + footer;

  const S = ['**[Simul-Net](Home)**\n', '- [Arquitetura](arquitetura)', '- [Simuladores](simuladores)', '- [Contribuindo](contribuindo)\n'];
  for (const c of CATEGORIES) {
    const items = avail.filter((s) => s.category === c.id);
    if (!items.length) continue;
    S.push(`**${c.title}**\n`);
    for (const s of items) S.push(`- [${s.title}](${pageName(s.id)})`);
    S.push('');
  }
  files['_Sidebar.md'] = S.join('\n');
  files['_Footer.md'] = CRED + '\n';
}

// Contribuindo
files['contribuindo.md'] = `# Contribuindo\n
## Criar um simulador novo

1. Crie a pasta \`src/sims/<id>/\` em kebab-case com \`engine.ts\`, \`protocol.ts\`, \`topology.ts\` (opcional) e \`content/\` (controles, cenários, ajuda, abas, explicação e referência).
2. Registre o módulo em \`src/sims/native.ts\` e acrescente a entrada em \`src/sims/registry.ts\` (fonte única).
3. Siga o padrão visual e didático: abas Cenário, Captura, Mensagem, abas próprias, Experimento, Referência e Log; ajuda em cada campo; uma informação, um lugar.
4. Inclua o rodapé de crédito padrão e respeite a acessibilidade (imagens com \`alt\`, foco visível, contraste AA, \`prefers-reduced-motion\`).
5. Atualize as impressões digitais apenas quando a mudança de comportamento for intencional: \`UPDATE_GOLDEN=1 npx vitest run tests/sim-core/golden.test.ts\`.
6. Antes de entregar, rode \`npm run typecheck\` e \`npm test\`.

## Regras de texto

- Português do Brasil, tom acadêmico e impessoal.
- Sem travessão longo nem meia-risca (há teste automático).
- Conteúdo baseado nas RFCs; nunca inventar comandos, parâmetros ou saídas; explicitar as limitações do simulador.
- Cenários de ataque no nível defensivo (aviso, efeito e defesa), sem passo a passo ofensivo.

## Como esta wiki é gerada

As páginas dos simuladores nativos são geradas a partir dos próprios módulos (\`controls\`, \`scenarios\`, \`scenDoc\`, \`help\` e \`reference\`), e as dos legados, a partir da execução da página (campos, ajuda, cenários e aba Referência). Assim a wiki não diverge do código.

1. Altere o conteúdo do módulo ou da página legada.
2. Gere as páginas: \`npm run wiki -- <pasta-de-saida>\`.
3. Clone \`Simul-Net.wiki.git\`, copie os \`.md\` gerados, faça o commit e o push.

Edições manuais diretas nas páginas geradas são sobrescritas na próxima geração. As páginas \`Home\`, \`arquitetura\` (cópia de \`docs/arquitetura.md\`), \`simuladores\`, \`contribuindo\`, \`_Sidebar\` e \`_Footer\` também são geradas.
` + footer;

if (DOCS) {
  // Só os documentos dos simuladores e o índice; a arquitetura e as demais páginas da wiki não entram.
  const keep = new Set(avail.map((x) => `${pageName(x.id)}.md`));
  for (const k of Object.keys(files)) if (!keep.has(k) && k !== 'simuladores.md') delete files[k];
  files['README.md'] = files['simuladores.md'].replace('# Simuladores\n', '# Documentação dos simuladores\n');
  delete files['simuladores.md'];
}

/**
 * Transforma cada citação de RFC e de BCP em link para o rfc-editor.org (mesmo endereço dos chips do cabeçalho).
 * Intervalos como "RFC 4033 a 4035" têm o segundo número linkado também. Blocos de código (inclusive os diagramas
 * Mermaid), código em linha e links já existentes não são tocados. IEEE e ISO ficam em texto: não têm endereço gratuito estável.
 */
const rfcUrl = (n) => `https://www.rfc-editor.org/rfc/rfc${n}`;
const bcpUrl = (n) => `https://www.rfc-editor.org/info/bcp${n}`;
function linkRfcs(text) {
  const SKIP = /(`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\))/;
  let fenced = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^```/.test(line)) { fenced = !fenced; return line; }
      if (fenced) return line;
      return line
        .split(SKIP)
        .map((part, i) => {
          if (i % 2 === 1) return part; // código em linha ou link existente
          return part
            .replace(/\bRFC (\d{2,5})(?: a (\d{2,5}))?\b/g, (_, a, b) => `[RFC ${a}](${rfcUrl(a)})` + (b ? ` a [${b}](${rfcUrl(b)})` : ''))
            .replace(/\bBCP (\d{1,3})\b/g, (_, n) => `[BCP ${n}](${bcpUrl(n)})`);
        })
        .join('');
    })
    .join('\n');
}
for (const k of Object.keys(files)) files[k] = linkRfcs(files[k]);

for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(out, name), text, 'utf8');
console.log(`${Object.keys(files).length} arquivos em ${out}; ${nNative} nativos, ${nScen} cenários`);
await server.close();
