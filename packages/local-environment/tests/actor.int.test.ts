import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { expect, assert, use as chaiUse } from "chai";
import { LocalAgent, AgentType, Agents } from "../src/agent";
import chaiAsPromised from "chai-as-promised";

chaiUse(chaiAsPromised);

const network = new HardhatNetwork('local', 1337);

const domain = new NomadDomain(network);

describe("Actor test", () => {

    it('can attach and detach logger', async () => {
        const kathy = new LocalAgent(AgentType.Kathy, domain, 1337);

        expect(kathy.isLogMatcherAttached()).to.equal(false);

        await assert.isRejected(kathy.subscribeToContainerEvents(), "Container is not connected");
        await kathy.up();
        const events = await kathy.getEvents();
        expect(events).to.exist;

        await kathy.down();
    })
})