// // @ts-ignore
// import { Nomad, utils, LocalNetwork, Key } from "@nomad-xyz/local-environment";
// import fs from "fs";

// export async function setupTwo() {
//   const tom = new LocalNetwork("tom", 1000, "http://localhost:9545");
//   const jerry = new LocalNetwork("jerry", 2000, "http://localhost:9546");

//   const tomActor = new Key();
//   const jerryActor = new Key();

//   const t = utils.generateDefaultKeys();
//   const j = utils.generateDefaultKeys();

//   tom.addKeys(
//     tomActor,
//     t.updater,
//     t.watcher,
//     t.deployer,
//     t.signer.base,
//     t.signer.updater,
//     t.signer.watcher,
//     t.signer.relayer,
//     t.signer.processor
//   );
//   jerry.addKeys(
//     jerryActor,
//     j.updater,
//     j.watcher,
//     j.deployer,
//     j.signer.base,
//     j.signer.updater,
//     j.signer.watcher,
//     j.signer.relayer,
//     j.signer.processor
//   );

//   await Promise.all([tom.up(), jerry.up()]);

//   const n = new Nomad(tom);
//   n.addNetwork(jerry);

//   n.setUpdater(jerry, j.updater); // Need for an update like updater
//   n.setWatcher(jerry, j.watcher); // Need for the watcher
//   n.setDeployer(jerry, j.deployer); // Need to deploy all
//   n.setSigner(jerry, j.signer.base); // Need for home.dispatch
//   n.setSigner(jerry, j.signer.updater, "updater"); // Need for home.dispatch
//   n.setSigner(jerry, j.signer.relayer, "relayer"); // Need for home.dispatch
//   n.setSigner(jerry, j.signer.watcher, "watcher"); // Need for home.dispatch
//   n.setSigner(jerry, j.signer.processor, "processor"); // Need for home.dispatch

//   n.setUpdater(tom, t.updater); // Need for an update like updater
//   n.setWatcher(tom, t.watcher); // Need for the watcher
//   n.setDeployer(tom, t.deployer); // Need to deploy all
//   n.setSigner(tom, t.signer.base); // Need for home.dispatch
//   n.setSigner(tom, t.signer.updater, "updater"); // Need for home.dispatch
//   n.setSigner(tom, t.signer.relayer, "relayer"); // Need for home.dispatch
//   n.setSigner(tom, t.signer.watcher, "watcher"); // Need for home.dispatch
//   n.setSigner(tom, t.signer.processor, "processor"); // Need for home.dispatch

//   await n.deploy({ injectSigners: true });

//   n.exportDeployArtifacts('../../rust/config')

//   fs.writeFileSync("/tmp/nomad.json", JSON.stringify(n.toObject()));

//   return {
//     tom,
//     jerry,
//     tomActor,
//     jerryActor,
//     n,
//   };
// }
