import { Nomad } from "../src";
import fs from "fs";

(async () => {
  const n = await Nomad.fromObject(
    JSON.parse(fs.readFileSync("/tmp/nomad.json", "utf8")) as Object
  );

  console.log(`Home root:`, await n.getCore(n.host).home.root());

  const nets = n.getNetworks(); // get them before the object is closed
  await n.end();
  await Promise.all(nets.map((n) => n.down()));
})();
