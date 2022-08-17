import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { expect, assert } from "chai";
import { NomadEnv } from "../src/nomadenv";

describe("NomadDomain test", () => {
    //TODO: We should implement any-network connection logic and test accordingly.
    it('can create a valid NomadEnvironment', async () => {
        // Creation
        const t = new HardhatNetwork('tom', 1);
        const j = new HardhatNetwork('jerry', 2);
        const tDomain = new NomadDomain(t);
        const jDomain = new NomadDomain(j);
        const le = new NomadEnv({
            domain: tDomain.network.domainNumber,
            id: "0x" + "20".repeat(20),
        });
        expect(le).to.exist;
        expect(le.govNetwork).to.equal(tDomain);
        // SDK
        expect(le.bridgeSDK).to.exist;
        expect(le.coreSDK).to.exist;

        // Can add domains
        le.addDomain(tDomain);
        le.addDomain(jDomain);
        assert.isTrue(le.domains.includes(tDomain));
        assert.isTrue(le.domains.includes(jDomain));

        // Can up agents
        le.upAgents();
        assert.isTrue(tDomain.isAgentUp);
        assert.isTrue(jDomain.isAgentUp);
        le.downAgents();
        assert.isFalse(tDomain.isAgentUp);
        assert.isFalse(jDomain.isAgentUp); 
        
        // Can up networks
        le.upNetworks();
        assert.isTrue(t.isConnected());
        assert.isTrue(j.isConnected());
    })

})