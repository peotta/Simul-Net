// Textos de apoio: grupos de cenário e resumo de cada cenário.
export const GROUP_DOC: Record<string, string> = {
  "TCP": "Ataques que abusam do estado da conexão TCP (fila de conexões, números de sequência, sessões abertas) ou das respostas do TCP para mapear a rede.",
  "UDP": "Ataques que exploram a falta de conexão do UDP: volume, origem falsificada, reflexão, amplificação e varredura."
};
export const SCEN_SHORT: Record<string, string> = {
  "syn-flood": "Milhares de SYN sem o ACK final esgotam a fila de conexões do servidor.",
  "rst-injection": "Um RST forjado tenta derrubar uma sessão TCP ativa.",
  "session-hijack": "Segmentos forjados tentam entrar em uma sessão já estabelecida.",
  "ack-scan": "Sondas ACK mapeiam as regras do firewall pelas respostas RST.",
  "slowloris": "Conexões HTTP lentas ocupam todos os workers com pouquíssimo tráfego.",
  "slow-scan": "Sondas espaçadas por horas passam abaixo dos limiares do IDS.",
  "udp-flood": "Datagramas em alta taxa saturam a banda e a CPU da vítima.",
  "botnet": "Milhares de origens reais somam um volume maior que o enlace da vítima.",
  "amplification": "Uma requisição pequena com origem falsa vira uma resposta enorme contra a vítima.",
  "reflection": "Terceiros são induzidos a responder à vítima, que nunca pediu nada.",
  "udp-scan": "Sondas UDP descobrem portas abertas pelo ICMP Port Unreachable.",
  "dns-water-torture": "Nomes aleatórios, via resolvedores legítimos, sobrecarregam o DNS autoritativo."
};
export const CHIP: Record<string, string> = {
  "syn-flood": "SYN flood",
  "rst-injection": "RST injection",
  "session-hijack": "session hijacking",
  "ack-scan": "ACK / port scan",
  "slowloris": "Slowloris",
  "slow-scan": "varredura lenta",
  "udp-flood": "flood",
  "botnet": "DDoS botnet",
  "amplification": "amplification",
  "reflection": "spoofing / reflection",
  "udp-scan": "port scan",
  "dns-water-torture": "DNS water torture"
};
