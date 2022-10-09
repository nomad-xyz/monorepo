import { defaultStart } from "../src/nomadenv";

describe("Startup test", () => {
    it('should successfully start the nomad environment', async () => {
        expect(await defaultStart()).toBeTruthy();
    });
});