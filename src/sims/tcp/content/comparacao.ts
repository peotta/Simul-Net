// Modo "TCP x UDP" visto pelo TCP: o foco é o que o TCP faz para garantir a entrega; o UDP entra como referência.
import type { ScenarioOverride } from '../../transporte-base/derive';

export const comparacao: Record<string, ScenarioOverride> = {
  closs: {
    what: '<p>O TCP e o UDP enviam 20 segmentos pela mesma rede, com as mesmas perdas. Observe o que só o <b>TCP</b> faz: detecta cada perda, retransmite e entrega tudo em ordem, ao custo de mais tempo.</p><p>Veja a aba Resultados.</p>',
    doc: {
      short: 'O que o TCP faz para entregar tudo, comparado ao UDP sem garantias.',
      concept: 'O TCP e o UDP enviam o mesmo volume pela mesma rede, com <b>as mesmas perdas</b> (mesma semente). O UDP serve só de referência: termina antes e entrega o que chegou. O TCP detecta cada perda por ACKs duplicados ou por timeout, retransmite e entrega todos os dados, em ordem, e por isso demora mais.',
      observe: ['No diagrama: as retransmissões do TCP, que o UDP não faz.', 'Na aba Janela (cwnd): como cada perda reduz a janela do TCP.', 'Na aba Resultados: o tempo extra do TCP e o fato de ele entregar 100% dos dados.'],
      cols: ['Unidade', 'Função', 'Quem envia'],
      msgs: [['Segmento TCP', 'com ACK e retransmissão', 'cliente'], ['Datagrama UDP', 'referência, sem confirmação', 'cliente']],
      why: 'Mostra o preço da confiabilidade: a garantia de entrega vem de confirmações e retransmissões, que custam tempo.',
    },
  },
  cord: {
    what: '<p>Sem perdas, mas com 15% dos pacotes atrasados na rede. O <b>TCP</b> reordena no buffer do receptor e pode até retransmitir sem necessidade, se a desordem gerar três ACKs duplicados. O UDP, de referência, entrega fora de ordem.</p>',
    doc: {
      short: 'O TCP reordena os dados; a desordem pode gerar retransmissão desnecessária.',
      concept: 'A <b>reordenação</b> acontece quando pacotes seguem caminhos diferentes ou esperam mais em alguma fila. O TCP guarda no buffer o que chega adiantado e entrega à aplicação na ordem certa. Cada segmento fora de ordem gera um ACK duplicado, e três deles disparam o fast retransmit, mesmo sem perda.',
      observe: ['No TCP: ACKs duplicados causados só pela desordem, sem nenhuma perda.', 'Se surgirem três ACKs duplicados, o TCP retransmite sem necessidade (retransmissão espúria).', 'Na aba Resultados: o UDP, de referência, entregou fora de ordem.'],
      cols: ['Evento', 'Função', 'Origem'],
      msgs: [['Segmento atrasado', 'chega depois dos seguintes', 'rede'], ['ACK duplicado', 'causado pela desordem', 'servidor']],
      why: 'Mostra que ACK duplicado nem sempre significa perda. Pilhas modernas detectam retransmissões espúrias e desfazem a redução da janela.',
    },
  },
};
