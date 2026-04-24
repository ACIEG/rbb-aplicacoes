import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Rede: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Reg = await ethers.getContractFactory("RegistroProdutores");
  const reg = await Reg.deploy(deployer.address);
  await reg.waitForDeployment();
  const regAddr = await reg.getAddress();
  console.log(`RegistroProdutores: ${regAddr}`);

  const Lote = await ethers.getContractFactory("RastreabilidadeLote");
  const lote = await Lote.deploy(deployer.address, regAddr);
  await lote.waitForDeployment();
  const loteAddr = await lote.getAddress();
  console.log(`RastreabilidadeLote: ${loteAddr}`);

  const Cert = await ethers.getContractFactory("CertificadosConformidade");
  const cert = await Cert.deploy(deployer.address, loteAddr);
  await cert.waitForDeployment();
  const certAddr = await cert.getAddress();
  console.log(`CertificadosConformidade: ${certAddr}`);

  const dir = join(__dirname, "..", "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `rastreabilidade-${network.name}.json`),
    JSON.stringify(
      {
        network: network.name,
        deployer: deployer.address,
        RegistroProdutores: regAddr,
        RastreabilidadeLote: loteAddr,
        CertificadosConformidade: certAddr,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Deployment em deployments/rastreabilidade-${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
