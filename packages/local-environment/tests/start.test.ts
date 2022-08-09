import { defaultStart } from "../src/nomadenv";
import { expect } from "chai";

describe("Startup test", () => {
    it('should successfully start the nomad environment', async () => {
        expect(defaultStart()).not.throw(Error);
    })
})