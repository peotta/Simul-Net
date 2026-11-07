// Controles do painel do simulador de RIP.
import type { ControlDef } from '../../../sim-core/ui';

const LINKS = [['L1', 'L1: R1 / R2'], ['L2', 'L2: R1 / R4'], ['L3', 'L3: R2 / R3'], ['L4', 'L4: R2 / R5'], ['L5', 'L5: R3 / R6'], ['L6', 'L6: R4 / R5'], ['L7', 'L7: R5 / R6']] as [string, string][];

export const controls: ControlDef[] = [
  {
    id: 'dir', grp: 'Teste', label: 'Sentido do tráfego', type: 'select', wide: true, def: 'PC-A',
    opts: [['PC-A', 'PC-A (192.168.1.10) → PC-B'], ['PC-B', 'PC-B (192.168.2.10) → PC-A']],
    help: { t: 'Sentido do tráfego', s: 'Quem envia o pacote de teste ao final da simulação.', p: ['Escolhe se o pacote sai do PC-A para o PC-B ou do PC-B para o PC-A.'] },
  },
  {
    id: 'sh', grp: 'Protocolo', label: 'Split horizon com poison reverse', type: 'check', def: true,
    help: { t: 'Split horizon com poison reverse', s: 'Anuncia de volta, com métrica 16, a rota aprendida de um vizinho.', p: ['<b>Marcado:</b> o roteador diz ao vizinho de quem aprendeu a rota que ela é inalcançável (métrica 16), o que evita o laço entre dois vizinhos (RFC 2453, seção 3.4.3).', '<b>Desmarcado:</b> o vetor é anunciado igual a todos os vizinhos, e a contagem ao infinito aparece mais cedo.'] },
  },
  {
    id: 'cost23', subs: ['conv'], grp: 'Teste', label: 'Custo OSPF do enlace R2 / R3', type: 'select', wide: true, num: true, def: 10,
    opts: [[10, '10 (padrão)'], [50, '50'], [100, '100']],
    help: { t: 'Custo do enlace R2 / R3', s: 'Um parâmetro que o RIP ignora.', p: ['O RIP usa só o número de saltos. Aumente o custo e veja que o caminho escolhido não muda, mesmo ficando bem mais caro.', 'O resultado mostra, para comparação, o caminho que um protocolo de estado de enlace (OSPF) escolheria com esse custo.'] },
  },
  {
    id: 'link', subs: ['falha'], grp: 'Falha', label: 'Enlace que cai', type: 'select', wide: true, def: 'L3', opts: LINKS,
    help: { t: 'Enlace que cai', s: 'O enlace que falha depois que a rede converge.', p: ['O caminho inicial é R1, R2, R3, R6 (3 saltos). Se o enlace não faz parte dele, o caminho não muda, mas pode haver mudanças de tabela em outros roteadores.'] },
  },
  {
    id: 'link2', subs: ['falha'], grp: 'Falha', label: 'Segundo enlace que cai (opcional)', type: 'select', wide: true, def: 'none',
    opts: [['none', 'Nenhum'], ...LINKS],
    help: { t: 'Segundo enlace', s: 'Derruba um segundo enlace junto com o primeiro.', p: ['Para isolar o PC-B, derrube L5 (R3 / R6) e L7 (R5 / R6). Como a rede fica dividida, as rotas para R6 só terminam em 16 depois de várias rodadas: é a <b>contagem ao infinito</b>.'] },
  },
  {
    id: 'root', grp: 'Tabelas', label: 'Ver as tabelas do roteador', type: 'select', wide: true, def: 'R1',
    opts: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((r) => [r, r] as [string, string]),
    help: { t: 'Ver as tabelas do roteador', s: 'Escolhe o roteador cujas tabelas aparecem nas abas Vetores e Tabela de roteamento.', p: ['A tabela acompanha o relógio: ela muda a cada rodada de Response.', 'Não muda o resultado da simulação.'] },
  },
];
