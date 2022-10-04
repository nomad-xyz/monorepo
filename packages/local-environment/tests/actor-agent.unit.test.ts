import { NomadDomain } from "../src/domain";
import { LocalAgent, AgentType } from "../src/agent";
import Dockerode from 'dockerode';

let local;
let domain;

beforeEach(() => {
    jest.clearAllMocks();
    local = NomadDomain.newHardhatNetwork('local', 1337);
    domain = new NomadDomain(local.network);
  });

test("Dockerized agents should be initalizable", async () => {

    const dockerode = new Dockerode();
    const kathy = new LocalAgent(AgentType.Kathy, domain, 1337, dockerode);

    expect(kathy).toBeTruthy();
    expect(kathy.isConnected()).toBe(false);
    expect(await kathy.status()).toBe(false);
    expect(kathy.containerName()).toEqual(`kathy_local_agent`);
    expect(kathy.getAdditionalEnvs()).toEqual([
      `DEFAULT_TXSIGNER_KEY=0x${domain.keys.kathy.toString()}`,
    ]);
    
});

test("Can initialize all other types of agents with correct configs", async () => {

  const dockerode = new Dockerode();

  const updater = new LocalAgent(AgentType.Updater, domain, 1337, dockerode);

  expect(updater).toBeTruthy();
  expect(updater.isConnected()).toBe(false);
  expect(await updater.status()).toBe(false);
  expect(updater.containerName()).toEqual(`updater_local_agent`);
  expect(updater.getAdditionalEnvs()).toEqual([
    `DEFAULT_TXSIGNER_KEY=0x${domain.keys.updater.toString()}`,
    `ATTESTATION_SIGNER_KEY=0x${domain.keys.signer.toString()}`,
  ]);

  const relayer = new LocalAgent(AgentType.Relayer, domain, 1337, dockerode);

  expect(relayer).toBeTruthy();
  expect(relayer.isConnected()).toBe(false);
  expect(await relayer.status()).toBe(false);
  expect(relayer.containerName()).toEqual(`relayer_local_agent`);
  expect(relayer.getAdditionalEnvs()).toEqual([
    `DEFAULT_TXSIGNER_KEY=0x${domain.keys.relayer.toString()}`,
  ]);

  const processor = new LocalAgent(AgentType.Processor, domain, 1337, dockerode);

  expect(processor).toBeTruthy();
  expect(processor.isConnected()).toBe(false);
  expect(await processor.status()).toBe(false);
  expect(processor.containerName()).toEqual(`processor_local_agent`);
  expect(processor.getAdditionalEnvs()).toEqual([
    `DEFAULT_TXSIGNER_KEY=0x${domain.keys.processor.toString()}`,
  ]);

  const watcher = new LocalAgent(AgentType.Watcher, domain, 1337, dockerode);

  expect(watcher).toBeTruthy();
  expect(watcher.isConnected()).toBe(false);
  expect(await watcher.status()).toBe(false);
  expect(watcher.containerName()).toEqual(`watcher_local_agent`);
  expect(watcher.getAdditionalEnvs()).toEqual([
    `DEFAULT_TXSIGNER_KEY=0x${domain.keys.watchers[0].toString()}`,
    `ATTESTATION_SIGNER_KEY=0x${domain.keys.signer.toString()}`,
  ]);

});

test("Can call to docker to create containers", async () => {

    const dockerode = new Dockerode();
    const dockerSpy = jest.spyOn(dockerode, 'createContainer').mockImplementation(() => {return undefined as unknown as Promise<Dockerode.Container>;});
    const kathy = new LocalAgent(AgentType.Kathy, domain, 1337, dockerode);

    await kathy.createContainer();
    
    expect(dockerSpy).toHaveBeenCalled();
});
