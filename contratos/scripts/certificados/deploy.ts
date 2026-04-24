import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Rede: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Saldo: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const Cert = await ethers.getContractFactory("CertificadoCapacitacao");
  const cert = await Cert.deploy(deployer.address);
  await cert.waitForDeployment();

  const endereco = await cert.getAddress();
  console.log(`CertificadoCapacitacao deployado em: ${endereco}`);

  const dir = join(__dirname, "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${network.name}.json`),
    JSON.stringify(
      {
        network: network.name,
        address: endereco,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        txHash: cert.deploymentTransaction()?.hash,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Deployment registrado em deployments/${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
