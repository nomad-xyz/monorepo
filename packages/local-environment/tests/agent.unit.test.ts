import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { assert, use as chaiUse } from "chai";
import { LocalAgent, AgentType, Agents } from "../src/agent";
import chaiAsPromised from "chai-as-promised";

chaiUse(chaiAsPromised);

jest.mock("../src/agent");
jest.mock("../src/domain");
jest.mock("../src/network");

const network = new HardhatNetwork('local', 1337);

const domain = new NomadDomain(network);

test("successfully calls LocalAgent functions", () => {
    const testAgents = new Agents(domain, 1337);
    const testLocalAgent = new LocalAgent(AgentType.Kathy, domain, 1337);

    jest.spyOn(testAgents, "upAll");
    testAgents.upAll();
    expect(testAgents.upAll).toHaveBeenCalled();

    testAgents.downAll();
    expect(testAgents.upAll).toHaveBeenCalled();

    testAgents.isAllUp();
    expect(testAgents.upAll).toHaveBeenCalled();

    testLocalAgent.containerName();
    expect(testLocalAgent.containerName).toHaveBeenCalled();

    testLocalAgent.getAdditionalEnvs();
    expect(testLocalAgent.getAdditionalEnvs).toHaveBeenCalled();

    testLocalAgent.createContainer();
    expect(testLocalAgent.createContainer).toHaveBeenCalled();

    testLocalAgent.status();
    expect(testLocalAgent.status).toHaveBeenCalled();

});