# Aplicações ACIEG na Rede Blockchain Brasil

Este repositório contém as aplicações desenvolvidas pela **ACIEG — Associação Comercial, Industrial e de Serviços do Estado de Goiás** (CNPJ 05.613.301/0001-92) para demonstração de experiência técnica e operação na **Rede Blockchain Brasil (RBB)**, rede público-permissionada fundada pelo BNDES e pelo TCU em 12/04/2022.

O código aqui publicado é referenciado no **Relato de Experiência em Blockchain** enviado à Governança da RBB como parte do processo de adesão da ACIEG na modalidade **Partícipe Associado**, em atendimento à Cláusula II, Parágrafo IV, Inciso III do [Acordo de Cooperação BNDES/TCU nº D-121.2.0014.22](https://github.com/RBBNet/rbb/blob/master/documentos/ACT%20-%20Documento%20firmado%20entre%20BNDES%20e%20TCU.pdf).

## Aplicações

| Aplicação | Descrição | Pasta |
|---|---|---|
| **Selo Digital de Associado** | Cartão digital on-chain (SBT — Soulbound Token) que permite a qualquer terceiro — bancos, órgãos públicos, fornecedores — verificar instantaneamente se uma empresa é associada à ACIEG, sem papel nem intermediação. | [`contratos/selo-digital-associado/`](contratos/selo-digital-associado/) |
| **Certificados de Capacitação Verificáveis** | Cursos, workshops e programas da ACIEG registrados on-chain como certificados verificáveis pelo empregador, com hash do PDF original gravado na blockchain — combate fraude de certificados. | [`contratos/certificados-capacitacao/`](contratos/certificados-capacitacao/) |
| **Rastreabilidade "Feito em Goiás"** | Registro da origem e cadeia produtiva de commodities goianas (soja, milho, carne, minério), atendendo exigências internacionais como o Regulamento Europeu Anti-Desmatamento (EUDR) e requisitos ESG de compradores globais. | [`contratos/rastreabilidade-feito-em-goias/`](contratos/rastreabilidade-feito-em-goias/) |
| **Plugin WordPress `acieg-rbb-verificador`** | Plugin para o site institucional [acieg.com.br](https://acieg.com.br) que expõe shortcodes e Gutenberg blocks para verificação on-chain de selos, certificados e lotes diretamente nas páginas da ACIEG. | [`wordpress-plugin/`](wordpress-plugin/) |
| **Rede Local de Desenvolvimento** | Ambiente Docker com nós Besu (validator + bootnode + observer) compatível com a topologia da RBB, usado para desenvolvimento e testes sem custo. | [`rede-local/`](rede-local/) |

## Stack Técnica

- **Solidity ^0.8.24** — mesma da RBB (Besu/EVM-compatível)
- **Hyperledger Besu** com consenso Clique (rede local) e compatibilidade direta com a RBB
- **Hardhat** (framework de desenvolvimento)
- **OpenZeppelin Contracts v5** (ERC-721, ERC-1155, AccessControl)
- **TypeScript** (testes, scripts e tipagem)
- **PHP 7.4+** e **ethers.js v6** (plugin WordPress)

## Como rodar localmente

```bash
# 1. Subir rede Besu local (Docker)
cd rede-local && ./scripts/start.sh

# 2. Instalar dependências e compilar contratos
cd ../contratos && pnpm install && pnpm hardhat compile

# 3. Rodar testes
pnpm hardhat test

# 4. Deploy em rede local
pnpm hardhat run selo-digital-associado/scripts/deploy.ts --network rbbLocal
```

Consulte o README de cada aplicação para detalhes específicos.

## Contexto da ACIEG na RBB

A ACIEG é entidade privada sem fins lucrativos de âmbito estadual (Goiás), fundada em 1952, reunindo representativamente o setor produtivo goiano — comércio, indústria e serviços. A adesão à RBB visa oferecer aos associados da ACIEG aplicações digitais baseadas em blockchain com **custo operacional zero por transação** (característica da rede pública-permissionada) e **integração imediata com o ecossistema institucional brasileiro** (BNDES, TCU, Dataprev, Serpro, CPQD, RNP, PUC-RJ, entre outros partícipes).

## Licença

Código distribuído sob [Apache License 2.0](LICENSE).

## Contato

- **ACIEG** — [acieg.com.br](https://acieg.com.br)
- **Head of Innovation** — Pedro Renan Ferreira de Santana
- **Presidente** — Rubens José Filéti
- **Governança da RBB** — rbb@bndes.gov.br
