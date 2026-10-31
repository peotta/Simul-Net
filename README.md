# Simul-Net

[![Publicação no GitHub Pages](https://github.com/peotta/Simul-Net/actions/workflows/deploy.yml/badge.svg)](https://github.com/peotta/Simul-Net/actions/workflows/deploy.yml)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

**Site:** <https://peotta.github.io/Simul-Net/> | **Wiki:** <https://github.com/peotta/Simul-Net/wiki> | **Documentação:** [docs/simuladores](docs/simuladores/README.md)

Simuladores visuais de redes e protocolos seguros, da Universidade de Brasília (UnB). Cada simulador mostra, passo a passo, como um protocolo funciona, como falha e como se defende, com diagrama de sequência, captura de pacotes, campos das mensagens e explicação do experimento. Tudo roda no navegador, sem servidor.

Projeto acadêmico do curso de Engenharia de Redes de Comunicação, sob responsabilidade do Prof. Dr. Laerte Peotta de Melo. Projeto irmão: [CryptoNet Lab](https://peotta.github.io/CryptoNet/#/).

![Página inicial do Simul-Net, com as categorias de simuladores](docs/imagens/hub.png)

Destaques: diagrama de sequência, captura de pacotes e campos das mensagens em cada simulador; cenários de falha e de defesa; conteúdo conferido nas RFCs vigentes, com link para o [rfc-editor.org](https://www.rfc-editor.org); acessibilidade verificada por testes automáticos (axe-core e contraste WCAG AA).

## Simuladores

| Categoria | Simulador |
| --- | --- |
| Camada de enlace e redes locais | Switching e aprendizado de MAC (tabela de endereços, inundação, filtragem, envelhecimento, broadcast, multicast com IGMP snooping, inundação de MAC e segurança de porta), STP, RSTP e MSTP (eleição da raiz, estados, reconvergência, tempestade de broadcast, BPDU Guard e Root Guard), VLAN e trunking 802.1Q (marcação, isolamento, router-on-a-stick, VLAN nativa e VLAN hopping) |
| Roteamento e serviços de rede | Roteamento (OSPF e RIPv2), ARP (resolução de endereços, proxy ARP, ARP gratuito, conflito de endereço, failover e envenenamento de cache com as defesas), DHCP (DORA), ICMP (ping e traceroute), BGP (sessões e seleção de caminho), MPLS (LDP e L3VPN), NAT (SNAT, DNAT e NAPT) |
| Camada de transporte e segurança | TCP e UDP (com SACK, download TCP e vídeo UDP), Ataques e defesas TCP/UDP, HTTP/1.1, HTTP/2 e HTTP/3 (conexões, fluxos, QUIC, 0-RTT, perda de pacote e fallback) |
| Protocolos de rede seguros | SSH (negociação, chaves, autenticação, túneis), HTTPS e TLS (handshake, certificados, HSTS e comparação HTTP x HTTPS), DNS e DNSSEC (resolução, cache e TTL, cadeia de confiança, envenenamento de cache, amplificação, DoT e DoH), FTP, FTPS e SFTP (canais de controle e dados, NAT e firewall, TLS e SSH), Firewall (filtragem sem estado e com estado, DMZ e defesas) |

Em preparação: VPN (IPsec e WireGuard), WAF, SMTP e segurança de e-mail, IS-IS, SNMP, NTP, Wi-Fi (operação e segurança WPA2/WPA3), controle de congestionamento (Reno, CUBIC e BBR), 802.1X e RADIUS (EAP). A situação de cada um está no [índice de documentação](docs/simuladores/README.md).

> Os simuladores têm finalidade didática. Valores de chaves, hashes e assinaturas são ilustrativos e não oferecem segurança real.
>
> Os cenários de ataque ficam no nível defensivo: mostram o aviso, o efeito e a defesa, sem passo a passo ofensivo. Uso exclusivo para fins de ensino e pesquisa.

## Desenvolvimento

Requer Node.js 22.12 ou superior (o fluxo de publicação usa o Node 24). Pilha: React 19, TypeScript, Vite 7, Tailwind CSS 4, Vitest e Playwright.

```bash
npm install          # instala as dependências
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
```

### Estrutura de pastas

| Pasta | Conteúdo |
| --- | --- |
| `src/sims/` | simuladores nativos (um por pasta: `engine`, `content` e `protocol.ts`), `native.ts` e o registro `registry.ts`, fonte única dos simuladores |
| `src/sim-core/` | núcleo compartilhado: contrato do motor, `Trace` e componentes das abas |
| `src/components/`, `src/pages/`, `src/layouts/` | hub, cartões, páginas e layout |
| `public/sims/` | simuladores legados, em HTML |
| `docs/` | arquitetura, documentos dos simuladores (`docs/simuladores/`) e imagens |
| `scripts/` | gerador da documentação e da wiki (`gerar-wiki.mjs`) |
| `tests/` e `e2e/` | testes unitários (Vitest) e de ponta a ponta (Playwright) |

## Testes

```bash
npm test             # executa os testes (Vitest) uma vez
npm run test:watch   # modo contínuo
npm run typecheck    # verificação de tipos
npm run build        # gera o dist/, necessário antes do teste de ponta a ponta
npm run test:e2e     # testes de ponta a ponta, em um Chrome instalado (veja abaixo)
```

Os testes unitários verificam a integridade do registro de simuladores (arquivos existentes, identificadores, categorias, pontuação), os requisitos de cada página legada (título, descrição, canônica, crédito, volta ao Simul-Net) e a acessibilidade da interface (axe-core).

### Testes de ponta a ponta

`npm run test:e2e` abre o site gerado (`dist/`) em um Chrome real, com o Playwright, e para **cada simulador disponível no registro** (um simulador novo entra sozinho):

- percorre todos os modos e todos os cenários prontos, clicando nos botões de ação e abrindo todas as abas, e falha se houver qualquer erro de JavaScript;
- confere que a bancada de trabalho cabe na tela (sem rolagem da página em 1366x768 e 1600x900) e que cada quadro destaca e encaixa de volta na posição original;
- mede o contraste de cores (WCAG AA) no hub, nos dois temas, e em cada simulador nativo;
- confere o hub: as categorias, a página de cada simulador com o iframe e o redirecionamento do endereço antigo.

Usa o Chrome instalado na máquina (sem baixar navegadores). No GitHub Actions o teste roda antes da publicação, com o build feito com `VITE_BASE=/Simul-Net/`; a variável `E2E_BASE` acompanha esse caminho. Se falhar, o relatório fica como artefato da execução.

## Build e publicação

```bash
npm run build        # gera a pasta dist/
npm run preview      # serve dist/ localmente
```

O caminho base vem da variável `VITE_BASE` (padrão `/`). O roteamento usa `HashRouter`, então recarregar qualquer página funciona em hospedagem estática.

Para publicar no GitHub Pages: em *Settings > Pages*, escolha *Source: GitHub Actions* e envie o código para a branch `main`. O fluxo [.github/workflows/deploy.yml](.github/workflows/deploy.yml) executa os testes, gera o build com `VITE_BASE=/<nome-do-repositório>/` e publica em `https://peotta.github.io/Simul-Net/`.

## Documentação

### Arquitetura

A arquitetura, o contrato do motor de simulação, o modelo misto (simuladores nativos em React e TypeScript e simuladores legados em HTML) e os testes estão em [docs/arquitetura.md](docs/arquitetura.md). O passo a passo para adicionar um simulador está na seção 10 desse documento.

### Documentação dos simuladores

Cada simulador disponível tem um documento em [docs/simuladores/](docs/simuladores/) (arquivo `<id>.md`, com índice em [docs/simuladores/README.md](docs/simuladores/README.md)). O documento reúne conceito, cenários, mensagens, campos, ajuda, referências e limitações, e todas as RFCs citadas têm link para o [rfc-editor.org](https://www.rfc-editor.org). Ele é gerado a partir dos próprios módulos, para não divergir do código, e o cartão de cada simulador no hub mostra o link "Documentação" automaticamente. Esse link abre a página interna `#/sim/<id>/documentacao`, que lê o arquivo Markdown e o apresenta com o visual da aplicação (`react-markdown` e `remark-gfm`), desenhando os diagramas de sequência e de topologia com o Mermaid nas cores padrão, como no GitHub. O Mermaid é carregado sob demanda, só ao abrir uma documentação, e a página tem o link "Ver no GitHub" para o arquivo original.

```bash
npm run docs:simuladores   # gera ou atualiza docs/simuladores/
```

O teste do registro falha se faltar o documento de algum simulador disponível. Versione o documento junto com o simulador.

### Wiki

A [wiki do projeto](https://github.com/peotta/Simul-Net/wiki) reúne a mesma documentação em formato de páginas navegáveis: página inicial, arquitetura, índice de simuladores, guia para contribuir e uma página por simulador. Também é gerada pelo código:

```bash
npm run wiki -- <pasta-de-saida>   # gera as páginas .md da wiki
```

Para publicar, clone `Simul-Net.wiki.git`, copie os `.md` gerados, faça o commit e o push. Como a wiki é pública, a publicação só ocorre com autorização expressa do autor.

## Como contribuir

Para criar ou alterar um simulador, siga o passo a passo da seção 10 de [docs/arquitetura.md](docs/arquitetura.md). Convenções do projeto:

- Idioma: português do Brasil, em tom acadêmico, direto e impessoal. Termos técnicos consagrados em inglês podem ser mantidos, com o significado esclarecido na primeira ocorrência.
- Pontuação: não usar travessão longo nem meia-risca (use hífen, dois-pontos, barra ou parênteses). Há teste automático.
- Rigor técnico: levantar as RFCs e os padrões vigentes no [rfc-editor.org](https://www.rfc-editor.org), conferir versões substituídas (por exemplo, a RFC 8446 foi substituída pela RFC 9846), citar RFC e seção e registrar as simplificações do simulador.
- Segurança: cenários de ataque somente no nível defensivo.
- Todo simulador novo entra em `src/sims/registry.ts`, com documento em `docs/simuladores/<id>.md` gerado por `npm run docs:simuladores`.
- Antes de enviar: `npm run typecheck` e `npm test`.
- Commits em português, no formato `tipo(escopo): descricao`, sem acentos.

## Como citar

Os metadados de citação estão em [CITATION.cff](CITATION.cff), e o GitHub oferece o botão "Cite this repository". Exemplo:

> MELO, Laerte Peotta de. *Simul-Net: simuladores visuais de redes e protocolos seguros*. Brasília: Universidade de Brasília, Departamento de Engenharia Elétrica, 2026. Disponível em: https://github.com/peotta/Simul-Net.

## Créditos

Simul-Net é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).

## Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE).
