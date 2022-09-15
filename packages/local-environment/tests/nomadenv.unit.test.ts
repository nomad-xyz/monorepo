import { HardhatNetwork } from "../src/network";
import { NomadDomain } from "../src/domain";
import { expect, assert, use as chaiUse } from "chai";
import { NomadEnv } from "../src/nomadenv";
import Docker from "dockerode";
import { LocalAgent } from "../src/agent";
import chaiAsPromised from "chai-as-promised";

chaiUse(chaiAsPromised);

jest.mock("../src/agent");
jest.mock("../src/domain");
jest.mock("../src/network");
jest.mock("../src/nomadenv");

test("successfully calls LocalAgent functions", () => {
    const t = new HardhatNetwork('tom', 1);
    const j = new HardhatNetwork('jerry', 2);
    const tDomain = new NomadDomain(t);
    const jDomain = new NomadDomain(j);
    const le = new NomadEnv({
        domain: tDomain.network.domainNumber,
        id: "0x" + "20".repeat(20),
    });

});