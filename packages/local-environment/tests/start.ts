import { LocalNetwork, Nomad, utils } from "../src";
import fs from "fs";

function stringifyDefaultishKeys(k: any) {
  return {
    updater: k.updater.toString(),
    watcher: k.watcher.toString(),
    deployer: k.deployer.toString(),
    signer: {
      base: k.signer.base.toString(),
      updater: k.signer.updater.toString(),
      watcher: k.signer.watcher.toString(),
      relayer: k.signer.relayer.toString(),
      processor: k.signer.processor.toString(),
    },
  };
}

(async () => {
  const tom = new LocalNetwork("tom", 1000, "http://localhost:9545");
  const jerry = new LocalNetwork("jerry", 2000, "http://localhost:9546");

  const j = utils.generateDefaultKeys();
  const t = utils.generateDefaultKeys();

  jerry.addKeys(
    j.updater,
    j.watcher,
    j.deployer,
    j.signer.base,
    j.signer.updater,
    j.signer.watcher,
    j.signer.relayer,
    j.signer.processor
  );
  tom.addKeys(
    t.updater,
    t.watcher,
    t.deployer,
    t.signer.base,
    t.signer.updater,
    t.signer.watcher,
    t.signer.relayer,
    t.signer.processor
  );

  fs.writeFileSync(
    "./tomKeys.json",
    JSON.stringify(stringifyDefaultishKeys(t))
  );
  fs.writeFileSync(
    "./jerryKeys.json",
    JSON.stringify(stringifyDefaultishKeys(j))
  );

  console.log(
    `Tom:\ndeployerKey: ${t.deployer.toString()}\naddress: ${t.deployer.toAddress()}`
  );
  console.log(
    `Jerry:\ndeployerKey: ${j.deployer.toString()}\naddress: ${j.deployer.toAddress()}`
  );

  await Promise.all([tom.up(), jerry.up()]);

  const n = new Nomad(tom);
  n.addNetwork(jerry);

  n.setUpdater(jerry, j.updater); // Need for an update like updater
  n.setWatcher(jerry, j.watcher); // Need for the watcher
  n.setDeployer(jerry, j.deployer); // Need to deploy all
  n.setSigner(jerry, j.signer.base); // Need for home.dispatch
  n.setSigner(jerry, j.signer.updater, "updater"); // Need for home.dispatch
  n.setSigner(jerry, j.signer.relayer, "relayer"); // Need for home.dispatch
  n.setSigner(jerry, j.signer.watcher, "watcher"); // Need for home.dispatch
  n.setSigner(jerry, j.signer.processor, "processor"); // Need for home.dispatch

  n.setUpdater(tom, t.updater); // Need for an update like updater
  n.setWatcher(tom, t.watcher); // Need for the watcher
  n.setDeployer(tom, t.deployer); // Need to deploy all
  n.setSigner(tom, t.signer.base); // Need for home.dispatch
  n.setSigner(tom, t.signer.updater, "updater"); // Need for home.dispatch
  n.setSigner(tom, t.signer.relayer, "relayer"); // Need for home.dispatch
  n.setSigner(tom, t.signer.watcher, "watcher"); // Need for home.dispatch
  n.setSigner(tom, t.signer.processor, "processor"); // Need for home.dispatch

  await n.deploy({ injectSigners: true });
  await n.startAllAgents();

  fs.writeFileSync("/tmp/nomad.json", JSON.stringify(n.toObject()));
})();
