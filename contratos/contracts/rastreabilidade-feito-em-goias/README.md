# Rastreabilidade "Feito em Goiás"

Três contratos Solidity coordenados que registram on-chain a origem e a cadeia produtiva de qualquer commodity goiana — vegetal, animal, mineral ou industrial — desde o produtor cadastrado até o consumidor final. Atende exigências do mercado europeu (Regulamento EU 2023/1115 — EUDR), FDA (FSMA 204), GS1 EPCIS 2.0 e ISO 22005, com KDEs locais brasileiros (RENASEM, CFO, PTV, GTA, SISBOV).

## Problema que resolve

Goiás é a 4ª maior economia agropecuária do Brasil, e os compradores internacionais — sobretudo a União Europeia a partir de 2026 — **exigem comprovação digital de origem e cadeia produtiva**:

- **EUDR (Regulamento EU 2023/1115)**: prova de que nenhum produto importado tem origem em área desmatada pós-31/Dez/2020, com geolocation data por talhão (ponto ou polígono GeoJSON, WGS-84). Vigência operadores: **30/Dez/2026 para grandes e médias empresas; 30/Jun/2027 para pequenas, micro e pessoas físicas** (datas confirmadas após segundo adiamento via Regulation EU 2025/2650, publicada no Diário Oficial da UE em 23/Dez/2025; pacote de simplificação da Comissão Europeia de 04/Mai/2026 manteve as datas).
- **FSMA 204 (FDA)**: rastreabilidade de Critical Tracking Events com Key Data Elements para alimentos importados nos EUA. Compliance: **20/Jul/2028** (a FDA estendeu o prazo original de 20/Jan/2026 em 30 meses; o Continuing Appropriations Act de Nov/2025 do Congresso americano direcionou que a FDA não execute a regra antes dessa data).
- **CBAM (Carbon Border Adjustment Mechanism)**: histórico de emissões na cadeia.
- **ESG / sustentabilidade**: fundos e grandes varejistas exigem dados auditáveis.

Plataformas proprietárias (Provenance, Everledger, IBM Food Trust, TraceX, etc.) cobram em três camadas somadas: assinatura SaaS recorrente, taxa por transação e onboarding customizado. Com a RBB pública-permissionada, a taxa por transação **é zero** — a infraestrutura é compartilhada com BNDES, TCU, Dataprev, Serpro, CPQD, RNP, PUC-RJ e PRODEMGE; ninguém paga gas pela transação on-chain.

Isso **não significa serviço gratuito**. A ACIEG (e federações setoriais que receberem `CADASTRADOR_ROLE`) cobram pelo **serviço de valor agregado**: cadastro e validação do produtor, auditoria do polígono CAR, hospedagem do GeoJSON, emissão e renovação do Selo Digital, integração com ERPs/sistemas de gestão, suporte técnico, treinamento e capacitação. O preço da entrega passa a ser definido pela qualidade do serviço da ACIEG, não pelo custo de infraestrutura nem pela margem do fornecedor — diferentemente das proprietárias, em que a margem da plataforma fica embutida em cada cobrança. Os dados, esses sim, são auditáveis por qualquer regulador ou comprador via RPC público da RBB sem permissão especial.

## Padrões adotados

| Padrão | Fonte | Como entra |
|--------|-------|------------|
| GS1 EPCIS 2.0 + GTS2 | GS1 Global | `enum CTE` com 12 buckets universais; `EventoCadeia` é um CTE; `subTipo` mapeia a `bizStep` URN |
| FSMA 204 (Food Traceability Final Rule) | FDA | CTEs canônicos: harvesting (EXTRACAO), initial packing (BENEFICIAMENTO), shipping/receiving (TRANSPORTE), transformation (PROCESSAMENTO) |
| EUDR (UE 2023/1115) | EU Commission | `poligonoCARHash` + `poligonoURI` no `RegistroProdutores` (Anexo II); evento `(MONITORAMENTO, "VEG.MAPBIOMAS")` para anti-desmatamento |
| ISO 22005:2007 | ISO | Identificação única do lote (1 lote = 1 NFT); one-step-back via `loteOrigem` |
| IPPC ISPM 12 | FAO | Phytosanitary certificate registrado como `(CERTIFICACAO, "VEG.CFO")` |
| RENASEM (Lei 10.711/2003) | MAPA | `Setor.SEMENTEIRA` + `renasem` no `Produtor`; lote-pai SEMENTE_* via `loteOrigem` |
| CFO/CFOC + PTV | MAPA + agências estaduais | Eventos `(CERTIFICACAO,"VEG.CFO")` e `(TRANSPORTE,"VEG.PTV")` carregam hash do PDF |
| SISBOV / GTA | MAPA | Phase 2 (`vocabulario-bovino.json`): `(TRANSPORTE,"BOV.GTA")` carrega hash do GTA |

## Arquitetura

Três contratos com responsabilidade única:

### 1. `RegistroProdutores.sol`

Cadastro de produtores elegíveis ao programa "Feito em Goiás":
- `AGROPECUARIA` (fazendeiros, cooperativas)
- `SEMENTEIRA` (produtores de semente certificada com nº RENASEM)
- `MINERACAO` (empresas de extração mineral)
- `INDUSTRIA` (beneficiamento, processamento)

Guarda: CNPJ/CPF, nome, **CAR** (Cadastro Ambiental Rural), município, lat/long da sede, **`poligonoCARHash`** (SHA-256 do GeoJSON do polígono CAR — atende EUDR Anexo II), **`poligonoURI`** (URL pública do GeoJSON), **`renasem`** (nº RENASEM para sementeiras). Controlado por `CADASTRADOR_ROLE` (inicialmente ACIEG; pode ser delegado a federações setoriais).

### 2. `RastreabilidadeLote.sol` (ERC-721)

Cada lote é um NFT único. Apenas produtores **ativos** no registro podem mintar. O contrato é **setor-agnóstico** — qualquer commodity entra via `string commoditySlug` (sem enum, sem redeploy ao adicionar novos produtos).

#### Critical Tracking Events (`enum CTE`)

12 buckets universais, cobrindo qualquer cadeia produtiva (vegetal/animal/mineral/industrial):

| # | CTE | GS1 EPCIS bizStep | FSMA 204 |
|---|-----|-------------------|----------|
| 0 | `ORIGEM` | receiving | — |
| 1 | `PRODUCAO` | commissioning | — |
| 2 | `TRATAMENTO` | inspecting | — |
| 3 | `MONITORAMENTO` | sensor_reporting | — |
| 4 | `EXTRACAO` | creating_class_instance | Harvesting |
| 5 | `BENEFICIAMENTO` | packing | Initial Packing |
| 6 | `ARMAZENAGEM` | storing | — |
| 7 | `CERTIFICACAO` | certification_issued | — |
| 8 | `TRANSPORTE` | shipping/receiving | Shipping/Receiving |
| 9 | `PROCESSAMENTO` | transforming | Transformation |
| 10 | `EXPORTACAO` | shipping (export) | Shipping |
| 11 | `ENTREGA_FINAL` | receiving (final) | Receiving |

#### Vocabulário setorial (`subTipo`)

Cada evento carrega um `subTipo` namespaced por setor — string livre validada off-chain por vocabulário JSON versionado. Namespaces previstos:

| Prefixo | Setor | Exemplos |
|---------|-------|----------|
| `VEG.*` | Vegetal (soja, milho, café, cana, algodão, cacau) | PLANTIO, COLHEITA, CFO, PTV, MAPBIOMAS, DUE |
| `BOV.*` | Bovinocultura (carne, leite) | NASCIMENTO, RECRIA, GTA, ABATE, SIF, DESOSSA |
| `SUI.*` | Suinocultura | NASCIMENTO, VACINACAO, GTA, ABATE, SIF |
| `OVI.*` | Ovinocultura/caprinocultura | NASCIMENTO, ESQUILA, ABATE |
| `AVE.*` | Avicultura (frango, peru, ovo) | ECLOSAO, FORMACAO_LOTE, ABATE, OVO_POSTURA |
| `AQU.*` | Aquicultura (peixe, camarão) | LARVICULTURA, ENGORDA, DESPESCA |
| `API.*` | Apicultura (mel, cera, própolis) | INSTALACAO_COLMEIA, COLHEITA_MEL, ENVASE |
| `MIN.*` | Mineração | PESQUISA, PLANO_LAVRA, LAVRA, BRITAGEM, PELOTIZACAO, LAOP, DOF_MINERAL |
| `MAD.*` | Madeira/florestal | PLANO_MANEJO, CORTE, BALDEIO, DOF, CITES |
| `IND.*` | Indústria/manufatura | RECEBIMENTO_MP, MONTAGEM, QC, EMBALAGEM, INMETRO, NF_E |
| `ENE.*` | Energia (etanol, biodiesel, biogás) | MOAGEM, FERMENTACAO, DESTILACAO, CBIOS |

Cada evento grava: ator, timestamp, GPS, hash de documentos (NF, BL, CFO, GTA, CTRC, DUE), observação com KDEs estruturados. Terceiros consultam `historicoCompleto(loteId)` e recebem a trilha **ordenada cronologicamente** (sort por timestamp em memory).

#### Parent-child entre lotes (`loteOrigem`)

`Lote.loteOrigem` é o tokenId do lote-pai (0 = nenhum). Permite encadear:
- Soja → SEMENTE_SOJA (one-step-back ISO 22005)
- Bezerro → MATRIZ_BOVINA
- Frango → OVO_INCUBACAO
- Aroma de cacau → CACAU_AMENDOA

Auditor consulta `historicoCompleto(loteFilho)` e em seguida `historicoCompleto(loteFilho.loteOrigem)` para reconstituir a árvore inteira em duas chamadas RPC.

### 3. `CertificadosConformidade.sol`

Certificadoras independentes (IBD, Rainforest Alliance, FSC, etc.) recebem `CERTIFICADORA_ROLE` e emitem certificados por lote: EUDR, ESG, ORGANICO, GMO_FREE, FAIR_TRADE. Cada certificado grava o hash SHA-256 do PDF da auditoria off-chain. Pode ser revogado se fraude for detectada. Consulta `temCertificadoValido(loteId, TIPO)` retorna `bool` em uma chamada.

## Multi-setor: futuro-proof

Adicionar **suíno, ovino, frango, peixe, mel, cana, algodão, madeira, ouro, qualquer commodity** = **commit de JSON, sem mudança no contrato, sem redeploy**:

1. Criar `wordpress-plugin/assets/vocabulario/<setor>.json` mapeando `subTipo` → `{label, sigla, padrao, urn}` e `commoditySlug` → `{label, ncm, scientific}`.
2. Demais Frontend carrega o JSON novo e renderiza labels/conformidades.
3. Produtor chama `criarLote("CARNE_SUINA", ...)` + `registrarEvento(CTE.PRODUCAO, "SUI.NASCIMENTO", ...)`.

O contrato aceita qualquer string em `commoditySlug` e em `subTipo`. Validação de coerência fica off-chain (UI versionada). A enum `CTE` foi desenhada para ser estável — os 12 buckets cobrem o ciclo completo de qualquer cadeia produtiva conhecida.

## Demo end-to-end: semente → Rotterdam

```bash
pnpm hardhat run scripts/rastreabilidade/demo-cadeia-soja.ts
```

Simula:

1. **ACIEG cadastra sementeira** Brasmax (Cristalina/GO, RENASEM GO 0815/2024) com polígono CAR
2. **Sementeira cria Lote #1** (SEMENTE_SOJA, cultivar BMX Lança IPRO, classe S1, 25t) e registra `VEG.PLANTIO` (set/24) → `VEG.MAPBIOMAS` (nov/24, hash Sentinel-2) → `VEG.COLHEITA` (jan/25)
3. **ACIEG cadastra produtor** "Fazenda Boa Vista" (Rio Verde/GO) com polígono CAR
4. **ACIEG autoriza IBD Certificações** (CERTIFICADORA EUDR)
5. **Produtor cria Lote #2** (SOJA, 50t, `loteOrigem=#1`) e registra a trilha completa:
   - `VEG.AQUISICAO_SEMENTE` (set/25, com nº RENASEM, cultivar, classe)
   - `VEG.PLANTIO` → `VEG.APLICACAO_INSUMO` → `VEG.MAPBIOMAS` (jan/26, anti-desmatamento) → `VEG.APLICACAO_INSUMO` → `VEG.COLHEITA`
6. **Pós-colheita**: `VEG.LIMPEZA_SECAGEM` → `VEG.SILO` → `VEG.CFO` (eng. agrônomo) → `VEG.PTV` (PTV nº GO-2026-031820) → `VEG.DUE` (embarque MV Santos Star) → `VEG.RECEBIMENTO_DDS` (Rotterdam)
7. **IBD emite certificado EUDR** vinculado ao Lote #2

### Saída do demo (trilha cronológica do Lote #2)

```
1. 2025-09-30 ORIGEM          VEG.AQUISICAO_SEMENTE   Fazenda Boa Vista (recebimento)
2. 2025-10-15 PRODUCAO        VEG.PLANTIO             Talhão A (Fazenda Boa Vista)
3. 2025-11-08 TRATAMENTO      VEG.APLICACAO_INSUMO    Talhão A
4. 2026-01-20 MONITORAMENTO   VEG.MAPBIOMAS           Imagem satelital MapBiomas
5. 2026-03-12 TRATAMENTO      VEG.APLICACAO_INSUMO    Talhão A
6. 2026-04-22 EXTRACAO        VEG.COLHEITA            Talhão A — colheita mecanizada
7. 2026-04-25 BENEFICIAMENTO  VEG.LIMPEZA_SECAGEM     Silo Cooperativa Comigo
8. 2026-04-26 ARMAZENAGEM     VEG.SILO                Silo Cooperativa Comigo
9. 2026-04-29 CERTIFICACAO    VEG.CFO                 Eng. Agrônomo CREA-GO 12345
10. 2026-04-30 TRANSPORTE      VEG.PTV                 Porto de Santos/SP (Tecon)
11. 2026-05-04 EXPORTACAO      VEG.DUE                 Embarque navio MV Santos Star
12. 2026-06-01 ENTREGA_FINAL   VEG.RECEBIMENTO_DDS     Terminal Rotterdam — Importador XYZ

Certificado EUDR:  VÁLIDO ✓ (emissor: IBD)
```

## Verificação por terceiro (comprador europeu)

```bash
LOTE_ID=2 pnpm hardhat run scripts/rastreabilidade/verificar-lote.ts --network rbbLocal
```

Saída JSON inclui:
- Lote principal + eventos cronológicos
- Lote-pai (semente) + eventos cronológicos
- Lista de certificados (EUDR, ESG etc) com validade
- Bloco `conformidade` calculado pelo subTipo: `EUDR`, `RENASEM`, `CFO`, `PTV`, `GTA`, `SIF`, `DOF`, `MONITORAMENTO_SATELITAL`

Um sistema de compliance europeu faria **exatamente a mesma chamada** via RPC público da RBB, sem registro, sem autenticação, em tempo real.

## Deploy

```bash
pnpm hardhat run scripts/rastreabilidade/deploy.ts --network rbbLocal
```

Saída grava endereços dos 3 contratos em `deployments/rastreabilidade-rbbLocal.json`.

## Limitações conhecidas

- **`subTipo` e `commoditySlug` são strings livres**: contrato não valida vocabulário. Vocabulário canônico vive off-chain (JSON versionado por setor). Validação on-chain seria cara e fragilizaria a extensibilidade — fica para Fase 3 se houver fraude detectada.
- **`loteOrigem` é referência fraca**: dono pode apontar para um lote arbitrário. Coerência slug pai-filho fica off-chain (UI alerta se slug não bate).
- **Polígono CAR como hash on-chain**: GeoJSON real precisa estar acessível em IPFS ou URL pública. EUDR atendido na prova de imutabilidade do polígono declarado.
- **Sort em memory O(n²)**: aceitável para n<50 (caso típico). Lotes com 100+ eventos podem mover sort para frontend.
- **Indústria multi-input (BoM)**: `loteOrigem` é único. Adicionar `loteOrigemMulti[]` em mapping separado quando indústria entrar é zero-breaking change.

## Próximos passos

- **Oráculos de satélite automatizados** (MapBiomas, Planet Labs, Sentinel-2): hash já é registrável em `(MONITORAMENTO, "VEG.MAPBIOMAS")`; integração automática (sem chamada manual) é Fase 3.
- **Validação on-chain de coerência slug pai-filho**: Fase 2 condicional a casos de fraude.
- **Vocabulários de outros setores**: `bovino.json`, `mineracao.json`, `madeira.json`, etc — populados conforme demanda da ACIEG.

## Licença

[Apache-2.0](../../../LICENSE)
