import { NomadDomain } from "../src/domain";
import { expect, assert, use as chaiUse } from "chai";
import { LocalAgent, AgentType } from "../src/agent";
import chaiAsPromised from "chai-as-promised";
import Dockerode from 'dockerode';

chaiUse(chaiAsPromised);

let dockerode;
let tom;
let domain;

beforeEach(() => {
    jest.clearAllMocks();
    dockerode = new Dockerode();
    tom = NomadDomain.newHardhatNetwork("tom", 1);
    domain = new NomadDomain(tom.network);
  });

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