import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Script CLI para verificação de selo ACIEG por terceiros.
 *
 * Uso:
 *   pnpm hardhat run selo-digital-associado/scripts/verificar.ts --network rbbLocal
 *   SELO_ADDRESS=0x... CONSULTA=05613301000192 pnpm hardhat run ...
 *
 * `CONSULTA` pode ser:
 *   - Endereço 0x... (consulta por endereço)
 *   - 14 dígitos (CNPJ) ou 11 dígitos (CPF) (consulta por CNPJ/CPF)
 */
async function main() {
  let enderecoContrato = process.env.SELO_ADDRESS;
  if (!enderecoContrato) {
    const deploy = JSON.parse(
      readFileSync(join(__dirname, "..", "deployments", `${network.name}.json`), "utf-8")
    ) as { address: string };
    enderecoContrato = deploy.address;
  }

  const consulta = process.env.CONSULTA;
  if (!consulta) {
    console.error("Informe CONSULTA=<endereço|cnpj|cpf>");
    process.exit(1);
  }

  const selo = await ethers.getContractAt("SeloDigitalAssociado", enderecoContrato);

  const isEnd = consulta.startsWith("0x") && consulta.length === 42;
  const endereco = isEnd ? consulta : await selo.associadoPorCnpj(consulta);
  if (endereco === ethers.ZeroAddress) {
    console.log(JSON.stringify({ consulta, status: "NAO_ENCONTRADO" }, null, 2));
    return;
  }

  const ativo = await selo.statusAtivo(endereco);
  const dados = await selo.dadosAssociado(endereco);

  const out = {
    consulta,
    endereco,
    status: ativo ? "ATIVO" : dados.revogado ? "REVOGADO" : "EXPIRADO",
    cnpjOuCpf: dados.cnpjOuCpf,
    razaoSocial: dados.razaoSocial,
    setor: dados.setor,
    emitidoEm: new Date(Number(dados.emitidoEm) * 1000).toISOString(),
    validoAte: new Date(Number(dados.validoAte) * 1000).toISOString(),
    revogado: dados.revogado,
    motivoRevogacao: dados.motivoRevogacao || undefined,
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
