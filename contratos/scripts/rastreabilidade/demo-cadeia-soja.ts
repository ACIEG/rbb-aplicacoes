import { ethers, network } from "hardhat";

/**
 * Demo end-to-end: cadeia de custódia de um lote de soja saindo de Rio Verde/GO
 * e chegando a um importador europeu, com certificação EUDR.
 *
 * Atores (Hardhat accounts):
 *   #0 (deployer/admin ACIEG) — cadastra produtores, permissiona certificadora
 *   #1 (produtor) — Fazenda Boa Vista em Rio Verde/GO (-17.85, -50.926)
 *   #2 (certificadora) — IBD Certificações (EUDR)
 *   #3 (transportador) — representa caminhoneiro/ferrovia/porto
 *   #4 (exportador) — trading company que vende para importador europeu
 */

const SETOR_AGROPECUARIA = 1;
const COMMODITY_SOJA = 1;
const TIPO_COLHEITA = 0;
const TIPO_TRANSPORTE = 1;
const TIPO_ARMAZENAGEM = 2;
const TIPO_PROCESSAMENTO = 3;
const TIPO_EXPORTACAO = 4;
const TIPO_ENTREGA_FINAL = 5;
const TIPO_EUDR = 1;

async function main() {
  const [admin, produtor, certificadora, transportador, exportador] = await ethers.getSigners();
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

  console.log("\n=== 2. ACIEG cadastra produtor goiano ===");
  await reg.cadastrar(
    produtor.address,
    "12345678000199",
    "Fazenda Boa Vista Ltda",
    "GO-5218907-AB12",
    "Rio Verde/GO",
    -17850000,
    -50926000,
    SETOR_AGROPECUARIA
  );
  console.log(`Produtor cadastrado: ${produtor.address}`);
  console.log(`CAR: GO-5218907-AB12 | Localização: Rio Verde/GO (-17.85, -50.926)`);

  console.log("\n=== 3. ACIEG autoriza IBD Certificações ===");
  await cert.grantRole(await cert.CERTIFICADORA_ROLE(), certificadora.address);
  console.log(`Certificadora habilitada: ${certificadora.address}`);

  console.log("\n=== 4. Produtor cria lote de 50t de soja ===");
  const dataColheita = Math.floor(Date.now() / 1000);
  const txLote = await lote
    .connect(produtor)
    .criarLote(COMMODITY_SOJA, 50000, dataColheita, "RIV-2026-S-0042");
  await txLote.wait();
  console.log(`Lote #1 criado — 50.000 kg de soja — código RIV-2026-S-0042`);

  console.log("\n=== 5. Cadeia de custódia ===");
  const hashNF = (texto: string) => ethers.keccak256(ethers.toUtf8Bytes(texto));

  await lote
    .connect(produtor)
    .registrarEvento(
      1,
      TIPO_TRANSPORTE,
      "-17.80,-50.95",
      "Transporte Fazenda -> Silo Comigo",
      hashNF("NF-001-FAZENDA"),
      "Caminhao granel ABC-1234"
    );
  console.log(`  -> Transporte para Silo Comigo (hash NF registrado)`);

  await lote
    .connect(transportador)
    .registrarEvento(
      1,
      TIPO_ARMAZENAGEM,
      "-17.82,-51.00",
      "Silo Cooperativa Comigo - Rio Verde",
      hashNF("CTRC-002-SILO"),
      "Secagem e classificacao"
    );
  console.log(`  -> Armazenagem em silo`);

  await lote
    .connect(transportador)
    .registrarEvento(
      1,
      TIPO_TRANSPORTE,
      "-23.98,-46.32",
      "Porto de Santos/SP (Tecon)",
      hashNF("BL-003-SANTOS"),
      "Ferrovia Rumo + caminhao ate terminal"
    );
  console.log(`  -> Chegada ao Porto de Santos`);

  await lote
    .connect(exportador)
    .registrarEvento(
      1,
      TIPO_EXPORTACAO,
      "-23.98,-46.32",
      "Embarque navio MV Santos Star",
      hashNF("BL-004-CONTAINER-MSK-7733"),
      "Container MSKU-7733912 destino Rotterdam"
    );
  console.log(`  -> Exportação (navio MV Santos Star, destino Rotterdam)`);

  console.log("\n=== 6. Certificadora emite EUDR ===");
  const umAno = dataColheita + 365 * 24 * 60 * 60;
  await cert
    .connect(certificadora)
    .emitir(
      1,
      TIPO_EUDR,
      "IBD Certificacoes",
      umAno,
      hashNF("PDF-CERT-EUDR-IBD-2026-0042"),
      "Lote auditado conforme Regulamento EU 2023/1115"
    );
  console.log(`Certificado EUDR #1 emitido pela IBD Certificações`);

  await lote
    .connect(exportador)
    .registrarEvento(
      1,
      TIPO_ENTREGA_FINAL,
      "51.92,4.48",
      "Terminal Rotterdam - Importador XYZ",
      hashNF("DECL-007-EU-IMPORT"),
      "Recepcao e liberacao alfandegaria"
    );
  console.log(`  -> Entrega final em Rotterdam`);

  console.log("\n=== 7. Consulta final: comprador europeu verifica o lote ===");
  const [info, eventos] = await lote.historicoCompleto(1);
  const temEUDR = await cert.temCertificadoValido(1, TIPO_EUDR);
  const certIds = await cert.certificadosDoLote(1);

  const tipoNome = (t: bigint) =>
    ["COLHEITA", "TRANSPORTE", "ARMAZENAGEM", "PROCESSAMENTO", "EXPORTACAO", "ENTREGA_FINAL"][Number(t)];

  const relatorio = {
    lote: {
      tokenId: 1,
      produtor: info.produtor,
      quantidadeKg: Number(info.quantidadeKg),
      dataColheita: new Date(Number(info.dataColheita) * 1000).toISOString(),
      codigoInterno: info.codigoInterno,
    },
    eventos: eventos.map((e) => ({
      tipo: tipoNome(e.tipo),
      ator: e.ator,
      timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
      local: e.localNome,
      gps: e.localGPS,
      hashDoc: e.hashDocumento === ethers.ZeroHash ? null : e.hashDocumento,
      obs: e.observacao,
    })),
    certificados: {
      EUDR_valido: temEUDR,
      ids: certIds.map((x) => Number(x)),
    },
  };

  console.log(JSON.stringify(relatorio, null, 2));

  console.log(
    `\nResumo: ${eventos.length} eventos registrados on-chain, certificado EUDR ${temEUDR ? "VÁLIDO" : "INVÁLIDO"}. Consulta replicável por qualquer comprador europeu via RPC público.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
