import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Rede: ${network.name} (chainId via provider)`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Saldo: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const Selo = await ethers.getContractFactory("SeloDigitalAssociado");
  const selo = await Selo.deploy(deployer.address);
  await selo.waitForDeployment();

  const endereco = await selo.getAddress();
  console.log(`SeloDigitalAssociado deployado em: ${endereco}`);

  const out = {
    network: network.name,
    address: endereco,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash: selo.deploymentTransaction()?.hash,
  };

  const dir = join(__dirname, "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${network.name}.json`),
    JSON.stringify(out, null, 2) + "\n"
  );

  console.log(`Deployment registrado em deployments/${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
