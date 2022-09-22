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

