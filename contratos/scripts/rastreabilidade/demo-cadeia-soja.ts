import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

/**
 * Demo end-to-end: cadeia de custódia "Feito em Goiás" da semente até a entrega final.
 *
 * Cobre:
 *   - Sementeira goiana certificada RENASEM cria lote-pai SEMENTE_SOJA (plantio→colheita
 *     em sua área de multiplicação) com monitoramento satelital MapBiomas.
 *   - Produtor compra a semente (AQUISICAO_SEMENTE), planta, faz manejo, monitora,
 *     colhe e exporta para Rotterdam — tudo on-chain.
 *   - Comprador europeu verifica a árvore semente→soja + certificado EUDR num único RPC.
 *
 * Atores (Hardhat accounts):
 *   #0 admin/ACIEG      — cadastra produtores e habilita certificadora
 *   #1 produtor          — Fazenda Boa Vista (Rio Verde/GO)
 *   #2 certificadora     — IBD Certificações (EUDR)
 *   #3 transportador     — frota multimodal (rodovia + ferrovia)
 *   #4 exportador        — trading que vende para Rotterdam
 *   #5 sementeira        — Brasmax Sementes (Cristalina/GO)
 */

const PAUSE_MS = Number(process.env.DEMO_PAUSE_MS ?? 0);
const pausa = () =>
  PAUSE_MS > 0 ? new Promise((r) => setTimeout(r, PAUSE_MS)) : Promise.resolve();

// Setor enum
const SETOR_AGRO = 1;
const SETOR_SEMENTEIRA = 4;

// CTE enum (RastreabilidadeLote.sol)
const CTE_ORIGEM = 0;
const CTE_PRODUCAO = 1;
const CTE_TRATAMENTO = 2;
const CTE_MONITORAMENTO = 3;
const CTE_EXTRACAO = 4;
const CTE_BENEFICIAMENTO = 5;
const CTE_ARMAZENAGEM = 6;
const CTE_CERTIFICACAO = 7;
const CTE_TRANSPORTE = 8;
const CTE_PROCESSAMENTO = 9;
const CTE_EXPORTACAO = 10;
const CTE_ENTREGA_FINAL = 11;

const CTE_NOME = [
  "ORIGEM",
  "PRODUCAO",
  "TRATAMENTO",
  "MONITORAMENTO",
  "EXTRACAO",
  "BENEFICIAMENTO",
  "ARMAZENAGEM",
  "CERTIFICACAO",
  "TRANSPORTE",
  "PROCESSAMENTO",
  "EXPORTACAO",
  "ENTREGA_FINAL",
];

const TIPO_EUDR = 1;

const hashKey = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

async function main() {
  const [admin, produtor, certificadora, transportador, exportador, sementeira] = await ethers.getSigners();
  console.log(`Rede: ${network.name}`);

  console.log("\n=== 1. Deploy dos contratos ===");
  const Reg = await ethers.getContractFactory("RegistroProdutores");
  const reg = await Reg.deploy(admin.address);
  await reg.waitForDeployment();
  console.log(`RegistroProdutores: ${await reg.getAddress()}`);

  const Lote = await ethers.getContractFactory("RastreabilidadeLote");
  const lote = await Lote.deploy(admin.address, await reg.getAddress());
  await lote.waitForDeployment();
  console.log(`RastreabilidadeLote: ${await lote.getAddress()}`);

  const Cert = await ethers.getContractFactory("CertificadosConformidade");
  const cert = await Cert.deploy(admin.address, await lote.getAddress());
  await cert.waitForDeployment();
  console.log(`CertificadosConformidade: ${await cert.getAddress()}`);

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 2. ACIEG cadastra sementeira (RENASEM) ===");
  const poligonoCristalinaHash = hashKey("geojson-cristalina-go");
  await (await reg.cadastrar(
    sementeira.address,
    "98765432000111",
    "Brasmax Sementes Ltda",
    "GO-CAR-SEM-001",
    "Cristalina/GO",
    -16768000,
    -47616000,
    poligonoCristalinaHash,
    "ipfs://QmCristalinaPoligono",
    "GO 0815/2024",
    SETOR_SEMENTEIRA
  )).wait();
  console.log(`Sementeira: ${sementeira.address}`);
  console.log(`RENASEM: GO 0815/2024 | Polígono CAR: ${poligonoCristalinaHash}`);

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 3. Sementeira cria Lote #1 (SEMENTE_SOJA) e registra ciclo ===");
  // Plantio set/2024, monitoramento nov/2024, colheita jan/2025
  const dataPlantioSemente = Math.floor(new Date("2024-09-15T00:00:00Z").getTime() / 1000);
  const dataMonitorSemente = Math.floor(new Date("2024-11-20T00:00:00Z").getTime() / 1000);
  const dataColheitaSemente = Math.floor(new Date("2025-01-25T00:00:00Z").getTime() / 1000);

  await (await lote.connect(sementeira).criarLote(
    "SEMENTE_SOJA",
    25000,
    dataPlantioSemente,
    dataColheitaSemente,
    "SEM-2025-01",
    0
  )).wait();
  console.log(`Lote #1: SEMENTE_SOJA · 25t · cultivar BMX Lança IPRO · classe S1`);

  await (await lote.connect(sementeira).registrarEvento(
    1, CTE_PRODUCAO, "VEG.PLANTIO", dataPlantioSemente,
    "-16.768,-47.616", "Cristalina/GO",
    ethers.ZeroHash,
    "Cultivar BMX Lança IPRO; classe S1; densidade 280k sementes/ha"
  )).wait();
  await (await lote.connect(sementeira).registrarEvento(
    1, CTE_MONITORAMENTO, "VEG.MAPBIOMAS", dataMonitorSemente,
    "-16.768,-47.616", "Imagem satelital Sentinel-2",
    hashKey("MAPBIOMAS-2024-CRISTALINA-NDF"),
    "Sem desmatamento na area de multiplicacao pos-2020"
  )).wait();
  await (await lote.connect(sementeira).registrarEvento(
    1, CTE_EXTRACAO, "VEG.COLHEITA", dataColheitaSemente,
    "-16.768,-47.616", "Cristalina/GO",
    hashKey("BOL-CERT-RENASEM-GO-0815-2024"),
    "Colheita lote SEM-2025-01; pureza 99.5%; germinação 92%"
  )).wait();
  console.log(`  Plantio (set/24) → Monitoramento Sentinel-2 (nov/24) → Colheita (jan/25)`);

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 4. ACIEG cadastra produtor goiano com polígono CAR ===");
  const poligonoBoaVistaHash = hashKey("geojson-fazenda-boa-vista");
  await (await reg.cadastrar(
    produtor.address,
    "12345678000199",
    "Fazenda Boa Vista Ltda",
    "GO-5218907-AB12",
    "Rio Verde/GO",
    -17850000,
    -50926000,
    poligonoBoaVistaHash,
    "ipfs://QmFazendaBoaVistaPoligono",
    "",
    SETOR_AGRO
  )).wait();
  console.log(`Produtor: ${produtor.address}`);
  console.log(`CAR: GO-5218907-AB12 | Polígono: ${poligonoBoaVistaHash}`);

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 5. ACIEG autoriza IBD Certificações (EUDR) ===");
  await (await cert.grantRole(await cert.CERTIFICADORA_ROLE(), certificadora.address)).wait();
  console.log(`Certificadora habilitada: ${certificadora.address}`);

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 6. Produtor cria Lote #2 (SOJA) com loteOrigem=1 e registra ciclo ===");
  const dataAquisicao = Math.floor(new Date("2025-09-30T00:00:00Z").getTime() / 1000);
  const dataPlantioSoja = Math.floor(new Date("2025-10-15T00:00:00Z").getTime() / 1000);
  const dataInsumo1 = Math.floor(new Date("2025-11-08T00:00:00Z").getTime() / 1000);
  const dataMonitorSoja = Math.floor(new Date("2026-01-20T00:00:00Z").getTime() / 1000);
  const dataInsumo2 = Math.floor(new Date("2026-03-12T00:00:00Z").getTime() / 1000);
  const dataColheitaSoja = Math.floor(new Date("2026-04-22T00:00:00Z").getTime() / 1000);

  await (await lote.connect(produtor).criarLote(
    "SOJA",
    50000,
    dataPlantioSoja,
    dataColheitaSoja,
    "RIV-2026-S-0042",
    1 // loteOrigem = lote da sementeira
  )).wait();
  console.log(`Lote #2: SOJA · 50t · código RIV-2026-S-0042 · loteOrigem=#1 (semente)`);

  await (await lote.connect(produtor).registrarEvento(
    2, CTE_ORIGEM, "VEG.AQUISICAO_SEMENTE", dataAquisicao,
    "-17.850,-50.926", "Fazenda Boa Vista (recebimento)",
    hashKey("NF-SEM-COMPRA-001"),
    "RENASEM=GO 0815/2024; cultivar=BMX Lança IPRO; lote=SEM-2025-01; classe=S1; quantidade=50sc"
  )).wait();
  await (await lote.connect(produtor).registrarEvento(
    2, CTE_PRODUCAO, "VEG.PLANTIO", dataPlantioSoja,
    "-17.850,-50.926", "Talhão A (Fazenda Boa Vista)",
    ethers.ZeroHash,
    "Área 50ha; densidade 320k sementes/ha; profundidade 4cm"
  )).wait();
  await (await lote.connect(produtor).registrarEvento(
    2, CTE_TRATAMENTO, "VEG.APLICACAO_INSUMO", dataInsumo1,
    "-17.850,-50.926", "Talhão A",
    hashKey("NF-FERTILIZANTE-MAP-001"),
    "Fertilizante MAP 250 kg/ha (cobertura)"
  )).wait();
  await (await lote.connect(produtor).registrarEvento(
    2, CTE_MONITORAMENTO, "VEG.MAPBIOMAS", dataMonitorSoja,
    "-17.850,-50.926", "Imagem satelital MapBiomas",
    hashKey("MAPBIOMAS-2026-RIO-VERDE-NDF"),
    "Sem desmatamento pos-2020 no poligono CAR"
  )).wait();
  await (await lote.connect(produtor).registrarEvento(
    2, CTE_TRATAMENTO, "VEG.APLICACAO_INSUMO", dataInsumo2,
    "-17.850,-50.926", "Talhão A",
    hashKey("RECEITUARIO-AGRONOMICO-002"),
    "Glifosato 2L/ha; alvo Conyza spp; receituario eng. agronomo"
  )).wait();
  await (await lote.connect(produtor).registrarEvento(
    2, CTE_EXTRACAO, "VEG.COLHEITA", dataColheitaSoja,
    "-17.850,-50.926", "Talhão A — colheita mecanizada",
    hashKey("ROMANEIO-COLHEITA-001"),
    "Quantidade 50.000 kg; umidade 14.2%; impurezas 1.1%"
  )).wait();
  console.log(`  AQUISICAO_SEMENTE → PLANTIO → INSUMO → MONITORAMENTO → INSUMO → COLHEITA`);

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 7. Cadeia pós-colheita ===");
  const dataBenef = Math.floor(new Date("2026-04-25T00:00:00Z").getTime() / 1000);
  const dataArm = Math.floor(new Date("2026-04-26T00:00:00Z").getTime() / 1000);
  const dataCFO = Math.floor(new Date("2026-04-29T00:00:00Z").getTime() / 1000);
  const dataPTV = Math.floor(new Date("2026-04-30T00:00:00Z").getTime() / 1000);
  const dataDUE = Math.floor(new Date("2026-05-04T00:00:00Z").getTime() / 1000);
  const dataDDS = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);

  await (await lote.connect(produtor).registrarEvento(
    2, CTE_BENEFICIAMENTO, "VEG.LIMPEZA_SECAGEM", dataBenef,
    "-17.82,-51.00", "Silo Cooperativa Comigo",
    hashKey("BOL-SILO-001"),
    "Secagem ate 13.0% umidade; tipo 1 padrao"
  )).wait();
  await (await lote.connect(produtor).registrarEvento(
    2, CTE_ARMAZENAGEM, "VEG.SILO", dataArm,
    "-17.82,-51.00", "Silo Cooperativa Comigo",
    hashKey("CTRC-002-SILO"),
    "Lote silo nº SC-22-A; classificacao tipo 1"
  )).wait();
  await (await lote.connect(produtor).registrarEvento(
    2, CTE_CERTIFICACAO, "VEG.CFO", dataCFO,
    "-17.82,-51.00", "Eng. Agrônomo CREA-GO 12345",
    hashKey("CFO-PDF-2026-RIV-S-0042"),
    "CFO emitido conforme IN MAPA 28/2016; validade 90 dias"
  )).wait();
  await (await lote.connect(transportador).registrarEvento(
    2, CTE_TRANSPORTE, "VEG.PTV", dataPTV,
    "-23.98,-46.32", "Porto de Santos/SP (Tecon)",
    hashKey("PTV-GO-2026-031820"),
    "PTV nº GO-2026-031820; ferrovia Rumo + caminhão até terminal"
  )).wait();
  await (await lote.connect(exportador).registrarEvento(
    2, CTE_EXPORTACAO, "VEG.DUE", dataDUE,
    "-23.98,-46.32", "Embarque navio MV Santos Star",
    hashKey("DUE-26BR0XXX-MSKU-7733912"),
    "Container MSKU-7733912 destino Rotterdam; DUE 26BR0XXX"
  )).wait();

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 8. Certificadora emite EUDR (vinculado ao Lote #2) ===");
  const umAno = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  await (await cert.connect(certificadora).emitir(
    2,
    TIPO_EUDR,
    "IBD Certificacoes",
    umAno,
    hashKey("PDF-CERT-EUDR-IBD-2026-0042"),
    "Auditoria conforme Regulamento EU 2023/1115; poligono CAR sem desmatamento pos-2020"
  )).wait();
  console.log(`Certificado EUDR emitido pela IBD Certificações`);

  await (await lote.connect(exportador).registrarEvento(
    2, CTE_ENTREGA_FINAL, "VEG.RECEBIMENTO_DDS", dataDDS,
    "51.92,4.48", "Terminal Rotterdam — Importador XYZ",
    hashKey("DDS-EU-2026-0042"),
    "DDS recebido e arquivado pelo importador europeu"
  )).wait();
  console.log(`  → Entrega final em Rotterdam (com DDS EUDR)`);

  // ─────────────────────────────────────────────────────────────────
  await pausa();
  console.log("\n=== 9. Comprador europeu verifica a árvore semente→soja ===");
  const [infoSoja, eventosSoja] = await lote.historicoCompleto(2);
  const [infoSemente, eventosSemente] = await lote.historicoCompleto(infoSoja.loteOrigem);
  const temEUDR = await cert.temCertificadoValido(2, TIPO_EUDR);
  const certIds = await cert.certificadosDoLote(2);

  const fmt = (e: { cte: bigint; subTipo: string; ator: string; timestamp: bigint; localGPS: string; localNome: string; hashDocumento: string; observacao: string }) => ({
    cte: CTE_NOME[Number(e.cte)],
    subTipo: e.subTipo,
    ator: e.ator,
    timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
    local: e.localNome,
    gps: e.localGPS,
    hashDoc: e.hashDocumento === ethers.ZeroHash ? null : e.hashDocumento,
    obs: e.observacao,
  });

  const relatorio = {
    lote: {
      tokenId: 2,
      produtor: infoSoja.produtor,
      commoditySlug: infoSoja.commoditySlug,
      quantidadeKg: Number(infoSoja.quantidadeKg),
      dataInicio: new Date(Number(infoSoja.dataInicio) * 1000).toISOString(),
      dataExtracao: new Date(Number(infoSoja.dataExtracao) * 1000).toISOString(),
      codigoInterno: infoSoja.codigoInterno,
      loteOrigem: Number(infoSoja.loteOrigem),
    },
    eventos: eventosSoja.map(fmt),
    loteOrigem: {
      tokenId: Number(infoSoja.loteOrigem),
      produtor: infoSemente.produtor,
      commoditySlug: infoSemente.commoditySlug,
      quantidadeKg: Number(infoSemente.quantidadeKg),
      codigoInterno: infoSemente.codigoInterno,
      eventos: eventosSemente.map(fmt),
    },
    certificados: {
      EUDR_valido: temEUDR,
      ids: certIds.map((x) => Number(x)),
    },
  };

  const dir = join(__dirname, "..", "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `relatorio-lote-2-${network.name}.json`),
    JSON.stringify(relatorio, null, 2) + "\n"
  );
  writeFileSync(
    join(dir, `rastreabilidade-${network.name}.json`),
    JSON.stringify(
      {
        network: network.name,
        deployer: admin.address,
        RegistroProdutores: await reg.getAddress(),
        RastreabilidadeLote: await lote.getAddress(),
        CertificadosConformidade: await cert.getAddress(),
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );

  const linha = "─".repeat(72);
  const abrev = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  console.log(linha);
  console.log(`  Lote #2 · ${relatorio.lote.codigoInterno} · ${(relatorio.lote.quantidadeKg / 1000).toFixed(0)}t de SOJA`);
  console.log(`  Produtor: ${abrev(relatorio.lote.produtor)} · Plantio: ${relatorio.lote.dataInicio.slice(0, 10)} · Colheita: ${relatorio.lote.dataExtracao.slice(0, 10)}`);
  console.log(`  Lote-pai: #${relatorio.loteOrigem.tokenId} (${relatorio.loteOrigem.commoditySlug}) — ${relatorio.loteOrigem.codigoInterno}`);
  console.log(linha);
  console.log("  Trilha cronológica do Lote #2:");
  eventosSoja.forEach((e, i) => {
    const cte = CTE_NOME[Number(e.cte)].padEnd(15);
    const sub = e.subTipo.padEnd(24);
    const data = new Date(Number(e.timestamp) * 1000).toISOString().slice(0, 10);
    console.log(`   ${String(i + 1).padStart(2)}. ${data} ${cte} ${sub} ${e.localNome}`);
  });
  console.log(linha);
  console.log(`  Certificado EUDR:  ${temEUDR ? "VÁLIDO ✓" : "INVÁLIDO ✗"} (ID #${certIds.map(Number).join(", ")}, emissor: IBD)`);
  console.log(`  Auditável por:     qualquer RPC público da RBB`);
  console.log(`  Relatório JSON:    deployments/relatorio-lote-2-${network.name}.json`);
  console.log(linha);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
