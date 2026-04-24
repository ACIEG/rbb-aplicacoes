import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SeloDigitalAssociado } from "../../typechain-types";

describe("SeloDigitalAssociado", () => {
  async function deploy() {
    const [admin, associado, associado2, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("SeloDigitalAssociado");
    const selo = (await Factory.deploy(admin.address)) as unknown as SeloDigitalAssociado;
    await selo.waitForDeployment();
    return { selo, admin, associado, associado2, outsider };
  }

  const DAYS = 24n * 60n * 60n;
  const CNPJ_ACIEG = "05613301000192";
  const CNPJ_OUTRO = "12345678000100";

  describe("Emissão", () => {
    it("admin emite selo com sucesso", async () => {
      const { selo, admin, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 365n * DAYS;

      await expect(
        selo.emitir(
          associado.address,
          CNPJ_ACIEG,
          "Empresa Exemplo Ltda",
          "Comercio",
          validade
        )
      )
        .to.emit(selo, "SeloEmitido")
        .withArgs(1n, associado.address, CNPJ_ACIEG, "Empresa Exemplo Ltda", validade);

      expect(await selo.ownerOf(1)).to.equal(associado.address);
      expect(await selo.balanceOf(associado.address)).to.equal(1n);
    });

    it("não-admin não pode emitir", async () => {
      const { selo, outsider, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;

      await expect(
        selo
          .connect(outsider)
          .emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Servicos", validade)
      ).to.be.revertedWithCustomError(selo, "AccessControlUnauthorizedAccount");
    });

    it("rejeita CNPJ vazio", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await expect(
        selo.emitir(associado.address, "", "Empresa X", "Servicos", validade)
      ).to.be.revertedWithCustomError(selo, "CnpjObrigatorio");
    });

    it("rejeita razão social vazia", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await expect(
        selo.emitir(associado.address, CNPJ_ACIEG, "", "Servicos", validade)
      ).to.be.revertedWithCustomError(selo, "RazaoSocialObrigatoria");
    });

    it("rejeita validade no passado", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) - 1n;
      await expect(
        selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Servicos", validade)
      ).to.be.revertedWithCustomError(selo, "ValidadeDeveSerFutura");
    });

    it("não permite dois selos para o mesmo associado", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);
      await expect(
        selo.emitir(associado.address, CNPJ_OUTRO, "Outra Razao", "Industria", validade)
      ).to.be.revertedWithCustomError(selo, "AssociadoJaPossuiSelo");
    });

    it("não permite dois selos para o mesmo CNPJ", async () => {
      const { selo, associado, associado2 } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);
      await expect(
        selo.emitir(associado2.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade)
      ).to.be.revertedWithCustomError(selo, "CnpjJaRegistrado");
    });
  });

  describe("Soulbound", () => {
    it("reverte transferFrom", async () => {
      const { selo, associado, associado2 } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      await expect(
        selo.connect(associado).transferFrom(associado.address, associado2.address, 1)
      ).to.be.revertedWithCustomError(selo, "SeloIntransferivel");
    });

    it("reverte safeTransferFrom", async () => {
      const { selo, associado, associado2 } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      await expect(
        selo
          .connect(associado)
          ["safeTransferFrom(address,address,uint256)"](
            associado.address,
            associado2.address,
            1
          )
      ).to.be.revertedWithCustomError(selo, "SeloIntransferivel");
    });
  });

  describe("Revogação", () => {
    it("admin revoga com motivo", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      await expect(selo.revogar(1, "Inadimplencia"))
        .to.emit(selo, "SeloRevogado")
        .withArgs(1n, associado.address, "Inadimplencia");

      expect(await selo.statusAtivo(associado.address)).to.equal(false);
      const dados = await selo.dadosAssociado(associado.address);
      expect(dados.revogado).to.equal(true);
      expect(dados.motivoRevogacao).to.equal("Inadimplencia");
    });

    it("não-revogador não pode revogar", async () => {
      const { selo, outsider, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      await expect(
        selo.connect(outsider).revogar(1, "Fraude")
      ).to.be.revertedWithCustomError(selo, "AccessControlUnauthorizedAccount");
    });

    it("não pode revogar selo inexistente", async () => {
      const { selo } = await deploy();
      await expect(selo.revogar(999, "qualquer")).to.be.revertedWithCustomError(
        selo,
        "ERC721NonexistentToken"
      );
    });

    it("não pode revogar duas vezes", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);
      await selo.revogar(1, "motivo 1");
      await expect(selo.revogar(1, "motivo 2")).to.be.revertedWithCustomError(
        selo,
        "SeloJaRevogado"
      );
    });
  });

  describe("Expiração", () => {
    it("selo expira automaticamente após validoAte", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      expect(await selo.statusAtivo(associado.address)).to.equal(true);

      await time.increaseTo(validade + 1n);
      expect(await selo.statusAtivo(associado.address)).to.equal(false);
      expect(await selo.verificarPorCnpj(CNPJ_ACIEG)).to.equal(false);
    });
  });

  describe("Consultas públicas", () => {
    it("verificarPorCnpj retorna true para selo ativo", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      expect(await selo.verificarPorCnpj(CNPJ_ACIEG)).to.equal(true);
      expect(await selo.verificarPorCnpj("00000000000000")).to.equal(false);
    });

    it("associadoPorCnpj retorna endereço do portador", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      expect(await selo.associadoPorCnpj(CNPJ_ACIEG)).to.equal(associado.address);
      expect(await selo.associadoPorCnpj("inexistente")).to.equal(ethers.ZeroAddress);
    });

    it("dadosAssociado reverte para endereço sem selo", async () => {
      const { selo, outsider } = await deploy();
      await expect(
        selo.dadosAssociado(outsider.address)
      ).to.be.revertedWithCustomError(selo, "SeloInexistente");
    });

    it("tokenURI retorna JSON base64 com metadados", async () => {
      const { selo, associado } = await deploy();
      const validade = BigInt(await time.latest()) + 30n * DAYS;
      await selo.emitir(associado.address, CNPJ_ACIEG, "Empresa X", "Comercio", validade);

      const uri = await selo.tokenURI(1);
      expect(uri).to.match(/^data:application\/json;base64,/);

      const base64 = uri.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
      expect(json.name).to.equal("Selo ACIEG #1");
      expect(json.attributes).to.be.an("array");
      const cnpjAttr = json.attributes.find((a: { trait_type: string }) => a.trait_type === "CNPJ/CPF");
      expect(cnpjAttr.value).to.equal(CNPJ_ACIEG);
    });
  });

  describe("ERC-165", () => {
    it("declara suporte a ERC-721 e AccessControl", async () => {
      const { selo } = await deploy();
      expect(await selo.supportsInterface("0x80ac58cd")).to.equal(true);
      expect(await selo.supportsInterface("0x7965db0b")).to.equal(true);
      expect(await selo.supportsInterface("0xffffffff")).to.equal(false);
    });
  });
});
