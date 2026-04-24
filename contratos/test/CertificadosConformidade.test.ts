import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  CertificadosConformidade,
  RastreabilidadeLote,
  RegistroProdutores,
} from "../typechain-types";

describe("CertificadosConformidade", () => {
  const SETOR_AGRO = 1;
  const COMMODITY_SOJA = 1;
  const TIPO_EUDR = 1;
  const TIPO_ESG = 2;
  const HASH_DOC = "0x" + "ab".repeat(32);

  async function deploy() {
    const [admin, produtor, certificadora, outsider] = await ethers.getSigners();

    const Reg = await ethers.getContractFactory("RegistroProdutores");
    const reg = (await Reg.deploy(admin.address)) as unknown as RegistroProdutores;
    await reg.waitForDeployment();
    await reg.cadastrar(
      produtor.address,
      "12345678000199",
      "Fazenda Exemplo",
      "CAR-1",
      "Rio Verde/GO",
      0,
      0,
      SETOR_AGRO
    );

    const Lote = await ethers.getContractFactory("RastreabilidadeLote");
    const lote = (await Lote.deploy(admin.address, await reg.getAddress())) as unknown as RastreabilidadeLote;
    await lote.waitForDeployment();
    await lote
      .connect(produtor)
      .criarLote(COMMODITY_SOJA, 50000, await time.latest(), "RIV-2026-S-0042");

    const Cert = await ethers.getContractFactory("CertificadosConformidade");
    const cert = (await Cert.deploy(admin.address, await lote.getAddress())) as unknown as CertificadosConformidade;
    await cert.waitForDeployment();
    await cert.grantRole(await cert.CERTIFICADORA_ROLE(), certificadora.address);

    return { reg, lote, cert, admin, produtor, certificadora, outsider };
  }

  it("certificadora emite EUDR", async () => {
    const { cert, certificadora } = await deploy();
    const validoAte = (await time.latest()) + 365 * 24 * 60 * 60;

    await expect(
      cert
        .connect(certificadora)
        .emitir(1, TIPO_EUDR, "IBD Certificacoes", validoAte, HASH_DOC, "Lote auditado")
    )
      .to.emit(cert, "CertificadoEmitido")
      .withArgs(1n, 1n, TIPO_EUDR, certificadora.address, validoAte);

    expect(await cert.temCertificadoValido(1, TIPO_EUDR)).to.equal(true);
    expect(await cert.temCertificadoValido(1, TIPO_ESG)).to.equal(false);
  });

  it("non-certificadora não pode emitir", async () => {
    const { cert, outsider } = await deploy();
    const validoAte = (await time.latest()) + 30 * 24 * 60 * 60;
    await expect(
      cert
        .connect(outsider)
        .emitir(1, TIPO_EUDR, "Falsa", validoAte, HASH_DOC, "")
    ).to.be.revertedWithCustomError(cert, "AccessControlUnauthorizedAccount");
  });

  it("rejeita tipo NAO_DEFINIDO", async () => {
    const { cert, certificadora } = await deploy();
    const validoAte = (await time.latest()) + 30 * 24 * 60 * 60;
    await expect(
      cert.connect(certificadora).emitir(1, 0, "IBD", validoAte, HASH_DOC, "")
    ).to.be.revertedWithCustomError(cert, "TipoInvalido");
  });

  it("rejeita validade no passado", async () => {
    const { cert, certificadora } = await deploy();
    const validoAte = (await time.latest()) - 1;
    await expect(
      cert.connect(certificadora).emitir(1, TIPO_EUDR, "IBD", validoAte, HASH_DOC, "")
    ).to.be.revertedWithCustomError(cert, "ValidadeDeveSerFutura");
  });

  it("rejeita hash zero", async () => {
    const { cert, certificadora } = await deploy();
    const validoAte = (await time.latest()) + 30 * 24 * 60 * 60;
    await expect(
      cert.connect(certificadora).emitir(1, TIPO_EUDR, "IBD", validoAte, ethers.ZeroHash, "")
    ).to.be.revertedWithCustomError(cert, "HashObrigatorio");
  });

  it("rejeita lote inexistente", async () => {
    const { cert, certificadora } = await deploy();
    const validoAte = (await time.latest()) + 30 * 24 * 60 * 60;
    await expect(
      cert.connect(certificadora).emitir(999, TIPO_EUDR, "IBD", validoAte, HASH_DOC, "")
    ).to.be.revertedWithCustomError(cert, "LoteInexistente");
  });

  it("revoga e invalida o certificado", async () => {
    const { cert, certificadora } = await deploy();
    const validoAte = (await time.latest()) + 30 * 24 * 60 * 60;
    await cert.connect(certificadora).emitir(1, TIPO_EUDR, "IBD", validoAte, HASH_DOC, "");

    expect(await cert.temCertificadoValido(1, TIPO_EUDR)).to.equal(true);
    await expect(cert.connect(certificadora).revogar(1, "Fraude detectada"))
      .to.emit(cert, "CertificadoRevogado")
      .withArgs(1n, "Fraude detectada");
    expect(await cert.temCertificadoValido(1, TIPO_EUDR)).to.equal(false);
  });

  it("certificadosDoLote lista todos os ids", async () => {
    const { cert, certificadora } = await deploy();
    const v = (await time.latest()) + 365 * 24 * 60 * 60;
    await cert.connect(certificadora).emitir(1, TIPO_EUDR, "IBD", v, HASH_DOC, "");
    await cert.connect(certificadora).emitir(1, TIPO_ESG, "Rainforest", v, HASH_DOC, "");

    const ids = await cert.certificadosDoLote(1);
    expect(ids.map((x) => Number(x))).to.deep.equal([1, 2]);
  });

  it("certificado expira automaticamente", async () => {
    const { cert, certificadora } = await deploy();
    const validoAte = (await time.latest()) + 60;
    await cert.connect(certificadora).emitir(1, TIPO_EUDR, "IBD", validoAte, HASH_DOC, "");

    expect(await cert.temCertificadoValido(1, TIPO_EUDR)).to.equal(true);
    await time.increaseTo(validoAte + 1);
    expect(await cert.temCertificadoValido(1, TIPO_EUDR)).to.equal(false);
  });
});
