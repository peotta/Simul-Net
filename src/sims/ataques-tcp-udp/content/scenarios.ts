// Cenários e documentação do simulador de ataques e defesas TCP/UDP (nível defensivo: aviso, efeito e defesa).
import type { ScenarioDef, ScenarioDoc } from '../../../sim-core/ui';
import type { ScenData } from '../model';
import { DEFENSES, SCEN, VICTIM } from './data';
import { GROUP_DOC, SCEN_SHORT } from './texts';

export const stageTitles: Record<string, string> = {
  tcp: 'Diagrama de sequência: ataque TCP, defesas em camadas e cliente legítimo',
  udp: 'Diagrama de sequência: ataque UDP, defesas em camadas e cliente legítimo',
};

const esc = (t: string): string => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const modeText = (id: string, s: ScenData): string => {
  if (s.mode === 'reflect') return 'O atacante envia requisições com a origem falsificada (o IP da vítima, ' + VICTIM + ') a um serviço refletor, que responde à vítima com fator de amplificação ' + s.factor + 'x. A vítima recebe tráfego de IPs legítimos, os dos refletores.';
  if (s.mode === 'scan') return 'O atacante envia sondas à vítima (' + VICTIM + ') e deduz portas e regras de filtragem pelas respostas' + (s.every ? '; aqui, uma sonda a cada ' + s.every + ' ciclos, de propósito abaixo dos limiares de detecção' : '') + '.';
  if (id === 'dns-water-torture') return 'Os bots não falam direto com a vítima: enviam as consultas a resolvedores recursivos legítimos (de provedores e DNS públicos), que as repassam ao servidor autoritativo da vítima (' + VICTIM + '). Por isso as origens que chegam são resolvedores reais.';
  if (s.multi) return 'Milhares de bots enviam tráfego ao mesmo tempo, cada um com o seu IP real, contra a vítima (' + VICTIM + '). O volume chega pela operadora antes de alcançar o firewall.';
  return 'O atacante envia o tráfego direto à vítima (' + VICTIM + '), passando pela operadora e pelo firewall da borda.';
};

const example = (e: string): string => e.replace(/\{src\}/g, '198.51.100.23').replace(/\{refl\}/g, '192.0.2.53').replace(/\{sport\}/g, '40211').replace(/\{dport\}/g, '161').replace(/\{seq\}/g, '381927113').replace(/\{seq1\}/g, '381927114').replace(/\{rand\}/g, 'x7f3k2').replace(/\{pct\}/g, '92');

export const scenarios: ScenarioDef[] = Object.keys(SCEN).map((id) => {
  const s = SCEN[id];
  const sub = s.proto === 'TCP' ? 'tcp' : 'udp';
  return {
    id,
    g: s.proto,
    sub,
    label: s.title,
    set: { [sub === 'tcp' ? 'attackTcp' : 'attackUdp']: id },
    what: '<p>' + modeText(id, s) + '</p><p>Controle essencial: ' + s.key.map((c) => '<b>' + esc(DEFENSES[c].name) + '</b>').join(' e ') + '. A eficácia, o ponto de atuação e o motivo de cada controle estão na aba Efeito dos controles.</p>',
  };
});

export const groupDoc: Record<string, string> = GROUP_DOC;

export const scenDoc: Record<string, ScenarioDoc> = Object.fromEntries(
  Object.keys(SCEN).map((id) => {
    const s = SCEN[id];
    return [
      id,
      {
        short: SCEN_SHORT[id],
        concept: esc(s.description),
        observe: s.indicators.map(esc),
        msgsTitle: 'Evidências típicas no log',
        cols: ['Fonte', 'Registro'],
        msgs: s.evidence.map((e) => {
          const x = example(e);
          const k = x.indexOf(': ');
          return k > 0 && k < 30 ? [esc(x.slice(0, k)), '<code>' + esc(x.slice(k + 2)) + '</code>'] : ['observação', esc(x)];
        }),
        why: 'Contramedidas recomendadas: ' + s.mitigations.map(esc).join('; ') + '. Risco residual: ' + esc(s.residual),
      } as ScenarioDoc,
    ];
  }),
);
