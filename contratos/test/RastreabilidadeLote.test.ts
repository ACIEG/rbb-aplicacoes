import { expect } from "chai";
import { ethers } from "hardhat";
import { RastreabilidadeLote, RegistroProdutores } from "../typechain-types";

describe("RastreabilidadeLote", () => {
  // Setor enum (RegistroProdutores.sol)
  const SETOR_AGRO = 1;
  const SETOR_SEMENTEIRA = 4;

  // CTE enum (RastreabilidadeLote.sol)
  const CTE_ORIGEM = 0;
  const CTE_PRODUCAO = 1;
  const CTE_TRATAMENTO = 2;
  const CTE_MONITORAMENTO = 3;
  const CTE_EXTRACAO = 4;
  const CTE_TRANSPORTE = 8;
  const CTE_EXPORTACAO = 10;

  const POLIGONO_HASH = ethers.keccak256(ethers.toUtf8Bytes("geojson-fazenda-boa-vista"));
  const POLIGONO_URI = "ipfs://QmPoligonoBoaVista";

  async function deploy() {
    const [admin, produtor, sementeira, transportador, outsider] = await ethers.getSigners();

    const Reg = await ethers.getContractFactory("RegistroProdutores");
    const reg = (await Reg.deploy(admin.address)) as unknown as RegistroProdutores;
    await reg.waitForDeployment();

    await reg.cadastrar(
      produtor.address,
      "12345678000199",
      "Fazenda Exemplo",
      "GO-CAR-001",
      "Rio Verde/GO",
      -17850000,
      -50926000,
      POLIGONO_HASH,
      POLIGONO_URI,
      "",
      SETOR_AGRO
    );

    const Lote = await ethers.getContractFactory("RastreabilidadeLote");
    const lote = (await Lote.deploy(admin.address, await reg.getAddress())) as unknown as RastreabilidadeLote;
    await lote.waitForDeployment();

    return { reg, lote, admin, produtor, sementeira, transportador, outsider };
  }

  it("produtor ativo cria lote sem auto-eventos", async () => {
    const { lote, produtor } = await deploy();
    const dataPlantio = Math.floor(Date.now() / 1000) - 200 * 86400;
    const dataColheita = Math.floor(Date.now() / 1000);

    await expect(
      lote.connect(produtor).criarLote("SOJA", 50000, dataPlantio, dataColheita, "RIV-2026-S-0042", 0)
    )
      .to.emit(lote, "LoteCriado")
      .withArgs(1n, produtor.address, "SOJA", 50000n, 0n, "RIV-2026-S-0042");

    expect(await lote.ownerOf(1)).to.equal(produtor.address);
    const info = await lote.loteInfo(1);
    expect(info.commoditySlug).to.equal("SOJA");
    expect(info.quantidadeKg).to.equal(50000n);
    expect(info.codigoInterno).to.equal("RIV-2026-S-0042");
    expect(info.loteOrigem).to.equal(0n);
    // Sem auto-eventos: histórico vazio até registrarEvento ser chamado
    expect(await lote.totalEventos(1)).to.equal(0n);
  });

  it("produtor não cadastrado não pode criar lote", async () => {
    const { lote, outsider } = await deploy();
    await expect(
      lote.connect(outsider).criarLote("SOJA", 50000, 0, 0, "X", 0)
    ).to.be.revertedWithCustomError(lote, "ProdutorNaoRegistradoOuInativo");
  });

  it("produtor suspenso não pode criar lote", async () => {
    const { reg, lote, produtor } = await deploy();
    await reg.suspender(produtor.address, "Teste");
    await expect(
      lote.connect(produtor).criarLote("SOJA", 50000, 0, 0, "X", 0)
    ).to.be.revertedWithCustomError(lote, "ProdutorNaoRegistradoOuInativo");
  });

  it("rejeita commoditySlug vazio", async () => {
    const { lote, produtor } = await deploy();
    await expect(
      lote.connect(produtor).criarLote("", 50000, 0, 0, "X", 0)
    ).to.be.revertedWithCustomError(lote, "CommoditySlugObrigatorio");
  });

  it("rejeita quantidade zero", async () => {
    const { lote, produtor } = await deploy();
    await expect(
      lote.connect(produtor).criarLote("SOJA", 0, 0, 0, "X", 0)
    ).to.be.revertedWithCustomError(lote, "QuantidadeInvalida");
  });

  it("rejeita código vazio", async () => {
    const { lote, produtor } = await deploy();
    await expect(
      lote.connect(produtor).criarLote("SOJA", 50000, 0, 0, "", 0)
    ).to.be.revertedWithCustomError(lote, "CodigoObrigatorio");
  });

  it("rejeita loteOrigem inexistente", async () => {
    const { lote, produtor } = await deploy();
    await expect(
      lote.connect(produtor).criarLote("SOJA", 50000, 0, 0, "X", 999)
    ).to.be.revertedWithCustomError(lote, "LoteOrigemInexistente");
  });

  it("aceita commoditySlug livre (qualquer setor)", async () => {
    const { lote, produtor } = await deploy();
    // Mesmo produtor cria lotes de slugs arbitrários — contrato é setor-agnóstico
    await lote.connect(produtor).criarLote("MEL", 100, 0, 0, "API-001", 0);
    await lote.connect(produtor).criarLote("OURO", 5, 0, 0, "MIN-001", 0);
    await lote.connect(produtor).criarLote("MADEIRA_CERTIFICADA", 8000, 0, 0, "MAD-001", 0);
    expect((await lote.loteInfo(1)).commoditySlug).to.equal("MEL");
    expect((await lote.loteInfo(3)).commoditySlug).to.equal("MADEIRA_CERTIFICADA");
  });

  it("dono registra evento com CTE + subTipo livre", async () => {
    const { lote, produtor } = await deploy();
    await lote.connect(produtor).criarLote("SOJA", 50000, 1700000000, 1710000000, "RIV-2026-S-0042", 0);

    const hashBL = ethers.keccak256(ethers.toUtf8Bytes("bill-of-lading-BR-EUROPE-001"));
    await expect(
      lote
        .connect(produtor)
        .registrarEvento(
          1,
          CTE_TRANSPORTE,
          "VEG.PTV",
          0,
          "-17.85,-50.926",
          "Saida da fazenda para silo",
          hashBL,
          "PTV nº GO-2026-031820"
        )
    )
      .to.emit(lote, "EventoRegistrado")
      .withArgs(1n, CTE_TRANSPORTE, produtor.address, "VEG.PTV", "Saida da fazenda para silo");

    expect(await lote.totalEventos(1)).to.equal(1n);
  });

  it("não-dono não pode registrar evento", async () => {
    const { lote, produtor, outsider } = await deploy();
    await lote.connect(produtor).criarLote("SOJA", 50000, 0, 0, "RIV-2026-S-0042", 0);
    await expect(
      lote.connect(outsider).registrarEvento(1, CTE_TRANSPORTE, "VEG.PTV", 0, "", "X", ethers.ZeroHash, "")
    ).to.be.revertedWithCustomError(lote, "NaoAutorizado");
  });

  it("após safeTransferFrom, novo dono pode registrar evento (chain-of-custody via NFT)", async () => {
    const { lote, produtor, outsider } = await deploy();
    // outsider aqui faz papel de exportador (trading company que compra do produtor)
    await lote.connect(produtor).criarLote("SOJA", 50000, 0, 0, "RIV-2026-S-0042", 0);

    // Antes do transfer: outsider não consegue registrar
    await expect(
      lote.connect(outsider).registrarEvento(1, CTE_TRANSPORTE, "VEG.PTV", 0, "", "X", ethers.ZeroHash, "")
    ).to.be.revertedWithCustomError(lote, "NaoAutorizado");

    // Produtor transfere o NFT para o exportador (venda)
    await lote
      .connect(produtor)
      ["safeTransferFrom(address,address,uint256)"](produtor.address, outsider.address, 1);
    expect(await lote.ownerOf(1)).to.equal(outsider.address);

    // Após transfer: novo dono registra normalmente; produtor antigo não pode mais
    await lote
      .connect(outsider)
      .registrarEvento(1, CTE_TRANSPORTE, "VEG.PTV", 0, "", "Porto de Santos", ethers.ZeroHash, "");
    expect(await lote.totalEventos(1)).to.equal(1n);
    await expect(
      lote.connect(produtor).registrarEvento(1, CTE_EXPORTACAO, "VEG.DUE", 0, "", "X", ethers.ZeroHash, "")
    ).to.be.revertedWithCustomError(lote, "NaoAutorizado");
  });

  it("historicoCompleto retorna eventos ordenados por timestamp ascendente (mesmo retroativos)", async () => {
    const { lote, produtor } = await deploy();
    const tPlantio = 1_700_000_000;
    const tInsumo = 1_705_000_000;
    const tColheita = 1_710_000_000;

    await lote.connect(produtor).criarLote("SOJA", 50000, tPlantio, tColheita, "RIV-2026-S-0042", 0);

    // Registra na ordem fora-de-cronologia: COLHEITA primeiro (mais recente), depois PLANTIO retroativo
    await lote
      .connect(produtor)
      .registrarEvento(1, CTE_EXTRACAO, "VEG.COLHEITA", tColheita, "x", "Fazenda", ethers.ZeroHash, "");
    await lote
      .connect(produtor)
      .registrarEvento(1, CTE_PRODUCAO, "VEG.PLANTIO", tPlantio, "x", "Fazenda", ethers.ZeroHash, "");
    await lote
      .connect(produtor)
      .registrarEvento(1, CTE_TRATAMENTO, "VEG.APLICACAO_INSUMO", tInsumo, "x", "Fazenda", ethers.ZeroHash, "");

    const [info, eventos] = await lote.historicoCompleto(1);
    expect(info.commoditySlug).to.equal("SOJA");
    expect(eventos.length).to.equal(3);
    expect(eventos[0].subTipo).to.equal("VEG.PLANTIO");
    expect(eventos[1].subTipo).to.equal("VEG.APLICACAO_INSUMO");
    expect(eventos[2].subTipo).to.equal("VEG.COLHEITA");
    expect(eventos[0].timestamp).to.be.lessThan(eventos[1].timestamp);
    expect(eventos[1].timestamp).to.be.lessThan(eventos[2].timestamp);
  });

  it("sementeira cria lote SEMENTE_SOJA, soja referencia via loteOrigem", async () => {
    const { reg, lote, produtor, sementeira } = await deploy();

    await reg.cadastrar(
      sementeira.address,
      "98765432000111",
      "Brasmax Sementes",
      "GO-CAR-SEM-001",
      "Cristalina/GO",
      -16768000,
      -47616000,
      ethers.keccak256(ethers.toUtf8Bytes("geojson-cristalina")),
      "ipfs://QmCristalina",
      "GO 0815/2024",
      SETOR_SEMENTEIRA
    );

    await lote.connect(sementeira).criarLote(
      "SEMENTE_SOJA",
      25000,
      1_700_000_000,
      1_710_000_000,
      "SEM-2025-01",
      0
    );

    await lote.connect(produtor).criarLote(
      "SOJA",
      50000,
      1_725_000_000,
      1_745_000_000,
      "RIV-2026-S-0042",
      1 // loteOrigem = lote da sementeira
    );

    expect((await lote.loteInfo(2)).loteOrigem).to.equal(1n);
    expect((await lote.loteInfo(1)).commoditySlug).to.equal("SEMENTE_SOJA");
  });

  it("RegistroProdutores: atualizarPoligono + atualizarRenasem com role check", async () => {
    const { reg, produtor, outsider } = await deploy();

    const novoHash = ethers.keccak256(ethers.toUtf8Bytes("novo-poligono"));
    await expect(reg.connect(outsider).atualizarPoligono(produtor.address, novoHash, "ipfs://novo"))
      .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");

    await reg.atualizarPoligono(produtor.address, novoHash, "ipfs://QmNovo");
    const dados = await reg.dadosProdutor(produtor.address);
    expect(dados.poligonoCARHash).to.equal(novoHash);
    expect(dados.poligonoURI).to.equal("ipfs://QmNovo");

    await reg.atualizarRenasem(produtor.address, "GO 9999/2026");
    expect((await reg.dadosProdutor(produtor.address)).renasem).to.equal("GO 9999/2026");
  });

  it("cross-setor smoke test: CARNE_SUINA com SUI.NASCIMENTO/SUI.ABATE funciona sem vocabulário SUI preenchido", async () => {
    const { lote, produtor } = await deploy();

    await lote.connect(produtor).criarLote(
      "CARNE_SUINA",
      120,
      1_700_000_000,
      1_730_000_000,
      "GO-SUI-2026-001",
      0
    );

    await lote.connect(produtor).registrarEvento(
      1,
      CTE_PRODUCAO,
      "SUI.NASCIMENTO",
      1_700_000_000,
      "-16.7,-49.2",
      "Granja Goiania",
      ethers.ZeroHash,
      "Lote de leitoes nascido"
    );

    await lote.connect(produtor).registrarEvento(
      1,
      CTE_TRATAMENTO,
      "SUI.VACINACAO",
      1_710_000_000,
      "-16.7,-49.2",
      "Granja Goiania",
      ethers.ZeroHash,
      "Vacinacao febre suina classica"
    );

    await lote.connect(produtor).registrarEvento(
      1,
      CTE_EXTRACAO,
      "SUI.ABATE",
      1_730_000_000,
      "-16.5,-49.5",
      "Frigorifico GO",
      ethers.keccak256(ethers.toUtf8Bytes("SIF-12345")),
      "Abate sob inspecao SIF"
    );

    const [info, eventos] = await lote.historicoCompleto(1);
    expect(info.commoditySlug).to.equal("CARNE_SUINA");
    expect(eventos.length).to.equal(3);
    expect(eventos[0].subTipo).to.equal("SUI.NASCIMENTO");
    expect(eventos[2].subTipo).to.equal("SUI.ABATE");
  });

  it("tokenURI inclui commoditySlug e loteOrigem", async () => {
    const { lote, produtor } = await deploy();
    await lote.connect(produtor).criarLote("SOJA", 50000, 1700000000, 1710000000, "RIV-2026-S-0042", 0);

    const uri = await lote.tokenURI(1);
    const base64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    expect(json.name).to.equal("Lote FG #1");
    const commAttr = json.attributes.find((a: { trait_type: string }) => a.trait_type === "Commodity");
    expect(commAttr.value).to.equal("SOJA");
    const origemAttr = json.attributes.find((a: { trait_type: string }) => a.trait_type === "Lote Origem");
    expect(origemAttr.value).to.equal(0);
  });
});
