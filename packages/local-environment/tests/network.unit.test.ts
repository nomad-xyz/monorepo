import Dockerode from 'dockerode';
import { HardhatNetwork } from "../src/network";
import { Key } from "../src/keys/key";

beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Networks should be initalizable", async () => {

    const dockerode = new Dockerode();
    const network = new HardhatNetwork('local', 1337, undefined, undefined, dockerode);

    expect(network).toBeTruthy();
    expect(network.name).toBe('local');
    expect(network.blockTime).toBeDefined();
    expect(network.domainNumber).toBe(network.chainId);
    expect(network.handler.port).toBe(1337);
    expect(network.isDeployed).toBe(false);

    expect(network.deployOverrides).toBeDefined();
    expect(network.updater).toBe("");
    expect(network.recoveryManager).toBe("");
    expect(network.watcher).toBe("");
    expect(network.weth).toBe("");
    expect(network.keys).toStrictEqual([]);
    expect(await network.handler.status()).toBe(2);
    expect(network.rpcs).toStrictEqual(["http://localhost:1337"]);
    expect(network.config).toBeDefined();
    expect(network.specs).toBeDefined();
    expect(network.bridgeConfig).toBeDefined();
    
});

test("Should be able to add keys", async () => {

  const dockerode = new Dockerode();
  const network = new HardhatNetwork('local', 1337, undefined, undefined, dockerode);

  expect(network.keys.length).toBe(0);
  network.addKeys(new Key());
  expect(network.keys.length).toBe(1);
  
});

test("Can call to docker to create containers", async () => {

  const dockerode = new Dockerode();
  const dockerSpy = jest.spyOn(dockerode, 'createContainer').mockImplementation(() => {return undefined as unknown as Promise<Dockerode.Container>;});
  const network = new HardhatNetwork('local', 1337, undefined, undefined, dockerode);

  await network.handler.createContainer();
  
  expect(dockerSpy).toHaveBeenCalled();

});

test("Can set weth address", async () => {

  const network = new HardhatNetwork('local', 1337);

  network.setWETH("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  expect(network.weth).toEqual("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");

});

test("Can get JSON RPC provider", async () => {

  const network = new HardhatNetwork('local', 1337);

  expect(network.getJsonRpcProvider()).toBeTruthy();
  expect(network.getJsonRpcSigner(new Key().toAddress())).toBeTruthy();

});
