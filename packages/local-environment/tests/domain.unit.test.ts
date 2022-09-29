import { NomadDomain } from "../src/domain";
import Dockerode from 'dockerode';
import { NomadEnv } from "../src/nomadenv";
import { AgentType } from "../src/agent";

jest.mock('dockerode');

beforeEach(() => {
    jest.clearAllMocks();
  });

test("Domains should be initalizable (without nomadEnv)", async () => {

    const dockerode = new Dockerode();
    const domain = new NomadDomain('local', 1337, undefined, dockerode);

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
    expect(domain.docker).toBeDefined();
    expect(domain.network.docker).toBe(domain.docker);
    expect(domain.connectedNetworks).toStrictEqual([]);
    
});

test("Domains can add NomadEnv", async () => {

    const dockerode = new Dockerode();
    const domain = new NomadDomain('local', 1337, undefined, dockerode);

    const le = new NomadEnv({domain: domain.network.domainNumber, id: '0x'+'20'.repeat(20)});
    expect(le).toBeTruthy();
    domain.addNomadEnv(le);
    expect(domain.nomadEnv).toBeDefined();
    expect(domain.nomadEnv).toEqual(le);
    
});

test("Domains can't connect to domains with identical names", async () => {

    const dockerode = new Dockerode();
    const domainfoo = new NomadDomain('local', 1337, undefined, dockerode);
    const domainbar = new NomadDomain('local', 1338, undefined, dockerode);

    expect(domainfoo.connections.length).toBe(0);
    expect(domainbar.connections.length).toBe(0);
    expect(domainfoo.name).toEqual('local');
    expect(domainbar.name).toEqual('local');
    domainfoo.connectNetwork(domainbar);
    expect(domainfoo.connections.length).toBe(0);
    
});

test("Domains can connect to general domains", async () => {

    const dockerode = new Dockerode();
    const domainfoo = new NomadDomain('localfoo', 1337, undefined, dockerode);
    const domainbar = new NomadDomain('localbar', 1338, undefined, dockerode);

    expect(domainfoo.connections.length).toBe(0);
    expect(domainbar.connections.length).toBe(0);
    expect(domainfoo.name).toEqual('localfoo');
    expect(domainbar.name).toEqual('localbar');
    domainfoo.connectNetwork(domainbar);
    expect(domainfoo.connections()).toEqual(['localbar']);
    expect(domainbar.connections.length).toBe(0);
    domainbar.connectNetwork(domainfoo);
    expect(domainbar.connections()).toEqual(['localfoo']);
});

test("Domains can create agents if none present", async () => {

    const dockerode = new Dockerode();
    const domain = new NomadDomain('local', 1337, undefined, dockerode);

    expect(domain.agents).toBeUndefined();
    expect(await domain.isAgentsUp()).toBe(undefined);
    domain.ensureAgents();
    expect(domain.agents).toBeDefined();
    expect(await domain.isAgentsUp()).toBe(false);
    expect(await domain.agents?.isAllUp()).toBeFalsy();
    
});

test("Domains can get agent keys and addresses", async () => {

    const dockerode = new Dockerode();
    const domain = new NomadDomain('local', 1337, undefined, dockerode);

    expect(domain.agents).toBeUndefined();
    expect(await domain.isAgentsUp()).toBe(undefined);
    domain.ensureAgents();
    expect(domain.agents).toBeDefined();
    expect(await domain.isAgentsUp()).toBe(false);
    expect(await domain.agents?.isAllUp()).toBeFalsy();

    expect(domain.getAgentAddress(AgentType.Updater)).toStrictEqual('0x9C7BC14e8a4B054e98C6DB99B9f1Ea2797BAee7B');
    expect(domain.getAgentSigner(AgentType.Updater).toAddress()).toStrictEqual('0x9C7BC14e8a4B054e98C6DB99B9f1Ea2797BAee7B');
    
});


test("Configs are defined", async () => {

    const dockerode = new Dockerode();
    const domain = new NomadDomain("local", 1337, undefined, dockerode);
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