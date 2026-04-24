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

  it("cadastra produtor agropecuário com CAR", async () => {
    const { reg, produtor } = await deploy();
    await expect(
      reg.cadastrar(
        produtor.address,
        CNPJ_A,
        "Fazenda Boa Vista Ltda",
        "GO-5218907-AB12",
        "Rio Verde/GO",
        -17850000, // -17.85 lat
        -50926000, // -50.926 long
        SETOR_AGRO
      )
    )
      .to.emit(reg, "ProdutorCadastrado")
      .withArgs(produtor.address, CNPJ_A, "Fazenda Boa Vista Ltda", SETOR_AGRO, "Rio Verde/GO");

    expect(await reg.produtorAtivo(produtor.address)).to.equal(true);
    const d = await reg.dadosProdutor(produtor.address);
    expect(d.car).to.equal("GO-5218907-AB12");
    expect(d.ativo).to.equal(true);
  });

  it("não admite CNPJ duplicado", async () => {
    const { reg, produtor, produtor2 } = await deploy();
    await reg.cadastrar(produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    await expect(
      reg.cadastrar(produtor2.address, CNPJ_A, "Y", "", "Goiania/GO", 0, 0, SETOR_AGRO)
    ).to.be.revertedWithCustomError(reg, "CnpjJaRegistrado");
  });

  it("não admite mesmo endereço duas vezes", async () => {
    const { reg, produtor } = await deploy();
    await reg.cadastrar(produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    await expect(
      reg.cadastrar(produtor.address, CNPJ_B, "Y", "", "Goiania/GO", 0, 0, SETOR_AGRO)
    ).to.be.revertedWithCustomError(reg, "ProdutorJaCadastrado");
  });

  it("rejeita setor NAO_DEFINIDO", async () => {
    const { reg, produtor } = await deploy();
    await expect(
      reg.cadastrar(produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, 0)
    ).to.be.revertedWithCustomError(reg, "SetorInvalido");
  });

  it("non-CADASTRADOR não pode cadastrar", async () => {
    const { reg, outsider, produtor } = await deploy();
    await expect(
      reg
        .connect(outsider)
        .cadastrar(produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO)
    ).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });

  it("atualiza CAR", async () => {
    const { reg, produtor } = await deploy();
    await reg.cadastrar(produtor.address, CNPJ_A, "X", "OLD-CAR", "Goiania/GO", 0, 0, SETOR_AGRO);
    await expect(reg.atualizarCAR(produtor.address, "NEW-CAR"))
      .to.emit(reg, "CARAtualizado")
      .withArgs(produtor.address, "NEW-CAR");
    expect((await reg.dadosProdutor(produtor.address)).car).to.equal("NEW-CAR");
  });

  it("suspende e reativa", async () => {
    const { reg, produtor } = await deploy();
    await reg.cadastrar(produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);

    await expect(reg.suspender(produtor.address, "Desmatamento detectado"))
      .to.emit(reg, "ProdutorSuspenso")
      .withArgs(produtor.address, "Desmatamento detectado");
    expect(await reg.produtorAtivo(produtor.address)).to.equal(false);

    await expect(reg.reativar(produtor.address)).to.emit(reg, "ProdutorReativado");
    expect(await reg.produtorAtivo(produtor.address)).to.equal(true);
  });

  it("produtorPorCnpj retorna endereço", async () => {
    const { reg, produtor } = await deploy();
    await reg.cadastrar(produtor.address, CNPJ_A, "X", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    expect(await reg.produtorPorCnpj(CNPJ_A)).to.equal(produtor.address);
    expect(await reg.produtorPorCnpj(CNPJ_B)).to.equal(ethers.ZeroAddress);
  });

  it("totalProdutores e produtorEm", async () => {
    const { reg, produtor, produtor2 } = await deploy();
    await reg.cadastrar(produtor.address, CNPJ_A, "A", "", "Goiania/GO", 0, 0, SETOR_AGRO);
    await reg.cadastrar(produtor2.address, CNPJ_B, "B", "", "Rio Verde/GO", 0, 0, SETOR_AGRO);
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
