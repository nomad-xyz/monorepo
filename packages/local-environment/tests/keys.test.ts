import { Key } from "../src/keys/key";
import { expect } from "chai";

describe("Keys test", () => {
    it('can create keys from scratch, with or without existing key input', async () => {
        expect(await new Key());
        expect(await new Key("1337000000000000000000000000000000000000000000000000000000001337"))
    })
    
    it('can translate keys to various forms', async function () {
        const tester = new Key();
        expect(tester);
        expect(tester.toString());
        expect(tester.toAddress()); //Tests publicKeyToAddress and privateKeyToPublicKey
        expect(tester.toSigner());
    })
})