import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { assert, use as chaiUse } from "chai";
import chaiAsPromised from "chai-as-promised";
import { NomadEnv } from "../src/nomadenv";

const t = new HardhatNetwork('tom', 1);
const j = new HardhatNetwork('jerry', 2);

const n = new NomadEnv({domain: 1, id: '0x'+'20'.repeat(20)});

jest.mock("../src/network")
jest.mock("../src/domain")

test("successfully calls Domain functions", () => {
    const tDomain = new NomadDomain(t);
    const jDomain = new NomadDomain(j);

    tDomain.networkUp();
    jDomain.networkUp();

    expect(tDomain.networkUp).toHaveBeenCalled();
    expect(jDomain.networkUp).toHaveBeenCalled();

    tDomain.addNomadEnv(n);
    jDomain.addNomadEnv(n);

    expect(tDomain.addNomadEnv).toHaveBeenCalled();
    expect(jDomain.addNomadEnv).toHaveBeenCalled();
    
    tDomain.ensureAgents();
    jDomain.ensureAgents();

    expect(tDomain.ensureAgents).toHaveBeenCalled();
    expect(jDomain.ensureAgents).toHaveBeenCalled();

    tDomain.connectNetwork(jDomain);
    jDomain.connectNetwork(tDomain);

    expect(tDomain.connectNetwork).toHaveBeenCalled();
    expect(jDomain.connectNetwork).toHaveBeenCalled();

    tDomain.networkJsonRpcProvider();
    jDomain.networkJsonRpcProvider();

    expect(tDomain.networkJsonRpcProvider).toHaveBeenCalled();
    expect(jDomain.networkJsonRpcProvider).toHaveBeenCalled();

    tDomain.networkRpcs();
    jDomain.networkRpcs();

    expect(tDomain.networkRpcs).toHaveBeenCalled();
    expect(jDomain.networkRpcs).toHaveBeenCalled();

    tDomain.watcherKeys();
    jDomain.watcherKeys();

    expect(tDomain.watcherKeys).toHaveBeenCalled();
    expect(jDomain.watcherKeys).toHaveBeenCalled();

    tDomain.getAgentSigner();
    jDomain.getAgentSigner();

    expect(tDomain.getAgentSigner).toHaveBeenCalled();
    expect(jDomain.getAgentSigner).toHaveBeenCalled();

    tDomain.connections();
    jDomain.connections();

    expect(tDomain.connections).toHaveBeenCalled();
    expect(jDomain.connections).toHaveBeenCalled();

    tDomain.localNetEnsureKeys();
    jDomain.localNetEnsureKeys();

    expect(tDomain.localNetEnsureKeys).toHaveBeenCalled();
    expect(jDomain.localNetEnsureKeys).toHaveBeenCalled();

    tDomain.networkUp();
    jDomain.networkUp();

    expect(tDomain.networkUp).toHaveBeenCalled();
    expect(jDomain.networkUp).toHaveBeenCalled();

    tDomain.upAgents();
    jDomain.upAgents();

    expect(tDomain.upAgents).toHaveBeenCalled();
    expect(jDomain.upAgents).toHaveBeenCalled();

    tDomain.up();
    jDomain.up();

    expect(tDomain.up).toHaveBeenCalled();
    expect(jDomain.up).toHaveBeenCalled();

    tDomain.downAgents();
    jDomain.downAgents();

    expect(tDomain.downAgents).toHaveBeenCalled();
    expect(jDomain.downAgents).toHaveBeenCalled();

    tDomain.down();
    jDomain.down();

    expect(tDomain.down).toHaveBeenCalled();
    expect(jDomain.down).toHaveBeenCalled();

    tDomain.downNetwork();
    jDomain.downNetwork();

    expect(tDomain.downNetwork).toHaveBeenCalled();
    expect(jDomain.downNetwork).toHaveBeenCalled();

});