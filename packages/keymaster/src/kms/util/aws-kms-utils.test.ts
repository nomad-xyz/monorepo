import BN from "bn.js";
import {
  getEthereumAddress,
  determineCorrectV,
  findEthereumSig,
} from "./aws-kms-utils";
// import { describe, test } from "mocha";
import { expect } from "chai";

describe("getEthereumAddress", () => {
  test("should work correctly", () => {
    const samplePubKey = Buffer.from(
      "3056301006072a8648ce3d020106052b8104000a03420004f2de8ae7a9f594fb0d399abfb58639f43fb80960a1ed7c6e257c11e764d4759e1773a2c7ec7b913bec5d0e3a12bd7acd199f62e86de3f83b35bf6749fc1144ba",
      "hex"
    );
    expect(getEthereumAddress(samplePubKey)).to.equal(
      "0xe94e130546485b928c9c9b9a5e69eb787172952e"
    );
  });
  test("should fail on truncated key", () => {
    const samplePubKey = Buffer.from(
      "3056301006072a8648ce3d020106052b8104000a03420004f2de8ae7a9f594fb0d399abfb58639f43fb80960a1ed7c6e257c11",
      "hex"
    );
    expect(() => getEthereumAddress(samplePubKey)).to.throw();
  });
});

describe("findEthereumSig", () => {
  test("should work correctly", () => {
    const sampleSignature = Buffer.from(
      "304502203f25afdb7ed67094101cd71109261886db9abbf1ba20cc53aec20ba01c2e6baa022100ab0de6d40f8960c252fc6f21e35e8369126fb19033f10953c42a61766635df82",
      "hex"
    );
    expect(JSON.stringify(findEthereumSig(sampleSignature))).to.equal(
      '{"r":"3f25afdb7ed67094101cd71109261886db9abbf1ba20cc53aec20ba01c2e6baa","s":"54f2192bf0769f3dad0390de1ca17c95a83f2b567b5796e7fba7fd166a0061bf"}'
    );
  });
});

describe("determineCorrectV", () => {
  test("should get correct V if it is 28", () => {
    const sampleMsg = Buffer.from(
      "a1de988600a42c4b4ab089b619297c17d53cffae5d5120d82d8a92d0bb3b78f2",
      "hex"
    );
    const sampleR = new BN(
      "fa754063b93a288b9a96883fc365efb9aee7ecaf632009baa04fe429e706d50e",
      16
    );
    const sampleS = new BN(
      "6a8971b06cd37b3da4ad04bb1298fda152a41e5c1104fd5d974d5c0a060a5e62",
      16
    );
    const expectedAddr = "0xe94e130546485b928c9c9b9a5e69eb787172952e";
    expect(
      determineCorrectV(sampleMsg, sampleR, sampleS, expectedAddr)
    ).to.deep.equal({
      pubKey: "0xE94E130546485b928C9C9b9A5e69EB787172952e",
      v: 28,
    });
  });
  test("should get correct V if it is 27", () => {
    const sampleMsg = Buffer.from(
      "a1de988600a42c4b4ab089b619297c17d53cffae5d5120d82d8a92d0bb3b78f2",
      "hex"
    );
    const sampleR = new BN(
      "904d320777ceae0232282cbf6da3809a678541cdef7f4f3328242641ceecb0dc",
      16
    );
    const sampleS = new BN(
      "5b7f7afe18221049a1e176a89a60b6c10df8c0e838edb9b2f11ae1fb50a28271",
      16
    );
    const expectedAddr = "0xe94e130546485b928c9c9b9a5e69eb787172952e";
    expect(
      determineCorrectV(sampleMsg, sampleR, sampleS, expectedAddr)
    ).to.deep.equal({
      pubKey: "0xE94E130546485b928C9C9b9A5e69EB787172952e",
      v: 27,
    });
  });

  test("should throw if somethings are invalid", () => {
    const sampleMsg = Buffer.from(
      "8600a42c4b4ab089b619297c17d53cffae5d5120d82d8a92d0bb3b78f2",
      "hex"
    );
    const sampleR = new BN(
      "777ceae0232282cbf6da3809a678541cdef7f4f3328242641ceecb0dc",
      16
    );
    const sampleS = new BN(
      "5b7f7afe18221049a1e176a89a60b6c10df8c0e838edb9b2f11ae1fb50a28271",
      16
    );
    const expectedAddr = "0xe94e130546485b928c9c9b9a5e69eb787172952e";
    expect(() =>
      determineCorrectV(sampleMsg, sampleR, sampleS, expectedAddr)
    ).to.throw();
  });
});
