import { NomadDomain } from "../src/domain";
import { expect, assert } from "chai";
import { NomadEnv } from "../src/nomadenv";

describe("NomadDomain test", () => {
    //TODO: We should implement any-network connection logic and test accordingly.
    it('can create and operate domain from any hardhat network', async () => {
        const tDomain = new NomadDomain('tom', 1);
        const jDomain = new NomadDomain('jerry', 2);
        tDomain.networkUp();
        jDomain.networkUp();
        expect(tDomain).to.exist;
        expect(tDomain).to.exist;
        expect(tDomain.networkJsonRpcProvider).to.exist;
        expect(jDomain.networkJsonRpcProvider).to.exist;
        // Name
        expect(tDomain.network.name).to.equal("tom");
        expect(jDomain.network.name).to.equal("jerry");
        // DomainNumber
        expect(tDomain.domain.domain).to.equal(1);
        expect(jDomain.domain.domain).to.equal(2);
        // Connections
        tDomain.connectNetwork(jDomain);
        jDomain.connectNetwork(tDomain);
        assert.isTrue(tDomain.connectedNetworks.includes(jDomain));
        assert.isTrue(jDomain.connectedNetworks.includes(tDomain));

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
        const le = new NomadEnv({domain: tDomain.domain.domain, id: '0x'+'20'.repeat(20)});
        tDomain.addNomadEnv(le);
        expect(tDomain.nomadEnv).to.equal(le);

        // Down / cleanup
        expect(await tDomain.downNetwork());
        expect(await jDomain.downNetwork());
    });

});