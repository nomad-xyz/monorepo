import { NomadDomain } from "../src/domain";
import { NomadEnv } from "../src/nomadenv";
import { AgentType } from "../src/agent";

jest.mock('dockerode');

beforeEach(() => {
    jest.clearAllMocks();
  });

test("Domains should be initalizable (without nomadEnv)", async () => {

    const local = NomadDomain.newHardhatNetwork('local', 1337);
    const domain = new NomadDomain(local.network);

    expect(domain).toBeTruthy();
    expect(domain.network).toBeDefined();
    expect(domain.network.updater).toBeDefined();
    expect(domain.network.watcher).toBeDefined();
    expect(domain.network.recoveryManager).toBeDefined();
    expect(domain.connections).toBeDefined();
    expect(domain.nomadEnv).toBeUndefined();
    expect(domain.name).toEqual('local');
    expect(domain.networkRpcs).toBeDefined();
    expect(domain.rpcs).toBeDefined();
    expect(domain.watcherKeys).toBeDefined();
    expect(domain.connectedNetworks).toStrictEqual([]);
    
});

test("Domains can add NomadEnv", async () => {

    const local = NomadDomain.newHardhatNetwork('local', 1337);
    const domain = new NomadDomain(local.network);

    const le = new NomadEnv({domain: domain.network.domainNumber, id: '0x'+'20'.repeat(20)});
    expect(le).toBeTruthy();
    domain.addNomadEnv(le);
    expect(domain.nomadEnv).toBeDefined();
    expect(domain.nomadEnv).toEqual(le);
    
});

test("Domains can't connect to domains with identical names", async () => {

    const localfoo = NomadDomain.newHardhatNetwork('local', 1337);
    const domainfoo = new NomadDomain(localfoo.network);
    const localbar = NomadDomain.newHardhatNetwork('local', 1338);
    const domainbar = new NomadDomain(localbar.network);

    expect(domainfoo.connections.length).toBe(0);
    expect(domainbar.connections.length).toBe(0);
    expect(domainfoo.name).toEqual('local');
    expect(domainbar.name).toEqual('local');
    domainfoo.connectDomain(domainbar);
    expect(domainfoo.connections.length).toBe(0);
    
});

test("Domains can connect to general domains", async () => {

    const localfoo = NomadDomain.newHardhatNetwork('localfoo', 1337);
    const domainfoo = new NomadDomain(localfoo.network);
    const localbar = NomadDomain.newHardhatNetwork('localbar', 1338);
    const domainbar = new NomadDomain(localbar.network);

    expect(domainfoo.connections.length).toBe(0);
    expect(domainbar.connections.length).toBe(0);
    expect(domainfoo.name).toEqual('localfoo');
    expect(domainbar.name).toEqual('localbar');
    domainfoo.connectDomain(domainbar);
    expect(domainfoo.connections()).toEqual(['localbar']);
    expect(domainbar.connections()).toEqual(['localfoo']);
});

test("Domains can't connect to already connected domains", async () => {

    const localfoo = NomadDomain.newHardhatNetwork('localfoo', 1337);
    const domainfoo = new NomadDomain(localfoo.network);
    const localbar = NomadDomain.newHardhatNetwork('localbar', 1338);
    const domainbar = new NomadDomain(localbar.network);

    expect(domainfoo.connections.length).toBe(0);
    expect(domainbar.connections.length).toBe(0);
    expect(domainfoo.name).toEqual('localfoo');
    expect(domainbar.name).toEqual('localbar');
    domainfoo.connectDomain(domainbar);
    expect(domainfoo.connections()).toEqual(['localbar']);
    expect(domainbar.connections()).toEqual(['localfoo']);

    // Shouldn't create duplicaates of either networks
    domainbar.connectDomain(domainfoo);
    expect(domainfoo.connections()).toEqual(['localbar']);
    expect(domainbar.connections()).toEqual(['localfoo']);
});

test("Domains can create agents if none present", async () => {

    const local = NomadDomain.newHardhatNetwork('local', 1337);
    const domain = new NomadDomain(local.network);

    expect(domain.agents).toBeUndefined();
    expect(await domain.areAgentsUp()).toBe(undefined);
    domain.ensureAgents();
    expect(domain.agents).toBeDefined();
    expect(await domain.areAgentsUp()).toBe(false);
    expect(await domain.agents?.areAllUp()).toBeFalsy();
    
});

test("Domains can get agent keys and addresses", async () => {

    const local = NomadDomain.newHardhatNetwork('local', 1337);
    const domain = new NomadDomain(local.network);

    expect(domain.agents).toBeUndefined();
    expect(await domain.areAgentsUp()).toBe(undefined);
    domain.ensureAgents();
    expect(domain.agents).toBeDefined();
    expect(await domain.areAgentsUp()).toBe(false);
    expect(await domain.agents?.areAllUp()).toBeFalsy();

    expect(domain.getAgentAddress(AgentType.Updater)).toStrictEqual('0x9C7BC14e8a4B054e98C6DB99B9f1Ea2797BAee7B');
    expect(domain.getAgentSigner(AgentType.Updater).toAddress()).toStrictEqual('0x9C7BC14e8a4B054e98C6DB99B9f1Ea2797BAee7B');
    
});


test("Configs are defined", async () => {

    const local = NomadDomain.newHardhatNetwork('local', 1337);
    const domain = new NomadDomain(local.network);
    const le = new NomadEnv({domain: domain.network.domainNumber, id: '0x'+'20'.repeat(20)});

    domain.addNomadEnv(le);
    expect(domain.nomadEnv).toBeDefined();

    expect(domain.agentConfig).toBeDefined();
    expect(domain.kathyConfig).toBeDefined();
    expect(domain.updaterConfig).toBeDefined();
    expect(domain.watcherConfig).toBeDefined();
    expect(domain.processorConfig).toBeDefined();
    expect(domain.domain).toBeDefined();
    expect(domain.bridgeConfig).toBeDefined();
    expect(domain.gasConfig).toBeDefined();
    expect(domain.specs).toBeDefined();

});