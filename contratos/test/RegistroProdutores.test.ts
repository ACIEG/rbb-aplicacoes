import { expect } from "chai";
import { ethers } from "hardhat";
import { RegistroProdutores } from "../typechain-types";

describe("RegistroProdutores", () => {
  async function deploy() {
    const [admin, produtor, produtor2, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RegistroProdutores");
    const reg = (await Factory.deploy(admin.address)) as unknown as RegistroProdutores;
    await reg.waitForDeployment();
    return { reg, admin, produtor, produtor2, outsider };
  }

  const CNPJ_A = "12345678000199";
  const CNPJ_B = "98765432000100";
  const SETOR_AGRO = 1; // Setor.AGROPECUARIA
  const SETOR_SEMENTEIRA = 4;

  const POLIGONO_HASH = ethers.keccak256(ethers.toUtf8Bytes("geojson-test"));
  const POLIGONO_URI = "ipfs://QmTestPoligono";
  const ZERO_HASH = ethers.ZeroHash;

  // Wrapper que preenche os parâmetros novos com defaults vazios
  async function cadastrarSimples(
    reg: RegistroProdutores,
    addr: string,
    cnpj: string,
    nome: string,
    car: string,
    municipio: string,
    lat: number,
    long: number,
    setor: number
  ) {
    return reg.cadastrar(
      addr,
      cnpj,
      nome,
      car,
      municipio,
      lat,
      long,
      ZERO_HASH,
      "",
      "",
      setor
    );
  }

  it("cadastra produtor agropecuário com CAR + polígono", async () => {
    const { reg, produtor } = await deploy();
    await expect(
      reg.cadastrar(
        produtor.address,
        CNPJ_A,
        "Fazenda Boa Vista Ltda",
        "GO-5218907-AB12",
        "Rio Verde/GO",
        -17850000,
        -50926000,
        POLIGONO_HASH,
        POLIGONO_URI,
        "",
        SETOR_AGRO
      )
    )
      .to.emit(reg, "ProdutorCadastrado")
      .withArgs(produtor.address, CNPJ_A, "Fazenda Boa Vista Ltda", SETOR_AGRO, "Rio Verde/GO");

    expect(await reg.produtorAtivo(produtor.address)).to.equal(true);
    const d = await reg.dadosProdutor(produtor.address);
    expect(d.car).to.equal("GO-5218907-AB12");
    expect(d.poligonoCARHash).to.equal(POLIGONO_HASH);
    expect(d.poligonoURI).to.equal(POLIGONO_URI);
    expect(d.renasem).to.equal("");
    expect(d.ativo).to.equal(true);
  });

  it("cadastra sementeira com nº RENASEM", async () => {
    const { reg, produtor } = await deploy();
    await reg.cadastrar(
      produtor.address,
      CNPJ_A,
      "Brasmax Sementes",
      "GO-CAR-SEM",
      "Cristalina/GO",
      -16768000,
      -47616000,
      POLIGONO_HASH,
      POLIGONO_URI,
      "GO 0815/2024",
      SETOR_SEMENTEIRA
    );
    const d = await reg.dadosProdutor(produtor.address);
    expect(d.setor).to.equal(SETOR_SEMENTEIRA);
    expect(d.renasem).to.equal("GO 0815/2024");
  });

  it("não admite CNPJ duplicado", async () => {
    const { reg, produtor, produtor2 } = await deploy();
    await cadastrarSimples(reg, produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    await expect(
      cadastrarSimples(reg, produtor2.address, CNPJ_A, "Y", "", "Goiania/GO", 0, 0, SETOR_AGRO)
    ).to.be.revertedWithCustomError(reg, "CnpjJaRegistrado");
  });

  it("não admite mesmo endereço duas vezes", async () => {
    const { reg, produtor } = await deploy();
    await cadastrarSimples(reg, produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    await expect(
      cadastrarSimples(reg, produtor.address, CNPJ_B, "Y", "", "Goiania/GO", 0, 0, SETOR_AGRO)
    ).to.be.revertedWithCustomError(reg, "ProdutorJaCadastrado");
  });

  it("rejeita setor NAO_DEFINIDO", async () => {
    const { reg, produtor } = await deploy();
    await expect(
      cadastrarSimples(reg, produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, 0)
    ).to.be.revertedWithCustomError(reg, "SetorInvalido");
  });

  it("non-CADASTRADOR não pode cadastrar", async () => {
    const { reg, outsider, produtor } = await deploy();
    await expect(
      reg
        .connect(outsider)
        .cadastrar(produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, ZERO_HASH, "", "", SETOR_AGRO)
    ).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });

  it("atualiza CAR", async () => {
    const { reg, produtor } = await deploy();
    await cadastrarSimples(reg, produtor.address, CNPJ_A, "X", "OLD-CAR", "Goiania/GO", 0, 0, SETOR_AGRO);
    await expect(reg.atualizarCAR(produtor.address, "NEW-CAR"))
      .to.emit(reg, "CARAtualizado")
      .withArgs(produtor.address, "NEW-CAR");
    expect((await reg.dadosProdutor(produtor.address)).car).to.equal("NEW-CAR");
  });

  it("atualiza polígono e RENASEM", async () => {
    const { reg, produtor } = await deploy();
    await cadastrarSimples(reg, produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    const novoHash = ethers.keccak256(ethers.toUtf8Bytes("novo-poligono"));
    await expect(reg.atualizarPoligono(produtor.address, novoHash, "ipfs://QmNovo"))
      .to.emit(reg, "PoligonoAtualizado")
      .withArgs(produtor.address, novoHash, "ipfs://QmNovo");
    const d = await reg.dadosProdutor(produtor.address);
    expect(d.poligonoCARHash).to.equal(novoHash);
    expect(d.poligonoURI).to.equal("ipfs://QmNovo");

    await reg.atualizarRenasem(produtor.address, "GO 9999/2026");
    expect((await reg.dadosProdutor(produtor.address)).renasem).to.equal("GO 9999/2026");
  });

  it("suspende e reativa", async () => {
    const { reg, produtor } = await deploy();
    await cadastrarSimples(reg, produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);

    await expect(reg.suspender(produtor.address, "Desmatamento detectado"))
      .to.emit(reg, "ProdutorSuspenso")
      .withArgs(produtor.address, "Desmatamento detectado");
    expect(await reg.produtorAtivo(produtor.address)).to.equal(false);

    await expect(reg.reativar(produtor.address)).to.emit(reg, "ProdutorReativado");
    expect(await reg.produtorAtivo(produtor.address)).to.equal(true);
  });

  it("produtorPorCnpj retorna endereço", async () => {
    const { reg, produtor } = await deploy();
    await cadastrarSimples(reg, produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    expect(await reg.produtorPorCnpj(CNPJ_A)).to.equal(produtor.address);
    expect(await reg.produtorPorCnpj(CNPJ_B)).to.equal(ethers.ZeroAddress);
  });

  it("totalProdutores e produtorEm", async () => {
    const { reg, produtor, produtor2 } = await deploy();
    await cadastrarSimples(reg, produtor.address, CNPJ_A, "A", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    await cadastrarSimples(reg, produtor2.address, CNPJ_B, "B", "", "Rio Verde/GO", 0, 0, SETOR_AGRO);
    expect(await reg.totalProdutores()).to.equal(2n);
    expect(await reg.produtorEm(0)).to.equal(produtor.address);
    expect(await reg.produtorEm(1)).to.equal(produtor2.address);
  });

  it("dadosProdutor reverte para inexistente", async () => {
    const { reg, outsider } = await deploy();
    await expect(reg.dadosProdutor(outsider.address)).to.be.revertedWithCustomError(
      reg,
      "ProdutorInexistente"
    );
  });
});
