import { NomadContext, NomadMessage } from "..";
import { ErinBackend } from "./backend";

let backend = new ErinBackend('api');

let ctx = new NomadContext('production', backend);

(async () => {
    const m = await NomadMessage.baseFromTransactionHashUsingBackend(ctx, '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b');
    if (!m) throw new Error(`No message found`);

    const p = await m.getProcess();

    if (p !== '0xa03a72bcea4deff1e6cdc9e526db43a2305d094f71d6b3fb1d296ff4cb6f4668') throw new Error("FAILED!")
    console.log("SUCCESS!", p);
    


})()
