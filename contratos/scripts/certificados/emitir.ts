import { ethers, network } from "hardhat";
import { readFileSync, existsSync, createReadStream } from "fs";
import { createHash } from "crypto";
import { join } from "path";

/**
 * Emite um certificado a partir de um PDF real.
 *
 * Variáveis de ambiente:
 *   CERT_ADDRESS  — endereço do contrato (fallback: deployments/<network>.json)
 *   ALUNO         — endereço de carteira do aluno
 *   PDF_PATH      — caminho para o PDF (será hasheado com SHA-256)
 *   NOME_CURSO    — obrigatório
 *   NOME_ALUNO    — obrigatório
 *   CARGA_HORARIA — em horas (obrigatório)
 *   DATA_CONCLUSAO — timestamp UNIX (default: agora)
 */
async function main() {
  let enderecoContrato = process.env.CERT_ADDRESS;
  if (!enderecoContrato) {
    const d = JSON.parse(
      readFileSync(join(__dirname, "..", "deployments", `${network.name}.json`), "utf-8")
    ) as { address: string };
    enderecoContrato = d.address;
  }

  const aluno = process.env.ALUNO;
  const pdfPath = process.env.PDF_PATH;
  const nomeCurso = process.env.NOME_CURSO;
  const nomeAluno = process.env.NOME_ALUNO;
  const cargaHoraria = process.env.CARGA_HORARIA;
  const dataConclusao = process.env.DATA_CONCLUSAO ?? String(Math.floor(Date.now() / 1000));

  if (!aluno || !pdfPath || !nomeCurso || !nomeAluno || !cargaHoraria) {
    console.error("Variáveis obrigatórias: ALUNO, PDF_PATH, NOME_CURSO, NOME_ALUNO, CARGA_HORARIA");
    process.exit(1);
  }
  if (!existsSync(pdfPath)) {
    console.error(`PDF não encontrado: ${pdfPath}`);
    process.exit(1);
  }

  const hashPdf = await sha256File(pdfPath);
  console.log(`Hash SHA-256 do PDF: ${hashPdf}`);

  const cert = await ethers.getContractAt("CertificadoCapacitacao", enderecoContrato);
  const tx = await cert.emitirCertificado(
    aluno,
    hashPdf,
    nomeCurso,
    nomeAluno,
    Number(cargaHoraria),
    Number(dataConclusao)
  );
  const receipt = await tx.wait();
  console.log(`Certificado emitido em tx ${receipt?.hash}`);
}

async function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve("0x" + hash.digest("hex")));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
