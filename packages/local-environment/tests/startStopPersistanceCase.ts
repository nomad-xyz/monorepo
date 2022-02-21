import { LocalNetwork, Nomad, Key, utils } from "../src";

(async () => {
  const persistance = await startNomad();
  await stopNomad(persistance);
})();

async function startNomad(): Promise<Object> {
  const jerry = new LocalNetwork("jerry", 1000, "http://localhost:9545");
  const tom = new LocalNetwork("tom", 2000, "http://localhost:9546");

  const k = new Key(utils.paddedZeros("1337"));

  jerry.addKeys(k);
  tom.addKeys(k);

  await Promise.all([jerry.up(), tom.up()]);

  console.log(`Started both`);

  const n = new Nomad(jerry);
  n.addNetwork(tom);

  n.setAllKeys(jerry, k);
  n.setAllKeys(tom, k);

  await n.deploy({ injectSigners: true });

  await n.startAllAgents();

  return n.toObject();
}

async function stopNomad(obj: Object): Promise<void> {
  const n = await Nomad.fromObject(obj as Object);

  console.log(
    `await n.getCore(n.host).home.root();->`,
    await n.getCore(n.host).home.root()
  );

  const nets = n.getNetworks(); // get them before the object is closed
  await n.end();
  await Promise.all(nets.map((n) => n.down()));
}
