// Motor do TCP e do UDP, portado do simulador legado: cada função monta um traço (segmentos, eventos, log, estados,
// amostras da cwnd) a partir dos parâmetros. Os tempos são em ms; a aleatoriedade vem de uma semente fixa, então a
// mesma configuração produz sempre as mesmas perdas. Os tipos são frouxos de propósito: o traço é convertido em Trace
// nativo por modes.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MSS = 1000;
export const MIN_RTO = 200;
export const CLI = { ip: '192.168.10.10', port: 50432, isn: 0x5a1b3c4d };
export const SRV = { ip: '203.0.113.80', isn: 0x1f2e3d4c };
export const COL = { conn: '#5FD4C0', data: '#F2A65A', ack: '#6FB8E8', bad: '#E2574C', resp: '#6FB8E8' };

export const fmtMs = (v: number): string => (Math.round(v * 10) / 10).toString().replace('.', ',') + ' ms';
export const listSeg = (a: number[]): string => a.map((n) => '#' + n).join(', ').replace(/, ([^,]*)$/, ' e $1');
export const synOpts = (P: any): string => (P.sack ? 'MSS=1000, SACK_PERM' : 'MSS=1000');

function rnd(seed: any, kind: any, idx: any, att: any): any {
  let t=((seed*1000003)^(kind.charCodeAt(0)*7919)^(idx*104729)^(att*1299709))>>>0;
  t=(t+0x6D2B79F5)>>>0;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}
function dataLost(P: any, i: any, att: any): any { return (att===0 && P.drops.indexOf(i+1)>=0) || rnd(P.seed,'d',i,att)<P.loss; }
function reorderExtra(P: any, i: any, att: any, tx: any): any { return rnd(P.seed,'r',i,att)<P.reorder ? 2.5*tx+3 : 0; }

// ---------- Estrutura de um traço ----------
function mkTrace(dport: any, svc: any, proto: any, title: any): any {
  return {cols:[{key:'c',label:'Cliente',sub:CLI.ip+':'+CLI.port},{key:'s',label:'Servidor',sub:SRV.ip+':'+dport+' ('+svc+')'}],
    proto:proto,title:title||proto,segs:[] as any[],events:[] as any[],log:[] as any[],states:[] as any[],samples:[] as any[],metro:[] as any[],stats:{},raw:{},end:0};
}
function addSeg(tr: any, o: any): any {
  o.id=tr.segs.length; o.tags=o.tags||[];
  if(o.lost) o.lostFrac=0.5;
  tr.segs.push(o);
  tr.end=Math.max(tr.end,o.lost?o.tSend+(o.tArr-o.tSend)*0.5:o.tArr);
  return o;
}
function ev(tr: any, t: any, who: any, text: any): any { tr.events.push({t:t,who:who,text:text}); tr.end=Math.max(tr.end,t); }
function lg(tr: any, t: any, text: any, tag: any): any { tr.log.push({t:t,text:text,tag:tag||'sys'}); }
function st(tr: any, t: any, who: any, s: any): any { tr.states.push({t:t,who:who,st:s}); }
function makeQueue(){
  const q: any[]=[]; let n=0;
  return {
    at(t: any, fn: any){ q.push({t:t,o:n++,fn:fn}); },
    run(limit: any){
      let g=0;
      while(q.length && g++<limit){
        let b=0;
        for(let i=1;i<q.length;i++) if(q[i].t<q[b].t || (q[i].t===q[b].t && q[i].o<q[b].o)) b=i;
        const e=q.splice(b,1)[0]; e.fn(e.t);
      }
    }
  };
}

// ---------- TCP: transferência de arquivo ----------
function simTcp(P: any, title: any): any {
  const tr=mkTrace(80,'HTTP','TCP',title);
  const ow=P.rtt/2, tx=MSS*8/(P.bw*1000), N=P.N, Q=makeQueue();
  let srtt=P.rtt, rttvar=P.rtt/2, rto=Math.max(MIN_RTO,P.rtt+2*P.rtt);
  let cwnd=P.iw, ssthresh=P.ssth, una=0, nxt=0, dup=0, inRec=false, recover=0;
  let nicFree=0, tVer=0, tOn=false, rcvNxt=0, lastAck=-1, dupN=0, ackNum=0;
  const ooo=new Set<any>(), txc: any[]=[], sentAt: any[]=[], wasRetx: any[]=[], sacked=new Set<any>(), retxd=new Set<any>();
  let highSack=-1;
  const S: any={sent:0,retx:0,fast:0,rto:0,start:0,end:0,acks:0,dupAcks:0,lostData:0,lostAcks:0,lostList:[] as any[],fastList:[] as any[],rtoList:[] as any[],rtoVals:[] as any[],caAt:null,oooSeen:false,sackAcks:0};
  const sample=(t: any, e: any): any=>tr.samples.push({t:t,cwnd:+cwnd.toFixed(2),ssthresh:ssthresh,flight:nxt-una,rto:Math.round(rto),ev:e||''});
  const dataSeg=(o: any): any=>Object.assign({proto:'TCP',win:64240,len:0},o);

  // Abertura da conexão (sem perdas, para manter o foco na transferência)
  st(tr,0,'s','LISTEN'); st(tr,0,'c','SYN_SENT');
  tr.metro.push({t:0,label:'Handshake',sub:'SYN, SYN-ACK, ACK'});
  addSeg(tr,dataSeg({from:'c',to:'s',tSend:0,tArr:ow,kind:'ctl',color:COL.conn,label:'SYN Seq=0',sport:CLI.port,dport:80,flags:['SYN'],seq:0,ack:null,opts:synOpts(P),info:CLI.port+' → 80 [SYN] Seq=0 Win=64240 Len=0 MSS=1000'+(P.sack?' SACK_PERM':'')}));
  lg(tr,0,'Cliente envia SYN (ISN mostrado como Seq=0 relativo) e anuncia MSS = 1000. Estado: SYN_SENT.','conn');
  st(tr,ow,'s','SYN_RCVD');
  addSeg(tr,dataSeg({from:'s',to:'c',tSend:ow,tArr:2*ow,kind:'ctl',color:COL.conn,label:'SYN, ACK Seq=0 Ack=1',sport:80,dport:CLI.port,flags:['SYN','ACK'],seq:0,ack:1,win:P.rwnd*MSS,opts:synOpts(P),info:'80 → '+CLI.port+' [SYN, ACK] Seq=0 Ack=1 Win='+(P.rwnd*MSS)+' Len=0 MSS=1000'+(P.sack?' SACK_PERM':'')}));
  lg(tr,ow,'Servidor responde SYN-ACK: confirma o SYN (Ack=1) e envia o próprio ISN. Estado: SYN_RCVD.','conn');
  st(tr,2*ow,'c','ESTABLISHED');
  addSeg(tr,dataSeg({from:'c',to:'s',tSend:2*ow,tArr:3*ow,kind:'ctl',color:COL.conn,label:'ACK Ack=1',sport:CLI.port,dport:80,flags:['ACK'],seq:1,ack:1,info:CLI.port+' → 80 [ACK] Seq=1 Ack=1 Win=64240 Len=0'}));
  lg(tr,2*ow,'Cliente confirma com ACK e já pode enviar dados. Estado: ESTABLISHED. O handshake custou 1 RTT ('+P.rtt+' ms) antes do primeiro byte de dados.','conn');
  st(tr,3*ow,'s','ESTABLISHED');
  ev(tr,2*ow,'c','RTO inicial = '+Math.round(rto)+' ms');
  tr.metro.push({t:2*ow,label:'Transferência',sub:'janela deslizante'});
  S.start=2*ow; nicFree=2*ow;
  sample(2*ow,'início');

  function arm(t: any): any { tVer++; const v=tVer; tOn=true; Q.at(t+rto,(tt: any)=>{ if(v===tVer && tOn) onRto(tt); }); }
  function stop(){ tVer++; tOn=false; }

  function send(i: any, t: any, why: any): any {
    const att=txc[i]||0; txc[i]=att+1;
    const tS=Math.max(t,nicFree); nicFree=tS+tx;
    const extra=reorderExtra(P,i,att,tx), lost=dataLost(P,i,att), seq=1+i*MSS;
    let pre='';
    if(att>0){ pre=why==='fast'?'[TCP Fast Retransmission] ':'[TCP Retransmission] '; S.retx++; wasRetx[i]=true; }
    const flags=i===N-1?['PSH','ACK']:['ACK'];
    const s=addSeg(tr,dataSeg({from:'c',to:'s',tSend:tS,tArr:tS+tx+ow+extra,lost:lost,kind:'data',color:att>0?COL.bad:COL.data,
      label:(att>0?'↻ ':'')+'#'+(i+1)+' Seq='+seq,sport:CLI.port,dport:80,flags:flags,seq:seq,ack:1,len:MSS,idx:i,
      info:pre+CLI.port+' → 80 ['+flags.join(', ')+'] Seq='+seq+' Ack=1 Win=64240 Len='+MSS}));
    if(att>0) s.tags.push(why==='fast'?'Fast Retransmission':'Retransmission');
    if(extra) s.tags.push('atrasado na rede (reordenação)');
    S.sent++; sentAt[i]=tS;
    if(lost){ S.lostData++; S.lostList.push(i+1); lg(tr,tS,'Segmento #'+(i+1)+' (Seq='+seq+') perdido na rede.','loss'); }
    else Q.at(s.tArr,(tt: any)=>receive(i,tt,s));
    if(!tOn) arm(t);
  }
  // Recuperação com SACK: todo segmento não confirmado abaixo do maior byte seletivamente confirmado é dado como perdido
  // (ideia do FACK, hoje substituído no Linux pelo RACK-TLP da RFC 8985). O "pipe" conta o que ainda está na rede e limita os envios à cwnd.
  function sackPump(t: any): any {
    let g=0;
    while(g++<100){
      let pipe=0;
      for(let i=una;i<nxt;i++){ if(sacked.has(i)) continue; if(i<highSack && !retxd.has(i)) continue; pipe++; }
      if(pipe>=Math.floor(cwnd)) break;
      let hole=-1;
      for(let i=una;i<highSack;i++) if(!sacked.has(i) && !retxd.has(i)){ hole=i; break; }
      if(hole>=0){ retxd.add(hole); if(hole!==una) S.fastList.push(hole+1); send(hole,t,'fast'); }
      else if(nxt<N && (nxt-una)<P.rwnd){ const i=nxt; nxt++; send(i,t,txc[i]?'rto':'new'); }
      else break;
    }
  }
  function pump(t: any): any {
    let g=0;
    if(P.sack && inRec) sackPump(t);
    else while(nxt<N && (nxt-una)<Math.floor(Math.min(cwnd,P.rwnd)) && g++<100){ const i=nxt; nxt++; if(P.sack && sacked.has(i)) continue; send(i,t,txc[i]?'rto':'new'); }
    if(!tOn && nxt>una) arm(t);
    // Registra quantos segmentos ficaram em voo depois dos envios deste instante.
    const last=tr.samples[tr.samples.length-1];
    if(last && last.t===t) last.flight=nxt-una;
  }
  function receive(i: any, t: any, seg: any): any {
    if(i===rcvNxt){
      rcvNxt++; let filled=0;
      while(ooo.has(rcvNxt)){ ooo.delete(rcvNxt); rcvNxt++; filled++; }
      if(filled) ev(tr,t,'s','Lacuna preenchida: entrega até #'+rcvNxt+' em ordem');
    } else if(i>rcvNxt){
      ooo.add(i); seg.tags.push('fora de ordem'); S.oooSeen=true;
      if(seg.info.indexOf('[TCP')!==0) seg.info='[TCP Out-Of-Order] '+seg.info;
      ev(tr,t,'s','#'+(i+1)+' no buffer (falta #'+(rcvNxt+1)+')');
    } else { seg.tags.push('duplicado'); seg.info='[TCP Spurious Retransmission] '+seg.info; }
    const ackVal=1+rcvNxt*MSS;
    // Blocos SACK: intervalos contíguos fora de ordem; o que contém o segmento recém-chegado vem primeiro (até 3 blocos).
    let blocks=null;
    if(P.sack && ooo.size){
      const rs: any[]=[]; Array.from(ooo).sort((a: any, b: any)=>a-b).forEach((x: any)=>{ const l=rs[rs.length-1]; if(l && l[1]===x-1) l[1]=x; else rs.push([x,x]); });
      const ordered=rs.filter((r: any)=>i>=r[0] && i<=r[1]); rs.slice().reverse().forEach((r: any)=>{ if(ordered.indexOf(r)<0) ordered.push(r); });
      blocks=ordered.slice(0,3);
    }
    let pre='', label='ACK='+ackVal;
    if(ackVal===lastAck){ dupN++; S.dupAcks++; pre='[TCP Dup ACK #'+dupN+'] '; label+=' (dup '+dupN+')'; }
    else { dupN=0; ackNum++; lastAck=ackVal; }
    const k=S.acks++, lost=P.ackLoss && rnd(P.seed,'a',k,0)<P.loss;
    const a=addSeg(tr,dataSeg({from:'s',to:'c',tSend:t,tArr:t+ow,lost:lost,kind:'ack',color:dupN?COL.bad:COL.ack,label:label,
      sport:80,dport:CLI.port,flags:['ACK'],seq:1,ack:ackVal,win:P.rwnd*MSS,
      sack:blocks?blocks.map((b: any)=>[1+b[0]*MSS,1+(b[1]+1)*MSS]):null,
      info:pre+'80 → '+CLI.port+' [ACK] Seq=1 Ack='+ackVal+' Win='+(P.rwnd*MSS)+' Len=0'+(blocks?' '+blocks.map((b: any)=>'SLE='+(1+b[0]*MSS)+' SRE='+(1+(b[1]+1)*MSS)).join(' '):'')}));
    if(dupN) a.tags.push('Dup ACK');
    if(blocks){ S.sackAcks++; a.tags.push('SACK: '+blocks.length+(blocks.length===1?' bloco':' blocos')); a.label+=' +SACK'; }
    if(lost){ S.lostAcks++; lg(tr,t,'ACK='+ackVal+' perdido na rede. O próximo ACK, por ser cumulativo, cobre a perda.','loss'); }
    else { const ai=rcvNxt; Q.at(t+ow,(tt: any)=>onAck(ai,tt,blocks)); }
    if(rcvNxt===N && !S.rcvDone){ S.rcvDone=t; ev(tr,t,'s','Arquivo completo e em ordem ('+N+' segmentos)'); }
  }
  function onAck(ai: any, t: any, blocks: any): any {
    if(una>=N) return;
    if(P.sack && blocks) blocks.forEach((b: any)=>{ for(let k=b[0];k<=b[1];k++) sacked.add(k); highSack=Math.max(highSack,b[1]+1); });
    if(ai>una){
      const k=ai-1;
      if(!wasRetx[k] && !(P.sack && sacked.has(k)) && sentAt[k]!==undefined){
        const r=t-sentAt[k];
        rttvar=0.75*rttvar+0.25*Math.abs(srtt-r); srtt=0.875*srtt+0.125*r;
        rto=Math.max(MIN_RTO,srtt+4*rttvar);
      }
      const acked=ai-una; una=ai; if(nxt<una) nxt=una;
      let e='';
      if(inRec){
        if(ai>=recover){
          cwnd=ssthresh; inRec=false; retxd.clear(); e='fim do fast recovery';
          ev(tr,t,'c','ACK completo: fim do fast recovery, cwnd = '+ssthresh);
          lg(tr,t,'O ACK cobre tudo até o ponto de recuperação: fim do fast recovery. cwnd = ssthresh = '+ssthresh+'.','cc');
        } else if(P.sack){
          e='ACK parcial (SACK)';
          ev(tr,t,'c','ACK parcial: o SACK já indica os demais buracos');
          lg(tr,t,'ACK parcial: com SACK o emissor já sabe quais segmentos faltam e continua repondo os buracos sem esperar novos ACKs duplicados.','cc');
        } else {
          cwnd=Math.max(cwnd-acked+1,1); e='ACK parcial';
          ev(tr,t,'c','ACK parcial: retransmite #'+(una+1)+' (NewReno)');
          lg(tr,t,'ACK parcial (NewReno, RFC 6582): houve outra perda na mesma janela. Retransmite #'+(una+1)+' sem esperar novos ACKs duplicados.','cc');
          S.fastList.push(una+1); send(una,t,'fast');
        }
      } else if(cwnd<ssthresh){
        cwnd+=acked;
        if(cwnd>=ssthresh){
          cwnd=ssthresh; e='congestion avoidance'; if(S.caAt===null && !S.fast && !S.rto) S.caAt=t;
          ev(tr,t,'c','cwnd chegou ao ssthresh ('+ssthresh+'): congestion avoidance');
          lg(tr,t,'cwnd chegou ao ssthresh ('+ssthresh+'): sai do slow start e passa ao crescimento linear (congestion avoidance).','cc');
        }
      } else cwnd+=acked/cwnd;
      dup=0;
      if(una>=N){ stop(); sample(t,e); finish(t); return; }
      arm(t); sample(t,e);
    } else if(ai===una && nxt>una){
      dup++;
      if(!inRec && dup===3){
        const flight=nxt-una;
        ssthresh=Math.max(Math.floor(flight/2),2); recover=nxt; inRec=true; S.fast++; S.fastList.push(una+1);
        ev(tr,t,'c','3 ACKs duplicados: fast retransmit de #'+(una+1));
        if(P.sack) lg(tr,t,'Terceiro ACK duplicado, já com blocos SACK: o emissor sabe quais segmentos o receptor tem e quais faltam. Retransmite o #'+(una+1)+' sem esperar o RTO. ssthresh = '+flight+'/2 = '+ssthresh+', cwnd = ssthresh. A cada ACK, repõe os demais buracos enquanto o que está na rede (pipe) for menor que a cwnd.','cc');
        else lg(tr,t,'Terceiro ACK duplicado: o segmento #'+(una+1)+' deve ter se perdido. Fast retransmit sem esperar o RTO. ssthresh = '+flight+'/2 = '+ssthresh+', cwnd = ssthresh + 3 = '+(ssthresh+3)+' (fast recovery).','cc');
        send(una,t,'fast');
        if(P.sack){ retxd.add(una); cwnd=ssthresh; } else cwnd=ssthresh+3;
        sample(t,'fast retransmit');
      } else if(inRec && !P.sack){ cwnd+=1; sample(t,''); }
    }
    pump(t);
  }
  function onRto(t: any): any {
    if(una>=N) return;
    const flight=nxt-una;
    ssthresh=Math.max(Math.floor(flight/2),2); cwnd=1; inRec=false; dup=0; S.rto++; retxd.clear();
    const old=rto; S.rtoList.push(una+1); S.rtoVals.push(old); rto=Math.min(rto*2,60000); nxt=una; tOn=false;
    ev(tr,t,'c','RTO ('+Math.round(old)+' ms) expirou: cwnd = 1, ssthresh = '+ssthresh);
    lg(tr,t,'Timeout: nenhum ACK novo em '+Math.round(old)+' ms. Retransmite #'+(una+1)+', ssthresh = '+ssthresh+', cwnd = 1 (volta ao slow start) e o RTO dobra para '+Math.round(rto)+' ms.','loss');
    sample(t,'RTO'); pump(t);
  }
  function finish(t: any): any {
    S.end=t;
    ev(tr,t,'c','Todos os dados confirmados');
    tr.metro.push({t:t,label:'Encerramento',sub:'FIN e ACK'});
    const fs=1+N*MSS;
    st(tr,t,'c','FIN_WAIT_1');
    addSeg(tr,dataSeg({from:'c',to:'s',tSend:t,tArr:t+ow,kind:'ctl',color:COL.conn,label:'FIN, ACK Seq='+fs,sport:CLI.port,dport:80,flags:['FIN','ACK'],seq:fs,ack:1,info:CLI.port+' → 80 [FIN, ACK] Seq='+fs+' Ack=1 Len=0'}));
    lg(tr,t,'Cliente terminou de enviar: FIN. Estado: FIN_WAIT_1.','conn');
    st(tr,t+ow,'s','CLOSE_WAIT');
    addSeg(tr,dataSeg({from:'s',to:'c',tSend:t+ow,tArr:t+2*ow,kind:'ctl',color:COL.conn,label:'ACK='+(fs+1),sport:80,dport:CLI.port,flags:['ACK'],seq:1,ack:fs+1,win:P.rwnd*MSS,info:'80 → '+CLI.port+' [ACK] Seq=1 Ack='+(fs+1)+' Len=0'}));
    st(tr,t+ow+1,'s','LAST_ACK');
    addSeg(tr,dataSeg({from:'s',to:'c',tSend:t+ow+1,tArr:t+2*ow+1,kind:'ctl',color:COL.conn,label:'FIN, ACK Seq=1',sport:80,dport:CLI.port,flags:['FIN','ACK'],seq:1,ack:fs+1,win:P.rwnd*MSS,info:'80 → '+CLI.port+' [FIN, ACK] Seq=1 Ack='+(fs+1)+' Len=0'}));
    lg(tr,t+ow,'Servidor confirma o FIN (CLOSE_WAIT); a aplicação fecha e ele envia o próprio FIN (LAST_ACK).','conn');
    st(tr,t+2*ow,'c','FIN_WAIT_2'); st(tr,t+2*ow+1,'c','TIME_WAIT');
    addSeg(tr,dataSeg({from:'c',to:'s',tSend:t+2*ow+1,tArr:t+3*ow+1,kind:'ctl',color:COL.conn,label:'ACK=2',sport:CLI.port,dport:80,flags:['ACK'],seq:fs+1,ack:2,info:CLI.port+' → 80 [ACK] Seq='+(fs+1)+' Ack=2 Len=0'}));
    ev(tr,t+2*ow+1,'c','TIME_WAIT: aguarda 2×MSL (60 s no Linux)');
    lg(tr,t+2*ow+1,'Cliente confirma o FIN do servidor e entra em TIME_WAIT por 2×MSL, para absorver segmentos atrasados desta conexão.','conn');
    st(tr,t+3*ow+1,'s','CLOSED');
    tr.metro.push({t:t+3*ow+1,label:'Fechado',sub:'TIME_WAIT no cliente'});
  }

  Q.at(2*ow,(t: any)=>pump(t));
  Q.run(30000);
  const dur=S.end?S.end-S.start:0;
  tr.stats={
    'Tempo total (do SYN ao último ACK)':Math.round(tr.end)+' ms',
    'Tempo da transferência de dados':Math.round(dur)+' ms',
    'Dados entregues à aplicação':N+' de '+N+' segmentos, em ordem',
    'Segmentos de dados enviados':S.sent+' ('+S.retx+' retransmissões)',
    'Perdas na rede (dados / ACKs)':S.lostData+' / '+S.lostAcks,
    'Fast retransmits / timeouts':S.fast+' / '+S.rto,
    'ACKs duplicados':S.dupAcks,
    'Vazão útil (goodput)':dur?Math.round(N*MSS*8/dur)+' kbit/s (enlace de '+(P.bw*1000)+' kbit/s)':'-',
    'SACK (confirmação seletiva)':P.sack?'ligado: '+S.sackAcks+' ACKs com blocos SACK':'desligado (recuperação NewReno)',
    'Segmentos de controle':'3 no handshake e 4 no encerramento'
  };
  const uniq=(a: any): any=>Array.from(new Set(a)).sort((x: any, y: any)=>x-y);
  tr.raw={delivered:N,lost:S.lostData,order:'garantida',retx:S.retx,N:N,start:S.start,dur:dur,
    lostList:S.lostList,fastList:uniq(S.fastList),rtoList:uniq(S.rtoList),rtoVals:S.rtoVals,caAt:S.caAt,lostAcks:S.lostAcks,oooSeen:S.oooSeen,
    sack:P.sack,sackAcks:S.sackAcks,maxCwnd:Math.max.apply(null,tr.samples.map((x: any)=>x.cwnd)),maxFlight:Math.max.apply(null,tr.samples.map((x: any)=>x.flight))};
  return tr;
}

// ---------- UDP: fluxo de datagramas ----------
function simUdp(P: any, title: any): any {
  const tr=mkTrace(5004,'RTP','UDP',title);
  const ow=P.rtt/2, tx=MSS*8/(P.bw*1000), N=P.N;
  st(tr,0,'c','sem conexão'); st(tr,0,'s','sem conexão');
  tr.metro.push({t:0,label:'Envio',sub:'sem handshake'});
  lg(tr,0,'O UDP não abre conexão: o primeiro datagrama sai imediatamente, na taxa que a aplicação escolher.','udp');
  const arr: any[]=[], lostList: any[]=[], oooList: any[]=[]; let lost=0;
  for(let i=0;i<N;i++){
    const tS=i*tx, extra=reorderExtra(P,i,0,tx), l=dataLost(P,i,0);
    const s=addSeg(tr,{from:'c',to:'s',tSend:tS,tArr:tS+tx+ow+extra,lost:l,kind:'data',color:COL.data,label:'Datagrama #'+(i+1),proto:'UDP',sport:CLI.port,dport:5004,len:MSS,idx:i,info:CLI.port+' → 5004 Len='+MSS});
    if(extra) s.tags.push('atrasado na rede (reordenação)');
    if(l){ lost++; lostList.push(i+1); s.tags.push('perdido'); lg(tr,tS,'Datagrama #'+(i+1)+' perdido. Ninguém retransmite: o UDP não sabe que ele se perdeu.','loss'); ev(tr,tS+tx+ow+4,'s','#'+(i+1)+' nunca chegou'); }
    else arr.push(s);
  }
  arr.sort((a: any, b: any)=>a.tArr-b.tArr);
  let maxI=-1, ooo=0;
  arr.forEach((s: any)=>{ if(s.idx<maxI){ ooo++; oooList.push(s.idx+1); s.tags.push('entregue fora de ordem'); ev(tr,s.tArr,'s','#'+(s.idx+1)+' entregue fora de ordem'); } maxI=Math.max(maxI,s.idx); });
  const last=arr.length?arr[arr.length-1].tArr:tr.end;
  tr.metro.push({t:last,label:'Fim',sub:'sem encerramento'});
  tr.stats={
    'Tempo até o último datagrama':Math.round(last)+' ms',
    'Dados entregues à aplicação':arr.length+' de '+N+' datagramas',
    'Perdidos (não recuperados)':lost,
    'Entregues fora de ordem':ooo,
    'Retransmissões':'0 (o UDP não retransmite)',
    'Segmentos de controle':'nenhum'
  };
  tr.raw={kind:'stream',N:N,delivered:arr.length,lost:lost,lostList:lostList,oooList:oooList,order:ooo?ooo+' fora de ordem':'mantida nesta execução',retx:0,time:last};
  return tr;
}

// ---------- UDP: DNS ----------
function simDns(P: any): any {
  const tr=mkTrace(53,'DNS','UDP','UDP');
  const ow=P.rtt/2, TIMEOUT=1000;
  st(tr,0,'c','sem conexão'); st(tr,0,'s','sem conexão');
  tr.metro.push({t:0,label:'Consulta',sub:'um datagrama'});
  let ok=false, k=0;
  const lostQ: any[]=[], lostR: any[]=[];
  for(k=0;k<3 && !ok;k++){
    const t=k*TIMEOUT;
    const lq=(k===0 && P.drops.indexOf(1)>=0) || rnd(P.seed,'d',k,0)<P.loss;
    if(k>0){ ev(tr,t,'c','Timeout de '+TIMEOUT+' ms: a aplicação repete a consulta'); lg(tr,t,'Sem resposta em '+TIMEOUT+' ms: o resolvedor repete a consulta. Aqui a confiabilidade é responsabilidade da aplicação, não do UDP.','loss'); }
    addSeg(tr,{from:'c',to:'s',tSend:t,tArr:t+ow,lost:lq,kind:'data',color:k?COL.bad:COL.data,label:(k?'↻ ':'')+'Consulta A www.unb.br id=0x2f1a',proto:'UDP',sport:CLI.port,dport:53,len:31,info:'Standard query 0x2f1a A www.unb.br'});
    if(lq){ lostQ.push(k+1); lg(tr,t,'A consulta DNS foi perdida.','loss'); continue; }
    const lr=rnd(P.seed,'a',k,0)<P.loss;
    addSeg(tr,{from:'s',to:'c',tSend:t+ow+0.4,tArr:t+2*ow+0.4,lost:lr,kind:'ack',color:COL.resp,label:'Resposta A 164.41.101.12',proto:'UDP',sport:53,dport:CLI.port,len:47,info:'Standard query response 0x2f1a A www.unb.br A 164.41.101.12'});
    if(lr){ lostR.push(k+1); lg(tr,t+ow,'A resposta DNS foi perdida.','loss'); continue; }
    ok=true;
    ev(tr,t+2*ow+0.4,'c','Resposta recebida: o ID 0x2f1a casa com a consulta');
    lg(tr,t+2*ow+0.4,'O cliente associa a resposta à consulta pelo ID (0x2f1a) e pela porta. Resolução concluída em '+Math.round(t+2*ow)+' ms.','udp');
    tr.metro.push({t:t+2*ow,label:'Resposta',sub:k?'após '+k+' repetição(ões)':'na primeira tentativa'});
  }
  if(!ok){ ev(tr,3*TIMEOUT,'c','Sem resposta após 3 tentativas'); tr.metro.push({t:3*TIMEOUT,label:'Falha',sub:'sem resposta'}); }
  tr.raw={kind:'dns',ok:ok,attempts:k,lostQ:lostQ,lostR:lostR};
  tr.stats={'Resultado':ok?'nome resolvido':'falhou','Tentativas':k,'Quem repete a consulta':'a aplicação (resolvedor), após o timeout','Conexão':'nenhuma: 1 RTT por consulta'};
  return tr;
}

// ---------- TCP: download de arquivo (modelo por rodada, recuperação com SACK) ----------
// O servidor envia o arquivo e o cliente confirma. Cada rodada (uma janela inteira em voo) vira uma seta de rajada.
function simDownload(P: any, title: any): any {
  const tr=mkTrace(80,'HTTP','TCP',title);
  const ow=P.rtt/2, tx=MSS*8/(P.bw*1000), n=Math.ceil(P.file*1000000/MSS), REQ=120;
  const bdp=Math.max(1,Math.ceil(P.rtt/tx)), qmax=Math.max(20,bdp), cap=bdp+qmax;
  const dataSeg=(o: any): any=>Object.assign({proto:'TCP',win:64240,len:0,pktLen:MSS},o);
  let cwnd=P.iw, ssth=P.ssth, rto=Math.max(MIN_RTO,2*P.rtt), mult=1;
  const att=new Array(n).fill(0), R: any[]=[];
  let T=3*ow, next=0, got=0, holes: any[]=[], lastEv='início';
  const S: any={rand:0,queue:0,fast:0,tlp:0,rto:0,retx:0,caAt:null,rwndR:0,linkR:0,qFirst:null,maxW:0};
  const rt=()=>Math.round(rto*mult);

  while(got<n && R.length<60000){
    const wmax=Math.max(1,Math.min(Math.floor(cwnd),P.rwnd)), list: any[]=[];
    const hs=holes.splice(0,P.sack?wmax:Math.min(1,wmax));
    hs.forEach((i: any)=>list.push({i:i,r:true}));
    while(list.length<wmax && next<n){ list.push({i:next,r:false}); next++; }
    const w=list.length;
    const rd: any={n:R.length+1,T:T,w:w,cwnd:cwnd,ssth:ssth,rto:rt(),ev:lastEv,got:got,retx:hs.length,fresh:w-hs.length,first:list[0].i,type:'ok',lostQ:0,lostR:0,nLost:0,nDel:0,tDet:0};
    const isLost: any[]=[]; let lastDel=-1, firstLost=-1; const lost: any[]=[];
    list.forEach((x: any, p: any)=>{
      const a=att[x.i]++, q=p>=cap, rl=dataLost(P,x.i,a);
      if(x.r) S.retx++;
      if(q||rl){ isLost[p]=true; lost.push(x.i); if(firstLost<0) firstLost=p; if(q) rd.lostQ++; else rd.lostR++; }
      else lastDel=p;
    });
    rd.nLost=lost.length; rd.nDel=w-lost.length; S.rand+=rd.lostR; S.queue+=rd.lostQ;
    if(rd.lostQ && S.qFirst===null) S.qFirst=rd.n;
    S.maxW=Math.max(S.maxW,w);
    if(w>=P.rwnd) S.rwndR++;
    if(w>=bdp) S.linkR++;
    rd.tLast=lastDel>=0?T+ow+(lastDel+1)*tx:T+ow+w*tx;
    let dupAcks=0, third=-1;
    for(let p=firstLost+1;firstLost>=0 && p<w;p++) if(!isLost[p]){ dupAcks++; if(dupAcks===3) third=p; }
    rd.dup=dupAcks;
    got+=rd.nDel;
    const dur=Math.max(P.rtt+tx,w*tx);
    let nextT=T+dur;
    lastEv='';
    if(!lost.length){
      mult=1;
      // A janela só cresce quando a rodada a usou por inteiro (limitada pela cwnd); se a rwnd ou o fim do arquivo limitaram, ela fica.
      if(w>=Math.floor(cwnd) && (P.sack || !holes.length)){
        if(cwnd<ssth){ cwnd=Math.min(cwnd+w,ssth); if(cwnd>=ssth){ lastEv='congestion avoidance'; if(S.caAt===null && !S.fast && !S.tlp && !S.rto) S.caAt=T+dur; } }
        else cwnd+=w/cwnd;
      }
    } else if(dupAcks>=3){
      const td=T+ow+(third+1)*tx+ow;
      ssth=Math.max(2,Math.floor(w/2)); cwnd=ssth; holes=holes.concat(lost); S.fast++;
      rd.type='fast'; rd.tDet=td; lastEv='fast retransmit'; nextT=Math.max(td,T+tx*w);
    } else if(rd.nDel>0 && P.sack){
      const td=T+2*P.rtt+w*tx;
      ssth=Math.max(2,Math.floor(w/2)); cwnd=ssth; holes=holes.concat(lost); S.tlp++;
      rd.type='tlp'; rd.tDet=td; lastEv='sonda de cauda'; nextT=Math.max(td,T+tx*w);
    } else {
      const wait=Math.max(rt(),w*tx+P.rtt);
      rd.rtoVal=rt(); ssth=Math.max(2,Math.floor(w/2)); cwnd=1; holes=holes.concat(lost); S.rto++;
      rd.type='rto'; rd.tDet=T+wait; lastEv='RTO'; mult=Math.min(mult*2,64); nextT=T+wait;
    }
    let cum=next; for(let k=0;k<holes.length;k++) if(holes[k]<cum) cum=holes[k];
    rd.cum=cum; rd.cwndAfter=cwnd; rd.ssthAfter=ssth;
    R.push(rd); T=nextT;
  }
  const last=R[R.length-1], tDone=last.tLast;

  // Abertura da conexão e pedido HTTP
  st(tr,0,'s','LISTEN'); st(tr,0,'c','SYN_SENT');
  tr.metro.push({t:0,label:'Handshake',sub:'SYN, SYN-ACK, ACK'});
  addSeg(tr,dataSeg({from:'c',to:'s',tSend:0,tArr:ow,kind:'ctl',color:COL.conn,label:'SYN Seq=0',sport:CLI.port,dport:80,flags:['SYN'],seq:0,ack:null,opts:synOpts(P),info:CLI.port+' → 80 [SYN] Seq=0 Win=64240 Len=0 MSS=1000'+(P.sack?' SACK_PERM':'')}));
  lg(tr,0,'Cliente envia SYN e anuncia MSS = 1000. Estado: SYN_SENT.','conn');
  st(tr,ow,'s','SYN_RCVD');
  addSeg(tr,dataSeg({from:'s',to:'c',tSend:ow,tArr:2*ow,kind:'ctl',color:COL.conn,label:'SYN, ACK Seq=0 Ack=1',sport:80,dport:CLI.port,flags:['SYN','ACK'],seq:0,ack:1,win:Math.min(65535,P.rwnd*MSS),opts:synOpts(P),info:'80 → '+CLI.port+' [SYN, ACK] Seq=0 Ack=1 Win='+Math.min(65535,P.rwnd*MSS)+' Len=0 MSS=1000'+(P.sack?' SACK_PERM':'')}));
  lg(tr,ow,'Servidor responde SYN-ACK. Estado: SYN_RCVD.','conn');
  st(tr,2*ow,'c','ESTABLISHED');
  addSeg(tr,dataSeg({from:'c',to:'s',tSend:2*ow,tArr:3*ow,kind:'data',color:COL.conn,label:'ACK + GET /arquivo.bin',sport:CLI.port,dport:80,flags:['PSH','ACK'],seq:1,ack:1,len:REQ,pktLen:REQ,idx:-1,agg:'Pedido HTTP: GET /arquivo.bin HTTP/1.1 (cabeçalhos incluídos)',
    info:CLI.port+' → 80 [PSH, ACK] Seq=1 Ack=1 Len='+REQ+' GET /arquivo.bin HTTP/1.1'}));
  lg(tr,2*ow,'Cliente confirma o SYN-ACK e já envia o pedido HTTP (GET /arquivo.bin). Estado: ESTABLISHED. Até aqui passou 1 RTT ('+P.rtt+' ms) só com o handshake.','conn');
  st(tr,3*ow,'s','ESTABLISHED');
  tr.metro.push({t:2*ow,label:'Pedido GET',sub:'ACK + requisição'});
  tr.metro.push({t:4*ow+tx,label:'Primeiro byte',sub:'resposta chegou'});
  ev(tr,3*ow,'s','Pedido recebido: começa o envio do arquivo');
  lg(tr,3*ow,'O servidor recebeu o pedido e inicia a resposta com janela inicial de '+P.iw+(P.iw===1?' segmento':' segmentos')+'. O arquivo tem '+n+' segmentos de 1000 bytes ('+P.file+' MB).','cc');

  // Quais rodadas aparecem no diagrama: as primeiras, as com evento e uma amostra do regime estável.
  const BUDGET=64, show=new Set<any>();
  for(let i=0;i<R.length && i<12;i++) show.add(i);
  show.add(R.length-1);
  const evR: any[]=[], steady: any[]=[];
  for(let i=12;i<R.length-1;i++) (R[i].type!=='ok' || R[i].lostQ ? evR : steady).push(i);
  evR.slice(0,24).forEach((i: any)=>{ show.add(i); if(i+1<R.length) show.add(i+1); });
  const room=Math.max(0,BUDGET-show.size);
  if(steady.length && room){ const k=Math.max(1,Math.ceil(steady.length/room)); steady.forEach((i: any, j: any)=>{ if(j%k===0) show.add(i); }); }
  R.forEach((rd: any, i: any)=>{ rd.show=show.has(i); });

  // Pontos da curva da cwnd (um por rodada) e do progresso.
  R.forEach((rd: any)=>{ tr.samples.push({t:rd.T,cwnd:+rd.cwnd.toFixed(2),ssthresh:rd.ssth,flight:rd.w,rto:rd.rto,ev:rd.ev,got:rd.got}); });
  tr.samples.push({t:tDone,cwnd:+last.cwndAfter.toFixed(2),ssthresh:last.ssthAfter,flight:0,rto:last.rto,ev:'fim da transferência',got:n});

  let omitted=0, omitStart: any=null;
  tr.warp=[];
  const flush=(bT: any): any=>{ if(omitted>=3){ ev(tr,omitStart,'s','... '+omitted+' rodadas semelhantes omitidas do diagrama'); if(bT-omitStart>P.rtt*1.6) tr.warp.push({a:omitStart,b:bT,keep:P.rtt*0.8}); } omitted=0; omitStart=null; };
  const seqOf=(i: any): any=>1+i*MSS;
  R.forEach((rd: any)=>{
    if(!rd.show){ if(omitStart===null) omitStart=rd.T; omitted++; return; }
    flush(rd.T);
    const k=rd.n, lo=rd.first+1, hi=rd.first+rd.w;
    const win=Math.min(65535,P.rwnd*MSS);
    if(rd.nDel>0){
      const lab=(rd.retx?'↻ ':'')+rd.nDel+' seg.'+(rd.retx?' ('+rd.retx+' retransm.)':' #'+lo+'-'+hi);
      const s=addSeg(tr,dataSeg({from:'s',to:'c',tSend:rd.T,tArr:rd.tLast,kind:'data',color:rd.retx?COL.bad:COL.data,label:lab,sport:80,dport:CLI.port,flags:['ACK'],
        seq:seqOf(rd.first),ack:REQ+1,len:rd.nDel*MSS,idx:rd.first,
        agg:'Rajada da rodada '+k+': '+rd.nDel+' segmentos de 1000 bytes enviados em sequência'+(rd.retx?', sendo '+rd.retx+' retransmissões':'')+'. Mostrada como uma seta só.',
        info:'80 → '+CLI.port+' [ACK] Seq='+seqOf(rd.first)+' Ack='+(REQ+1)+' Win=64240 Len='+(rd.nDel*MSS)+' (rodada '+k+', '+rd.nDel+' segmentos)'}));
      if(rd.retx) s.tags.push('Retransmission');
    }
    if(rd.nLost>0){
      addSeg(tr,dataSeg({from:'s',to:'c',tSend:rd.T,tArr:rd.T+ow+rd.w*tx,lost:true,kind:'data',color:COL.bad,
        label:rd.nLost+(rd.nLost===1?' perdido':' perdidos')+(rd.lostQ?' (fila cheia)':''),sport:80,dport:CLI.port,flags:['ACK'],seq:seqOf(rd.first),ack:REQ+1,len:rd.nLost*MSS,idx:rd.first,
        agg:rd.nLost+' segmentos descartados nesta rodada'+(rd.lostQ?' ('+rd.lostQ+' por estouro da fila do roteador'+(rd.lostR?' e '+rd.lostR+' por perda aleatória':'')+')':' por perda aleatória')+'.',
        info:'80 → '+CLI.port+' [ACK] Seq='+seqOf(rd.first)+' Len='+(rd.nLost*MSS)+' (rodada '+k+': '+rd.nLost+' segmentos perdidos)'}));
    }
    const dupLab=rd.nLost>0;
    const a=addSeg(tr,dataSeg({from:'c',to:'s',tSend:rd.tLast,tArr:rd.tLast+ow,kind:'ack',color:dupLab?COL.bad:COL.ack,
      label:dupLab?(rd.dup>=3?'ACKs duplicados':'ACK parcial')+(P.sack?' (SACK)':''):'ACK='+seqOf(rd.cum),
      sport:CLI.port,dport:80,flags:['ACK'],seq:REQ+1,ack:seqOf(rd.cum),win:win,
      info:(dupLab?'[TCP Dup ACK] ':'')+CLI.port+' → 80 [ACK] Seq='+(REQ+1)+' Ack='+seqOf(rd.cum)+' Win='+win+' Len=0'+(dupLab&&P.sack?' SACK (blocos recebidos além da lacuna)':'')+' (resume a rodada '+k+')'}));
    if(dupLab) a.tags.push('Dup ACK');
    lg(tr,rd.T,'Rodada '+k+': o servidor envia '+rd.w+(rd.w===1?' segmento':' segmentos')+' (cwnd = '+(Math.round(rd.cwnd*10)/10)+', rwnd = '+P.rwnd+(rd.retx?'; '+rd.retx+' são retransmissões':'')+').','data');
    if(rd.lostQ) lg(tr,rd.T+ow,'Rodada '+k+': a janela de '+rd.w+' segmentos passou da capacidade do caminho ('+cap+' = '+bdp+' no enlace + '+qmax+' na fila do roteador). '+rd.lostQ+' '+(rd.lostQ===1?'segmento foi descartado':'segmentos foram descartados')+' no final da fila (tail drop).','loss');
    if(rd.lostR) lg(tr,rd.T+ow,'Rodada '+k+': '+rd.lostR+' '+(rd.lostR===1?'segmento perdido':'segmentos perdidos')+' por perda aleatória.','loss');
    if(rd.type==='fast'){
      ev(tr,rd.tDet,'s','3 ACKs duplicados: fast retransmit de '+rd.nLost);
      if(P.sack) lg(tr,rd.tDet,'Três ACKs duplicados com SACK: o servidor retransmite os '+rd.nLost+' segmentos que faltam sem esperar o RTO. ssthresh = '+rd.w+'/2 = '+rd.ssthAfter+' e cwnd = ssthresh (fast recovery).','cc');
      else lg(tr,rd.tDet,'Três ACKs duplicados, sem SACK: o servidor só sabe até onde o ACK cumulativo chegou. Retransmite um segmento por RTT ('+rd.nLost+' perdas levarão '+rd.nLost+' RTTs, NewReno). ssthresh = '+rd.w+'/2 = '+rd.ssthAfter+'.','cc');
    } else if(rd.type==='tlp'){
      ev(tr,rd.tDet,'s','Sonda de cauda (TLP): '+rd.nLost+' retransmitidos');
      lg(tr,rd.tDet,'A perda atingiu o fim da janela: não sobrou segmento depois dela para gerar 3 ACKs duplicados. Em vez de esperar o RTO ('+rd.rto+' ms), o servidor dispara a sonda de cauda (TLP, RFC 8985) cerca de 2 RTT depois, detecta as '+rd.nLost+' perdas e retransmite. ssthresh = '+rd.ssthAfter+' e cwnd = ssthresh.','cc');
    } else if(rd.type==='rto'){
      ev(tr,rd.tDet,'s','RTO ('+rd.rtoVal+' ms): cwnd = 1');
      lg(tr,rd.tDet,'Timeout: poucos segmentos depois da perda, então não houve 3 ACKs duplicados. Passados '+rd.rtoVal+' ms, o servidor retransmite, ssthresh = '+rd.ssthAfter+', cwnd = 1 (volta ao slow start) e o RTO dobra.','loss');
    }
  });
  flush(tDone);
  ev(tr,tDone,'c','Último byte recebido: arquivo completo');
  lg(tr,tDone,'O cliente recebeu o último segmento. O arquivo de '+P.file+' MB chegou completo e em ordem.','data');
  tr.metro.push({t:tDone,label:'Último byte',sub:'arquivo completo'});

  // Encerramento
  const tf=tDone+ow, fs=1+n*MSS, win0=Math.min(65535,P.rwnd*MSS);
  st(tr,tf,'s','FIN_WAIT_1');
  addSeg(tr,dataSeg({from:'s',to:'c',tSend:tf,tArr:tf+ow,kind:'ctl',color:COL.conn,label:'FIN, ACK',sport:80,dport:CLI.port,flags:['FIN','ACK'],seq:fs,ack:REQ+1,info:'80 → '+CLI.port+' [FIN, ACK] Seq='+fs+' Ack='+(REQ+1)+' Len=0'}));
  tr.metro.push({t:tf,label:'Encerramento',sub:'FIN e ACK'});
  lg(tr,tf,'Servidor terminou de enviar: FIN. Estado: FIN_WAIT_1.','conn');
  st(tr,tf+ow,'c','CLOSE_WAIT');
  addSeg(tr,dataSeg({from:'c',to:'s',tSend:tf+ow,tArr:tf+2*ow,kind:'ctl',color:COL.conn,label:'ACK='+(fs+1),sport:CLI.port,dport:80,flags:['ACK'],seq:REQ+1,ack:fs+1,win:win0,info:CLI.port+' → 80 [ACK] Seq='+(REQ+1)+' Ack='+(fs+1)+' Len=0'}));
  st(tr,tf+2*ow,'s','FIN_WAIT_2');
  st(tr,tf+ow+1,'c','LAST_ACK');
  addSeg(tr,dataSeg({from:'c',to:'s',tSend:tf+ow+1,tArr:tf+2*ow+1,kind:'ctl',color:COL.conn,label:'FIN, ACK',sport:CLI.port,dport:80,flags:['FIN','ACK'],seq:REQ+1,ack:fs+1,win:win0,info:CLI.port+' → 80 [FIN, ACK] Seq='+(REQ+1)+' Ack='+(fs+1)+' Len=0'}));
  st(tr,tf+2*ow+1,'s','TIME_WAIT');
  addSeg(tr,dataSeg({from:'s',to:'c',tSend:tf+2*ow+1,tArr:tf+3*ow+1,kind:'ctl',color:COL.conn,label:'ACK='+(REQ+2),sport:80,dport:CLI.port,flags:['ACK'],seq:fs+1,ack:REQ+2,info:'80 → '+CLI.port+' [ACK] Seq='+(fs+1)+' Ack='+(REQ+2)+' Len=0'}));
  ev(tr,tf+2*ow+1,'s','TIME_WAIT: aguarda 2×MSL');
  st(tr,tf+3*ow+1,'c','CLOSED');
  tr.metro.push({t:tf+3*ow+1,label:'Fechado',sub:'TIME_WAIT no servidor'});

  const dur=tDone-2*ow, ideal=4*ow+n*tx, goodput=Math.round(n*MSS*8/dur);
  const shownN=R.filter((r: any)=>r.show).length;
  tr.stats={
    'Tamanho do arquivo':P.file+' MB ('+n+' segmentos de 1000 bytes)',
    'Tempo até o primeiro byte':fmtMs(4*ow+tx),
    'Tempo até o último byte':fmtMs(tDone)+' (tempo ideal em enlace cheio: '+fmtMs(ideal)+')',
    'Vazão útil (goodput)':goodput+' kbit/s de '+(P.bw*1000)+' kbit/s do enlace ('+Math.min(100,Math.round(ideal/tDone*100))+'%)',
    'Rodadas (RTTs) de transmissão':R.length+' (o diagrama mostra '+shownN+')',
    'Capacidade do caminho':cap+' segmentos ('+bdp+' no enlace + '+qmax+' na fila)',
    'Perdas (fila cheia / aleatórias)':S.queue+' / '+S.rand,
    'Fast retransmits / sondas de cauda / timeouts':S.fast+' / '+S.tlp+' / '+S.rto,
    'Segmentos retransmitidos':S.retx+' ('+(Math.round(S.retx/n*1000)/10).toString().replace('.',',')+'% do arquivo)',
    'SACK (confirmação seletiva)':P.sack?'ligado':'desligado (recuperação NewReno, um buraco por RTT)',
    'Maior janela usada':S.maxW+' segmentos'
  };
  tr.raw={kind:'download',N:n,delivered:n,lost:S.queue+S.rand,order:'garantida',retx:S.retx,time:tDone,dur:dur,ideal:ideal,goodput:goodput,
    sack:P.sack,rounds:R.length,shown:shownN,bdp:bdp,qmax:qmax,cap:cap,queueLoss:S.queue,randLoss:S.rand,fast:S.fast,tlp:S.tlp,rto:S.rto,caAt:S.caAt,qFirst:S.qFirst,
    maxW:S.maxW,rwndRounds:S.rwndR,linkRounds:S.linkR,ttfb:4*ow+tx,eff:Math.min(100,Math.round(ideal/tDone*100)),
    maxCwnd:Math.max.apply(null,tr.samples.map((x: any)=>x.cwnd)),first:R[0].w,
    firstLossRound:(R.find((r: any)=>r.nLost>0)||{}).n||null,txSeg:tx};
  return tr;
}

// ---------- UDP: vídeo em streaming (RTP) ----------
// 25 quadros por segundo, um quadro I por segundo (GOP de 25) e os demais P. O envio é espaçado ao longo do quadro.
function simVideo(P: any, title: any): any {
  const tr=mkTrace(5004,'RTP','UDP',title);
  tr.cols[0].label='Cliente (player)'; tr.cols[1].label='Servidor de vídeo';
  const ow=P.rtt/2, FPS=25, FI=1000/FPS, GOP=25, PAY=1200, QMS=100, NF=P.vdur*FPS;
  const unit=P.vbr*125/(6+GOP-1), BIN=250, nb=Math.ceil((NF*FI+P.rtt+P.jb+400)/BIN)+1;
  const sentB=new Array(nb).fill(0), recvB=new Array(nb).fill(0);
  const frames: any[]=[], got: any[]=[];
  let busy=0, idx=0, sentBytes=0, okBytes=0;
  const C: any={pk:0,rand:0,queue:0,late:0,ok:0};
  st(tr,0,'c','sem conexão'); st(tr,0,'s','sem conexão');
  tr.metro.push({t:0,label:'Envio',sub:'sem handshake'});
  lg(tr,0,'O vídeo começa a ser enviado sem handshake. O servidor divide cada quadro em pacotes RTP de até '+PAY+' bytes e os envia ao longo dos '+FI+' ms do quadro. Não existe ACK nem retransmissão.','udp');
  for(let f=0;f<NF;f++){
    const isI=f%GOP===0, size=Math.round(isI?6*unit:unit), k=Math.max(1,Math.ceil(size/PAY)), tS=f*FI;
    const fr: any={f:f,type:isI?'I':'P',t:tS,play:tS+FI+ow+P.jb,bytes:size,np:k,nl:0,nq:0,nlate:0,ok:0,lastArr:null,status:'ok'};
    for(let j=0;j<k;j++){
      const bytes=j<k-1?PAY:size-PAY*(k-1), ts=tS+j*FI/k, i=idx++, ptx=bytes*8/(P.bw*1000);
      sentBytes+=bytes; sentB[Math.floor(ts/BIN)]+=bytes; C.pk++;
      const start=Math.max(ts,busy);
      if(start-ts>QMS){ fr.nq++; C.queue++; continue; }
      busy=start+ptx;
      if(rnd(P.seed,'v',i,0)<P.loss){ fr.nl++; C.rand++; continue; }
      const arr=busy+ow+rnd(P.seed,'j',i,0)*P.jit+(rnd(P.seed,'r',i,0)<P.reorder?60:0);
      fr.lastArr=fr.lastArr===null?arr:Math.max(fr.lastArr,arr);
      got.push({ts:ts,arr:arr});
      if(arr>fr.play){ fr.nlate++; C.late++; }
      else { fr.ok++; C.ok++; okBytes+=bytes; const b=Math.floor(arr/BIN); if(b<nb) recvB[b]+=bytes; }
    }
    frames.push(fr);
  }
  // Estado de cada quadro: um quadro I incompleto congela até o próximo I; um P incompleto gera artefatos, que se propagam.
  let frozen=false, dirty=false;
  frames.forEach((fr: any)=>{
    const complete=fr.ok===fr.np;
    if(fr.type==='I'){
      frozen=!complete; dirty=false;
      fr.status=complete?'ok':'congelado'; fr.own=!complete;
    } else if(frozen) fr.status='congelado';
    else if(!complete){ fr.status='artefatos'; dirty=true; fr.own=true; }
    else if(dirty) fr.status='artefatos';
    else fr.status='ok';
  });
  const cnt: any={ok:0,artefatos:0,congelado:0};
  frames.forEach((fr: any)=>{ cnt[fr.status]++; });
  // Jitter estimado como na RFC 3550 e atrasos.
  let J=0, Jmax=0, prev: any=null, dSum=0, dMax=0;
  got.forEach((g: any)=>{ if(prev){ const D=(g.arr-prev.arr)-(g.ts-prev.ts); J+=(Math.abs(D)-J)/16; Jmax=Math.max(Jmax,J); } prev=g; const d=g.arr-g.ts; dSum+=d; dMax=Math.max(dMax,d); });
  const lastPlay=frames[frames.length-1].play;

  // Setas, eventos e log
  let evN=0;
  frames.forEach((fr: any)=>{
    const problem=fr.nl>0 || fr.nq>0 || fr.nlate>0;
    const delivered=fr.ok+fr.nlate;
    const tArr=fr.lastArr!==null?fr.lastArr:fr.t+FI+ow;
    const tags: any[]=[];
    if(fr.nl) tags.push(fr.nl+' pacote(s) perdido(s) na rede');
    if(fr.nq) tags.push(fr.nq+' descartado(s) na fila do enlace');
    if(fr.nlate) tags.push(fr.nlate+' fora do prazo (descartado(s) pelo buffer)');
    if(fr.status!=='ok') tags.push('quadro exibido com '+fr.status);
    let lab='';
    if(fr.own) lab=fr.type+' #'+(fr.f+1)+(fr.type==='I'?' incompleto: congela':' incompleto: artefatos');
    else if(fr.type==='I') lab='I #'+(fr.f+1)+' ('+fr.np+' pacotes)';
    const s=addSeg(tr,{from:'s',to:'c',tSend:fr.t,tArr:tArr,lost:delivered===0,kind:'data',color:problem?COL.bad:COL.data,label:lab,
      proto:'UDP',sport:5004,dport:CLI.port,len:fr.bytes,pktLen:PAY,idx:fr.f,
      agg:'Quadro '+fr.type+' #'+(fr.f+1)+': '+fr.bytes+' bytes em '+fr.np+' pacotes RTP (SSRC 0x1a2b3c4d, PT 96, marcador no último pacote). Mostrado como uma seta só.',
      info:'5004 → '+CLI.port+' RTP quadro '+fr.type+' #'+(fr.f+1)+': '+fr.np+' pacotes, '+fr.bytes+' bytes'+(problem?' ('+tags.join('; ')+')':'')});
    tags.forEach((t: any)=>s.tags.push(t));
    if(fr.type==='I') lg(tr,fr.t,'Quadro I #'+(fr.f+1)+': '+fr.np+' pacotes ('+fr.bytes+' bytes). É o quadro de referência: os próximos P dependem dele.','data');
    if(fr.nq) lg(tr,fr.t,'Quadro '+fr.type+' #'+(fr.f+1)+': '+fr.nq+(fr.nq===1?' pacote descartado':' pacotes descartados')+' porque a fila do enlace passou de '+QMS+' ms (a taxa do vídeo excede o que o enlace entrega).','loss');
    if(fr.nl) lg(tr,fr.t,'Quadro '+fr.type+' #'+(fr.f+1)+': '+fr.nl+(fr.nl===1?' pacote perdido':' pacotes perdidos')+' na rede. O UDP não avisa e o RTP não retransmite.','loss');
    if(fr.nlate) lg(tr,fr.play,'Quadro '+fr.type+' #'+(fr.f+1)+': '+fr.nlate+(fr.nlate===1?' pacote chegou':' pacotes chegaram')+' depois do prazo de exibição e '+(fr.nlate===1?'foi descartado':'foram descartados')+' pelo buffer de reprodução.','loss');
    if(fr.own){
      lg(tr,fr.play,fr.type==='I'?'Quadro I #'+(fr.f+1)+' incompleto: o player não consegue decodificar e congela a imagem até o próximo quadro I.':'Quadro P #'+(fr.f+1)+' incompleto: o player exibe com artefatos, e o erro se propaga até o próximo quadro I.','loss');
      if(evN++<18) ev(tr,fr.play,'c',fr.type+' #'+(fr.f+1)+': '+(fr.status==='congelado'?'imagem congela':'artefatos'));
    }
  });
  tr.metro.push({t:frames[0].play,label:'Primeiro quadro',sub:'após o buffer de '+P.jb+' ms'});
  tr.metro.push({t:NF*FI,label:'Fim do envio',sub:NF+' quadros'});
  tr.metro.push({t:lastPlay,label:'Fim da exibição',sub:'último quadro'});
  ev(tr,lastPlay,'c','Fim da exibição');
  lg(tr,lastPlay,'Último quadro exibido. '+cnt.ok+' de '+NF+' quadros saíram sem defeito.','udp');

  const dur=P.vdur, frozenMs=Math.round(cnt.congelado*FI);
  const pc=(v: any): any=>Math.round(v/NF*1000)/10;
  const fx=(v: any): any=>(Math.round(v*10)/10).toString().replace('.',',');
  tr.vsamples=[]; for(let b=0;b<nb;b++) tr.vsamples.push({t:b*BIN,sent:sentB[b]*8/BIN,recv:recvB[b]*8/BIN});
  tr.frames=frames;
  tr.stats={
    'Vídeo':P.vdur+' s, '+NF+' quadros a '+FPS+' quadros/s (GOP de '+GOP+', 1 quadro I por segundo), '+P.vbr+' kbit/s',
    'Pacotes enviados':C.pk,
    'Perdidos na rede (aleatório)':C.rand,
    'Descartados na fila do enlace':C.queue,
    'Chegaram fora do prazo (descartados no player)':C.late,
    'Entregues a tempo':C.ok+' ('+Math.round(C.ok/C.pk*1000)/10+'%)',
    'Quadros sem defeito':cnt.ok+' de '+NF+' ('+pc(cnt.ok)+'%)',
    'Quadros com artefatos':cnt.artefatos,
    'Quadros congelados':cnt.congelado+' ('+frozenMs+' ms de imagem parada)',
    'Jitter estimado (RFC 3550)':fx(J)+' ms (máximo '+fx(Jmax)+' ms)',
    'Atraso de rede (médio / máximo)':got.length?fx(dSum/got.length)+' ms / '+fx(dMax)+' ms':'-',
    'Atraso até a exibição':fx(FI+ow+P.jb)+' ms (quadro + propagação + buffer)',
    'Taxa enviada / entregue a tempo':Math.round(sentBytes*8/dur/1000)+' / '+Math.round(okBytes*8/dur/1000)+' kbit/s (enlace de '+(P.bw*1000)+' kbit/s)'
  };
  tr.raw={kind:'video',N:NF,fps:FPS,delivered:C.ok,lost:C.rand+C.queue,order:'por número de sequência RTP',retx:0,time:lastPlay,
    pk:C.pk,rand:C.rand,queue:C.queue,late:C.late,ok:C.ok,cnt:cnt,frozenMs:frozenMs,jitter:J,jitterMax:Jmax,delay:got.length?dSum/got.length:0,delayMax:dMax,
    display:FI+ow+P.jb,sent:Math.round(sentBytes*8/dur/1000),recv:Math.round(okBytes*8/dur/1000),iFrames:frames.filter((f: any)=>f.type==='I').length,
    iBad:frames.filter((f: any)=>f.type==='I' && f.status!=='ok').length,qdMax:QMS,unit:unit};
  return tr;
}

export { simTcp, simUdp, simDns, simDownload, simVideo };
