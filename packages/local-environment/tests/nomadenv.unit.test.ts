import { NomadDomain } from "../src/domain";
import { assert, use as chaiUse } from "chai";
import { NomadEnv } from "../src/nomadenv";
import chaiAsPromised from "chai-as-promised";
chaiUse(chaiAsPromised);

test("NomadEnv should be initalizable", async () => {

    const le = new NomadEnv({
        domain: 1,
        id: "0x" + "20".repeat(20),
    });
    expect(le).toBeTruthy();

    const tom = NomadDomain.newHardhatNetwork("tom", 1, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: le });
    const tDomain = le.addNetwork(tom.network);
    assert.isTrue(le.domains.includes(tDomain));
    expect(le.govNetwork).toBe(tDomain);
    // SDK
    expect(le.bridgeSDK).toBeDefined();
    expect(le.coreSDK).toBeDefined();
    expect(le.getDomains()).toStrictEqual([tDomain]);
    expect(le.deployerKey).toEqual(process.env.PRIVATE_KEY);
    expect(le.deployedOnce()).toBe(false);
    expect(tDomain).toBeDefined();

});

test("NomadEnv should be able to refresh SDK", async () => {

    const tom = NomadDomain.newHardhatNetwork("tom", 1);
    const tDomain = new NomadDomain(tom.network);
    const le = new NomadEnv({
        domain: tDomain.network.domainNumber,
        id: "0x" + "20".repeat(20),
    });
    
    expect(le.refreshSDK(le.nomadConfig)).toBeDefined();
});

test("Can create deployContext", async () => {

    const le = new NomadEnv({
        domain: 1,
        id: "0x" + "20".repeat(20),
    });
    const tom = NomadDomain.newHardhatNetwork("tom", 1, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: le });
    le.addNetwork(tom.network);
    
    expect(le.setDeployContext).toBeDefined();
});