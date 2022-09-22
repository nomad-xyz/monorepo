import { NomadLocator, NomadConfig } from "@nomad-xyz/configuration";
import * as dotenv from "dotenv";
import { DeployContext } from "@nomad-xyz/deploy/src/DeployContext";
import * as ethers from "ethers";
import { NonceManager } from "@ethersproject/experimental";
import fs from "fs";
import bunyan from "bunyan";
import { NomadDomain } from "./domain";
import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import { NomadContext } from "@nomad-xyz/sdk";

if (!fs.existsSync("../../.env"))
  dotenv.config({ path: __dirname + "/../.env.example" });
else dotenv.config();

export class NomadEnv {
  domains: NomadDomain[];
  governor: NomadLocator;
  bridgeSDK: BridgeContext;
  coreSDK: NomadContext;

  log = bunyan.createLogger({ name: "localenv" });

  constructor(governor: NomadLocator) {
    this.domains = [];
    this.governor = governor;
    this.bridgeSDK = new BridgeContext(this.nomadConfig());
    this.coreSDK = new NomadContext(this.nomadConfig());
  }

  refreshSDK(config: NomadConfig): void {
    this.bridgeSDK = new BridgeContext(config);
  }

  // Adds a network to the array of networks if it's not already there.
  addDomain(d: NomadDomain): void {
    if (!this.domains.includes(d)) this.domains.push(d);
    d.addNomadEnv(this);
  }

  // Gets governing network
  get govNetwork(): NomadDomain {
    const d = this.domains.find(
      (d) => d.network.domainNumber === this.governor.domain
    );
    if (!d)
      throw new Error(
        `Governing network is not present. GovDomain ${
          this.governor.domain
        }, present network domains: ${this.domains
          .map((d) => d.network.domainNumber)
          .join(", ")}`
      );
    return d;
  }

  getCoreSDK(): NomadContext {
    if (!this.coreSDK) throw new Error(`No core SDK`);
    return this.coreSDK;
  }

  getBridgeSDK(): BridgeContext {
    if (!this.bridgeSDK) throw new Error(`No bridge SDK`);
    return this.bridgeSDK;
  }

  async deployFresh(): Promise<DeployContext> {
    this.log.info(`Deploying!`);

    const deployContext = this.setDeployContext();

    const outputDir = "./output";
    const governanceBatch = await deployContext.deployAndRelinquish();
    this.log.info(`Deployed! gov batch:`, governanceBatch);

    await deployContext.checkDeployment();
    this.log.info(`Checked deployment`);

    this.outputConfigAndVerification(outputDir, deployContext);
    await this.outputCallBatch(outputDir, deployContext);

    return deployContext;
  }

  async deploy(): Promise<DeployContext> {
    let context;
    if (this.deployedOnce()) {
      //TODO: INPUT RESUME DEPLOYMENT LOGIC HERE
      throw new Error(`LOOK AT ME!`);
    } else {
      context = await this.deployFresh();
    }
    this.refreshSDK(context.data);

    // fs.writeFileSync('./conf.json', JSON.stringify(context.data));

   

    // console.log(`=== DEPLOYED!`)

    // this.bridgeSDK.mustGetCore('d').

    return context;
  }

  outputConfigAndVerification(outputDir: string, deployContext: DeployContext): void {
    // output the config
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      `${outputDir}/test_config.json`,
      JSON.stringify(deployContext.data, null, 2)
    );
    // if new contracts were deployed,
    const verification = Object.fromEntries(deployContext.verification);
    if (Object.keys(verification).length > 0) {
      // output the verification inputs
      fs.writeFileSync(
        `${outputDir}/verification-${Date.now()}.json`,
        JSON.stringify(verification, null, 2)
      );
    }
  }

  async outputCallBatch(outputDir: string, deployContext: DeployContext): Promise<void> {
    const governanceBatch = deployContext.callBatch;
    if (!governanceBatch.isEmpty()) {
      // build & write governance batch
      await governanceBatch.build();
      fs.writeFileSync(
        `${outputDir}/governanceTransactions.json`,
        JSON.stringify(governanceBatch, null, 2)
      );
    }
  }

  async check(): Promise<void> {
    await this.deployContext.checkDeployment();
  }

  //@TODO Feature: switches after contracts exist
  deployedOnce(): boolean {
    return false;
  }

  get deployerKey(): string {
    const DEPLOYERKEY = `` + process.env.PRIVATE_KEY + ``;
    if (!DEPLOYERKEY) {
      throw new Error("Add DEPLOYER_PRIVATE_KEY to .env");
    }
    return DEPLOYERKEY;
  }

  getDomains(): NomadDomain[] {
    return Array.from(this.domains.values());
  }

  setDeployContext(): DeployContext {
    //@TODO remove re-initialization.
    const deployContext = new DeployContext(this.nomadConfig());
    // add deploy signer and overrides for each network
    for (const domain of this.domains) {
      const name = domain.network.name;
      const provider = deployContext.mustGetProvider(name);
      const wallet = new ethers.Wallet(this.deployerKey, provider);
      const signer = new NonceManager(wallet);
      deployContext.registerSigner(name, signer);
      deployContext.overrides.set(name, domain.network.deployOverrides);
    }
    return deployContext;
  }

  get deployContext(): DeployContext {
    return this.deployContext;
  }

  nomadConfig(): NomadConfig {
    return {
      version: 0,
      environment: "local",
      networks: this.domains.map((d) => d.network.name),
      rpcs: Object.fromEntries(
        this.domains.map((d) => [d.network.name, d.rpcs])
      ),
      agent: Object.fromEntries(
        this.domains.map((d) => [d.network.name, d.agentConfig])
      ),
      protocol: {
        governor: this.governor,
        networks: Object.fromEntries(
          this.domains.map((d) => [d.network.name, d.domain])
        ),
      },
      core: Object.fromEntries(
        this.domains
          .filter((d) => d.network.isDeployed)
          .map((d) => [d.network.name, d.network.coreContracts!])
      ),
      bridge: Object.fromEntries(
        this.domains
          .filter((d) => d.network.isDeployed)
          .map((d) => [d.network.name, d.network.bridgeContracts!])
      ),
      bridgeGui: Object.fromEntries(
        this.domains
          .filter((d) => d.network.isDeployed)
          .map((d) => [d.network.name, d.network.bridgeGui!])
      ),
      gas: Object.fromEntries(
        this.domains.map((d) => [d.network.name, d.gasConfig!])
      ),
    };
  }

  

  //Input arguments to d.up to disable a specific agent.
  async up(): Promise<void> {
    const metrics = 9000;
    await Promise.all(this.domains.map((d, i) => d.up(metrics + i * 10)));
  }

  async down(): Promise<void> {
    await Promise.all(this.domains.map((d) => d.down()));
  }

  //Input arguments to d.up to disable a specific agent.
  async upAgents(): Promise<void> {
    const metrics = 9000;
    await Promise.all(this.domains.map((d, i) => d.upAgents(metrics + i * 10)));
  }

  async downAgents(): Promise<void> {
    await Promise.all(this.domains.map((d) => d.down()));
  }

  async upNetworks(): Promise<void> {
    // Await domains to up networks.
    await Promise.all(this.domains.map((d) => d.networkUp()));
  }
}

export async function defaultStart(): Promise<void> {
  // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
  const log = bunyan.createLogger({ name: "localenv" });

  // Instantiate Nomad domains
  const tDomain = new NomadDomain("tom", 1);
  const jDomain = new NomadDomain("jerry", 2);

  // Await domains to up networks.
  await Promise.all([tDomain.network.up(), jDomain.network.up()]);

  log.info(`Upped Tom and Jerry`);

  const le = new NomadEnv({
    domain: tDomain.network.domainNumber,
    id: "0x" + "20".repeat(20),
  });

  le.addDomain(tDomain);
  le.addDomain(jDomain);
  log.info(`Going to init NomadEnv with domains`, le.domains);

  tDomain.connectNetwork(jDomain);
  jDomain.connectNetwork(tDomain);
  log.info(`Connected Tom and Jerry`);

  // Notes, check governance router deployment on Jerry and see if that's actually even passing
  // ETHHelper deployment may be failing because of lack of governance router, either that or lack of wETH address.

  await Promise.all([tDomain.network.setWETH(tDomain.network.deployWETH()), jDomain.network.setWETH(jDomain.network.deployWETH())]);

  log.info(await le.deploy());

  // let myContracts = le.deploymyproject();

  await le.upAgents();

  log.info(`Agents up`);
}
