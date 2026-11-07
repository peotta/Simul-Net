// Abas próprias do simulador de OSPF: LSDB do roteador escolhido e tabela de roteamento.
import { esc, type Trace } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import type { LiveLink, Topo } from '../../roteamento-base/topologia';
import { areasOf, routeTable, type Item } from '../model';
import type { LsdbLog } from '../modes';

const td = (cells: string[]): string => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
const m = (t: string): string => '<span class="meaning">' + t + '</span>';

const rootOf = (tr: Trace, P: Record<string, unknown>): string => String(tr.raw.sub === 'multi' ? P.rootm || 'R1' : P.root || 'R1');

/** O que a LSDB do roteador contém no instante dado: o LSA de maior sequência de cada chave, entre os já recebidos. */
function lsdbAt(tr: Trace, root: string, now: number): Item[] {
  const best = new Map<string, Item>();
  (tr.raw.lsdbLog as LsdbLog[]).forEach((x) => {
    if (x.at !== root || x.t > now + 1e-9) return;
    const cur = best.get(x.item.key);
    if (!cur || cur.seq < x.item.seq) best.set(x.item.key, x.item);
  });
  return Array.from(best.values());
}

const areaName = (a: string): string => (a === '0' ? '0 (backbone)' : a);
const seqText = (n: number): string => '0x8000000' + n;

const lsdb: TabDef = {
  id: 'lsdb',
  label: 'LSDB',
  render: (tr, ctx) => {
    const root = rootOf(tr, ctx.P);
    const t = tr.raw.t as Topo;
    const items = lsdbAt(tr, root, ctx.timeAt(ctx.c));
    let h = '<h3>Base de estado de enlace (LSDB) de ' + esc(root) + '</h3>';
    h += '<p>' + (t.kind === 'multi' ? 'O roteador mantém uma LSDB por área a que pertence (' + areasOf(t, root).map((a) => 'área ' + areaName(a)).join(' e ') + ').' : 'Em área única, todos os roteadores terminam com a mesma LSDB.') + ' A tabela acompanha o relógio: os LSAs aparecem quando a inundação os entrega.</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Tipo</th><th>Origem</th><th>Área</th><th>Sequência</th><th>Conteúdo</th></tr></thead><tbody>';
    if (!items.length) h += '<tr><td colspan="5" class="meaning">LSDB vazia: o roteador ainda não originou nem recebeu nenhum LSA.</td></tr>';
    const ord = (i: Item): string => i.area + (i.kind === 'router' ? '0' : '1') + i.owner + (i.dest || '');
    items.sort((a, b) => (ord(a) < ord(b) ? -1 : 1)).forEach((it) => {
      if (it.kind === 'router') h += td(['Router-LSA (1)', esc(it.owner), esc(areaName(it.area)), m(seqText(it.seq)), m((it.links || []).map((l) => esc(l.to) + ' (custo ' + l.cost + ')').join(', ') || 'sem enlaces')]);
      else h += td(['Summary-LSA (3)', esc(it.owner), esc(areaName(it.area)), m(seqText(it.seq)), m('destino ' + esc(it.dest) + ', custo ' + it.cost)]);
    });
    h += '</tbody></table>';
    h += '<p>Um LSA com número de sequência maior substitui o anterior (RFC 2328, seção 13). Os Summary-LSAs são originados pelos ABRs e carregam só o destino e o custo, sem a topologia da outra área.</p>';
    return h;
  },
};

function tabela(tr: Trace, root: string, now: number): { rows: ReturnType<typeof routeTable> | null; aviso: string } {
  const R = tr.raw;
  const t = R.t as Topo;
  if (R.sub === 'evento') {
    const before = R.linksBefore as LiveLink[];
    const after = R.links as LiveLink[];
    const usaDepois = now + 1e-9 >= R.tSpf && R.tSpf > 0;
    return { rows: routeTable(t, usaDepois ? after : before, root), aviso: usaDepois ? 'Tabela depois do SPF que reagiu ao evento.' : 'Tabela da rede convergida, antes do evento (o SPF ainda não reagiu).' };
  }
  if (now + 1e-9 < R.tSpf) return { rows: null, aviso: 'A tabela só é calculada na fase SPF. Até lá, o roteador não tem rotas aprendidas.' };
  return { rows: routeTable(t, R.links as LiveLink[], root), aviso: 'Tabela calculada pelo SPF.' };
}

const rotas: TabDef = {
  id: 'rotas',
  label: 'Tabela de roteamento',
  render: (tr, ctx) => {
    const root = rootOf(tr, ctx.P);
    const { rows, aviso } = tabela(tr, root, ctx.timeAt(ctx.c));
    const multi = tr.raw.sub === 'multi';
    let h = '<h3>Tabela de roteamento de ' + esc(root) + '</h3><p>' + esc(aviso) + '</p>';
    h += '<table class="sc-msgs"><thead><tr><th>Destino</th><th>Tipo</th><th>Custo</th><th>Próximo salto</th>' + (multi ? '<th>Aprendida por</th>' : '') + '</tr></thead><tbody>';
    if (!rows) h += '<tr><td colspan="' + (multi ? 5 : 4) + '" class="meaning">Sem rotas ainda.</td></tr>';
    else rows.forEach((r) => {
      const tipo = r.kind === 'local' ? 'local' : r.kind === 'intra' ? 'intra-área (O)' : r.kind === 'inter' ? 'inter-área (O IA)' : 'sem rota';
      h += td([esc(r.dest + ' (10.0.0.' + r.dest.slice(1) + ')'), m(tipo), m(r.cost === null ? 'inalcançável' : String(r.cost)), m(r.next || '-'), ...(multi ? [m(r.via ? 'ABR ' + esc(r.via) : '-')] : [])]);
    });
    h += '</tbody></table>';
    h += '<p>O OSPF escolhe o caminho de menor custo total. Em redes reais, as rotas intra-área são marcadas O e as inter-área, O IA. Neste simulador o destino de cada linha é o Router ID do roteador.</p>';
    return h;
  },
};

export const tabs: TabDef[] = [lsdb, rotas];
