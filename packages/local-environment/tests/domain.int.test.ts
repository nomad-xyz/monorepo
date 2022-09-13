import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { expect, assert } from "chai";
import { NomadEnv } from "../src/nomadenv";
import { Agents } from "../src/agent";

describe("NomadDomain test", () => {
    //TODO: We should implement any-network connection logic and test accordingly.
    it('can create and operate domain from any hardhat network', async () => {
        const t = new HardhatNetwork('tom', 1);
        const j = new HardhatNetwork('jerry', 2);
        const tDomain = new NomadDomain(t);
        const jDomain = new NomadDomain(j);
        tDomain.networkUp();
        jDomain.networkUp();
        expect(t).to.exist;
        expect(j).to.exist;
        expect(tDomain).to.exist;
        expect(jDomain).to.exist;
        expect(tDomain.networkJsonRpcProvider).to.exist;
        expect(jDomain.networkJsonRpcProvider).to.exist;
        // Name
        expect(tDomain.domain.name).to.equal(t.name).to.equal(tDomain.name);
        expect(jDomain.domain.name).to.equal(j.name).to.equal(jDomain.name);
        // DomainNumber
        expect(tDomain.domain.domain).to.equal(t.domainNumber);
        expect(jDomain.domain.domain).to.equal(j.domainNumber);
        // Connections
        tDomain.connectNetwork(jDomain);
        jDomain.connectNetwork(tDomain);
        assert.isTrue(tDomain.connectedNetworks.includes(jDomain));
        assert.isTrue(jDomain.connectedNetworks.includes(tDomain));

        // Addresses set
        expect(t.updater).to.equal(tDomain.keys.getAgentAddress("signer"));
        expect(t.watcher).to.equal(tDomain.keys.getAgentAddress("signer"));
        expect(t.recoveryManager).to.equal(tDomain.keys.getAgentAddress("signer"));
        expect(j.updater).to.equal(jDomain.keys.getAgentAddress("signer"));
        expect(j.watcher).to.equal(jDomain.keys.getAgentAddress("signer"));
        expect(j.recoveryManager).to.equal(jDomain.keys.getAgentAddress("signer"));

        // Domain agents
        await tDomain.upAgents(9000);
        await jDomain.upAgents(9010);
        expect(tDomain.agents).to.exist;
        expect(jDomain.agents).to.exist;

        assert.isTrue(await tDomain.isAgentsUp());
        assert.isTrue(await tDomain.agents!.updater.status());
        assert.isTrue(await tDomain.agents!.relayer.status());
        assert.isTrue(await tDomain.agents!.processor.status());
        assert.isTrue(await jDomain.isAgentsUp());
        assert.isTrue(await jDomain.agents!.updater.status());
        assert.isTrue(await jDomain.agents!.relayer.status());
        assert.isTrue(await jDomain.agents!.processor.status());

        await tDomain.downAgents();
        await jDomain.downAgents();

        assert.isFalse(await tDomain.isAgentsUp());
        assert.isFalse(await jDomain.isAgentsUp());

        // Add domains
        const le = new NomadEnv({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});
        tDomain.addNomadEnv(le);
        expect(tDomain.nomadEnv).to.equal(le);

        // Down / cleanup
        expect(await tDomain.downNetwork());
        expect(await jDomain.downNetwork());
    })

})