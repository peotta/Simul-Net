// Modo "TCP x UDP" visto pelo UDP: o foco é o que a aplicação ganha e perde sem as garantias do TCP; o TCP entra como referência.
import type { ScenarioOverride } from '../../transporte-base/derive';

export const comparacao: Record<string, ScenarioOverride> = {
  closs: {
    what: '<p>Os dois protocolos enviam 20 datagramas ou segmentos pela mesma rede, com as mesmas perdas. Observe o que o <b>UDP</b> faz: termina antes e entrega só o que chegou, deixando as lacunas para a aplicação decidir.</p><p>Veja a aba Resultados.</p>',
    doc: {
      short: 'O UDP é mais rápido e entrega só o que chegou; o TCP, de referência, entrega tudo.',
      concept: 'O UDP e o TCP enviam o mesmo volume pela mesma rede, com <b>as mesmas perdas</b> (mesma semente). O UDP não espera confirmação nem retransmite: termina antes e entrega apenas o que chegou, e cabe à aplicação tolerar ou tratar as lacunas. O TCP serve de referência: demora mais, mas entrega tudo, em ordem.',
      observe: ['Na aba Resultados: o tempo total e a quantidade entregue pelo UDP, comparados aos do TCP.', 'No diagrama: as lacunas do UDP, sem nenhuma retransmissão.', 'Na aba Experimento: a comparação explicada a partir da execução.'],
      cols: ['Unidade', 'Função', 'Quem envia'],
      msgs: [['Datagrama UDP', 'sem confirmação', 'cliente'], ['Segmento TCP', 'referência, com ACK e retransmissão', 'cliente']],
      why: 'Voz e vídeo em tempo real preferem perder um pacote a esperar por ele: o UDP entrega o que chegou na hora, e a aplicação esconde a perda.',
    },
  },
  cord: {
    what: '<p>Sem perdas, mas com 15% dos pacotes atrasados na rede. O <b>UDP</b> entrega os datagramas na ordem em que chegam, fora de ordem. O TCP, de referência, reordena no buffer do receptor.</p>',
    doc: {
      short: 'O UDP entrega na ordem de chegada; reordenar é problema da aplicação.',
      concept: 'A <b>reordenação</b> acontece quando pacotes seguem caminhos diferentes ou esperam mais em alguma fila. O UDP não tem números de sequência: entrega os datagramas na ordem em que chegaram. Quem precisa de ordem, como o RTP, numera os pacotes por conta própria e usa um buffer. O TCP, de referência, reordena sozinho.',
      observe: ['Na aba Resultados: quantos datagramas UDP chegaram fora de ordem.', 'No diagrama: o datagrama atrasado chega depois dos seguintes, sem nenhuma correção.', 'Compare com o TCP, que guarda o que chega adiantado e entrega na ordem certa.'],
      cols: ['Evento', 'Função', 'Origem'],
      msgs: [['Datagrama atrasado', 'chega depois dos seguintes', 'rede'], ['Datagrama UDP', 'entregue na ordem de chegada', 'servidor']],
      why: 'Mostra que, no UDP, ordem e perda são assuntos da aplicação: por isso o RTP numera os pacotes e o player usa um buffer.',
    },
  },
};
