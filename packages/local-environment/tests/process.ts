import { Nomad } from "../src";
import fs from "fs";

(async () => {
  const n = await Nomad.fromObject(
    JSON.parse(fs.readFileSync("/tmp/nomad.json", "utf8")) as Object
  );

  console.log(`Home root:`, await n.getCore(n.host).home.root());

  const jerry = n.host;

  const events = await n.getAgent("updater", jerry).getEvents();

  events.on("restart", () => {
    console.log(`RESTARTED!`, events.listenerCount("restart"));
    n.getAgent("updater", jerry).unsubscribe();
  });

  events.on("logs.info_messages", (match) => {
    console.log(`debug_thing!`, match[1]);
  });
})();
