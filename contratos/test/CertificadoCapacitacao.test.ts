import { expect } from "chai";
import { ethers } from "hardhat";
import { CertificadoCapacitacao } from "../../typechain-types";

describe("CertificadoCapacitacao", () => {
  async function deploy() {
    const [admin, aluno, aluno2, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CertificadoCapacitacao");
    const cert = (await Factory.deploy(admin.address)) as unknown as CertificadoCapacitacao;
    await cert.waitForDeployment();
    return { cert, admin, aluno, aluno2, outsider };
  }

  const HASH_A = ethers.keccak256(ethers.toUtf8Bytes("pdf-curso-blockchain-2026"));
  const HASH_B = ethers.keccak256(ethers.toUtf8Bytes("pdf-curso-gestao-2026"));
  const DATA_CONCLUSAO = 1740000000; // 2025-02-19

  describe("Emissão", () => {
    it("emite certificado com sucesso", async () => {
      const { cert, admin, aluno } = await deploy();

      await expect(
        cert.emitirCertificado(
          aluno.address,
          HASH_A,
          "Blockchain para Gestao",
          "Maria da Silva",
          40,
          DATA_CONCLUSAO
        )
      )
        .to.emit(cert, "CertificadoEmitido")
        .withArgs(
          1n,
          aluno.address,
          admin.address,
          HASH_A,
          "Blockchain para Gestao",
          40n
        );

      expect(await cert.ownerOf(1)).to.equal(aluno.address);
    });

    it("não-emissor não pode emitir", async () => {
      const { cert, outsider, aluno } = await deploy();
      await expect(
        cert
          .connect(outsider)
          .emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO)
      ).to.be.revertedWithCustomError(cert, "AccessControlUnauthorizedAccount");
    });

    it("rejeita hash zero", async () => {
      const { cert, aluno } = await deploy();
      await expect(
        cert.emitirCertificado(
          aluno.address,
          ethers.ZeroHash,
          "Curso X",
          "Maria",
          40,
          DATA_CONCLUSAO
        )
      ).to.be.revertedWithCustomError(cert, "HashObrigatorio");
    });

    it("rejeita nome de curso vazio", async () => {
      const { cert, aluno } = await deploy();
      await expect(
        cert.emitirCertificado(aluno.address, HASH_A, "", "Maria", 40, DATA_CONCLUSAO)
      ).to.be.revertedWithCustomError(cert, "NomeCursoObrigatorio");
    });

    it("rejeita nome de aluno vazio", async () => {
      const { cert, aluno } = await deploy();
      await expect(
        cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "", 40, DATA_CONCLUSAO)
      ).to.be.revertedWithCustomError(cert, "NomeAlunoObrigatorio");
    });

    it("rejeita carga horária zero", async () => {
      const { cert, aluno } = await deploy();
      await expect(
        cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 0, DATA_CONCLUSAO)
      ).to.be.revertedWithCustomError(cert, "CargaHorariaInvalida");
    });

    it("rejeita hash duplicado", async () => {
      const { cert, aluno, aluno2 } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO);
      await expect(
        cert.emitirCertificado(aluno2.address, HASH_A, "Curso Y", "Joao", 20, DATA_CONCLUSAO)
      ).to.be.revertedWithCustomError(cert, "HashDuplicado");
    });

    it("permite múltiplos certificados por aluno", async () => {
      const { cert, aluno } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso A", "Maria", 40, DATA_CONCLUSAO);
      await cert.emitirCertificado(aluno.address, HASH_B, "Curso B", "Maria", 20, DATA_CONCLUSAO);
      const ids = await cert.certificadosDe(aluno.address);
      expect(ids.map((x) => Number(x))).to.deep.equal([1, 2]);
    });
  });

  describe("Soulbound", () => {
    it("reverte transferFrom", async () => {
      const { cert, aluno, aluno2 } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO);
      await expect(
        cert.connect(aluno).transferFrom(aluno.address, aluno2.address, 1)
      ).to.be.revertedWithCustomError(cert, "CertificadoIntransferivel");
    });
  });

  describe("Revogação", () => {
    it("admin revoga certificado", async () => {
      const { cert, aluno } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO);

      await expect(cert.revogar(1, "Fraude de identidade detectada"))
        .to.emit(cert, "CertificadoRevogado")
        .withArgs(1n, aluno.address, "Fraude de identidade detectada");

      const d = await cert.detalhes(1);
      expect(d.revogado).to.equal(true);
      expect(d.motivoRevogacao).to.equal("Fraude de identidade detectada");
    });

    it("reverifica hash como inválido após revogar", async () => {
      const { cert, aluno } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO);

      const [validoAntes, idAntes] = await cert.verificarPorHash(HASH_A);
      expect(validoAntes).to.equal(true);
      expect(idAntes).to.equal(1n);

      await cert.revogar(1, "motivo");

      const [validoDepois, idDepois] = await cert.verificarPorHash(HASH_A);
      expect(validoDepois).to.equal(false);
      expect(idDepois).to.equal(1n); // tokenId ainda é encontrado; só o 'valido' muda
    });

    it("não pode revogar duas vezes", async () => {
      const { cert, aluno } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO);
      await cert.revogar(1, "motivo 1");
      await expect(cert.revogar(1, "motivo 2")).to.be.revertedWithCustomError(
        cert,
        "CertificadoJaRevogado"
      );
    });

    it("não-revogador não pode revogar", async () => {
      const { cert, outsider, aluno } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO);
      await expect(
        cert.connect(outsider).revogar(1, "x")
      ).to.be.revertedWithCustomError(cert, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Consultas públicas", () => {
    it("verificarPorHash retorna false+0 para hash inexistente", async () => {
      const { cert } = await deploy();
      const [valido, id] = await cert.verificarPorHash(HASH_B);
      expect(valido).to.equal(false);
      expect(id).to.equal(0n);
    });

    it("detalhes reverte para tokenId inexistente", async () => {
      const { cert } = await deploy();
      await expect(cert.detalhes(999)).to.be.revertedWithCustomError(
        cert,
        "ERC721NonexistentToken"
      );
    });

    it("tokenURI inclui hash em hex", async () => {
      const { cert, aluno } = await deploy();
      await cert.emitirCertificado(aluno.address, HASH_A, "Curso X", "Maria", 40, DATA_CONCLUSAO);
      const uri = await cert.tokenURI(1);
      const base64 = uri.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
      const hashAttr = json.attributes.find((a: { trait_type: string }) => a.trait_type === "Hash PDF");
      expect(hashAttr.value.toLowerCase()).to.equal(HASH_A.toLowerCase());
    });
  });
});
