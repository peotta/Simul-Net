// Controles do painel do simulador OSI.
import type { ControlDef } from '../../../sim-core/ui';

export const controls: ControlDef[] = [
  { id: 'rtt', num: true, grp: 'Rede', label: 'RTT (ms)', type: 'select', opts: [[4, '4'], [12, '12'], [40, '40'], [120, '120']], def: 12, help: { t: 'RTT', s: 'Tempo de ida e volta da requisição.', p: ['Define o tempo que cada quadro leva em cada salto. Valores altos servem para ver o diagrama mais espaçado.', 'Não muda o que cada camada faz, só os tempos mostrados.'] } },
  { id: 'vlan', grp: 'Rede local', label: 'Enlace tronco com etiqueta 802.1Q', type: 'check', def: false, help: { t: 'Etiqueta 802.1Q', s: 'Marca o quadro com a VLAN no enlace entre o switch e o roteador.', p: ['Marcado, o switch acrescenta 4 bytes ao quadro (TPID 0x8100 e a VLAN 10) ao enviá-lo ao roteador pelo tronco e os retira na volta. O FCS é recalculado em cada alteração.', 'É um exemplo de como a camada 2 "marca" um quadro sem que as camadas de cima percebam.'] } },
];
