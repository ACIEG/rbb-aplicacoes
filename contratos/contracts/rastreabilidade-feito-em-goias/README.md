# Rastreabilidade "Feito em Goiás"

Três contratos Solidity coordenados que registram, on-chain, a origem e a cadeia produtiva completa de commodities goianas — desde o produtor cadastrado até o consumidor internacional final. Atende exigências crescentes do mercado europeu (Regulamento EU 2023/1115 – EUDR) e compradores globais com requisitos ESG.

## Problema que resolve

Goiás é a 4ª maior economia agropecuária do Brasil (soja, milho, carne bovina, cana-de-açúcar). Os compradores internacionais — sobretudo União Europeia a partir de 2026 — **exigem comprovação digital de origem e cadeia produtiva**. Quem não conseguir comprovar, perde acesso ao mercado:

- **EUDR (Regulamento EU 2023/1115)**: obrigatório provar que nenhum produto importado tem origem em área desmatada pós-2020. Entrou em vigor 30/12/2024 com fiscalização ativa em 2026.
- **ESG / sustentabilidade**: fundos de investimento e grandes varejistas (Walmart, Carrefour, etc.) exigem dados de rastreabilidade para compor relatório ESG.
- **Relatórios de emissão (CBAM)**: Carbon Border Adjustment Mechanism da UE cobra taxa de carbono na importação — precisa do histórico completo de emissões na cadeia.

Soluções atuais são proprietárias, caras (US$0,05 a US$0,50 por transação em plataformas como Provenance ou Everledger), e não interoperáveis. **Com a RBB pública-permissionada**, o custo por transação é **zero** e os dados são auditáveis por qualquer órgão regulador ou comprador sem permissão especial.

## Arquitetura

Três contratos com responsabilidade única:

### 1. `RegistroProdutores.sol`

Cadastro de produtores elegíveis ao programa "Feito em Goiás":
- Agropecuária (fazendeiros, cooperativas)
- Mineração (empresas de extração mineral)
- Indústria (beneficiamento, processamento)

Guarda: CNPJ/CPF, nome, **CAR** (Cadastro Ambiental Rural — obrigatório para agropecuária), município, lat/long, setor. Controlado por `CADASTRADOR_ROLE` (inicialmente ACIEG; pode ser delegado a federações setoriais).

### 2. `RastreabilidadeLote.sol` (ERC-721)

Cada lote é um NFT único. Só produtores **ativos** no registro podem mintar lotes. O contrato mantém on-chain **todos os eventos da cadeia de custódia**:
- `COLHEITA` (registrado automaticamente no mint, no local do produtor)
- `TRANSPORTE` (cada movimento entre fazenda → silo → porto)
- `ARMAZENAGEM`
- `PROCESSAMENTO`
- `EXPORTACAO`
- `ENTREGA_FINAL`

Cada evento grava: ator, timestamp, coordenadas GPS, hash de documentos (bill of lading, NF, CTRC), observações. Terceiros consultam `historicoCompleto(loteId)` e recebem a trilha inteira.

### 3. `CertificadosConformidade.sol`

Certificadoras independentes (IBD, Rainforest Alliance, FSC, Greenpeace, etc.) recebem `CERTIFICADORA_ROLE` e emitem certificados por lote:
- `EUDR` — Regulamento Anti-Desmatamento EU
- `ESG` — Genérico
- `ORGANICO`
- `GMO_FREE`
- `FAIR_TRADE`

Cada certificado grava o hash SHA-256 do PDF da auditoria off-chain. Certificadora pode revogar se fraude for detectada posteriormente. Consulta `temCertificadoValido(loteId, TIPO)` retorna `bool` para verificação rápida.

## Demo end-to-end: soja Rio Verde → Rotterdam

```bash
pnpm hardhat run scripts/rastreabilidade/demo-cadeia-soja.ts
```

Simula:

1. **ACIEG cadastra** produtor goiano "Fazenda Boa Vista Ltda" em Rio Verde/GO (-17.85, -50.926) com CAR válido
2. **ACIEG autoriza** IBD Certificações como CERTIFICADORA
3. **Produtor cria lote** #1: 50.000 kg de soja, código `RIV-2026-S-0042`
4. Cadeia de custódia registrada on-chain:
   - Fazenda → Silo Comigo (transporte rodoviário, NF registrada)
   - Silo (armazenagem + classificação)
   - Silo → Porto de Santos (ferrovia Rumo + rodoviário)
   - Embarque no navio MV Santos Star, container MSKU-7733912, destino Rotterdam
5. **IBD emite certificado EUDR** (auditoria de desmatamento zero)
6. **Entrega final em Rotterdam** registrada
7. Comprador europeu consulta `historicoCompleto(1)` e `temCertificadoValido(1, EUDR)` — trilha completa + certificado retornados em uma chamada

### Saída do demo (trecho)

```json
{
  "lote": {
    "tokenId": 1,
    "produtor": "0x7099...dc79C8",
    "quantidadeKg": 50000,
    "dataColheita": "2026-04-24T...",
    "codigoInterno": "RIV-2026-S-0042"
  },
  "eventos": [
    { "tipo": "COLHEITA", "local": "Rio Verde/GO", ... },
    { "tipo": "TRANSPORTE", "local": "Transporte Fazenda -> Silo Comigo", ... },
    { "tipo": "ARMAZENAGEM", "local": "Silo Cooperativa Comigo", ... },
    { "tipo": "TRANSPORTE", "local": "Porto de Santos/SP (Tecon)", ... },
    { "tipo": "EXPORTACAO", "local": "Embarque navio MV Santos Star", ... },
    { "tipo": "ENTREGA_FINAL", "local": "Terminal Rotterdam", ... }
  ],
  "certificados": { "EUDR_valido": true, "ids": [1] }
}
```

## Verificação por terceiro (comprador europeu)

```bash
LOTE_ID=1 pnpm hardhat run scripts/rastreabilidade/verificar-lote.ts --network rbbLocal
```

Um sistema de compliance de uma importadora europeia faria **exatamente a mesma chamada** via RPC público da RBB, sem precisar registrar-se na ACIEG, sem autenticação, em tempo real.

## Deploy

```bash
pnpm hardhat run scripts/rastreabilidade/deploy.ts --network rbbLocal
```

Saída grava endereços dos 3 contratos em `deployments/rastreabilidade-rbbLocal.json`.

## Limitações e próximos passos

- Entrada de eventos é feita pelo **dono atual do NFT** (`owner`). Para transição entre atores (exemplo: produtor transfere lote para transportadora), seria necessário implementar `safeTransferFrom` ou usar um contrato intermediário com `approveAll`. Fase 2.
- GPS é string livre. Validação de formato (ISO 6709) fica na aplicação cliente. Fase 2.
- Certificados poderiam ser ERC-721 próprios (como os selos). Ficaram como struct interna por simplicidade — cada abordagem tem vantagens.
- Integração com **oráculos de satélite** (ex: MapBiomas, Planet Labs) para validação automática de desmatamento — grande oportunidade Fase 3.

## Licença

[Apache-2.0](../../../LICENSE)
