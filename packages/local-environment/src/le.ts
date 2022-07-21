import { NomadLocator, NomadConfig } from "@nomad-xyz/configuration";
import * as dotenv from 'dotenv';
import { DeployContext } from "../../deploy/src/DeployContext";
import { HardhatNetwork, Network } from "./network";
import * as ethers from 'ethers';
import { NonceManager } from "@ethersproject/experimental";
import fs from 'fs';
import bunyan from 'bunyan';

dotenv.config();

export class Env {
    networks: Network[];
    governor: NomadLocator;
    log = bunyan.createLogger({name: 'localenv'});

    constructor(governor: NomadLocator) {
        this.networks = [];
        this.governor = governor;
    }

    // Adds a network to the array of networks if it's not already there.
    addNetwork(n: Network) {
        if (!this.networks.includes(n)) this.networks.push(n);
    }
    
    // Gets governing network
    get govNetwork(): Network {
        const n = this.networks.find(n => n.domainNumber === this.governor.domain);
        if (!n) throw new Error(`Governing network is not present. GovDomain ${this.governor.domain}, present network domains: ${this.networks.map(n => n.domainNumber).join(', ')}`);
        return n;
    }

    async deployFresh(): Promise<void> {
        console.log(`Deploying!`, JSON.stringify(this.nomadConfig(), null, 4));

        const outputDir = './output';
        const governanceBatch = await this.deployContext.deployAndRelinquish();
        console.log(`Deployed! gov batch:`, governanceBatch);
        
        fs.mkdirSync(outputDir, {recursive: true});
        fs.writeFileSync(
            `${outputDir}/test_config.json`,
            JSON.stringify(this.deployContext.data, null, 2),
        );
        // if new contracts were deployed,
        const verification = Object.fromEntries(this.deployContext.verification);
        if (Object.keys(verification).length > 0) {
          // output the verification inputs
          fs.writeFileSync(
              `${outputDir}/verification-${Date.now()}.json`,
              JSON.stringify(verification, null, 2),
          );
        }
    }

    async deploy(): Promise<void> {
        if (this.deployedOnce()) {

        console.log(`Deploying!`, JSON.stringify(this.nomadConfig(), null, 4));

        const deployContext = this.setDeployContext();

        const outputDir = './output';
        const governanceBatch = await deployContext.deployAndRelinquish();
        console.log(`Deployed! gov batch:`, governanceBatch);
        await this.outputConfigAndVerification(outputDir, deployContext);
        await this.outputCallBatch(outputDir, deployContext);
        } else {
                this.deployFresh()
                return
        }
    }

    outputConfigAndVerification(outputDir: string, deployContext: DeployContext) {
        // output the config
        fs.mkdirSync(outputDir, {recursive: true});
        fs.writeFileSync(
            `${outputDir}/test_config.json`,
            JSON.stringify(deployContext.data, null, 2),
        );
        // if new contracts were deployed,
        const verification = Object.fromEntries(deployContext.verification);
        if (Object.keys(verification).length > 0) {
          // output the verification inputs
          fs.writeFileSync(
              `${outputDir}/verification-${Date.now()}.json`,
              JSON.stringify(verification, null, 2),
          );
        }
    }

    async outputCallBatch(outputDir: string, deployContext: DeployContext) {
        const governanceBatch = deployContext.callBatch;
        if (!governanceBatch.isEmpty()) {
          // build & write governance batch
          await governanceBatch.build();
          fs.writeFileSync(
              `${outputDir}/governanceTransactions.json`,
              JSON.stringify(governanceBatch, null, 2),
          );
        }
      }

    async check(): Promise<void> {
        await this.deployContext.checkDeployment();
        console.log(`CHECKS PASS!`);
    }

    //@TODO Feature: switches after contracts exist
    deployedOnce(): boolean {
        return true;
    }

    get deployerKey1(): string {
        const DEPLOYERKEY1 = ``+ process.env.DEPLOYER_PRIVATE_KEY_1 + ``;
        if (!DEPLOYERKEY1) {
            throw new Error('Add DEPLOYER_PRIVATE_KEY to .env');
        }
        return DEPLOYERKEY1;
    }

    getNetworks(): Network[] {
        return Array.from(this.networks.values());
   }

    setDeployContext(): DeployContext {
        //@TODO remove re-initialization.
        const deployContext = new DeployContext(this.nomadConfig());
        // add deploy signer and overrides for each network
        for (const network of this.networks) {
            const name = network.name;
            const provider = deployContext.mustGetProvider(name);
            const wallet = new ethers.Wallet(this.deployerKey1, provider);
            const signer = new NonceManager(wallet);
            deployContext.registerSigner(name, signer);
            deployContext.overrides.set(name, network.deployOverrides);
        }
        return deployContext;
    }

    get deployContext(): DeployContext{
        return this.deployContext;
    }

    nomadConfig(): NomadConfig {
        return {
            version: 0,
            environment: 'local',
            networks: this.networks.map(n => n.name),
            rpcs: Object.fromEntries(this.networks.map(n => [n.name, n.rpcs])),
            agent: Object.fromEntries(this.networks.map(n => [n.name, n.agentConfig])),
            protocol: {governor: this.governor, networks: Object.fromEntries(this.networks.map(n => [n.name, n.domain]))},
            core: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.coreContracts!])),
            bridge: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.bridgeContracts!])),
            bridgeGui: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.bridgeGui!])),
            gas: Object.fromEntries(this.networks.map(n => [n.name, n.gasConfig!])),
        }
    }
}

(async () => {

    // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
    const log = bunyan.createLogger({name: 'localenv'});

    const t = new HardhatNetwork('tom', 1, []);

    const j = new HardhatNetwork('jerry', 2, []);

    await Promise.all([
        t.up(),
        j.up(),
    ])

    /* TODO Input keysetting logic here

    */

    log.info(`Upped Tom and Jerry`);

    const le = new Env({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});

    le.addNetwork(t);
    le.addNetwork(j);
    log.info(`Added Tom and Jerry`);

    t.connectNetwork(j);
    j.connectNetwork(t);
    log.info(`Connected Tom and Jerry`);

    // Notes, check governance router deployment on Jerry and see if that's actually even passing
    // ETHHelper deployment may be failing because of lack of governance router, either that or lack of wETH address.

    log.info(await Promise.all([
        t.deployWETHTom(),
        j.deployWETHJerry()
    ]))

    log.info(await le.deploy());

    // let myContracts = le.deploymyproject();

    await t.upAgents(t, le, 9080);
    await j.upAgents(j, le, 9090);
    log.info(`Agents up`);

})()