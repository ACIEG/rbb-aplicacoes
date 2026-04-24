import { expect } from "chai";
import { ethers } from "hardhat";
import { RastreabilidadeLote, RegistroProdutores } from "../typechain-types";

describe("RastreabilidadeLote", () => {
  const SETOR_AGRO = 1;
  const COMMODITY_SOJA = 1;
  const TIPO_TRANSPORTE = 1;
  const TIPO_EXPORTACAO = 4;

  async function deploy() {
    const [admin, produtor, transportador, outsider] = await ethers.getSigners();

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
      SETOR_AGRO
    );

    const Lote = await ethers.getContractFactory("RastreabilidadeLote");
    const lote = (await Lote.deploy(admin.address, await reg.getAddress())) as unknown as RastreabilidadeLote;
    await lote.waitForDeployment();

    return { reg, lote, admin, produtor, transportador, outsider };
  }

  it("produtor ativo cria lote", async () => {
    const { lote, produtor } = await deploy();
    const dataColheita = Math.floor(Date.now() / 1000);

    await expect(
      lote.connect(produtor).criarLote(COMMODITY_SOJA, 50000, dataColheita, "RIV-2026-S-0042")
    )
      .to.emit(lote, "LoteCriado")
      .withArgs(1n, produtor.address, COMMODITY_SOJA, 50000n, "RIV-2026-S-0042");

    expect(await lote.ownerOf(1)).to.equal(produtor.address);
    const info = await lote.loteInfo(1);
    expect(info.quantidadeKg).to.equal(50000n);
    expect(info.codigoInterno).to.equal("RIV-2026-S-0042");
    expect(await lote.totalEventos(1)).to.equal(1n); // Evento inicial de colheita
  });

  it("produtor não cadastrado não pode criar lote", async () => {
    const { lote, outsider } = await deploy();
    await expect(
      lote.connect(outsider).criarLote(COMMODITY_SOJA, 50000, 0, "X")
    ).to.be.revertedWithCustomError(lote, "ProdutorNaoRegistradoOuInativo");
  });

  it("produtor suspenso não pode criar lote", async () => {
    const { reg, lote, produtor } = await deploy();
    await reg.suspender(produtor.address, "Teste");
    await expect(
      lote.connect(produtor).criarLote(COMMODITY_SOJA, 50000, 0, "X")
    ).to.be.revertedWithCustomError(lote, "ProdutorNaoRegistradoOuInativo");
  });

  it("rejeita commodity NAO_DEFINIDA", async () => {
    const { lote, produtor } = await deploy();
    await expect(
      lote.connect(produtor).criarLote(0, 50000, 0, "X")
    ).to.be.revertedWithCustomError(lote, "CommodityInvalida");
  });

  it("rejeita quantidade zero", async () => {
    const { lote, produtor } = await deploy();
    await expect(
      lote.connect(produtor).criarLote(COMMODITY_SOJA, 0, 0, "X")
    ).to.be.revertedWithCustomError(lote, "QuantidadeInvalida");
  });

  it("rejeita código vazio", async () => {
    const { lote, produtor } = await deploy();
    await expect(
      lote.connect(produtor).criarLote(COMMODITY_SOJA, 50000, 0, "")
    ).to.be.revertedWithCustomError(lote, "CodigoObrigatorio");
  });

  it("owner registra evento de transporte", async () => {
    const { lote, produtor } = await deploy();
    await lote.connect(produtor).criarLote(COMMODITY_SOJA, 50000, 1700000000, "RIV-2026-S-0042");

    const hashBL = ethers.keccak256(ethers.toUtf8Bytes("bill-of-lading-BR-EUROPE-001"));
    await expect(
      lote
        .connect(produtor)
        .registrarEvento(
          1,
          TIPO_TRANSPORTE,
          "-17.85,-50.926",
          "Saida da fazenda para silo",
          hashBL,
          "Caminhao placa ABC-1234"
        )
    )
      .to.emit(lote, "EventoRegistrado")
      .withArgs(1n, TIPO_TRANSPORTE, produtor.address, "Saida da fazenda para silo");

    expect(await lote.totalEventos(1)).to.equal(2n);
  });

  it("historicoCompleto retorna lote + eventos em ordem", async () => {
    const { lote, produtor } = await deploy();
    await lote.connect(produtor).criarLote(COMMODITY_SOJA, 50000, 1700000000, "RIV-2026-S-0042");
    await lote.connect(produtor).registrarEvento(1, TIPO_TRANSPORTE, "x", "Silo", ethers.ZeroHash, "");
    await lote.connect(produtor).registrarEvento(1, TIPO_EXPORTACAO, "y", "Santos/SP", ethers.ZeroHash, "Export EU");

    const [info, eventos] = await lote.historicoCompleto(1);
    expect(info.quantidadeKg).to.equal(50000n);
    expect(eventos.length).to.equal(3);
    expect(Number(eventos[0].tipo)).to.equal(0); // COLHEITA
    expect(Number(eventos[1].tipo)).to.equal(TIPO_TRANSPORTE);
    expect(Number(eventos[2].tipo)).to.equal(TIPO_EXPORTACAO);
    expect(eventos[2].localNome).to.equal("Santos/SP");
  });

  it("tokenURI retorna metadados JSON", async () => {
    const { lote, produtor } = await deploy();
    await lote.connect(produtor).criarLote(COMMODITY_SOJA, 50000, 1700000000, "RIV-2026-S-0042");

    const uri = await lote.tokenURI(1);
    const base64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    expect(json.name).to.equal("Lote FG #1");
    const codAttr = json.attributes.find((a: { trait_type: string }) => a.trait_type === "Codigo");
    expect(codAttr.value).to.equal("RIV-2026-S-0042");
    const commAttr = json.attributes.find((a: { trait_type: string }) => a.trait_type === "Commodity");
    expect(commAttr.value).to.equal("Soja");
  });
});
