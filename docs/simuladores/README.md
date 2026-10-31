# Documentação dos simuladores

Lista dos simuladores do Simul-Net por categoria. A fonte única é `src/sims/registry.ts`.

## Camada de enlace e redes locais

Switching, VLANs, spanning tree e Wi-Fi: como os quadros são encaminhados, como a rede local evita laços e como as redes sem fio operam.

| Simulador | Motor | Situação | RFCs e padrões |
| --- | --- | --- | --- |
| [Switching e aprendizado de MAC](switching.md) | nativo | disponível | IEEE 802.1Q-2022 (inclui 802.1D), IEEE 802.3, [RFC 1112](https://www.rfc-editor.org/rfc/rfc1112), [RFC 4541](https://www.rfc-editor.org/rfc/rfc4541), [RFC 9776](https://www.rfc-editor.org/rfc/rfc9776) |
| [STP, RSTP e MSTP](stp.md) | nativo | disponível | IEEE 802.1Q-2022 (inclui 802.1D, 802.1w e 802.1s), [RFC 4188](https://www.rfc-editor.org/rfc/rfc4188), [RFC 4318](https://www.rfc-editor.org/rfc/rfc4318) |
| [VLAN e trunking (802.1Q)](vlan.md) | nativo | disponível | IEEE 802.1Q-2022, [RFC 9542](https://www.rfc-editor.org/rfc/rfc9542) |
| Wi-Fi: operação (802.11) | - | planejado | IEEE 802.11 |

## Roteamento e serviços de rede

Roteamento, endereçamento automático, diagnóstico e redes de operadora, em diagramas de sequência e topologias animadas.

| Simulador | Motor | Situação | RFCs e padrões |
| --- | --- | --- | --- |
| [Roteamento (OSPF e RIPv2)](roteamento.md) | legado | disponível | [RFC 2328](https://www.rfc-editor.org/rfc/rfc2328), [RFC 2453](https://www.rfc-editor.org/rfc/rfc2453), [RFC 5709](https://www.rfc-editor.org/rfc/rfc5709), [RFC 4822](https://www.rfc-editor.org/rfc/rfc4822) |
| [DHCP (DORA)](dhcp.md) | nativo | disponível | [RFC 2131](https://www.rfc-editor.org/rfc/rfc2131), [RFC 2132](https://www.rfc-editor.org/rfc/rfc2132), [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227), [RFC 3046](https://www.rfc-editor.org/rfc/rfc3046), [RFC 1542](https://www.rfc-editor.org/rfc/rfc1542) |
| [ICMP (ping e traceroute)](icmp.md) | nativo | disponível | [RFC 792](https://www.rfc-editor.org/rfc/rfc792), [RFC 1191](https://www.rfc-editor.org/rfc/rfc1191), [RFC 1812](https://www.rfc-editor.org/rfc/rfc1812), [RFC 2923](https://www.rfc-editor.org/rfc/rfc2923), [RFC 4821](https://www.rfc-editor.org/rfc/rfc4821) |
| [BGP (sessões e seleção de caminho)](bgp.md) | legado | disponível | [RFC 4271](https://www.rfc-editor.org/rfc/rfc4271), [RFC 6811](https://www.rfc-editor.org/rfc/rfc6811), [RFC 7908](https://www.rfc-editor.org/rfc/rfc7908), [RFC 9319](https://www.rfc-editor.org/rfc/rfc9319), [RFC 9582](https://www.rfc-editor.org/rfc/rfc9582), [RFC 8212](https://www.rfc-editor.org/rfc/rfc8212) |
| [MPLS (LDP e L3VPN)](mpls.md) | legado | disponível | [RFC 3031](https://www.rfc-editor.org/rfc/rfc3031), [RFC 5036](https://www.rfc-editor.org/rfc/rfc5036), [RFC 4364](https://www.rfc-editor.org/rfc/rfc4364), [RFC 4381](https://www.rfc-editor.org/rfc/rfc4381) |
| IS-IS | - | planejado | [RFC 1195](https://www.rfc-editor.org/rfc/rfc1195), ISO/IEC 10589 |
| SNMP | - | planejado | [RFC 3411](https://www.rfc-editor.org/rfc/rfc3411), [RFC 3416](https://www.rfc-editor.org/rfc/rfc3416), [RFC 3414](https://www.rfc-editor.org/rfc/rfc3414) |
| NTP (sincronização de tempo) | - | planejado | [RFC 5905](https://www.rfc-editor.org/rfc/rfc5905), [RFC 8915](https://www.rfc-editor.org/rfc/rfc8915), [RFC 5906](https://www.rfc-editor.org/rfc/rfc5906) |
| [ARP](arp.md) | nativo | disponível | [RFC 826](https://www.rfc-editor.org/rfc/rfc826), [RFC 1027](https://www.rfc-editor.org/rfc/rfc1027), [RFC 1122](https://www.rfc-editor.org/rfc/rfc1122), [RFC 5227](https://www.rfc-editor.org/rfc/rfc5227) |
| [NAT (SNAT, DNAT e NAPT)](nat.md) | nativo | disponível | [RFC 2663](https://www.rfc-editor.org/rfc/rfc2663), [RFC 3022](https://www.rfc-editor.org/rfc/rfc3022), [RFC 4787](https://www.rfc-editor.org/rfc/rfc4787), [RFC 5382](https://www.rfc-editor.org/rfc/rfc5382), [RFC 5508](https://www.rfc-editor.org/rfc/rfc5508), [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598), [RFC 6888](https://www.rfc-editor.org/rfc/rfc6888), [RFC 7857](https://www.rfc-editor.org/rfc/rfc7857) |

## Camada de transporte e segurança

TCP e UDP passo a passo e o laboratório defensivo com ataques, mitigações e resposta a incidentes.

| Simulador | Motor | Situação | RFCs e padrões |
| --- | --- | --- | --- |
| [TCP e UDP](tcp-udp.md) | legado | disponível | [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293), [RFC 768](https://www.rfc-editor.org/rfc/rfc768), [RFC 5681](https://www.rfc-editor.org/rfc/rfc5681), [RFC 2018](https://www.rfc-editor.org/rfc/rfc2018) |
| [Ataques e defesas TCP/UDP](ataques-tcp-udp.md) | legado | disponível | [RFC 4987](https://www.rfc-editor.org/rfc/rfc4987), [RFC 5961](https://www.rfc-editor.org/rfc/rfc5961), [BCP 38](https://www.rfc-editor.org/info/bcp38), [RFC 5925](https://www.rfc-editor.org/rfc/rfc5925), [RFC 8955](https://www.rfc-editor.org/rfc/rfc8955), [RFC 7999](https://www.rfc-editor.org/rfc/rfc7999) |
| [HTTP/1.1, HTTP/2 e HTTP/3](http-versoes.md) | nativo | disponível | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112), [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113), [RFC 9114](https://www.rfc-editor.org/rfc/rfc9114), [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000), [RFC 7541](https://www.rfc-editor.org/rfc/rfc7541), [RFC 9204](https://www.rfc-editor.org/rfc/rfc9204) |
| Controle de congestionamento (Reno, CUBIC e BBR) | - | planejado | [RFC 5681](https://www.rfc-editor.org/rfc/rfc5681), [RFC 9438](https://www.rfc-editor.org/rfc/rfc9438), [RFC 6582](https://www.rfc-editor.org/rfc/rfc6582) |

## Protocolos de rede seguros

SSH, HTTPS e transferência de arquivos por dentro: negociação, troca de chaves, autenticação, certificados e hardening.

| Simulador | Motor | Situação | RFCs e padrões |
| --- | --- | --- | --- |
| [SSH](ssh.md) | nativo | disponível | [RFC 4251](https://www.rfc-editor.org/rfc/rfc4251), [RFC 4253](https://www.rfc-editor.org/rfc/rfc4253), [RFC 4252](https://www.rfc-editor.org/rfc/rfc4252), [RFC 4254](https://www.rfc-editor.org/rfc/rfc4254), [RFC 4256](https://www.rfc-editor.org/rfc/rfc4256), [RFC 8332](https://www.rfc-editor.org/rfc/rfc8332), [RFC 8709](https://www.rfc-editor.org/rfc/rfc8709), [RFC 8731](https://www.rfc-editor.org/rfc/rfc8731), [RFC 9142](https://www.rfc-editor.org/rfc/rfc9142) |
| [HTTPS e TLS](https.md) | nativo | disponível | [RFC 9846](https://www.rfc-editor.org/rfc/rfc9846), [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797), [RFC 5280](https://www.rfc-editor.org/rfc/rfc5280), [RFC 5246](https://www.rfc-editor.org/rfc/rfc5246), [RFC 9525](https://www.rfc-editor.org/rfc/rfc9525), [RFC 8996](https://www.rfc-editor.org/rfc/rfc8996) |
| [FTP, FTPS e SFTP](ftp.md) | nativo | disponível | [RFC 959](https://www.rfc-editor.org/rfc/rfc959), [RFC 4217](https://www.rfc-editor.org/rfc/rfc4217), [RFC 2428](https://www.rfc-editor.org/rfc/rfc2428), [RFC 2228](https://www.rfc-editor.org/rfc/rfc2228), [RFC 2577](https://www.rfc-editor.org/rfc/rfc2577) |
| [DNS e DNSSEC](dns.md) | nativo | disponível | [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034), [RFC 1035](https://www.rfc-editor.org/rfc/rfc1035), [RFC 2308](https://www.rfc-editor.org/rfc/rfc2308), [RFC 4033](https://www.rfc-editor.org/rfc/rfc4033), [RFC 4035](https://www.rfc-editor.org/rfc/rfc4035), [RFC 5452](https://www.rfc-editor.org/rfc/rfc5452), [RFC 5155](https://www.rfc-editor.org/rfc/rfc5155), [RFC 7858](https://www.rfc-editor.org/rfc/rfc7858), [RFC 8310](https://www.rfc-editor.org/rfc/rfc8310), [RFC 8484](https://www.rfc-editor.org/rfc/rfc8484) |
| [Firewall: filtragem e estado](firewall.md) | nativo | disponível | [RFC 2979](https://www.rfc-editor.org/rfc/rfc2979), [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293), [BCP 38](https://www.rfc-editor.org/info/bcp38), [RFC 5737](https://www.rfc-editor.org/rfc/rfc5737), [RFC 6298](https://www.rfc-editor.org/rfc/rfc6298) |
| VPN (IPsec e WireGuard) | - | planejado | [RFC 7296](https://www.rfc-editor.org/rfc/rfc7296), [RFC 4303](https://www.rfc-editor.org/rfc/rfc4303) |
| WAF e firewall de aplicação | - | planejado | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), [RFC 9846](https://www.rfc-editor.org/rfc/rfc9846), [RFC 8404](https://www.rfc-editor.org/rfc/rfc8404) |
| SMTP e segurança de e-mail | - | planejado | [RFC 5321](https://www.rfc-editor.org/rfc/rfc5321), [RFC 3207](https://www.rfc-editor.org/rfc/rfc3207), [RFC 7208](https://www.rfc-editor.org/rfc/rfc7208), [RFC 6376](https://www.rfc-editor.org/rfc/rfc6376), [RFC 9989](https://www.rfc-editor.org/rfc/rfc9989), [RFC 9990](https://www.rfc-editor.org/rfc/rfc9990), [RFC 9991](https://www.rfc-editor.org/rfc/rfc9991) |
| Wi-Fi: segurança (WPA2 e WPA3) | - | planejado | IEEE 802.11-2020 (inclui 802.11i e 802.11w), IEEE 802.1X, [RFC 3748](https://www.rfc-editor.org/rfc/rfc3748) |
| 802.1X e RADIUS (EAP) | - | planejado | [RFC 3748](https://www.rfc-editor.org/rfc/rfc3748), [RFC 2865](https://www.rfc-editor.org/rfc/rfc2865), IEEE 802.1X |


---

*Simul-Net é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
