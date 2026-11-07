// Controles do painel do simulador de OSPF.
import type { ControlDef } from '../../../sim-core/ui';

const L1 = [['L1', 'L1: R1 / R2 (custo 10)'], ['L2', 'L2: R1 / R4 (custo 20)'], ['L3', 'L3: R2 / R3 (custo 10)'], ['L4', 'L4: R2 / R5 (custo 15)'], ['L5', 'L5: R3 / R6 (custo 10)'], ['L6', 'L6: R4 / R5 (custo 10)'], ['L7', 'L7: R5 / R6 (custo 20)']] as [string, string][];
const MA = [['none', 'Nenhum (rede íntegra)'], ['MA1', 'MA1: R1 / R2 (área 1)'], ['MA2', 'MA2: R1 / R3 (área 1)'], ['MA3', 'MA3: R2 / R3 (área 1)'], ['MA4', 'MA4: R4 / R5 (área 0)'], ['MA5', 'MA5: R5 / R6 (área 0)'], ['MA6', 'MA6: R4 / R6 (área 0)'], ['MA7', 'MA7: R7 / R8 (área 2)'], ['MA8', 'MA8: R7 / R9 (área 2)'], ['MA9', 'MA9: R8 / R9 (área 2)'], ['MA10', 'MA10: R2 / R4 (área 0)'], ['MA11', 'MA11: R3 / R6 (área 0)'], ['MA12', 'MA12: R4 / R8 (área 0)'], ['MA13', 'MA13: R6 / R9 (área 0)']] as [string, string][];
const AREA_DE: Record<string, string> = { R1: ' (área 1)', R2: ' (ABR 1 e 0)', R3: ' (ABR 1 e 0)', R4: ' (área 0)', R5: ' (área 0)', R6: ' (área 0)', R7: ' (área 2)', R8: ' (ABR 2 e 0)', R9: ' (ABR 2 e 0)' };

export const controls: ControlDef[] = [
  {
    id: 'dir', grp: 'Teste', label: 'Sentido do tráfego', type: 'select', wide: true, def: 'PC-A',
    opts: [['PC-A', 'PC-A (192.168.1.10) → PC-B'], ['PC-B', 'PC-B (192.168.2.10) → PC-A']],
    help: { t: 'Sentido do tráfego', s: 'Quem envia o pacote de teste ao final da simulação.', p: ['Escolhe se o pacote sai do PC-A para o PC-B ou do PC-B para o PC-A.', 'Como o custo é o mesmo nos dois sentidos, o caminho de volta é o inverso da ida. Em redes reais, custos diferentes por interface podem tornar o caminho assimétrico.'] },
  },
  {
    id: 'ev', subs: ['evento'], grp: 'Evento', label: 'Tipo de evento', type: 'select', wide: true, def: 'custo',
    opts: [['custo', 'Mudança de custo de um enlace'], ['queda', 'Queda de enlace']],
    help: { t: 'Tipo de evento', s: 'O que acontece depois que a rede converge.', p: ['<b>Mudança de custo:</b> o administrador altera o custo da interface nas duas pontas do enlace. A topologia continua a mesma, mas o SPF pode escolher outro caminho.', '<b>Queda de enlace:</b> o enlace deixa de funcionar e as duas pontas perdem a adjacência.'] },
  },
  {
    id: 'link', subs: ['evento'], grp: 'Evento', label: 'Enlace afetado', type: 'select', wide: true, def: 'L3', opts: L1,
    help: { t: 'Enlace afetado', s: 'O enlace que muda de custo ou cai.', p: ['O caminho de menor custo inicial é R1, R2, R3, R6. Se o enlace escolhido não faz parte dele, o tráfego pode continuar pelo mesmo caminho, e ainda assim os dois roteadores do enlace originam novos LSAs.'] },
  },
  {
    id: 'custo', subs: ['evento'], grp: 'Evento', label: 'Novo custo (só na mudança de custo)', type: 'select', wide: true, num: true, def: 50,
    opts: [[1, '1'], [10, '10 (igual ao de L1, L3 e L5)'], [20, '20'], [30, '30'], [50, '50'], [100, '100']],
    help: { t: 'Novo custo', s: 'Custo OSPF configurado na interface.', p: ['A RFC 2328 trata o custo como um parâmetro configurável: quanto menor, mais preferido. A fórmula "largura de banda de referência dividida pela do enlace" é prática dos fabricantes.', 'Usado só quando o evento é mudança de custo. Se o valor for igual ao atual, nada muda.'] },
  },
  {
    id: 'link2', subs: ['evento'], grp: 'Evento', label: 'Segundo enlace que cai (opcional)', type: 'select', wide: true, def: 'none',
    opts: [['none', 'Nenhum'], ...L1],
    help: { t: 'Segundo enlace', s: 'Derruba um segundo enlace junto com o primeiro.', p: ['Usado só na queda de enlace. Para isolar o PC-B, derrube L5 (R3 / R6) e L7 (R5 / R6): R6 fica sem nenhum vizinho e o pacote é descartado.'] },
  },
  {
    id: 'mlink', subs: ['multi'], grp: 'Falha', label: 'Enlace fora de serviço', type: 'select', wide: true, def: 'none', opts: MA,
    help: { t: 'Enlace fora de serviço', s: 'Um enlace que já está caído quando a rede converge.', p: ['Com o enlace MA12 (R4 / R8) fora de serviço, o caminho do backbone para a área 2 passa por R6 e R9.', 'Dentro de uma área a falha altera o Router-LSA; entre áreas, o ABR muda o custo dos Summary LSAs.'] },
  },
  {
    id: 'root', subs: ['conv', 'evento'], grp: 'Tabelas', label: 'Ver a LSDB e a tabela do roteador', type: 'select', wide: true, def: 'R1',
    opts: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((r) => [r, r] as [string, string]),
    help: { t: 'Ver a LSDB e a tabela', s: 'Escolhe o roteador cujas tabelas aparecem nas abas LSDB e Tabela de roteamento.', p: ['Em área única, todas as LSDBs convergem para o mesmo conteúdo; a tabela de rotas, não: cada roteador tem a raiz do SPF em si mesmo.', 'Não muda o resultado da simulação.'] },
  },
  {
    id: 'rootm', subs: ['multi'], grp: 'Tabelas', label: 'Ver a LSDB e a tabela do roteador', type: 'select', wide: true, def: 'R1',
    opts: Object.keys(AREA_DE).map((r) => [r, r + AREA_DE[r]] as [string, string]),
    help: { t: 'Ver a LSDB e a tabela', s: 'Escolhe o roteador cujas tabelas aparecem nas abas.', p: ['Compare R1 (só a área 1 e Summary LSAs) com R2 (ABR: duas LSDBs, uma por área) e com R4 (só o backbone).', 'Não muda o resultado da simulação.'] },
  },
];
