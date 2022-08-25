import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { expect, assert, use as chaiUse } from "chai";
import { NomadEnv } from "../src/nomadenv";
import Docker from "dockerode";
import { LocalAgent } from "../src/agent";
import chaiAsPromised from "chai-as-promised";
 
chaiUse(chaiAsPromised);

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
        

        // Can add domains
        le.addDomain(tDomain);
        le.addDomain(jDomain);
        assert.isTrue(le.domains.includes(tDomain));
        assert.isTrue(le.domains.includes(jDomain));

        expect(le.govNetwork).to.equal(tDomain);
        // SDK
        expect(le.bridgeSDK).to.exist;
        expect(le.coreSDK).to.exist;

        // Can up agents
        await le.upAgents();

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

        const docker = new Docker();

        const tUpdater = (tDomain.agents!.updater as LocalAgent).containerName();
        const tRelayer = (tDomain.agents!.relayer as LocalAgent).containerName();
        const tProcessor = (tDomain.agents!.processor as LocalAgent).containerName();

        const jUpdater = (jDomain.agents!.updater as LocalAgent).containerName();
        const jRelayer = (jDomain.agents!.relayer as LocalAgent).containerName();
        const jProcessor = (jDomain.agents!.processor as LocalAgent).containerName();

        assert.isTrue((await docker.getContainer(tUpdater).inspect()).State.Running)
        assert.isTrue((await docker.getContainer(tRelayer).inspect()).State.Running)
        assert.isTrue((await docker.getContainer(tProcessor).inspect()).State.Running)

        assert.isTrue((await docker.getContainer(jUpdater).inspect()).State.Running)
        assert.isTrue((await docker.getContainer(jRelayer).inspect()).State.Running)
        assert.isTrue((await docker.getContainer(jProcessor).inspect()).State.Running)

        await le.downAgents();
        assert.isFalse(await tDomain.isAgentsUp());
        assert.isFalse(await jDomain.isAgentsUp()); 

        await assert.isRejected(docker.getContainer(tUpdater).inspect(), "no such container");
        await assert.isRejected(docker.getContainer(tRelayer).inspect(), "no such container");
        await assert.isRejected(docker.getContainer(tProcessor).inspect(), "no such container");
        await assert.isRejected(docker.getContainer(jUpdater).inspect(), "no such container");
        await assert.isRejected(docker.getContainer(jRelayer).inspect(), "no such container");
        await assert.isRejected(docker.getContainer(jProcessor).inspect(), "no such container");

        // Can up networks
        await le.upNetworks();

        assert.isTrue(await t.isConnected());
        assert.isTrue(await j.isConnected());

        assert.isTrue(await tDomain.network.isConnected())
        assert.isTrue(await jDomain.network.isConnected())

        await le.down();
        assert.isFalse(await t.isConnected());
        assert.isFalse(await j.isConnected());
    })

})