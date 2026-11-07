// Texto da aba Experimento e do cabeçalho do cenário do simulador OSI.
import type { Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import type { FrameRec } from '../modes';

/** Texto "Configuração do cenário": só o que o cenário define. */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as { vlan?: boolean };
  return V.vlan ? 'enlace tronco com etiqueta 802.1Q' : 'enlace sem etiqueta de VLAN';
}

export function explain(tr: Trace): string {
  const R = tr.raw;
  const fr = (R.frames || []) as FrameRec[];
  const first = fr[0];
  const last = fr[2];
  let h = '<ul>';
  h += '<li>A requisição atravessou <b>3 saltos</b> e a resposta, outros 3. O quadro foi refeito em cada salto, e o switch e o roteador só leram até as camadas 2 e 3.</li>';
  if (first && last) h += '<li>O TTL foi de <b>' + first.ttl + '</b> no cliente para <b>' + last.ttl + '</b> no servidor, e o MAC de destino mudou de <b>' + first.dmac + '</b> para <b>' + last.dmac + '</b>. O IP não mudou.</li>';
  if (R.vlan) h += '<li>No tronco, o quadro ganhou a <b>etiqueta 802.1Q</b> (4 bytes, VLAN 10) e o FCS foi recalculado.</li>';
  h += '<li>Cada camada do receptor conferiu e retirou o cabeçalho que a camada correspondente do emissor tinha acrescentado.</li>';
  h += '<li>Lição: cada nó da rede só sobe até a camada de que precisa. Os endereços de enlace (MAC) valem em um salto, e os de rede (IP) valem de ponta a ponta.</li></ul>';
  return h;
}
