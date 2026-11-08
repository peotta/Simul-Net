// Texto da aba Experimento e do cabeçalho do cenário do simulador de TCP e UDP.
// Os parâmetros P são os do motor (perdas em fração, descartes como lista de números).
import { esc, plural, type Trace } from '../../../sim-core';
import type { ScenarioDef } from '../../../sim-core/ui';
import { MSS, fmtMs, listSeg } from '../sim';

const sp = (a: unknown[], s: string, p: string): string => (a.length === 1 ? s : p);
const f1 = (v: number): string => (Math.round(v * 10) / 10).toString().replace('.', ',');
const ul = (a: string[]): string => '<ul>' + a.map((x) => '<li>' + x + '</li>').join('') + '</ul>';

/** Texto "Configuração do cenário": só o que o cenário define. */
export function setup(s: ScenarioDef): string {
  const c = (s.set || {}) as Record<string, any>;
  let t: string;
  if (s.sub === 'dl') {
    t = ['Download de ' + c.file + ' MB por TCP', 'RTT de ' + c.rtt + ' ms', 'enlace de ' + c.bw + ' Mbps', c.loss ? c.loss + '% de perda' : 'sem perda aleatória', 'janela inicial ' + c.iw + ', rwnd ' + c.rwnd, 'SACK ' + (c.sack ? 'ligado' : 'desligado')].join('; ');
  } else if (s.sub === 'vid') {
    t = ['Vídeo de ' + c.vdur + ' s a ' + c.vbr + ' kbit/s por UDP', 'RTT de ' + c.rtt + ' ms', 'enlace de ' + c.bw + ' Mbps', c.loss ? c.loss + '% de perda' : 'sem perda aleatória', 'jitter de até ' + c.jit + ' ms', 'buffer do player de ' + c.jb + ' ms'].join('; ');
  } else {
    const parts: string[] = [s.sub === 'tcp' ? 'TCP' : s.sub === 'cmp' ? 'Comparação TCP x UDP' : 'UDP (' + (s.sub === 'dns' ? 'DNS' : 'fluxo de mídia') + ')'];
    if (c.N !== undefined) parts.push(c.N + ' segmentos de 1000 bytes');
    parts.push(c.loss ? c.loss + '% de perda' : 'sem perda aleatória');
    if (c.drops) parts.push('descarte forçado do #' + String(c.drops).split(',').map((x) => x.trim()).join(', #'));
    if (c.reorder) parts.push(c.reorder + '% de reordenação');
    if (c.rtt) parts.push('RTT de ' + c.rtt + ' ms, enlace de ' + c.bw + ' Mbps');
    if (s.sub !== 'stream' && s.sub !== 'dns' && c.iw) parts.push('janela inicial ' + c.iw + ', rwnd ' + c.rwnd + ', ssthresh ' + c.ssth + ', SACK ' + (c.sack ? 'ligado' : 'desligado'));
    t = parts.join('; ');
  }
  return t;
}

function explainConfig(P: any, withTcp: boolean): string {
  const tx = (MSS * 8) / (P.bw * 1000);
  const bdp = (P.bw * P.rtt) / 8;
  const pct = (v: number): string => Math.round(v * 100) + '%';
  let h = '<p>O cliente envia ' + plural(P.N, 'segmento', 'segmentos') + ' de 1000 bytes (' + P.N + ' kB) por um enlace de <b>' + P.bw + ' Mbps</b> com <b>RTT de ' + P.rtt + ' ms</b>. Cada segmento leva ' + fmtMs(tx) + ' para ser transmitido e mais ' + fmtMs(P.rtt / 2) + ' para atravessar a rede. O produto banda × RTT é de <b>' + f1(bdp) + (bdp === 1 ? ' segmento' : ' segmentos') + '</b>: é o volume que precisa estar em voo para manter o enlace ocupado o tempo todo.</p>';
  const net: string[] = [P.loss ? 'perda aleatória de ' + pct(P.loss) + ' (semente ' + P.seed + ')' : 'sem perda aleatória'];
  if (P.drops.length) net.push('descarte forçado na 1ª transmissão de ' + listSeg(P.drops));
  if (P.reorder) net.push(pct(P.reorder) + ' dos pacotes atrasados (reordenação)');
  if (withTcp && P.ackLoss && P.loss) net.push('perda também nos ACKs');
  h += '<p>Condições da rede: ' + net.join('; ') + '.';
  if (withTcp) h += ' TCP com janela inicial de ' + plural(P.iw, 'segmento', 'segmentos') + ', janela do receptor (rwnd) de ' + P.rwnd + ' e ssthresh inicial de ' + P.ssth + '. SACK ' + (P.sack ? 'ligado' : 'desligado (recuperação NewReno)') + '.';
  return h + '</p>';
}

function explainTcp(sim: any, P: any): string {
  const r = sim.raw;
  const bdp = (P.bw * P.rtt) / 8;
  const cap = P.bw * 1000;
  let h = '<p><b>Abertura.</b> A conexão começou com SYN, SYN-ACK e ACK. O primeiro byte de dados só saiu em ' + fmtMs(r.start) + ', ou seja, 1 RTT gasto apenas para combinar a conexão.</p>';
  let g = '<p><b>Janela de congestionamento.</b> A cwnd começou em ' + plural(P.iw, 'segmento', 'segmentos') + ' e cresceu em slow start, 1 segmento a cada ACK';
  if (r.caAt !== null) g += ', até atingir o ssthresh em ' + fmtMs(r.caAt) + '. A partir daí passou ao crescimento linear (congestion avoidance), cerca de 1 segmento por RTT';
  g += '. O maior valor alcançado foi ' + f1(r.maxCwnd) + ' segmentos.';
  if (r.maxCwnd > P.rwnd && r.maxFlight >= P.rwnd) g += ' Mesmo assim, nunca houve mais de ' + P.rwnd + ' segmentos em voo: o limite foi a <b>janela do receptor</b> (controle de fluxo), e não a rede.';
  if (r.maxFlight > Math.ceil(bdp) + 1) g += ' Como o produto banda × RTT é pequeno, poucos segmentos em voo já ocupavam o enlace; o restante esperava na fila de transmissão do cliente.';
  h += g + '</p>';
  if (!r.lostList.length && !r.lostAcks) {
    h += '<p><b>Perdas.</b> Nenhum segmento se perdeu, então não houve retransmissão: cada ACK confirmou dados novos e liberou novos envios (ACK clocking).</p>';
  } else {
    let p = '<p><b>Perdas e recuperação.</b> ';
    const uniq: number[] = (Array.from(new Set(r.lostList)) as number[]).sort((x, y) => x - y);
    if (r.lostList.length) p += (r.lostList.length === 1 ? 'Perdeu-se' : 'Perderam-se') + ' na rede ' + plural(r.lostList.length, 'transmissão', 'transmissões') + ' de dados (' + sp(uniq, 'segmento ', 'segmentos ') + listSeg(uniq) + '). ';
    if (r.fastList.length) p += sp(r.fastList, 'O segmento ', 'Os segmentos ') + listSeg(r.fastList) + sp(r.fastList, ' foi recuperado', ' foram recuperados') + ' por <b>fast retransmit</b>: os segmentos seguintes chegaram fora de ordem, o servidor repetiu o ACK do que faltava e, no terceiro ACK duplicado, o cliente retransmitiu sem esperar o temporizador, reduzindo o ssthresh à metade do que estava em voo (fast recovery). ';
    if (r.rtoList.length) p += sp(r.rtoList, 'O segmento ', 'Os segmentos ') + listSeg(r.rtoList) + sp(r.rtoList, ' só foi recuperado', ' só foram recuperados') + ' por <b>timeout</b>: não havia segmentos suficientes depois ' + sp(r.rtoList, 'dele', 'deles') + ' para gerar três ACKs duplicados, então o cliente esperou o RTO (' + r.rtoVals.map(fmtMs).join(', ') + '), voltou a cwnd para 1 e dobrou o RTO (backoff). ';
    if (r.lostAcks) p += 'Também se perderam ' + plural(r.lostAcks, 'ACK', 'ACKs') + ', sem grande efeito, porque o ACK seguinte, cumulativo, confirma o mesmo dado. ';
    h += p + '</p>';
  }
  if (P.sack) h += '<p><b>Confirmação seletiva (SACK).</b> O SACK foi negociado no handshake (SACK_PERM). ' + (r.sackAcks ? 'Os ACKs duplicados trouxeram blocos SLE e SRE (' + plural(r.sackAcks, 'ACK com blocos', 'ACKs com blocos') + '): os intervalos de bytes que já tinham chegado além da lacuna. ' : 'Nesta execução não houve segmentos fora de ordem, então nenhum ACK precisou de blocos. ') + 'Com o placar do que o receptor tem, o emissor repõe só os buracos, vários na mesma janela de uma vez, em vez de um por RTT (NewReno).</p>';
  else if (r.fastList.length > 1) h += '<p><b>Sem SACK.</b> O emissor só sabe até onde o ACK cumulativo chegou. Com mais de uma perda na mesma janela, o NewReno repõe um segmento por RTT (cada ACK parcial revela o próximo buraco). Ligue o SACK e compare o tempo total.</p>';
  const eff = r.dur ? Math.round(((r.N * MSS * 8) / r.dur / cap) * 100) : 0;
  h += '<p><b>Resultado.</b> Os ' + r.N + ' segmentos chegaram à aplicação, completos e em ordem. A transferência de dados levou ' + fmtMs(r.dur) + ' e a conexão inteira, com abertura e encerramento, ' + fmtMs(sim.end) + '. A vazão útil foi de ' + (r.dur ? Math.round((r.N * MSS * 8) / r.dur) : 0) + ' kbit/s, ou ' + eff + '% da capacidade do enlace.';
  const why: string[] = [];
  if ((r.N * MSS * 8) / cap < P.rtt * 3) why.push('a transferência é curta e boa parte do tempo vai para o slow start, quando a janela ainda é pequena');
  if (r.rtoList.length) why.push('cada timeout deixou o enlace parado esperando o RTO');
  if (r.fastList.length) why.push('cada perda reduziu a janela à metade');
  if (P.rwnd < bdp) why.push('a rwnd é menor que o produto banda × RTT');
  if (eff < 85 && why.length) h += ' A eficiência ficou abaixo do máximo porque ' + why.join('; ') + '.';
  return h + '</p>';
}

function explainUdp(sim: any, P: any): string {
  const r = sim.raw;
  const tx = (MSS * 8) / (P.bw * 1000);
  let h = '<p><b>Envio.</b> Sem handshake, o primeiro datagrama saiu no instante 0. Os ' + r.N + ' datagramas foram enviados um a cada ' + fmtMs(tx) + ', sem esperar nenhuma confirmação, e o envio terminou em ' + fmtMs(r.N * tx) + '.</p>';
  if (r.lostList.length) h += '<p><b>Perdas.</b> ' + sp(r.lostList, 'O datagrama ', 'Os datagramas ') + listSeg(r.lostList) + sp(r.lostList, ' se perdeu', ' se perderam') + ' e <b>ninguém percebeu</b>: o UDP não tem ACK, número de sequência nem retransmissão. Só a aplicação poderia notar a falta.</p>';
  else h += '<p><b>Perdas.</b> Nenhum datagrama se perdeu nesta execução. Se houvesse perda, o UDP não a detectaria.</p>';
  if (r.oooList.length) h += '<p><b>Ordem.</b> ' + sp(r.oooList, 'O datagrama ', 'Os datagramas ') + listSeg(r.oooList) + sp(r.oooList, ' chegou depois de outros enviados mais tarde e foi entregue', ' chegaram depois de outros enviados mais tarde e foram entregues') + ' à aplicação nessa ordem trocada.</p>';
  h += '<p><b>Resultado.</b> A aplicação recebeu ' + r.delivered + ' de ' + r.N + ' datagramas, e o último chegou em ' + fmtMs(r.time) + '. ' + (r.lostList.length ? 'Para voz ou vídeo, isso é aceitável: um trecho perdido vira um pequeno ruído, e esperar por ele atrasaria todo o resto. Para um arquivo, faltariam pedaços e ele estaria corrompido.' : 'Mesmo sem perdas aqui, nada garante a entrega numa próxima execução.') + '</p>';
  return h;
}

function explainDns(sim: any, P: any): string {
  const r = sim.raw;
  let h = '<p>O cliente envia uma consulta DNS (um único datagrama UDP para a porta 53) e espera a resposta por até 1 s.</p>';
  if (r.attempts === 1 && r.ok) h += '<p>A consulta e a resposta chegaram na primeira tentativa: a resolução custou só 1 RTT (' + P.rtt + ' ms), sem nenhum handshake.</p>';
  else h += '<p>' + (r.lostQ.length ? sp(r.lostQ, 'A consulta da tentativa ', 'As consultas das tentativas ') + r.lostQ.join(' e ') + sp(r.lostQ, ' se perdeu. ', ' se perderam. ') : '') + (r.lostR.length ? sp(r.lostR, 'A resposta da tentativa ', 'As respostas das tentativas ') + r.lostR.join(' e ') + sp(r.lostR, ' se perdeu. ', ' se perderam. ') : '') + 'O UDP não percebe a perda: quem percebe é o resolvedor, que esperou 1 s sem resposta e repetiu a consulta. ' + (r.ok ? 'Na tentativa ' + r.attempts + ', o nome foi resolvido.' : 'Depois de 3 tentativas, desistiu.') + '</p>';
  h += '<p>Esse é o padrão de quem usa UDP: a confiabilidade, quando necessária, é implementada pela aplicação, que escolhe o tempo de espera e o número de repetições.</p>';
  return h;
}

function explainConfigApp(P: any, sub: string): string {
  const net: string[] = [P.loss ? 'perda aleatória de ' + Math.round(P.loss * 100) + '% (semente ' + P.seed + ')' : 'sem perda aleatória'];
  if (sub === 'dl') {
    const tx = (MSS * 8) / (P.bw * 1000);
    const bdp = Math.ceil(P.rtt / tx);
    const q = Math.max(20, bdp);
    if (P.drops.length) net.push('descarte forçado na 1ª transmissão de ' + listSeg(P.drops));
    return '<p>O cliente baixa um arquivo de <b>' + P.file + ' MB</b> (' + P.file * 1000 + ' segmentos de 1000 bytes) de um servidor HTTP, por um enlace de <b>' + P.bw + ' Mbps</b> com <b>RTT de ' + P.rtt + ' ms</b>. O enlace comporta cerca de <b>' + bdp + ' segmentos em voo</b> (produto banda × RTT) e a fila do roteador guarda mais ' + q + ', então a rede aguenta até ' + (bdp + q) + ' segmentos em voo antes de descartar.</p>' +
      '<p>Condições da rede: ' + net.join('; ') + '. TCP com janela inicial de ' + plural(P.iw, 'segmento', 'segmentos') + ', janela do receptor (rwnd) de ' + P.rwnd + ' e ssthresh inicial ' + (P.ssth >= 1000 ? 'sem limite' : 'de ' + P.ssth) + '. ' + (P.sack ? 'A recuperação de perdas usa SACK, como as pilhas atuais.' : 'Sem SACK: a recuperação segue o NewReno, repondo um segmento por RTT.') + '</p>';
  }
  if (P.reorder) net.push(Math.round(P.reorder * 100) + '% dos pacotes atrasados em 60 ms (reordenação)');
  return '<p>O servidor transmite <b>' + P.vdur + ' s</b> de vídeo a <b>' + P.vbr + ' kbit/s</b> (25 quadros por segundo, um quadro I por segundo) por UDP, por um enlace de <b>' + P.bw + ' Mbps</b> com RTT de ' + P.rtt + ' ms. O player espera <b>' + P.jb + ' ms</b> (buffer) antes de exibir cada quadro, e a rede acrescenta até <b>' + P.jit + ' ms</b> de jitter a cada pacote.</p>' +
    '<p>Condições da rede: ' + net.join('; ') + '. A fila do enlace descarta pacotes quando o atraso de espera passa de 100 ms.</p>';
}

function explainDownload(sim: any, P: any): string {
  const r = sim.raw;
  let h = '<p><b>Abertura e pedido.</b> O handshake custou 1 RTT (' + P.rtt + ' ms). O cliente enviou o pedido HTTP junto com o ACK final e o servidor só pôde começar a responder em ' + fmtMs(1.5 * P.rtt) + '. O primeiro byte chegou em <b>' + fmtMs(r.ttfb) + '</b>, 2 RTT depois do início: é o custo fixo de toda conexão nova, mesmo para um arquivo pequeno.</p>';
  let g = '<p><b>Crescimento da janela.</b> O servidor começou com ' + plural(r.first, 'segmento', 'segmentos') + ' na primeira rodada e dobrou a janela a cada RTT (slow start).';
  if (r.caAt !== null) g += ' Ao atingir o ssthresh, passou a crescer cerca de 1 segmento por RTT (congestion avoidance).';
  h += g + ' A maior janela usada foi de <b>' + r.maxW + ' segmentos</b>, em ' + plural(r.rounds, 'rodada', 'rodadas') + ' no total (o diagrama mostra ' + r.shown + ').</p>';
  let p = '<p><b>Capacidade do caminho e perdas.</b> O enlace comporta ' + r.bdp + ' segmentos em voo e a fila do roteador mais ' + r.qmax + ', ou seja, ' + r.cap + ' no total. ';
  if (r.queueLoss) p += 'Na rodada ' + r.qFirst + ', a janela passou desse limite: o excesso foi descartado no fim da fila (tail drop), ' + plural(r.queueLoss, 'segmento', 'segmentos') + ' ao todo. O TCP não vê a fila: só percebe a perda e reduz a janela. ';
  else if (r.maxW < r.cap) p += 'A janela nunca chegou a esse limite, então a fila não estourou. ';
  if (r.randLoss) p += plural(r.randLoss, 'segmento perdido', 'segmentos perdidos') + ' por perda aleatória. ';
  if (r.fast) p += 'Houve ' + plural(r.fast, 'recuperação', 'recuperações') + ' por <b>fast retransmit</b> (3 ACKs duplicados' + (P.sack ? ', com SACK' : '') + '), cada uma cortando a janela à metade. ' + (P.sack ? '' : 'Sem SACK, cada segmento perdido da janela custou um RTT de recuperação (NewReno). ');
  if (r.tlp) p += 'Em ' + plural(r.tlp, 'rodada', 'rodadas') + ', a perda atingiu o <b>fim da janela</b>: não sobrou segmento depois dela para gerar ACKs duplicados. O servidor percebeu pela <b>sonda de cauda</b> (TLP, RFC 8985), cerca de 2 RTT depois, em vez de esperar o RTO, e também cortou a janela à metade. ';
  if (r.rto) p += 'Houve ' + plural(r.rto, 'timeout', 'timeouts') + ' (RTO): a janela volta a 1 e a transferência para, esperando o temporizador. ';
  if (!r.queueLoss && !r.randLoss) p += 'Nenhum segmento foi retransmitido.';
  h += p + '</p>';
  let lim: string;
  if (r.rwndRounds >= r.rounds * 0.5 && r.rounds > 3 && P.rwnd < r.cap) lim = 'A transferência ficou <b>limitada pela janela do receptor</b>: com rwnd de ' + P.rwnd + ' segmentos e RTT de ' + P.rtt + ' ms, o máximo é rwnd × 1000 bytes / RTT = ' + Math.round((P.rwnd * MSS * 8) / P.rtt) + ' kbit/s, bem abaixo dos ' + P.bw * 1000 + ' kbit/s do enlace.';
  else if (r.randLoss > 0 && r.queueLoss === 0) lim = 'A vazão ficou <b>limitada pelas perdas</b>: cada perda cortou a janela, que não teve tempo de crescer até encher o enlace.';
  else if (r.eff >= 85) lim = 'O enlace foi <b>bem aproveitado</b>: a janela ocupou a capacidade do caminho durante quase todo o tempo.';
  else if (r.rounds <= 12) lim = 'O arquivo é <b>curto para este caminho</b>: o handshake e o slow start consumiram a maior parte do tempo, e a janela mal chegou a encher o enlace.';
  else lim = 'O tempo foi dominado pelo <b>slow start e pela recuperação das perdas</b>: depois de cada corte, a janela precisou crescer de novo.';
  h += '<p><b>O que limitou a transferência.</b> ' + lim + '</p>';
  h += '<p><b>Resultado.</b> O arquivo chegou completo e em ordem em ' + fmtMs(r.time) + '. A vazão útil foi de <b>' + r.goodput + ' kbit/s</b>, ' + r.eff + '% do que o enlace entregaria se estivesse cheio desde o primeiro byte (' + fmtMs(r.ideal) + '). Foram retransmitidos ' + plural(r.retx, 'segmento', 'segmentos') + ' (' + f1((r.retx / r.N) * 100) + '% do arquivo).</p>';
  return h;
}

function explainVideo(sim: any, P: any): string {
  const r = sim.raw;
  const fr = sim.frames;
  const I = fr[0];
  const Pf = fr[1] || fr[0];
  const N = r.N;
  let h = '<p><b>Codificação e envio.</b> Um quadro I tem ' + I.bytes + ' bytes (' + plural(I.np, 'pacote', 'pacotes') + ' RTP de até 1200 bytes) e um quadro P cerca de ' + Pf.bytes + ' bytes (' + plural(Pf.np, 'pacote', 'pacotes') + '). Os pacotes de cada quadro saem espaçados ao longo dos 40 ms do quadro. O vídeo gerou <b>' + r.pk + ' pacotes</b> (' + r.sent + ' kbit/s em média) em ' + P.vdur + ' s, sem handshake e sem nenhuma confirmação.</p>';
  let p = '<p><b>Rede.</b> ';
  if (r.queue) p += plural(r.queue, 'pacote foi descartado', 'pacotes foram descartados') + ' porque a fila do enlace passou de 100 ms: o vídeo (' + P.vbr + ' kbit/s, com picos de cerca de ' + Math.round((I.bytes * 8) / 40) + ' kbit/s no quadro I) excede o que o enlace de ' + P.bw + ' Mbps entrega, e o UDP não reduz a taxa, pois não tem controle de congestionamento. ';
  else p += 'A fila do enlace nunca passou de 100 ms, então nenhum pacote foi descartado por congestionamento. ';
  if (r.rand) p += plural(r.rand, 'pacote se perdeu', 'pacotes se perderam') + ' por perda aleatória. ';
  p += 'O jitter estimado pelo player (RFC 3550) foi de ' + f1(r.jitter) + ' ms e o atraso médio de rede, de ' + f1(r.delay) + ' ms.';
  h += p + '</p>';
  h += '<p><b>Buffer de reprodução.</b> O player espera ' + P.jb + ' ms antes de exibir cada quadro, para absorver as variações de atraso. ' + (r.late ? plural(r.late, 'pacote chegou', 'pacotes chegaram') + ' depois do prazo e ' + (r.late === 1 ? 'foi descartado' : 'foram descartados') + ': o atraso extra (fila mais jitter de até ' + P.jit + ' ms) passou do que o buffer cobre. Um buffer maior descartaria menos, ao custo de mais atraso (hoje ' + f1(r.display) + ' ms entre o envio e a exibição).' : 'Nenhum pacote chegou fora do prazo. O custo foi um atraso de ' + f1(r.display) + ' ms entre o envio de cada quadro e a sua exibição.') + '</p>';
  let e = '<p><b>Efeito na imagem.</b> ';
  if (r.cnt.ok === N) e += 'Todos os ' + N + ' quadros foram exibidos sem defeito.';
  else {
    e += r.cnt.ok + ' de ' + N + ' quadros saíram sem defeito';
    if (r.cnt.artefatos) e += '; ' + r.cnt.artefatos + ' foram exibidos com artefatos';
    if (r.cnt.congelado) e += '; ' + r.cnt.congelado + ' ficaram congelados (' + r.frozenMs + ' ms de imagem parada)';
    e += '. Um pacote perdido num quadro P deixa só aquele quadro incompleto, mas os seguintes dependem dele, então o defeito se propaga até o próximo quadro I (no máximo 1 s). Quando é o quadro I que perde pacote, o player não consegue decodificar e congela a imagem até o próximo I.';
    if (r.iBad) e += ' Aqui, ' + plural(r.iBad, 'quadro I ficou incompleto', 'quadros I ficaram incompletos') + ' (de ' + r.iFrames + ').';
  }
  h += e + '</p>';
  h += '<p><b>Resultado.</b> Nada foi retransmitido, e isso é intencional: em vídeo ao vivo, um pacote retransmitido chegaria depois do instante de exibição do seu quadro. A taxa entregue a tempo foi de ' + r.recv + ' kbit/s, contra ' + r.sent + ' kbit/s enviados.</p>';
  return h;
}

function explainConcepts(sims: any[], P: any): string {
  const c: string[] = [];
  sims.forEach((sim) => {
    const r = sim.raw;
    if (r.kind === 'download') {
      c.push('<b>Handshake e pedido HTTP</b>: 2 RTT até o primeiro byte', '<b>Slow start</b>: a janela dobra a cada RTT');
      if (r.caAt !== null) c.push('<b>Congestion avoidance</b>: crescimento linear acima do ssthresh');
      c.push('<b>Produto banda × RTT</b> e fila do roteador: a capacidade do caminho');
      if (r.queueLoss) c.push('<b>Tail drop</b>: a fila cheia descarta o excesso, e o TCP percebe só a perda');
      if (r.fast) c.push('<b>Fast retransmit</b> com <b>SACK</b>: reposição de várias lacunas em cerca de 1 RTT');
      if (r.tlp) c.push('<b>Sonda de cauda</b> (TLP/RACK): perdas no fim da janela sem esperar o RTO');
      if (r.rto) c.push('<b>Timeout (RTO)</b> e <b>backoff exponencial</b>');
      if (r.rwndRounds >= r.rounds * 0.5 && P.rwnd < r.cap) c.push('<b>Controle de fluxo</b>: a rwnd limitou a vazão');
    } else if (r.kind === 'video') {
      c.push('<b>RTP sobre UDP</b>: sequência e marca de tempo, sem retransmissão', '<b>Quadros I e P</b>: o I é completo e grande; o P depende dos anteriores', '<b>Buffer de reprodução</b> (jitter buffer): troca atraso por fluidez', '<b>Jitter</b> (RFC 3550): variação do atraso entre pacotes');
      if (r.rand || r.queue) c.push('<b>Perda sem recuperação</b>: artefatos e congelamento da imagem');
      if (r.queue) c.push('<b>Ausência de controle de congestionamento</b> no UDP: o excesso é descartado na fila');
    } else if (sim.proto === 'TCP') {
      c.push('<b>Three-way handshake</b> e <b>encerramento</b> com FIN e TIME_WAIT', '<b>Slow start</b>: a janela cresce 1 segmento por ACK');
      if (r.sack) c.push('<b>SACK</b> (RFC 2018): blocos SLE e SRE e recuperação só dos buracos');
      if (r.caAt !== null) c.push('<b>Congestion avoidance</b>: crescimento linear acima do ssthresh');
      if (r.maxCwnd > P.rwnd && r.maxFlight >= P.rwnd) c.push('<b>Controle de fluxo</b>: a rwnd limitou o envio');
      if (r.fastList.length) c.push('<b>ACKs duplicados</b>, <b>fast retransmit</b> e <b>fast recovery</b>');
      if (r.rtoList.length) c.push('<b>Timeout (RTO)</b> e <b>backoff exponencial</b>');
      if (r.oooSeen) c.push('<b>Buffer do receptor</b> guardando segmentos fora de ordem');
    } else if (r.kind === 'dns') {
      c.push('<b>Confiabilidade na aplicação</b>: timeout e repetição feitos pelo resolvedor DNS');
    } else {
      c.push('<b>Datagramas independentes</b>: sem conexão, sem ACK e sem retransmissão');
      if (r.lostList.length) c.push('<b>Perda não recuperada</b> no UDP');
      if (r.oooList.length) c.push('<b>Entrega fora de ordem</b> no UDP');
    }
  });
  return ul(Array.from(new Set(c)));
}

function explainNext(sims: any[], P: any, sub: string): string {
  const s: string[] = [];
  const r = sims[0].raw;
  if (sub === 'dl') {
    if (!r.randLoss) s.push('Coloque <b>1%</b> de perda: a janela passa a ser cortada com frequência e a vazão cai bem abaixo da capacidade do enlace.');
    if (P.rwnd > 16) s.push('Reduza a <b>rwnd para 16</b> com RTT de 100 ms e veja a janela do receptor limitar a vazão.');
    if (P.rtt < 100) s.push('Aumente o <b>RTT</b> para 200 ms: o handshake e o slow start passam a dominar o tempo.');
    if (P.bw < 20) s.push('Suba a <b>banda</b> para 50 Mbps: o enlace passa a ser mais rápido que o TCP consegue aproveitar em um arquivo curto.');
    s.push('Use <b>Descartar na 1ª transmissão</b> com "#5" para ver uma perda isolada e a recuperação por fast retransmit.');
    return ul(s.slice(0, 4));
  }
  if (sub === 'vid') {
    if (P.jb < 400) s.push('Aumente o <b>buffer do player</b> para 400 ms e veja menos pacotes chegarem fora do prazo, ao custo de mais atraso.');
    if (!P.loss) s.push('Coloque <b>3%</b> de perda e troque a semente: veja onde caem os quadros com artefatos e os congelamentos.');
    if (P.vbr < 4000 || P.bw > 2) s.push('Use <b>4000 kbit/s</b> com banda de <b>2 Mbps</b>: o UDP não reduz o envio e o excesso é descartado.');
    if (P.jit < 80) s.push('Suba o <b>jitter</b> para 80 ms com buffer de 20 ms para ver os pacotes tardios.');
    s.push('Compare com o <b>download</b>: lá, o TCP reduz a janela quando perde; aqui o envio segue igual.');
    return ul(s.slice(0, 4));
  }
  if (sub === 'tcp' || sub === 'cmp') {
    if (!r.sack && r.fastList.length > 1) s.push('Ligue o <b>SACK</b> e repita: as várias perdas da janela são repostas juntas, em cerca de 1 RTT.');
    if (!r.lostList.length) s.push('Escolha <b>#8</b> em "Descartar na 1ª transmissão" (com janela inicial de 4) para provocar um fast retransmit.');
    if (!r.rtoList.length) s.push('Descarte o <b>último</b> segmento para ver por que ele só é recuperado por timeout.');
    if (r.caAt === null) s.push('Mude o ssthresh inicial para <b>8</b> para ver a passagem do slow start ao crescimento linear.');
    if (P.rwnd > 4) s.push('Reduza a <b>rwnd para 4</b> e compare o tempo total: é o controle de fluxo limitando o envio.');
    s.push('Aumente o <b>RTT</b> para 100 ms e observe como o handshake e o slow start passam a dominar o tempo.');
  }
  if (sub === 'stream') s.push('Use o modo <b>Comparação</b> com os mesmos parâmetros e veja o TCP recuperar as mesmas perdas.');
  if (sub === 'dns') s.push('Coloque <b>30%</b> de perda e troque a semente até a resolução falhar nas 3 tentativas.');
  if (sub === 'cmp') s.push('Troque a <b>semente</b> para comparar os dois protocolos com outras sequências de perdas.');
  return ul(s.slice(0, 4));
}

const GOAL: Record<string, string> = {
  dl: 'Observar como o TCP baixa um arquivo: abertura, crescimento da janela, perdas por fila cheia e recuperação.',
  vid: 'Observar como um vídeo ao vivo sobre UDP lida com perdas, atraso e jitter, sem retransmissão.',
  cmp: 'Comparar TCP e UDP transmitindo os mesmos dados pela mesma rede, com as mesmas perdas.',
  tcp: 'Observar como o TCP abre a conexão, controla quanto envia e garante a entrega de um arquivo.',
  dns: 'Observar como uma aplicação sobre UDP lida com a perda de uma consulta.',
  stream: 'Observar como o UDP entrega datagramas sem conexão e sem garantias.',
};

export function explain(tr: Trace): string {
  const R = tr.raw;
  const P = R.P;
  const sub = R.sub as string;
  const sims = R.sims as any[];
  let h = '<h3>Objetivo</h3><p>' + GOAL[sub] + '</p>';
  h += '<h3>Configuração</h3>';
  if (sub === 'dl' || sub === 'vid') h += explainConfigApp(P, sub);
  else if (sub === 'dns') h += '<p>RTT de ' + P.rtt + ' ms; ' + (P.loss ? 'perda aleatória de ' + Math.round(P.loss * 100) + '% (semente ' + P.seed + ')' : 'sem perda aleatória') + (P.drops.includes(1) ? '; a primeira consulta é descartada' : '') + '.</p>';
  else h += explainConfig(P, sub !== 'stream');
  h += '<h3>O que aconteceu</h3>';
  if (sub === 'cmp') {
    const t = sims[0];
    const u = sims[1];
    h += '<h3>No TCP</h3>' + explainTcp(t, P) + '<h3>No UDP</h3>' + explainUdp(u, P);
    h += '<h3>Comparação</h3><p>O UDP terminou em ' + fmtMs(u.raw.time) + ' e o TCP em ' + fmtMs(t.end) + ', ' + (t.end / Math.max(u.raw.time, 1)).toFixed(1).replace('.', ',') + ' vezes mais. Em troca, o TCP entregou ' + t.raw.N + ' de ' + t.raw.N + ' segmentos em ordem, enquanto o UDP entregou ' + u.raw.delivered + ' de ' + u.raw.N + '. O tempo extra do TCP vem ' + (t.raw.lostList.length ? 'do handshake (1 RTT), do slow start, da recuperação das perdas e do encerramento' : 'do handshake (1 RTT), do slow start e do encerramento') + '. Nenhum dos dois é melhor em geral: transferência de arquivos precisa do TCP; voz e vídeo em tempo real preferem o UDP.</p>';
  } else if (sub === 'dl') h += explainDownload(sims[0], P);
  else if (sub === 'vid') h += explainVideo(sims[0], P);
  else if (sub === 'tcp') h += explainTcp(sims[0], P);
  else h += sub === 'dns' ? explainDns(sims[0], P) : explainUdp(sims[0], P);
  h += '<h3>Conceitos observados</h3>' + explainConcepts(sims, P);
  h += '<h3>Para explorar em seguida</h3>' + explainNext(sims, P, sub);
  return h;
}

void esc;
