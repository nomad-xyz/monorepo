import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { expect, assert } from "chai";
import { NomadEnv } from "../src/nomadenv";

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
        expect(tDomain.networkRpcs).to.equal("https://localhost:8080");
        expect(tDomain.networkRpcs).to.equal("https://localhost:9080");
        // Name
        expect(tDomain.domain.name).to.equal(t.name).to.equal(tDomain.name);
        expect(jDomain.domain.name).to.equal(j.name).to.equal(jDomain.name);
        // DomainNumber
        expect(tDomain.domain.domain).to.equal(t.domainNumber);
        expect(jDomain.domain.domain).to.equal(j.domainNumber);
        // Connections
        tDomain.connectNetwork(jDomain);
        jDomain.connectNetwork(tDomain);
        expect(tDomain.connections).to.equal([j.name]);
        expect(tDomain.connections).to.equal([t.name]);
        // Specs
        expect(tDomain.specs).to.equal(t.specs);
        expect(jDomain.specs).to.equal(j.specs);

        // Addresses set
        expect(t.updater).to.equal(tDomain.keys.getAgentKey("signer"));
        expect(t.watcher).to.equal(tDomain.keys.getAgentKey("signer"));
        expect(t.recoveryManager).to.equal(tDomain.keys.getAgentKey("signer"));
        expect(j.updater).to.equal(jDomain.keys.getAgentKey("signer"));
        expect(j.watcher).to.equal(jDomain.keys.getAgentKey("signer"));
        expect(j.recoveryManager).to.equal(jDomain.keys.getAgentKey("signer"));

        // Domain agents
        assert.isFalse(tDomain.isAgentsUp);
        assert.isFalse(jDomain.isAgentsUp);

        tDomain.agentsUp(9000);
        jDomain.agentsUp(9010);
        assert.isTrue(tDomain.isAgentsUp);
        assert.isTrue(jDomain.isAgentsUp);
        assert.isArray(tDomain.watcherKeys());
        assert.isArray(tDomain.watcherKeys());

        tDomain.downAgents();
        jDomain.downAgents();
        assert.isFalse(tDomain.isAgentsUp);
        assert.isFalse(jDomain.isAgentsUp);

        // Add domains
        const le = new NomadEnv({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});
        tDomain.addNomadEnv(le);
        expect(tDomain.nomadEnv).to.equal(le);

        // Down / cleanup
        expect(tDomain.downNetwork());
        expect(jDomain.downNetwork());
    })

})