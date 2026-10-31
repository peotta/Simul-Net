// Abas próprias do simulador de VLAN: configuração das portas e interfaces do roteador.
import { esc } from '../../../sim-core';
import type { TabDef } from '../../../sim-core/ui';
import { peerName, portsOfSwitch, R1, type Net } from '../model';

const NOMES: Record<string, string> = { a: 'Host A', b: 'Host B', c: 'Host C', d: 'Host D', m: 'Invasor', r1: 'Roteador R1' };

const portas: TabDef = {
  id: 'portas',
  label: 'Portas',
  render: (tr) => {
    const net = tr.raw.net as Net;
    let h = '<h3>Configuração das portas (como um comando de status de VLANs)</h3>';
    [1, 2].forEach((sw) => {
      h += '<h3>SW' + sw + '</h3><table class="sc-msgs"><thead><tr><th>Porta</th><th>Liga a</th><th>Modo</th><th>VLAN de acesso</th><th>VLAN nativa</th><th>VLANs permitidas</th></tr></thead><tbody>';
      portsOfSwitch(net, sw).forEach((p) => {
        const c = net.ports['sw' + sw + ':' + p];
        const peer = peerName(sw, p);
        const nome = peer.startsWith('sw') ? 'SW' + peer.slice(2, 3) : NOMES[peer];
        h += '<tr><td>' + p + '</td><td class="meaning">' + esc(nome) + '</td><td class="meaning">' + (c.mode === 'access' ? 'acesso' : 'tronco') + '</td><td class="meaning">' + (c.mode === 'access' ? c.vid : '-') + '</td><td class="meaning">' + (c.mode === 'trunk' ? c.native : '-') + '</td><td class="meaning">' + (c.mode === 'trunk' ? (c.allowed ? c.allowed.join(', ') : 'todas') : '-') + '</td></tr>';
      });
      h += '</tbody></table>';
    });
    h += '<p><b>Acesso:</b> a porta pertence a uma só VLAN e o quadro trafega sem tag. <b>Tronco:</b> a porta carrega várias VLANs, cada uma com a sua tag, exceto a nativa, que vai sem tag. <b>Permitidas:</b> as VLANs que o tronco aceita carregar.</p>';
    return h;
  },
};

const rotas: TabDef = {
  id: 'rotas',
  label: 'Roteador',
  subs: ['rota'],
  render: (tr) => {
    const R = tr.raw;
    const sub20 = R.rmode !== 'nosubif';
    let h = '<h3>Subinterfaces do R1 (porta ligada à p4 do SW1)</h3>';
    h += '<table class="sc-msgs"><thead><tr><th>Subinterface</th><th>Encapsulação</th><th>Endereço</th><th>Sub-rede</th></tr></thead><tbody>';
    h += '<tr><td>.10</td><td class="meaning">802.1Q, VLAN 10</td><td class="meaning">' + R1.gw10 + '/24</td><td class="meaning">192.168.10.0/24</td></tr>';
    if (sub20) h += '<tr><td>.20</td><td class="meaning">802.1Q, VLAN 20</td><td class="meaning">' + R1.gw20 + '/24</td><td class="meaning">192.168.20.0/24</td></tr>';
    h += '</tbody></table>';
    h += '<p>MAC do R1: ' + R1.mac + ' (o mesmo nas duas subinterfaces, pois o cabo é um só). ' + (sub20 ? 'As duas sub-redes são diretamente conectadas: não é preciso rota estática.' : 'A sub-rede 192.168.20.0/24 não está conectada ao R1 e não há rota para ela.') + '</p>';
    h += '<p>Uma alternativa ao roteador externo é o switch de camada 3 com uma <b>SVI</b> (interface virtual) por VLAN. O roteamento passa a ser interno ao equipamento, sem o enlace único como gargalo.</p>';
    return h;
  },
};

export const tabs: TabDef[] = [portas, rotas];
