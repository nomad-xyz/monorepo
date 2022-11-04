// import { GoldSkyBackend } from "./backend";

// import { GoldSkyBridgeBackend } from "./backend";
import { BridgeContext } from "./BridgeContext";
import { BridgeMessage } from "./BridgeMessage";

// const GOLDSKY_SECRET = "yaZj76nCg5q";

// const backend = GoldSkyBridgeBackend.default('production');

const ctx = new BridgeContext('production');

(async () => {
    const m = await BridgeMessage.bridgeFirstFromBackend(ctx, '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b');
    if (!m) throw new Error(`No message found`);

    const p = await m.getProcess();

    if (p !== '0xa03a72bcea4deff1e6cdc9e526db43a2305d094f71d6b3fb1d296ff4cb6f4668') throw new Error("FAILED!");
    console.log("SUCCESS!", p);
    
    const r = await m.getReceived();
    console.log("received!", r);

    const s = await m.getSender();
    console.log("Sender!", s);

})();

