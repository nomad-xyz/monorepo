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

test("successfully calls Actor functions", () => {
    // Use a local agent (docker user) to test docker actor functionality
    // All of the following functions are mocked by default via. jest automock.
    const testLocalAgent = new LocalAgent(AgentType.Kathy, domain, 1337);

    testLocalAgent.containerName();
    expect(testLocalAgent.containerName).toHaveBeenCalled();

    testLocalAgent.getAdditionalEnvs();
    expect(testLocalAgent.getAdditionalEnvs).toHaveBeenCalled();

    testLocalAgent.createContainer();
    expect(testLocalAgent.createContainer).toHaveBeenCalled();

    testLocalAgent.status();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.up();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.down();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.connect();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.disconnect();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.isRunning();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.isConnected();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.getEvents();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.start();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.stop();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.createContainer();
    expect(testLocalAgent.createContainer).toHaveBeenCalled();

    testLocalAgent.removeContainer();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.isLogMatcherAttached();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.attachLogMatcher();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.registerAllLogEvents();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.detachLogMatcher();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.subscribeToContainerEvents();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.unsubscribeFromContainerEvents();
    expect(testLocalAgent.status).toHaveBeenCalled();

    testLocalAgent.getEvents();
    expect(testLocalAgent.status).toHaveBeenCalled();
});