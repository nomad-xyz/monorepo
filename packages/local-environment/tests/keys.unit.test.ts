import { Key } from "../src/keys/key";
import { expect } from "chai";

describe("Keys test", () => {
    it('can create keys from scratch, with or without existing key input', async () => {
        expect(await new Key());
        expect(await new Key("1337000000000000000000000000000000000000000000000000000000001337"));
    });
    
    it('can translate keys to various forms', async function () {
        const tester = new Key();
        expect(tester).to.exist; // Expects key to exist.
        expect(tester.toString()).to.be.a("string");
        expect(tester.toAddress()).to.have.lengthOf(42); // Tests publicKeyToAddress, privateKeyToPublicKey, and other utility functions like toChecksumAddress
        expect(tester.toSigner()).to.exist;
        const tester1 = new Key("1000000000000000000000000000000000000000000000000000000000000001");
        expect(tester1).to.exist;
        expect(tester1.toString()).to.be.a("string");
        expect(tester1.toString()).to.equal("1000000000000000000000000000000000000000000000000000000000000001");
        expect(tester1.toAddress()).to.equal("0x9C7BC14e8a4B054e98C6DB99B9f1Ea2797BAee7B"); // Tests publicKeyToAddress, privateKeyToPublicKey, and other utility functions like toChecksumAddress
        expect(tester1.toSigner()).to.exist;
        const tester2 = new Key("1000000000000000000000000000000000000000000000000000000000000001");
        expect(tester2.toAddress()).to.equal(tester1.toAddress()); // Test: two keys with the same seed values generate equal keys
        expect(tester2.toString()).to.equal(tester1.toString());
    });
});