// Cenários e documentação do simulador OSI (modo Jornada).
import type { ScenarioDef, ScenarioDoc } from '../../../sim-core/ui';

const jbase = { vlan: false };

export const scenarios: ScenarioDef[] = [
  { id: 'j-get', g: 'Jornada normal', sub: 'jor', label: 'Requisição e resposta HTTP', set: { ...jbase }, what: '<p>O navegador do cliente pede <b>GET /index.html</b> a um servidor em outra rede. A mensagem <b>desce</b> pelas sete camadas, cruza o switch e o roteador, <b>sobe</b> no servidor, e a resposta faz o caminho inverso.</p>' },
  { id: 'j-vlan', g: 'Jornada normal', sub: 'jor', label: 'Com etiqueta 802.1Q no tronco', set: { ...jbase, vlan: true }, what: '<p>Mesma jornada, mas o enlace entre o switch e o roteador é um <b>tronco 802.1Q</b>: o switch acrescenta uma etiqueta de 4 bytes ao quadro e a retira na volta. As camadas 3 e acima não percebem.</p>' },
];

export const groupDoc: Record<string, string> = {
  'Jornada normal': 'No modelo OSI, cada camada do emissor acrescenta o seu cabeçalho (encapsulamento) e a camada correspondente do receptor o retira e o confere (desencapsulamento). A PDU muda de nome a cada camada: dados, segmento, pacote, quadro e bits.',
};

export const stageTitles: Record<string, string> = {
  jor: 'Jornada de um quadro HTTP: as pilhas de camadas e o encapsulamento',
};

export const scenDoc: Record<string, ScenarioDoc> = {
  'j-get': {
    short: 'Encapsulamento no cliente, comutação, roteamento e desencapsulamento no servidor.',
    concept: 'O navegador gera a mensagem HTTP (camada 7). As camadas 5 e 6 não acrescentam nada aqui, pois não há TLS. O TCP cria o segmento (camada 4), o IPv4 cria o pacote (camada 3) e a Ethernet cria o quadro e o FCS (camada 2). A camada 1 transmite os bits. O switch lê só a camada 2. O roteador sobe até a camada 3, decrementa o TTL e monta um quadro novo para o próximo enlace.',
    observe: ['Na descida, cada camada acrescenta um cabeçalho, e o nome da PDU muda: dados, segmento, pacote, quadro, bits.', 'Entre os saltos, o MAC de origem e o de destino mudam, o TTL cai de 64 para 63 e o checksum do IP e o FCS são recalculados. O IP de origem, o de destino e as portas não mudam.', 'O switch aparece só nas camadas 1 e 2. O roteador, nas camadas 1 a 3.', 'A aba Bytes mostra o quadro real, com cada camada em uma cor.'],
    msgs: [['GET /index.html', 'requisição HTTP, três saltos', 'cliente, switch, roteador, servidor'], ['200 OK', 'resposta HTTP, três saltos', 'servidor, roteador, switch, cliente']],
    why: 'É o modelo mental de toda a área: cada protocolo vive em uma camada, e cada nó da rede só olha até a camada de que precisa.',
  },
  'j-vlan': {
    short: 'A camada 2 marca o quadro com a VLAN sem que a camada 3 perceba.',
    concept: 'No enlace tronco, o switch acrescenta ao quadro a etiqueta 802.1Q (4 bytes: TPID 0x8100 e o campo TCI, com a VLAN 10). O roteador retira a etiqueta ao receber e o resto do quadro segue igual. Como os bytes mudam, o FCS é recalculado.',
    observe: ['O quadro do salto 2 tem 4 bytes a mais e os campos do 802.1Q aparecem na aba Mensagem.', 'O IP, o TCP e o HTTP são idênticos aos do cenário sem VLAN.', 'Na volta, o switch retira a etiqueta antes de entregar ao cliente.'],
    msgs: [['GET /index.html', 'o salto 2 leva a etiqueta 802.1Q', 'switch para roteador'], ['200 OK', 'o salto 2 da volta leva a etiqueta', 'roteador para switch']],
    why: 'Mostra por que as VLANs são transparentes para as camadas superiores e por que uma configuração de tronco errada derruba a rede sem alterar nenhum IP.',
  },
};
