import { NomadDomain } from "../src/domain";
import { expect, assert, use as chaiUse } from "chai";
import Docker from "dockerode";
import { LocalAgent, AgentType, Agents } from "../src/agent";
import chaiAsPromised from "chai-as-promised";

chaiUse(chaiAsPromised);

const dockerode = new Docker();

let local;
let domain;

beforeEach(() => {
    jest.clearAllMocks();
    local = NomadDomain.newHardhatNetwork('local', 1337);
    domain = new NomadDomain(local.network);
  });

describe("Agent test", () => {
    //TODO: We should implement any-network connection logic and test accordingly.
    it('can create an LocalAgent with basic fields', async () => {

        // updater
        const updater = new LocalAgent(AgentType.Updater, domain, 1337, dockerode);
        expect(updater.containerName()).to.equal(`updater_local_agent`);

        expect(updater.getAdditionalEnvs()).to.deep.equal([
            `DEFAULT_TXSIGNER_KEY=0x${domain.keys.updater.toString()}`,
            `ATTESTATION_SIGNER_KEY=0x${domain.keys.signer.toString()}`,
        ]);

        expect(await updater.isRunning()).to.be.equal(false);


        // relayer
        const relayer = new LocalAgent(AgentType.Relayer, domain, 1337, dockerode);
        expect(relayer.containerName()).to.equal(`relayer_local_agent`);

        expect(relayer.getAdditionalEnvs()).to.deep.equal([
            `DEFAULT_TXSIGNER_KEY=0x${domain.keys.relayer.toString()}`,
        ]);

        expect(await relayer.isRunning()).to.be.equal(false);


        // processor
        const processor = new LocalAgent(AgentType.Processor, domain, 1337, dockerode);
        expect(processor.containerName()).to.equal(`processor_local_agent`);

        expect(processor.getAdditionalEnvs()).to.deep.equal([
            `DEFAULT_TXSIGNER_KEY=0x${domain.keys.processor.toString()}`,
        ]);

        expect(await processor.isRunning()).to.be.equal(false);


        // watcher
        const watcher = new LocalAgent(AgentType.Watcher, domain, 1337, dockerode);
        expect(watcher.containerName()).to.equal(`watcher_local_agent`);

        expect(watcher.getAdditionalEnvs()).to.deep.equal([
            `DEFAULT_TXSIGNER_KEY=0x${domain.keys.watchers[0].toString()}`,
            `ATTESTATION_SIGNER_KEY=0x${domain.keys.signer.toString()}`,
        ]);

        expect(await watcher.isRunning()).to.be.equal(false);


        // kathy
        const kathy = new LocalAgent(AgentType.Kathy, domain, 1337, dockerode);
        expect(kathy.containerName()).to.equal(`kathy_local_agent`);

        expect(kathy.getAdditionalEnvs()).to.deep.equal([
            `DEFAULT_TXSIGNER_KEY=0x${domain.keys.kathy.toString()}`,
        ]);

        expect(await kathy.isRunning()).to.be.equal(false);

    });

    it('can up and down an agent', async () => {
        const docker = new Docker();
        const kathy = new LocalAgent(AgentType.Kathy, domain, 1337, docker);

        await kathy.up();
        expect(await kathy.status()).to.be.equal(true);
        expect(await kathy.isConnected()).to.be.equal(true);
        assert.isTrue((await docker.getContainer(kathy.containerName()).inspect()).State.Running);

        await kathy.down();
        expect(await kathy.status()).to.be.equal(false);
        expect(await kathy.isConnected()).to.be.equal(false);
        await assert.isRejected(docker.getContainer(kathy.containerName()).inspect(), "no such container");
    });
});

describe("Agents test", () => {
    it('can create Agents, up and down them', async () => {
        const dockerode = new Docker();
        const agents = new Agents(domain, 1337, dockerode);

        expect(agents.updater).to.exist;
        expect(agents.relayer).to.exist;
        expect(agents.processor).to.exist;
        expect(agents.watchers[0]).to.exist;

        await agents.upAll();

        expect(await agents.updater.status()).to.be.equal(true);
        assert.isTrue((await dockerode.getContainer((agents.updater as LocalAgent).containerName()).inspect()).State.Running);

        expect(await agents.relayer.status()).to.be.equal(true);
        assert.isTrue((await dockerode.getContainer((agents.relayer as LocalAgent).containerName()).inspect()).State.Running);

        expect(await agents.processor.status()).to.be.equal(true);
        assert.isTrue((await dockerode.getContainer((agents.processor as LocalAgent).containerName()).inspect()).State.Running);

        expect(await agents.watchers[0].status()).to.be.equal(true);
        assert.isTrue((await dockerode.getContainer((agents.watchers[0] as LocalAgent).containerName()).inspect()).State.Running);

        await agents.downAll();

        expect(await agents.updater.status()).to.be.equal(false);
        await assert.isRejected(dockerode.getContainer((agents.updater as LocalAgent).containerName()).inspect(), "no such container");

        expect(await agents.relayer.status()).to.be.equal(false);
        await assert.isRejected(dockerode.getContainer((agents.relayer as LocalAgent).containerName()).inspect(), "no such container");

        expect(await agents.processor.status()).to.be.equal(false);
        await assert.isRejected(dockerode.getContainer((agents.processor as LocalAgent).containerName()).inspect(), "no such container");

        expect(await agents.watchers[0].status()).to.be.equal(false);
        await assert.isRejected(dockerode.getContainer((agents.watchers[0] as LocalAgent).containerName()).inspect(), "no such container");
    });
});

