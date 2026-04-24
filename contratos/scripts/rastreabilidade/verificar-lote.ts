import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * CLI de verificação de um lote rastreável.
 *
 * Uso:
 *   LOTE_ID=1 pnpm hardhat run scripts/rastreabilidade/verificar-lote.ts --network rbbLocal
 *
 * Opcional: LOTE_ADDRESS, CERT_ADDRESS para sobrescrever as addresses do deployment.
 */
async function main() {
  const deploy = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "deployments", `rastreabilidade-${network.name}.json`), "utf-8")
  ) as { RastreabilidadeLote: string; CertificadosConformidade: string };

  const loteAddr = process.env.LOTE_ADDRESS ?? deploy.RastreabilidadeLote;
  const certAddr = process.env.CERT_ADDRESS ?? deploy.CertificadosConformidade;
  const loteId = BigInt(process.env.LOTE_ID ?? "1");

  const lote = await ethers.getContractAt("RastreabilidadeLote", loteAddr);
  const cert = await ethers.getContractAt("CertificadosConformidade", certAddr);

  const [info, eventos] = await lote.historicoCompleto(loteId);
  const certIds = await cert.certificadosDoLote(loteId);
  const certificados = await Promise.all(
    certIds.map(async (id) => {
      const d = await cert.detalhes(id);
      return {
        id: Number(id),
        tipo: ["NAO_DEFINIDO", "EUDR", "ESG", "ORGANICO", "GMO_FREE", "FAIR_TRADE", "OUTRO"][Number(d.tipo)],
        emissor: d.emissor,
        nomeEmissor: d.nomeEmissor,
        emitidoEm: new Date(Number(d.emitidoEm) * 1000).toISOString(),
        validoAte: new Date(Number(d.validoAte) * 1000).toISOString(),
        hashDocumento: d.hashDocumento,
        revogado: d.revogado,
      };
    })
  );

  const tipoNome = (t: bigint) =>
    ["COLHEITA", "TRANSPORTE", "ARMAZENAGEM", "PROCESSAMENTO", "EXPORTACAO", "ENTREGA_FINAL"][Number(t)];

  console.log(
    JSON.stringify(
      {
        lote: {
          id: Number(loteId),
          produtor: info.produtor,
          quantidadeKg: Number(info.quantidadeKg),
          dataColheita: new Date(Number(info.dataColheita) * 1000).toISOString(),
          codigoInterno: info.codigoInterno,
          ativo: info.ativo,
        },
        cadeiaCustodia: eventos.map((e) => ({
          tipo: tipoNome(e.tipo),
          ator: e.ator,
          timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
          local: e.localNome,
          gps: e.localGPS,
          hashDocumento: e.hashDocumento === ethers.ZeroHash ? null : e.hashDocumento,
          observacao: e.observacao,
        })),
        certificados,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
