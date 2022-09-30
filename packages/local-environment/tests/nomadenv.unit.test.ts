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

    le.addDomain('tom', 1);
    assert.isTrue(le.domains.includes(le.tDomain!));
    expect(le.govNetwork).toBe(le.tDomain);
    // SDK
    expect(le.bridgeSDK).toBeDefined();
    expect(le.coreSDK).toBeDefined();
    expect(le.getDomains()).toStrictEqual([le.tDomain]);
    expect(le.deployerKey).toEqual(process.env.PRIVATE_KEY);
    expect(le.deployedOnce()).toBe(false);
    expect(le.tDomain).toBeDefined();
    if (process.env.ALCHEMY_API_KEY) {
        expect(le.forkUrl).toBe(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
    }

});

test("NomadEnv should be able to refresh SDK", async () => {

    const tDomain = new NomadDomain('tom', 1);
    const le = new NomadEnv({
        domain: tDomain.network.domainNumber,
        id: "0x" + "20".repeat(20),
    });
    
    expect(le.refreshSDK(le.nomadConfig)).toBeDefined();
});

test("Can create deployContext", async () => {

    const tDomain = new NomadDomain('tom', 1);
    const le = new NomadEnv({
        domain: tDomain.network.domainNumber,
        id: "0x" + "20".repeat(20),
    });
    
    expect(le.setDeployContext).toBeDefined();
});