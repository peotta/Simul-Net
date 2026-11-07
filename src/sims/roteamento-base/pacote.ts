// Encaminhamento de um pacote IP de um PC ao outro, salto a salto, pelo caminho que as tabelas de rotas indicam.
import { COLORS, type Field, type Trace } from '../../sim-core';
import type { HostDef } from './topologia';

export const PC_IP: Record<string, string> = { 'PC-A': '192.168.1.10', 'PC-B': '192.168.2.10' };
const HOP_MS = 2;

/** Registra o pacote percorrendo o caminho. Devolve true se chegou ao destino. */
export function emitPacket(tr: Trace, src: HostDef, dst: HostDef, path: string[], reached: boolean, proto: string): boolean {
  tr.phase('Pacote ' + src.id + ' → ' + dst.id, 'pacote');
  const hops = [src.id, ...path, ...(reached ? [dst.id] : [])];
  let ttl = 64;
  tr.ev(tr.t, src.id, 'Envia um pacote IP para ' + dst.id + ' (' + PC_IP[dst.id] + ') pelo gateway ' + src.attach, '');
  for (let i = 0; i + 1 < hops.length; i++) {
    const a = hops[i];
    const b = hops[i + 1];
    if (i > 0) ttl--;
    const fields: Field[] = [{ sec: 'IPv4' }, ['Origem', PC_IP[src.id]], ['Destino', PC_IP[dst.id]], ['TTL', String(ttl), 'decrementado por cada roteador (RFC 1812, seção 5.3.1)'], ['Protocolo', '1 (ICMP)', 'dados do teste de comunicação']];
    const m = tr.add(a, b, {
      dur: HOP_MS,
      color: COLORS.data,
      proto: 'IPv4',
      len: 98,
      label: 'IP ttl ' + ttl,
      info: a + ' → ' + b + ': pacote de ' + src.id + ' para ' + dst.id,
      about: i === 0 ? 'O PC envia ao gateway, que é o roteador ao qual está ligado.' : b === dst.id ? 'O último roteador entrega o pacote na rede do destino.' : 'O roteador consulta a própria tabela de rotas e escolhe só o próximo salto, sem conhecer o caminho inteiro (' + proto + ').',
      fields,
      phaseName: 'Pacote',
    });
    if (i > 0) {
      tr.ev(m.tSend, a, 'Encaminha para ' + b + ' (decisão local, pela própria tabela)', '');
    }
    tr.lg(m.tSend, a + ' encaminha para ' + b + '.', 'data');
  }
  if (reached) {
    tr.ev(tr.t, dst.id, 'Recebe o pacote de ' + src.id, 'ok');
    tr.lg(tr.t, 'Pacote de ' + src.id + ' entregue a ' + dst.id + '.', 'conn');
  } else {
    const last = hops[hops.length - 1];
    tr.ev(tr.t, last, 'Sem rota para ' + dst.id + ': descarta o pacote', 'warn');
    tr.lg(tr.t, last + ' não tem rota para ' + dst.id + ': pacote descartado.', 'loss');
  }
  return reached;
}
