import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { expect, assert, use as chaiUse } from "chai";
import { LocalAgent, AgentType, Agents } from "../src/agent";
import chaiAsPromised from "chai-as-promised";
import { DockerizedActor } from "../src/actor";
import Dockerode from 'dockerode';

chaiUse(chaiAsPromised);

const dockerode = new Dockerode();

const domain = new NomadDomain("tom", 1);

describe("Actor test", () => {

    it('can attach and detach logger', async () => {
        const kathy = new LocalAgent(AgentType.Kathy, domain, 1337, dockerode);

        expect(kathy.isLogMatcherAttached()).to.equal(false);

        await assert.isRejected(kathy.subscribeToContainerEvents(), "Container is not connected");
        await kathy.up();
        const events = await kathy.getEvents();
        expect(events).to.exist;

        await kathy.down();
    });
});