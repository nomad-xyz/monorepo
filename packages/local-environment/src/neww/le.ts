import { NomadLocator, NomadConfig } from "@nomad-xyz/configuration";
import { DeployContext } from "../../../deploy/src/DeployContext";
import { HardhatNetwork, Network } from "./network";
import ethers from 'ethers';
import { NonceManager } from "@ethersproject/experimental";


class Env {
    networks: Network[];
    governor: NomadLocator;

    constructor(governor: NomadLocator) {
        this.networks = [];
        this.governor = governor;
    }

    addNetwork(n: Network) {
        if (!this.networks.includes(n)) this.networks.push(n);
    }
    

    get govNetwork(): Network {
        const n = this.networks.find(n => n.domainNumber === this.governor.domain);
        if (!n) throw new Error(`Governing network is not present. GovDomain ${this.governor.domain}, present network domains: ${this.networks.map(n => n.domainNumber).join(', ')}`);
        return n;
    }

    async deployFresh(): Promise<void> {

    }

    async deploy(): Promise<void> {
        // if (this.deployedOnce()) {
        //     this.deployIncrementally()
        // } else {
        //     this.deployFresh()
        // }

        console.log(`Deploying!`, JSON.stringify(this.nomadConfig(), null, 4));

        const governanceBatch = await this.deployContext.deployAndRelinquish();
        console.log(`Deployed! gov batch:`, governanceBatch);
    }

    // deployedOnce(): boolean {
    //     return false;
    // }

    get deployerKey(): string {
        return '1000000000000000000000000000000000000000000000000000000000000001';
    }

    get deployContext(): DeployContext {
        const deployContext = new DeployContext(this.nomadConfig());
        // add deploy signer and overrides for each network
        for (const network of this.networks) {
            const name = network.name;
            const provider = deployContext.mustGetProvider(name);
            const wallet = new ethers.Wallet(this.deployerKey, provider);
            const signer = new NonceManager(wallet);
            deployContext.registerSigner(name, signer);
            deployContext.overrides.set(name, network.deployOverrides);
        }
        return deployContext;
    }
    

    nomadConfig(): NomadConfig {
        return {
            version: 0,
            environment: 'local',
            networks: this.networks.map(n => n.name),
            rpcs: Object.fromEntries(this.networks.map(n => [n.name, n.rpcs])),
            protocol: {governor: this.governor, networks: Object.fromEntries(this.networks.map(n => [n.name, n.domain]))},
            core: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.coreContracts!])),
            bridge: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.bridgeContracts!])),
            agent: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.agentConfig!])),
            bridgeGui: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.bridgeGui!])),
            gas: Object.fromEntries(this.networks.map(n => [n.name, n.gasConfig!])),
        }
    }
}

(async () => {
    const t = new HardhatNetwork('tom', 1);

    const j = new HardhatNetwork('jerry', 2);
    await Promise.all([
        t.up(),
        j.up(),
    ])
    console.log(`Upped tom and jerry`);



    const le = new Env({domain: t.domainNumber, id: '0x'+'00'.repeat(20)});
    le.addNetwork(t);
    le.addNetwork(j);

    await le.deploy();

    // let myContracts = le.deploymyproject();


    
})()



