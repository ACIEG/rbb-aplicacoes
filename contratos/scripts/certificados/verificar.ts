import { ethers, network } from "hardhat";
import { readFileSync, existsSync, createReadStream } from "fs";
import { createHash } from "crypto";
import { join } from "path";

/**
 * Verifica autenticidade de um certificado.
 *
 * Variáveis de ambiente:
 *   CERT_ADDRESS — endereço do contrato (fallback: deployments/<network>.json)
 *   PDF_PATH     — caminho do PDF a verificar (será hasheado)
 *   OU HASH      — hash SHA-256 já calculado (hex 0x...)
 *   OU TOKEN_ID  — consulta por tokenId direto
 */
async function main() {
  let enderecoContrato = process.env.CERT_ADDRESS;
  if (!enderecoContrato) {
    const d = JSON.parse(
      readFileSync(join(__dirname, "..", "deployments", `${network.name}.json`), "utf-8")
    ) as { address: string };
    enderecoContrato = d.address;
  }

  const cert = await ethers.getContractAt("CertificadoCapacitacao", enderecoContrato);

  let tokenId = 0n;
  let hashPdf = ethers.ZeroHash;
  let valido = false;

  if (process.env.TOKEN_ID) {
    tokenId = BigInt(process.env.TOKEN_ID);
    const detalhes = await cert.detalhes(tokenId);
    hashPdf = detalhes.hashPdf;
    valido = !detalhes.revogado;
  } else {
    if (process.env.HASH) {
      hashPdf = process.env.HASH;
    } else if (process.env.PDF_PATH) {
      if (!existsSync(process.env.PDF_PATH)) {
        console.error(`PDF não encontrado: ${process.env.PDF_PATH}`);
        process.exit(1);
      }
      hashPdf = await sha256File(process.env.PDF_PATH);
    } else {
      console.error("Informe TOKEN_ID=..., HASH=0x... ou PDF_PATH=...");
      process.exit(1);
    }
    const r = await cert.verificarPorHash(hashPdf);
    valido = r[0];
    tokenId = r[1];
  }

  if (tokenId === 0n) {
    console.log(
      JSON.stringify({ consulta: { hashPdf }, status: "NAO_ENCONTRADO" }, null, 2)
    );
    return;
  }

  const d = await cert.detalhes(tokenId);
  const out = {
    tokenId: Number(tokenId),
    hashPdf,
    valido,
    status: d.revogado ? "REVOGADO" : "VALIDO",
    nomeCurso: d.nomeCurso,
    nomeAluno: d.nomeAluno,
    cargaHorariaHoras: Number(d.cargaHorariaHoras),
    dataConclusao: new Date(Number(d.dataConclusao) * 1000).toISOString(),
    emissor: d.emissor,
    motivoRevogacao: d.motivoRevogacao || undefined,
  };
  console.log(JSON.stringify(out, null, 2));
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
