# Arquitetura do Simul-Net

## 1. Objetivo

O Simul-Net reúne simuladores visuais de redes e protocolos seguros em um único projeto, com registro central, testes automatizados e publicação própria. Ele substitui a organização anterior, em que cada simulador era um arquivo HTML independente, com CSS e JavaScript duplicados.

## 2. Estrutura de pastas

```text
Simul-Net/
  public/
    sims/                 simuladores legados (HTML autônomo) e redirecionamentos de endereços antigos
    favicon.svg
  src/
    sim-core/             núcleo dos simuladores nativos: trace, valores determinísticos e, em ui/, a bancada React
    sims/registry.ts      registro de categorias e simuladores (fonte única)
    sims/native.ts        mapa dos módulos nativos (carregados sob demanda)
    sims/ssh, https, ftp  motor (engine) e conteúdo (content) de cada simulador nativo
    pages/                Home, Category, SimPage, NativeSim, NotFound
    components/           SimCard
    layouts/              AppLayout (cabeçalho, navegação, tema, rodapé de crédito)
    docs/                 página de documentação: leitor de Markdown (DocView), diagramas (Mermaid) e âncoras
    hooks/                useTheme
  tests/                  registro, interface, núcleo, motores, integridade e impressões digitais dos módulos
  e2e/                    testes ponta a ponta (Playwright)
  docs/                   esta documentação
  .github/workflows/      testes e publicação no GitHub Pages
```

## 3. Registro de simuladores

`src/sims/registry.ts` é a única fonte de verdade. A página inicial, as categorias, os links de navegação e os testes leem dele. Cada entrada tem identificador (kebab-case), categoria, título, resumo, tópicos, especificações (RFCs), situação (`available` ou `planned`) e, quando disponível, o motor (`legado` ou `nativo`) e, no caso dos legados, o arquivo.

## 4. Simuladores legados e nativos

- **Nativo:** componente React com motor de simulação separado da interface e testado, na rota `/sim/:id`. SSH, HTTPS e TLS, FTP, FTPS e SFTP, ARP, ICMP, DHCP, NAT, DNS e DNSSEC e as versões do HTTP (HTTP/1.1, HTTP/2 e HTTP/3), o Firewall, o Switching, o STP, RSTP e MSTP e o VLAN e trunking (802.1Q) são nativos. Seguem o padrão visual e didático dos demais (abas, ajuda nos campos, rodapé de crédito) e têm a bancada de trabalho: tela única, quadros que destacam, movem, redimensionam, maximizam e recolhem, zoom do diagrama e alça de altura das abas.
- **Legado:** página autônoma em `public/sims/`, incorporada por `iframe` na rota `/sim/:id` e acessível em tela cheia. São os demais simuladores (roteamento, BGP, MPLS, TCP e UDP, ataques e defesas). Cada página mantém título, descrição, URL canônica, tags de compartilhamento e o rodapé de crédito padrão. O link de volta usa `target="_top"` para funcionar dentro e fora do `iframe`.
- **Modelo misto de propósito:** os simuladores legados continuam como estão. Migrar os que têm a lógica misturada à tela (80 a 160 referências ao DOM em 1.100 a 1.900 linhas de JavaScript cada) custaria muito e não muda o que o aluno vê. A camada nativa é usada nos simuladores novos (VPN, SMTP, IS-IS, SNMP, congestionamento, 802.1X; o DNS e DNSSEC já foi entregue, com cinco modos: resolução, DNSSEC, envenenamento de cache, amplificação e DoT/DoH; o ARP já foi entregue, com três modos: resolução, ARP gratuito e conflito, e envenenamento de cache; as versões do HTTP também, com um modo por versão e as abas Cascata e Comparação) e nos já migrados.
- **Endereços antigos:** `public/sims/ssh-simulator.html`, `https-simulator.html`, `ftp-simulator.html`, `icmp-simulator.html` e `dhcp-simulator.html` são páginas de redirecionamento para a rota nativa (`noindex`, fora do registro e do sitemap), para não quebrar links existentes.

## 5. Contrato do motor de simulação

O núcleo está em `src/sim-core/` (`trace.ts`, `hash.ts`, `types.ts`) e a bancada em `src/sim-core/ui/`. O contrato:

1. **Motor puro:** uma função `build(parâmetros, modo)` devolve um *trace* e não toca na tela. O mesmo parâmetro produz o mesmo trace (valores como chaves e hashes são determinísticos e ilustrativos).
2. **Trace:** colunas (atores), mensagens (origem, destino, instantes de envio e chegada, rótulo, campos, se vai cifrada), eventos anotados por ator, estados por ator, fases, marcos e métricas. `prepare()` converte os tempos em linhas, de modo que o diagrama é compacto e a animação tem ritmo constante.
3. **Módulo de simulador (`ProtocolDef`, em `src/sim-core/ui/module.ts`):** declara controles do painel, cenários, documentação de cada cenário, abas extras, texto do Experimento e Referência. A bancada (`Workbench`) cuida do diagrama, da captura, do detalhe da mensagem, do log, do estado e da reprodução (Simular, Passo, velocidade).
3a. **Topologia (opcional):** o módulo pode declarar `topology` (nós, enlaces, caminho de cada mensagem e notas sob cada nó, como a tabela ARP). A bancada então mostra um seletor "Sequência / Topologia" no quadro principal, e os pacotes percorrem os enlaces com o mesmo relógio, o mesmo Passo e o mesmo zoom. Usado pelo ARP, pelo ICMP, pelo DHCP, pelo HTTP, pelo NAT, pelo DNS e pelo Firewall. O módulo também pode configurar a legenda de cores (`legend`) e a formatação do tempo (`timeLabel`), por exemplo para mostrar horas num ciclo de lease.
4. **Padrão visual e didático:** abas Cenário, Captura, Mensagem, abas próprias, Experimento, Referência e Log; ajuda em cada campo; uma informação em um único lugar.
5. **Estilo:** `src/sim-core/ui/simnet.css`, com todos os seletores restritos a `.simnet`, para não interferir no hub (Tailwind).

## 6. Plano de migração

| Fase | Entrega | Situação |
| --- | --- | --- |
| 1 | Hub com registro e simuladores legados incorporados | concluída |
| 2 | Núcleo (`src/sim-core`), bancada React e migração do SSH, HTTPS e FTP para módulos TypeScript, com paridade verificada contra o legado antes de sua remoção | concluída; os legados desses três foram removidos |
| 3 | Migração dos demais simuladores legados | **não prevista**: o custo é alto e o ganho para o aluno é pequeno (seção 4) |
| 4 | Novos simuladores já nativos (DNS e DNSSEC, VPN, SMTP, IS-IS, SNMP, ARP, HTTP, congestionamento, 802.1X; DNS e DNSSEC, ARP e HTTP já entregues) | prevista; usam o núcleo e a bancada desde o início |

A verificação de paridade foi feita enquanto os dois lados coexistiam: cada cenário e milhares de combinações de parâmetros produziram o mesmo trace, o mesmo Experimento e as mesmas abas. Depois da remoção do legado, essa garantia passou para as impressões digitais (seção 7).

## 7. Testes

- **Registro:** identificadores únicos, categorias válidas, arquivos existentes, ausência de travessão longo e de meia-risca, e redirecionamentos dos endereços antigos.
- **Páginas legadas:** título, descrição, canônica, crédito e link de volta ao Simul-Net.
- **Interface:** páginas inicial, de categoria e de simulador, com verificação de acessibilidade (axe-core).
- **Página de documentação (`doc-ui.test.tsx`):** leitura dos documentos, índice lateral, âncoras, links, diagramas (o Mermaid é simulado no jsdom), página 404 e axe-core.
- **Núcleo e bancada (`tests/sim-core/`):** valores determinísticos e trace (`core.test.ts`); geometria do diagrama, reprodução e cenários (`ui-logic.test.ts`); e a bancada completa com um protocolo de exemplo, incluindo destacar, maximizar, recolher, Esc, zoom, a alça de altura e a alternância entre sequência e topologia, com axe-core em todas as abas (`workbench.test.tsx`).
- **Motores (`ssh-engine`, `https-engine`, `ftp-engine`, `http-engine`):** regras específicas de cada protocolo (negociação, downgrade, adulteração, política de encaminhamento, modos ativo e passivo, certificado inválido, RTT de abertura, bloqueio de cabeça de fila e fallback do QUIC).
- **Integridade (`protocol-integrity.test.ts`):** vale para qualquer módulo registrado em `src/sims/native.ts`: ids únicos, parâmetros dos cenários existentes e com valores permitidos, documentação completa de cada cenário e modo, e ausência de travessão nos textos.
- **Impressões digitais (`golden.test.ts` e `golden.json`):** hash SHA-256 do trace, do Experimento, do texto do cenário e das abas de cada cenário, e de 300 combinações aleatórias por modo (semente fixa). Qualquer mudança de comportamento falha o teste. Quando a mudança é intencional: `UPDATE_GOLDEN=1 npx vitest run tests/sim-core/golden.test.ts`, e revisar o diff de `golden.json` antes de versionar.
- **Páginas nativas (`tests/native-page.test.tsx`):** cada simulador nativo carrega, percorre todos os modos e passa no axe-core.
- **Contraste (Playwright, `e2e/contraste.spec.ts`):** o axe mede o contraste de cores (WCAG AA) no Chrome real, o que não funciona no jsdom: páginas do hub nos temas claro e escuro, e cada simulador nativo em todos os modos, numa amostra dos cenários e em todas as abas.
- **Ponta a ponta (Playwright, em `e2e/`):** todos os cenários de cada simulador sem erro de JavaScript, layout da bancada, quadros destacáveis, redirecionamento dos endereços antigos e o hub. Roda no fluxo de publicação.

## 8. Publicação

O fluxo `.github/workflows/deploy.yml` roda `npm ci`, `npm test`, `npm run build` com `VITE_BASE=/<repositório>/`, os testes ponta a ponta e publica `dist/` no GitHub Pages. Endereço previsto: `https://peotta.github.io/Simul-Net/`.

## 9. Relação com o portal (peotta.github.io)

O portal continua com suas páginas de simuladores até o Simul-Net estar publicado. Depois disso, a seção "Simuladores de Rede e Protocolos" do portal passa a apontar para o Simul-Net e as páginas antigas viram redirecionamentos, para não quebrar links existentes.

## 10. Como adicionar um simulador

**Nativo (recomendado para simuladores novos):**

1. **Levante as fontes antes de escrever.** Liste as RFCs e os padrões vigentes do protocolo em https://www.rfc-editor.org e confira se algum foi substituído ou atualizado (por exemplo, a RFC 8446 foi substituída pela RFC 9846). Anote o que o simulador vai simplificar em relação a elas.
2. Crie `src/sims/<nome>/` com o motor (`engine`, função pura que devolve um `Trace`), o conteúdo (`content`: controles, cenários, textos, abas, Experimento e Referência) e `protocol.ts`, que exporta um `ProtocolDef`. Cada cenário precisa de `scenDoc` completo (conceito, o que observar, mensagens, por que importa), cada campo precisa de ajuda e a aba Referência precisa citar a RFC e a seção nos pontos técnicos e registrar as limitações. Declare `topology` quando houver topologia.
3. Registre o módulo em `src/sims/native.ts` e acrescente a entrada em `src/sims/registry.ts` com `engine: 'nativo'`, preenchendo `rfcs`. O mesmo vale para `rfcs` no `protocol.ts`.
4. Inclua o módulo em `tests/sim-core/golden.test.ts`, grave as impressões digitais com `UPDATE_GOLDEN=1`, e rode `npm test` (integridade, páginas e registro são verificados) e `npm run test:e2e`.
5. **Documentação.** Rode `npm run docs:simuladores`. Isso gera `docs/simuladores/<id>.md` e atualiza o índice. Confira o arquivo (travessões, diagramas, textos) e versione-o junto com o simulador. O gerador transforma toda citação de RFC (e de BCP) em link para o rfc-editor.org; IEEE e ISO ficam em texto. O texto dos cenários dentro do simulador pode citar a RFC sem link. O teste do registro falha se o documento não existir ou se houver uma RFC sem link.
6. **Wiki.** Rode `npm run wiki -- <pasta>`, clone `Simul-Net.wiki.git`, copie os `.md` gerados, faça o commit e o push. Como a wiki é pública, a publicação só é feita com autorização expressa do autor.
7. **Link no cartão.** Nada a fazer: o cartão do hub mostra o link "Documentação" a partir do `id` do registro (`docUrl`).

**Legado:** coloque o arquivo em `public/sims/` e acrescente a entrada em `src/sims/registry.ts` com `engine: 'legado'`; o registro verifica o arquivo e os requisitos da página. A documentação de um legado é extraída executando a página no jsdom. Modos escolhidos por botões e captura passo a passo são tratados em `LEGACY`, em `scripts/gerar-wiki.mjs`; páginas cujas mensagens não são determinísticas não geram diagrama de sequência.

## 11. Limitações

Os simuladores são didáticos: parâmetros pequenos, valores ilustrativos e nenhuma criptografia real. Os modelos seguem as RFCs citadas em cada página, mas simplificam detalhes que são explicitados na aba Referência de cada simulador.
