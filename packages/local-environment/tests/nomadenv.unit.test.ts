import { NomadDomain } from "../src/domain";
import { assert, use as chaiUse } from "chai";
import { NomadEnv } from "../src/nomadenv";
import chaiAsPromised from "chai-as-promised";
chaiUse(chaiAsPromised);

test("NomadEnv should be initalizable", async () => {

    const tDomain = new NomadDomain('tom', 1);
    const le = new NomadEnv({
        domain: tDomain.network.domainNumber,
        id: "0x" + "20".repeat(20),
    });
    expect(le).toBeTruthy();

    le.addDomain(tDomain);
    assert.isTrue(le.domains.includes(tDomain));
    expect(le.govNetwork).toBe(tDomain);
    // SDK
    expect(le.bridgeSDK).toBeDefined();
    expect(le.coreSDK).toBeDefined();
    expect(le.getDomains()).toStrictEqual([tDomain]);
    expect(le.deployerKey).toEqual(process.env.PRIVATE_KEY);
    expect(le.deployedOnce()).toBe(false);

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