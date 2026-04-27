import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * CLI de verificação de um lote rastreável "Feito em Goiás".
 *
 * Uso:
 *   LOTE_ID=2 pnpm hardhat run scripts/rastreabilidade/verificar-lote.ts --network rbbLocal
 *
 * Exibe a trilha cronológica completa (eventos ordenados por timestamp),
 * o lote-pai (loteOrigem) se houver, e flags de conformidade
 * (EUDR / RENASEM / CFO / PTV / GTA / SIF / DOF) detectadas pelo subTipo.
 *
 * Opcional: LOTE_ADDRESS, CERT_ADDRESS para sobrescrever as addresses do deployment.
 */

const CTE_NOME = [
  "ORIGEM",
  "PRODUCAO",
  "TRATAMENTO",
  "MONITORAMENTO",
  "EXTRACAO",
  "BENEFICIAMENTO",
  "ARMAZENAGEM",
  "CERTIFICACAO",
  "TRANSPORTE",
  "PROCESSAMENTO",
  "EXPORTACAO",
  "ENTREGA_FINAL",
];

const TIPO_CERT = ["NAO_DEFINIDO", "EUDR", "ESG", "ORGANICO", "GMO_FREE", "FAIR_TRADE", "OUTRO"];

type EventoOut = {
  kind: "evento";
  cte: string;
  subTipo: string;
  ator: string;
  timestamp: string;
  local: string;
  gps: string;
  hashDocumento: string | null;
  observacao: string;
};

type TransferOut = {
  kind: "transfer";
  from: string;
  to: string;
  timestamp: string;
  blockNumber: number;
  txHash: string;
};

async function carregarLote(loteContract: any, certContract: any, loteId: bigint) {
  const [info, eventos] = await loteContract.historicoCompleto(loteId);
  const certIds = await certContract.certificadosDoLote(loteId);
  const certificados = await Promise.all(
    certIds.map(async (id: bigint) => {
      const d = await certContract.detalhes(id);
      return {
        id: Number(id),
        tipo: TIPO_CERT[Number(d.tipo)],
        emissor: d.emissor,
        nomeEmissor: d.nomeEmissor,
        emitidoEm: new Date(Number(d.emitidoEm) * 1000).toISOString(),
        validoAte: new Date(Number(d.validoAte) * 1000).toISOString(),
        hashDocumento: d.hashDocumento,
        revogado: d.revogado,
      };
    })
  );

  const eventosOut: EventoOut[] = eventos.map((e: any) => ({
    kind: "evento" as const,
    cte: CTE_NOME[Number(e.cte)],
    subTipo: e.subTipo,
    ator: e.ator,
    timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
    local: e.localNome,
    gps: e.localGPS,
    hashDocumento: e.hashDocumento === ethers.ZeroHash ? null : e.hashDocumento,
    observacao: e.observacao,
  }));

  // ERC-721 Transfer events do tokenId — chain-of-custody legal (mudança de posse)
  const transferFilter = loteContract.filters.Transfer(null, null, loteId);
  const transferLogs = await loteContract.queryFilter(transferFilter);
  const transfers: TransferOut[] = await Promise.all(
    transferLogs
      .filter((log: any) => log.args.from !== ethers.ZeroAddress) // filtra mint (from=0x0)
      .map(async (log: any) => {
        const block = await log.getBlock();
        return {
          kind: "transfer" as const,
          from: log.args.from,
          to: log.args.to,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          blockNumber: block.number,
          txHash: log.transactionHash,
        };
      })
  );

  // Trilha unificada e cronológica (eventos custom + transfers ERC-721)
  const trilha: (EventoOut | TransferOut)[] = [...eventosOut, ...transfers].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Heurística de conformidade pelo sufixo do subTipo (independe de setor)
  const sufixos = eventosOut.map((e) => e.subTipo.split(".")[1] ?? "");
  const conformidade = {
    EUDR: certificados.some((c) => c.tipo === "EUDR" && !c.revogado && new Date(c.validoAte) > new Date()),
    RENASEM: info.commoditySlug.startsWith("SEMENTE_") || info.loteOrigem !== 0n,
    CFO: sufixos.includes("CFO") || sufixos.includes("CFOC"),
    PTV: sufixos.includes("PTV"),
    GTA: sufixos.includes("GTA"),
    SIF: sufixos.includes("SIF"),
    DOF: sufixos.some((s) => s.startsWith("DOF")),
    MONITORAMENTO_SATELITAL: eventosOut.some((e) => e.cte === "MONITORAMENTO"),
  };

  return {
    info: {
      tokenId: Number(loteId),
      produtor: info.produtor,
      commoditySlug: info.commoditySlug,
      quantidadeKg: Number(info.quantidadeKg),
      dataInicio: new Date(Number(info.dataInicio) * 1000).toISOString(),
      dataExtracao: new Date(Number(info.dataExtracao) * 1000).toISOString(),
      codigoInterno: info.codigoInterno,
      loteOrigem: Number(info.loteOrigem),
      ativo: info.ativo,
    },
    trilha,
    eventos: eventosOut,
    transfers,
    certificados,
    conformidade,
  };
}

async function main() {
  const deploy = JSON.parse(
    readFileSync(
      join(__dirname, "..", "..", "deployments", `rastreabilidade-${network.name}.json`),
      "utf-8"
    )
  ) as { RastreabilidadeLote: string; CertificadosConformidade: string };

  const loteAddr = process.env.LOTE_ADDRESS ?? deploy.RastreabilidadeLote;
  const certAddr = process.env.CERT_ADDRESS ?? deploy.CertificadosConformidade;
  const loteId = BigInt(process.env.LOTE_ID ?? "1");

  const lote = await ethers.getContractAt("RastreabilidadeLote", loteAddr);
  const cert = await ethers.getContractAt("CertificadosConformidade", certAddr);

  const principal = await carregarLote(lote, cert, loteId);
  const arvore: { lote: any; loteOrigem?: any } = { lote: principal };

  if (principal.info.loteOrigem !== 0) {
    arvore.loteOrigem = await carregarLote(lote, cert, BigInt(principal.info.loteOrigem));
  }

  console.log(JSON.stringify(arvore, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
