// Texto da aba Experimento e do cabeçalho do cenário.
import type { Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import { HOSTS } from '../model';

/** Texto "Configuração do cenário": só o que o cenário define (o restante vem dos padrões). */
export function setup(s: ScenarioDef): string {
  const V = (s.set || {}) as Record<string, any>;
  if (s.sub === 'marc') return 'VLAN nativa do tronco: ' + V.nat + '; ' + (V.allowed === 'no10' ? 'tronco sem a VLAN 10' : 'todas as VLANs permitidas no tronco');
  if (s.sub === 'seg') return { uni: 'ping do Host A para o Host C', bc: 'broadcast do Host A', cross: 'quadro do Host A com o MAC do Host B' }[V.traffic as 'uni'] || '';
  if (s.sub === 'rota') {
    const m = { ok: 'R1 com as subinterfaces .10 e .20', nosubif: 'R1 sem a subinterface da VLAN 20', poda: 'tronco do R1 sem a VLAN 20' }[V.rmode as 'ok'];
    return 'destino: ' + HOSTS[V.rdst as string].name + '; ' + m;
  }
  if (s.sub === 'nativa') return 'nativa ' + V.nat1 + ' no SW1 e ' + V.nat2 + ' no SW2; origem: ' + HOSTS[V.src as string].name;
  const a = V.hatk === 'double' ? 'duas tags no mesmo quadro' : 'negociação de tronco pelo invasor';
  return a + '; ' + (V.hdef === 'def' ? 'com a defesa' : 'sem defesa');
}

const who = (ks: string[]) => ks.map((k) => HOSTS[k].name).join(', ');

export function explain(tr: Trace): string {
  const R = tr.raw;
  let h = '<ul>';
  if (R.sub === 'marc') {
    if (R.res === 'blocked') {
      h += '<li><span class="chk-bad">O SW1 não encaminhou o quadro:</span> a VLAN 10 não está na lista de VLANs permitidas do tronco.</li>';
      h += '<li>O Host C não recebeu nada. O tráfego da VLAN 20 continuaria passando normalmente.</li>';
    } else if (R.untagged) {
      h += '<li>No tronco o quadro foi <b>sem tag</b>, porque a VLAN 10 é a nativa. O SW2 o devolveu à VLAN 10 pela nativa dele (também 10).</li>';
      h += '<li><span class="chk-ok">Entregue ao Host C.</span></li>';
    } else {
      h += '<li>O Host A enviou um quadro <b>sem tag</b>. No tronco o SW1 inseriu a <b>tag 10</b> (4 bytes a mais), e o SW2 a removeu na porta de acesso.</li>';
      h += '<li><span class="chk-ok">Entregue ao Host C.</span></li>';
    }
    h += '<li>Lição: o host não conhece a VLAN; ela é decidida pela porta e carregada pela tag só entre os switches.</li>';
  } else if (R.sub === 'seg') {
    if (R.res === 'uni') h += '<li><span class="chk-ok">Só o Host C recebeu o quadro.</span> B e D (VLAN 20) não viram nada.</li>';
    else if (R.res === 'bc') h += '<li><span class="chk-ok">O broadcast ficou na VLAN 10:</span> chegou a ' + who(R.delivered) + ' e a nenhum host da VLAN 20.</li>';
    else {
      h += '<li><span class="chk-ok">O Host B não recebeu o quadro:</span> o switch o tratou como tráfego da VLAN 10.</li>';
      h += '<li>Como o MAC do Host B não existe na VLAN 10, o quadro foi inundado nessa VLAN. O Host C o recebeu e o ignorou.</li>';
    }
    h += '<li>Lição: o isolamento é feito pelo switch, VLAN por VLAN, em todos os switches ligados pelo tronco.</li>';
  } else if (R.sub === 'rota') {
    if (R.res === 'ok') {
      h += '<li>O quadro subiu ao R1 com a <b>tag 10</b> e voltou com a <b>tag 20</b>. O R1 trocou os MACs e reduziu o TTL de ' + R.ttlIn + ' para <b>' + R.ttlOut + '</b>.</li>';
      h += '<li><span class="chk-ok">Entregue ao ' + HOSTS[R.rdst].name + '.</span> O mesmo cabo foi usado nos dois sentidos.</li>';
    } else if (R.res === 'noroute') {
      h += '<li><span class="chk-bad">Sem rota para 192.168.20.0/24:</span> o R1 não tem a subinterface da VLAN 20.</li>';
      h += '<li>O Host A recebeu um ICMP Destination Unreachable (RFC 792).</li>';
    } else if (R.res === 'poda') {
      h += '<li><span class="chk-bad">O R1 roteou, mas o SW1 descartou o quadro de volta:</span> o tronco do R1 não permite a VLAN 20.</li>';
    }
    h += '<li>Lição: o router-on-a-stick usa um único enlace como tronco e uma subinterface por VLAN, e esse enlace é o gargalo.</li>';
  } else if (R.sub === 'nativa') {
    if (R.res === 'leak') {
      h += '<li><span class="chk-bad">O quadro mudou de VLAN no tronco:</span> saiu sem tag da VLAN ' + R.nat1 + ' e o SW2, com nativa ' + R.nat2 + ', o classificou nessa VLAN.</li>';
      h += '<li>O destino não recebeu.' + (R.leakedTo.length ? ' O quadro vazou para ' + who(R.leakedTo) + ', que o ignorou pelo MAC (um sniffer o leria).' : '') + '</li>';
    } else if (R.res === 'ok-untag') {
      h += '<li><span class="chk-ok">Entregue.</span> O quadro foi sem tag no tronco, e as duas pontas concordam sobre a nativa.</li>';
    } else {
      h += '<li><span class="chk-ok">Entregue.</span> O quadro foi com tag, então a divergência da nativa não o afetou.</li>';
    }
    h += '<li>Lição: a VLAN nativa deve ser idêntica nas duas pontas do tronco. A divergência só afeta os quadros sem tag.</li>';
  } else {
    if (R.res === 'spoof-ok') h += '<li><span class="chk-bad">O SW1 aceitou o tronco:</span> a porta do invasor passou a aceitar quadros de qualquer VLAN, e o quadro marcado com a VLAN 20 chegou ao Host D.</li>';
    else if (R.res === 'spoof-def') h += '<li><span class="chk-ok">Ataque barrado:</span> a porta é fixa em acesso, ignorou o pedido e descartou o quadro marcado com outra VLAN.</li>';
    else if (R.res === 'dbl-ok') h += '<li><span class="chk-bad">A tag externa foi removida no tronco</span> (a nativa é a VLAN do invasor), e o SW2 obedeceu à interna: o quadro chegou à VLAN 20. A resposta não voltaria.</li>';
    else h += '<li><span class="chk-ok">Nenhuma entrega na VLAN 20:</span> o tronco manteve as duas tags, e o SW2 usou a externa (VLAN 10).</li>';
    h += '<li>Lição: portas de usuário fixas em acesso, nativa dedicada e sem hosts, e só as VLANs necessárias no tronco.</li>';
  }
  return h + '</ul>';
}
