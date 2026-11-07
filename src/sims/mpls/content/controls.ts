// Controles do painel do simulador de MPLS.
import type { ControlDef } from '../../../sim-core/ui';

export const controls: ControlDef[] = [
  {
    id: 'service', grp: 'Serviço', label: 'Serviço', type: 'select', wide: true, def: 'ip',
    opts: [['ip', 'IP sobre MPLS (1 rótulo)'], ['vpn', 'L3VPN (pilha de 2 rótulos)']],
    help: { t: 'Serviço', s: 'Como o núcleo MPLS é usado.', p: ['<b>IP sobre MPLS:</b> todos os LSRs conhecem as redes dos clientes e o pacote leva 1 rótulo.', '<b>L3VPN:</b> as redes dos clientes ficam só na VRF dos PEs, trocadas por MP-BGP; o pacote leva 2 rótulos (transporte e VPN).'] },
  },
  {
    id: 'php', grp: 'Egresso e TTL', label: 'Rótulo do egresso (PHP)', type: 'select', wide: true, def: 'implicit',
    opts: [['implicit', 'implicit-null (3): PHP'], ['explicit', 'explicit-null (0)'], ['none', 'sem PHP (rótulo próprio)']],
    help: { t: 'Rótulo do egresso (PHP)', s: 'O que o PE de saída anuncia para as próprias FECs.', p: ['<b>implicit-null (3):</b> o penúltimo salto remove o rótulo (PHP) e o PE de saída faz uma só consulta.', '<b>explicit-null (0):</b> o rótulo 0 chega ao PE de saída, preservando o campo TC de QoS.', '<b>sem PHP:</b> o egresso anuncia um rótulo próprio e faz o pop e a consulta IP.'] },
  },
  {
    id: 'prop', grp: 'Egresso e TTL', label: 'Propagar TTL (modelo Uniform)', type: 'check', def: true,
    help: { t: 'Propagar TTL', s: 'Copia o TTL do IP para o rótulo (modelo Uniform).', p: ['<b>Marcado (Uniform):</b> o TTL do IP é copiado para o rótulo, e os P aparecem no traceroute.', '<b>Desmarcado (Pipe):</b> o rótulo começa com TTL 255 e o núcleo fica invisível para o cliente.', 'Equivale ao comando <code>mpls ip propagate-ttl</code> do Cisco IOS.'] },
  },
  {
    id: 'dir', subs: ['dados', 'ttl', 'falha'], grp: 'Teste', label: 'Sentido do tráfego', type: 'select', wide: true, def: 'H-A',
    opts: [['H-A', 'H-A (192.168.1.10) → H-B'], ['H-B', 'H-B (192.168.2.10) → H-A']],
    help: { t: 'Sentido do tráfego', s: 'Quem envia o ping e o traceroute.', p: ['Escolhe se o teste sai de H-A para H-B ou de H-B para H-A.', 'LSPs são unidirecionais: cada sentido usa rótulos diferentes.'] },
  },
  {
    id: 'ctl', subs: ['dados'], grp: 'Teste', label: 'Plano de controle', type: 'select', wide: true, def: 'ok',
    opts: [['ok', 'LSPs instalados (LDP completo)'], ['semldp', 'Só o IGP (sem rótulos)']],
    help: { t: 'Plano de controle', s: 'Se o LDP já montou os LSPs antes do teste.', p: ['<b>LSPs instalados:</b> o LDP descobriu vizinhos, abriu sessões, distribuiu rótulos e instalou a LFIB.', '<b>Só o IGP:</b> ainda não há rótulos. No IP sobre MPLS o pacote segue por roteamento IP comum; na L3VPN o PE o descarta, porque não há rota VPN sem LDP e MP-BGP.'] },
  },
  {
    id: 'fail', subs: ['falha'], grp: 'Falha', label: 'Enlace que cai', type: 'select', wide: true, def: 'L4',
    opts: [['L1', 'L1: PE1 / P1'], ['L2', 'L2: PE1 / P2'], ['L3', 'L3: P1 / P2'], ['L4', 'L4: P1 / P3'], ['L5', 'L5: P2 / P4'], ['L6', 'L6: P3 / P4'], ['L7', 'L7: P3 / PE2'], ['L8', 'L8: P4 / PE2']],
    help: { t: 'Enlace que cai', s: 'O enlace do núcleo que falha entre o primeiro e o segundo ping.', p: ['Qualquer falha isolada mantém o núcleo conectado: PE1 e PE2 têm dois caminhos.', 'Se o enlace não fazia parte do LSP, o caminho não muda. Para ver a troca de rótulos, escolha um enlace do caminho (por padrão, PE1, P1, P3 e PE2).'] },
  },
  {
    id: 'root', grp: 'Tabelas', label: 'Ver LIB / LFIB do LSR', type: 'select', wide: true, def: 'PE1',
    opts: [['PE1', 'PE1 (PE)'], ['P1', 'P1 (P)'], ['P2', 'P2 (P)'], ['P3', 'P3 (P)'], ['P4', 'P4 (P)'], ['PE2', 'PE2 (PE)']],
    help: { t: 'Ver LIB / LFIB do LSR', s: 'Escolhe o LSR cujas tabelas aparecem na aba LIB / LFIB.', p: ['A <b>LIB</b> guarda os rótulos anunciados por todos os vizinhos (retenção liberal).', 'A <b>LFIB</b> guarda só o rótulo do próximo salto do IGP, que é o usado de fato no encaminhamento. Não muda o resultado da simulação.'] },
  },
];
