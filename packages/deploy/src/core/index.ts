import { assert } from 'console';
import fs from 'fs';
import { ethers } from 'ethers';
import * as proxyUtils from '../proxyUtils';
import { CoreDeploy } from './CoreDeploy';
import * as contracts from '../../../contracts-core';
import { checkCoreDeploy } from './checks';
import { getPathToDeployConfig } from '../verification/readDeployOutput';
import { utils as mpUtils } from '@nomad-xyz/multi-provider';

export * from './CoreDeploy'

function log(str: string) {
  console.log(str);
}

function getGovernorDeploy(deploys: CoreDeploy[]): CoreDeploy {
  const govDeploy = deploys.find((d) => d.config.governor != undefined);
  if (!govDeploy)
    throw new Error(
      `Deploy with governing domain was not found in array of old deploys ${deploys}`,
    );

  return govDeploy;
}

function getNonGovernorDeploys(deploys: CoreDeploy[]): CoreDeploy[] {
  return deploys.filter((d) => d.config.governor == undefined);
}

export async function deployUpgradeBeaconController(deploy: CoreDeploy) {
  const factory = new contracts.UpgradeBeaconController__factory(
    deploy.deployer,
  );
  deploy.contracts.upgradeBeaconController = await factory.deploy(
    deploy.overrides,
  );
  assert(deploy.contracts.upgradeBeaconController);
  await deploy.contracts.upgradeBeaconController.deployTransaction.wait(
    deploy.chain.confirmations,
  );

  // add contract information to Etherscan verification array
  deploy.verificationInput.push({
    name: 'UpgradeBeaconController',
    address: deploy.contracts.upgradeBeaconController.address,
    constructorArguments: [],
  });
}

/**
 * Deploys the UpdaterManager on the chain of the given deploy and updates
 * the deploy instance with the new contract.
 *
 * @param deploy - The deploy instance
 */
export async function deployUpdaterManager(deploy: CoreDeploy) {
  const factory = new contracts.UpdaterManager__factory(deploy.deployer);
  deploy.contracts.updaterManager = await factory.deploy(
    deploy.config.updater,
    deploy.overrides,
  );
  await deploy.contracts.updaterManager.deployTransaction.wait(
    deploy.chain.confirmations,
  );

  // add contract information to Etherscan verification array
  deploy.verificationInput.push({
    name: 'UpdaterManager',
    address: deploy.contracts.updaterManager!.address,
    constructorArguments: [deploy.config.updater],
  });
}

/**
 * Deploys the XAppConnectionManager on the chain of the given deploy and updates
 * the deploy instance with the new contract.
 *
 * @param deploy - The deploy instance
 */
export async function deployXAppConnectionManager(deploy: CoreDeploy) {
  const deployer = deploy.deployer;
  const factory = new contracts.XAppConnectionManager__factory(deployer);

  deploy.contracts.xAppConnectionManager = await factory.deploy(
    deploy.overrides,
  );
  await deploy.contracts.xAppConnectionManager.deployTransaction.wait(
    deploy.chain.confirmations,
  );

  // add contract information to Etherscan verification array
  deploy.verificationInput.push({
    name: 'XAppConnectionManager',
    address: deploy.contracts.xAppConnectionManager!.address,
    constructorArguments: [],
  });
}

/**
 * Deploys the Home proxy on the chain of the given deploy and updates
 * the deploy instance with the new contract.
 *
 * @param deploy - The deploy instance
 */
export async function deployHome(deploy: CoreDeploy) {
  const homeFactory = contracts.Home__factory;

  const { updaterManager } = deploy.contracts;
  const initData = homeFactory
    .createInterface()
    .encodeFunctionData('initialize', [updaterManager!.address]);

  deploy.contracts.home = await proxyUtils.deployProxy<contracts.Home>(
    'Home',
    deploy,
    new homeFactory(deploy.deployer),
    initData,
    deploy.chain.domain,
  );
}

/**
 * Deploys the GovernanceRouter proxy on the chain of the given deploy and updates
 * the deploy instance with the new contract.
 *
 * @param deploy - The deploy instance
 */
export async function deployGovernanceRouter(deploy: CoreDeploy) {
  const governanceRouter = contracts.GovernanceRouter__factory;

  const { xAppConnectionManager } = deploy.contracts;
  const recoveryManager = deploy.config.recoveryManager;
  const recoveryTimelock = deploy.config.recoveryTimelock;

  const initData = governanceRouter
    .createInterface()
    .encodeFunctionData('initialize', [
      xAppConnectionManager!.address,
      recoveryManager,
    ]);

  deploy.contracts.governance =
    await proxyUtils.deployProxy<contracts.GovernanceRouter>(
      'Governance',
      deploy,
      new governanceRouter(deploy.deployer),
      initData,
      deploy.chain.domain,
      recoveryTimelock,
    );
}

/**
 * Deploys an unenrolled Replica proxy on the local chain and updates the local
 * deploy instance with the new contract.
 *
 * @param local - The local deploy instance
 * @param remote - The remote deploy instance
 */
export async function deployUnenrolledReplica(
  local: CoreDeploy,
  remote: CoreDeploy,
) {
  const replica = contracts.Replica__factory;

  const initData = replica.createInterface().encodeFunctionData('initialize', [
    remote.chain.domain,
    remote.config.updater,
    ethers.constants.HashZero, // TODO: allow configuration in case of recovery
    remote.config.optimisticSeconds,
  ]);

  // if we have no replicas, deploy the whole setup.
  // otherwise just deploy a fresh proxy
  let proxy;
  if (Object.keys(local.contracts.replicas).length === 0) {
    log(
      `${local.chain.name}: deploying initial Replica for ${remote.chain.name}`,
    );
    proxy = await proxyUtils.deployProxy<contracts.Replica>(
      'Replica',
      local,
      new replica(local.deployer),
      initData,
      local.chain.domain,
      local.config.processGas,
      local.config.reserveGas,
    );
  } else {
    log(
      `${local.chain.name}: deploying additional Replica for ${remote.chain.name}`,
    );
    const prev = Object.entries(local.contracts.replicas)[0][1];
    proxy = await proxyUtils.duplicate<contracts.Replica>(
      'Replica',
      local,
      prev,
      initData,
    );
  }
  local.contracts.replicas[remote.chain.domain] = proxy;
  log(
    `${local.chain.name}: replica deployed for ${remote.chain.name}`,
  );
}

/**
 * Deploys the entire nomad suite of contracts on the chain of the given deploy
 * and updates the deploy instance with the new contracts.
 *
 * @param deploy - The deploy instance
 */
export async function deployNomad(deploy: CoreDeploy) {
  log(`${deploy.chain.name}: awaiting deploy UBC(deploy);`);
  await deployUpgradeBeaconController(deploy);

  log(
    `${deploy.chain.name}: awaiting deploy UpdaterManager(deploy);`,
  );
  await deployUpdaterManager(deploy);

  log(
    `${deploy.chain.name}: awaiting deploy XappConnectionManager(deploy);`,
  );
  await deployXAppConnectionManager(deploy);

  log(`${deploy.chain.name}: awaiting deploy Home(deploy);`);
  await deployHome(deploy);

  log(
    `${deploy.chain.name}: awaiting XAppConnectionManager.setHome(...);`,
  );
  await deploy.contracts.xAppConnectionManager!.setHome(
    deploy.contracts.home!.proxy.address,
    deploy.overrides,
  );

  log(
    `${deploy.chain.name}: awaiting updaterManager.setHome(...);`,
  );
  await deploy.contracts.updaterManager!.setHome(
    deploy.contracts.home!.proxy.address,
    deploy.overrides,
  );

  log(
    `${deploy.chain.name}: awaiting deploy GovernanceRouter(deploy);`,
  );
  await deployGovernanceRouter(deploy);

  log(`${deploy.chain.name}: initial chain deploy completed`);
}

/**
 * Transfers ownership to the GovernanceRouter.
 *
 * @param deploy - The deploy instance
 */
export async function relinquish(deploy: CoreDeploy) {
  const govRouter = await deploy.contracts.governance!.proxy.address;

  log(`${deploy.chain.name}: Relinquishing control`);
  await deploy.contracts.updaterManager!.transferOwnership(
    govRouter,
    deploy.overrides,
  );

  log(
    `${deploy.chain.name}: Dispatched relinquish updatermanager`,
  );

  await deploy.contracts.xAppConnectionManager!.transferOwnership(
    govRouter,
    deploy.overrides,
  );

  log(
    `${deploy.chain.name}: Dispatched relinquish XAppConnectionManager`,
  );

  await deploy.contracts.upgradeBeaconController!.transferOwnership(
    govRouter,
    deploy.overrides,
  );

  log(
    `${deploy.chain.name}: Dispatched relinquish upgradeBeaconController`,
  );

  const replicaEntries = Object.entries(deploy.contracts.replicas);
  for (const replicaEntry of replicaEntries) {
    const remoteDomain = replicaEntry[0];
    const replica = replicaEntry[1];
    await replica!.proxy.transferOwnership(govRouter, deploy.overrides);
    log(
      `${deploy.chain.name}: Dispatched relinquish Replica for ${remoteDomain}`,
    );
  }

  const tx = await deploy.contracts.home!.proxy.transferOwnership(
    govRouter,
    deploy.overrides,
  );

  log(`${deploy.chain.name}: Dispatched relinquish home`);

  await tx.wait(deploy.chain.confirmations);
  log(`${deploy.chain.name}: Control relinquished`);
}

/**
 * Enrolls a remote replica on the local chain.
 *
 * @param local - The local deploy instance
 * @param remote - The remote deploy instance
 */
export async function enrollReplica(local: CoreDeploy, remote: CoreDeploy) {
  log(`${local.chain.name}: starting replica enrollment`);

  const tx = await local.contracts.xAppConnectionManager!.ownerEnrollReplica(
    local.contracts.replicas[remote.chain.domain].proxy.address,
    remote.chain.domain,
    local.overrides,
  );
  await tx.wait(local.chain.confirmations);

  log(`${local.chain.name}: replica enrollment done`);
}

/**
 * Enrolls a remote watcher on the local chain.
 *
 * @param local - The local deploy instance
 * @param remote - The remote deploy instance
 */
export async function enrollWatchers(left: CoreDeploy, right: CoreDeploy) {
  log(`${left.chain.name}: starting watcher enrollment`);

  await Promise.all(
    left.config.watchers.map(async (watcher) => {
      const tx =
        await left.contracts.xAppConnectionManager!.setWatcherPermission(
          watcher,
          right.chain.domain,
          true,
          left.overrides,
        );
      await tx.wait(left.chain.confirmations);
    }),
  );

  log(`${left.chain.name}: watcher enrollment done`);
}

/**
 * Enrolls a remote GovernanceRouter on the local chain.
 *
 * @param local - The local deploy instance
 * @param remote - The remote deploy instance
 */
export async function enrollGovernanceRouter(
  local: CoreDeploy,
  remote: CoreDeploy,
) {
  log(
    `${local.chain.name}: starting enroll ${remote.chain.name} governance router`,
  );
  const tx = await local.contracts.governance!.proxy.setRouterLocal(
    remote.chain.domain,
    mpUtils.canonizeId(remote.contracts.governance!.proxy.address),
    local.overrides,
  );
  await tx.wait(local.chain.confirmations);
  log(
    `${local.chain.name}: enrolled ${remote.chain.name} governance router`,
  );
}

/**
 * Enrolls a remote Replica, GovernanceRouter and Watchers on the local chain.
 *
 * @param local - The local deploy instance
 * @param remote - The remote deploy instance
 */
export async function enrollRemote(local: CoreDeploy, remote: CoreDeploy) {
  await deployUnenrolledReplica(local, remote);
  await enrollReplica(local, remote);
  await enrollWatchers(local, remote);
  await enrollGovernanceRouter(local, remote);
}

/**
 * Transfers governorship to the governing chain's GovernanceRouter.
 *
 * @param gov - The governor chain deploy instance
 * @param non - The non-governor chain deploy instance
 */
export async function transferGovernorship(gov: CoreDeploy, non: CoreDeploy) {
  log(`${non.chain.name}: transferring governorship`);
  const governorAddress = await gov.contracts.governance!.proxy.governor();
  const tx = await non.contracts.governance!.proxy.transferGovernor(
    gov.chain.domain,
    governorAddress,
    non.overrides,
  );
  await tx.wait(non.chain.confirmations);
  log(`${non.chain.name}: governorship transferred`);
}

/**
 * Appints the intended ultimate governor in that domain's Governance Router.
 * If the governor address is not configured, it will remain the deployer
 * address.
 * @param gov - The governor chain deploy instance
 */
export async function appointGovernor(gov: CoreDeploy) {
  const governor = gov.config.governor;
  if (governor) {
    log(
      `${gov.chain.name}: transferring root governorship to ${governor.domain}:${governor.address}`,
    );
    const tx = await gov.contracts.governance!.proxy.transferGovernor(
      governor.domain,
      governor.address,
      gov.overrides,
    );
    await tx.wait(gov.chain.confirmations);
    log(`${gov.chain.name}: root governorship transferred`);
  }
}

/**
 * Deploys the entire nomad suite of contracts on two chains.
 *
 * @notice `gov` has the governance capability after setup
 *
 * @param gov - The governor chain deploy instance
 * @param non - The non-governor chain deploy instance
 */
export async function deployTwoChains(gov: CoreDeploy, non: CoreDeploy) {
  log('Beginning Two Chain deploy process');
  log(`Deploy env is ${gov.config.environment}`);
  log(`${gov.chain.name} is governing`);
  log(
    `Updater for ${gov.chain.name} Home is ${gov.config.updater}`,
  );
  log(
    `Updater for ${non.chain.name} Home is ${non.config.updater}`,
  );

  log('awaiting provider ready');
  await Promise.all([gov.ready(), non.ready()]);
  log('done readying');

  await Promise.all([deployNomad(gov), deployNomad(non)]);

  log('initial deploys done');

  await Promise.all([
    deployUnenrolledReplica(gov, non),
    deployUnenrolledReplica(non, gov),
  ]);

  log('replica deploys done');

  await Promise.all([enrollReplica(gov, non), enrollReplica(non, gov)]);

  log('replica enrollment done');

  await Promise.all([enrollWatchers(gov, non), enrollWatchers(non, gov)]);

  await Promise.all([
    enrollGovernanceRouter(gov, non),
    enrollGovernanceRouter(non, gov),
  ]);

  if (gov.config.governor) {
    log(`appoint governor: ${gov.config.governor}`);
    await appointGovernor(gov);
  }

  await transferGovernorship(gov, non);

  await Promise.all([relinquish(gov), relinquish(non)]);

  // checks deploys are correct
  const govDomain = gov.chain.domain;
  const nonDomain = non.chain.domain;
  await checkCoreDeploy(gov, [nonDomain], govDomain);
  await checkCoreDeploy(non, [govDomain], govDomain);

  writeDeployOutput([gov, non]);
}

function containsDuplicateDomains(array: any): boolean {
  return new Set(array).size !== array.length;
}

/**
 * Deploy the entire suite of Nomad contracts
 * on each chain within the chainConfigs array
 * including the upgradable Home, Replicas, and GovernanceRouter
 * that have been deployed, initialized, and configured
 * according to the deployNomad script
 *
 * @dev The first chain in the array will be the governing chain
 *
 * @param deploys - An array of chain deploys
 */
export async function deployComplete(deploys: CoreDeploy[]) {
  const domains = deploys.map((deploy) => deploy.chain.domain);
  if (containsDuplicateDomains(domains)) {
    throw new Error(
      'You have specified multiple deploys with the same domain. Check your config.',
    );
  }

  if (deploys.length == 0) {
    throw new Error('Must pass at least one deploy config');
  }

  log(`Beginning ${deploys.length} Chain deploy process`);
  log(`Deploy env is ${deploys[0].config.environment}`);
  log(`${deploys[0].chain.name} is governing`);
  deploys.forEach((deploy) => {
    log(
      `Updater for ${deploy.chain.name} Home is ${deploy.config.updater}`,
    );
  });

  const govChain = getGovernorDeploy(deploys);
  const nonGovChains = getNonGovernorDeploys(deploys);

  log('awaiting provider ready');
  await Promise.all([
    deploys.map(async (deploy) => {
      await deploy.ready();
    }),
  ]);
  log('done readying');

  // store block numbers for each chain, so that agents know where to start
  await Promise.all(deploys.map((d) => d.recordFromBlock()));

  // deploy nomad on each chain
  await Promise.all(
    deploys.map(async (deploy) => {
      await deployNomad(deploy);
    }),
  );

  // enroll remotes on every chain
  //
  //    NB: do not use Promise.all for this block. It introduces a race condition
  //    which results in multiple replica implementations on the home chain.
  //
  for (const local of deploys) {
    const remotes = deploys.filter(
      (d) => d.chain.domain !== local.chain.domain,
    );
    for (const remote of remotes) {
      log(
        `connecting ${remote.chain.name} on ${local.chain.name}`,
      );
      await enrollRemote(local, remote);
      log(
        `connected ${remote.chain.name} on ${local.chain.name}`,
      );
    }
  }

  // appoint the configured governance account as governor
  if (govChain.config.governor) {
    log(
      `appoint governor: ${govChain.config.governor.address} at ${govChain.config.governor.domain}`,
    );
    await appointGovernor(govChain);
  }

  await Promise.all(
    nonGovChains.map(async (non) => {
      await transferGovernorship(govChain, non);
    }),
  );

  // relinquish control of all chains
  await Promise.all(deploys.map(relinquish));

  // checks deploys are correct
  const govDomain = govChain.chain.domain;
  for (let i = 0; i < deploys.length; i++) {
    const localDomain = deploys[i].chain.domain;
    const remoteDomains = deploys
      .map((deploy) => deploy.chain.domain)
      .filter((domain) => {
        return domain != localDomain;
      });
    await checkCoreDeploy(deploys[i], remoteDomains, govDomain);
  }

  // write config outputs
  writeDeployOutput(deploys);
}

/**
 * Deploy the entire suite of Nomad contracts
 * on each chain within the chainConfigs array
 * including the upgradable Home, Replicas, and GovernanceRouter
 * that have been deployed, initialized, and configured
 * according to the deployNomad script
 *
 * @dev The first chain in the array will be the governing chain
 *
 * @param deploys - An array of chain deploys
 */
export async function deployHubAndSpoke(hub: CoreDeploy, spokes: CoreDeploy[]) {
  if (!hub) {
    throw new Error('Must pass hub config');
  } else if (spokes.length == 0) {
    throw new Error('Must pass at least one spoke config');
  }

  // setup array of all deploys
  const deploys = [hub, ...spokes];
  const domains = deploys.map((deploy) => deploy.chain.domain);
  if (containsDuplicateDomains(domains)) {
    throw new Error(
      'You have specified multiple deploys with the same domain. Check your config.',
    );
  }

  log('awaiting provider ready');
  await Promise.all([
    deploys.map(async (deploy) => {
      await deploy.ready();
    }),
  ]);
  log('done readying');

  log(
    `Beginning 1 Hub, ${spokes.length} Spoke${
      spokes.length > 1 ? 's' : ''
    } deploy process`,
  );
  log(`Deploy env is ${hub.config.environment}`);
  log(`${hub.chain.name} is governing hub`);
  log(
    `${JSON.stringify(spokes.map((deploy) => deploy.chain.name))} ${
      spokes.length > 1 ? 'are spokes' : 'is spoke'
    }`,
  );
  deploys.forEach((deploy) => {
    log(
      `Updater for ${deploy.chain.name} Home is ${deploy.config.updater}`,
    );
  });

  // ensure that the hub has a governor config
  if (!hub.config.governor) {
    throw new Error(`Hub has no governor config`);
  }

  // store block numbers for each chain, so that agents know where to start
  console.log('Recording starting blocks for each network...');
  await Promise.all(deploys.map((d) => d.recordFromBlock()));

  // deploy nomad on each chain
  await Promise.all(
    deploys.map(async (deploy) => {
      await deployNomad(deploy);
    }),
  );

  // enroll hub on all spoke chains
  await Promise.all(
    spokes.map(async (spoke) => {
      log(
        `connecting Spoke ${spoke.chain.name} to Hub ${hub.chain.name}`,
      );
      await enrollRemote(spoke, hub);
      log(
        `connected Spoke ${spoke.chain.name} to Hub ${hub.chain.name}`,
      );
    }),
  );

  // enroll spokes on hub chain
  //    NB: do not use Promise.all for this block. It introduces a race condition
  //    which results in multiple replica implementations on the home chain.
  //
  for (const spoke of spokes) {
    log(
      `connecting Hub ${hub.chain.name} to Spoke ${spoke.chain.name}`,
    );
    await enrollRemote(hub, spoke);
    log(
      `connected Hub ${hub.chain.name} to Spoke ${spoke.chain.name}`,
    );
  }

  // appoint the configured governance account as governor
  if (hub.config.governor) {
    log(
      `appoint governor: ${hub.config.governor.address} at ${hub.config.governor.domain}`,
    );
    // TODO: governor chain should never transfer to another domain...
    await appointGovernor(hub);
  }

  await Promise.all(
    spokes.map(async (spoke) => {
      await transferGovernorship(hub, spoke);
    }),
  );

  // relinquish control of all chains
  await Promise.all(deploys.map(relinquish));

  // checks spoke deploys are correct
  for (const spoke of spokes) {
    await checkCoreDeploy(spoke, [hub.chain.domain], hub.chain.domain);
  }

  // check hub deploy is correct
  await checkCoreDeploy(
    hub,
    spokes.map((spoke) => spoke.chain.domain),
    hub.chain.domain,
  );

  // write config outputs
  writeHubAndSpokeOutput(hub, spokes);
}
/**
 * Deploy the entire suite of Nomad contracts
 * on a single new chain
 * including the upgradable Home, Replicas, and GovernanceRouter
 * that have been deployed, initialized, and configured
 * according to the deployNomad script
 *
 * @param newDeploy - A single chain deploy for the new chain being added
 * @param hubDeploy - A governing (hub) deploy of already-deployed chain, including chain, config, and deploy.contracts.governance.proxy
 */
export async function deployNewChain(
  newDeploy: CoreDeploy,
  hubDeploy: CoreDeploy,
  oldSpokeDeploys: CoreDeploy[],
) {
  if (!newDeploy || !hubDeploy) {
    throw new Error('Bad deploy input for deployNewChain');
  }

  // log the deploy details
  log(
    `Beginning New Chain deploy process for ${newDeploy.chain.name}`,
  );
  log(`Deploy env is ${newDeploy.config.environment}`);
  log(
    `Updater for ${newDeploy.chain.name} Home is ${newDeploy.config.updater}`,
  );

  // store block numbers for new chain, so that agents know where to start
  await newDeploy.recordFromBlock();

  // wait for providers to be ready
  log('awaiting provider ready');
  await Promise.all([newDeploy.ready(), hubDeploy.ready()]);
  log('done readying');

  // START TRANSACTIONS ON NEW CHAIN
  // deploy nomad on the new chain
  await deployNomad(newDeploy);

  // deploy remotes on new spoke chain & hub chain
  log(
    `connecting ${hubDeploy.chain.name} on ${newDeploy.chain.name}`,
  );
  // deploy and enroll replica for the hub chain on the new chain
  await enrollRemote(newDeploy, hubDeploy);
  log(
    `connected ${hubDeploy.chain.name} on ${newDeploy.chain.name}`,
  );

  // transfer governorship from new deploy to hub deploy
  await transferGovernorship(hubDeploy, newDeploy);

  // relinquish control of new chain
  await relinquish(newDeploy);
  // END TRANSACTIONS ON NEW CHAIN

  // checks new chain deploy is correct
  await checkCoreDeploy(
    newDeploy,
    [hubDeploy.chain.domain],
    hubDeploy.chain.domain,
  );

  // START TRANSACTION ON HUB CHAIN
  // deploy a replica for the new chain on hub chain
  // note: this will have to be enrolled via Governance messages
  await deployUnenrolledReplica(hubDeploy, newDeploy);

  // relinquish control of newly deployed replica on Hub
  const newReplica =
    hubDeploy.contracts.replicas[newDeploy.chain.domain]!.proxy;
  const govAddress = hubDeploy.contracts.governance?.proxy.address!;

  log(
    `Transfering ownership of new replica to ${hubDeploy.chain.name} governor router`,
  );
  await newReplica.transferOwnership(govAddress, hubDeploy.overrides);
  log(
    `${hubDeploy.chain.name}: Dispatched relinquish Replica for ${newDeploy.chain.domain}`,
  );
  // END TRANSACTION ON HUB CHAIN

  writeHubAndSpokeOutput(hubDeploy, [newDeploy], oldSpokeDeploys);
}

/**
 * Copies the partial configs from the default directory to the specified directory.
 *
 * @param dir - relative path to folder where partial configs will be written
 */
export function writePartials(dir: string) {
  // make folder if it doesn't exist already
  fs.mkdirSync(dir, { recursive: true });
  const defaultDir = '../../rust/config/default';
  const partialNames = ['kathy', 'processor', 'relayer', 'updater', 'watcher'];
  // copy partial config from default directory to given directory
  for (const partialName of partialNames) {
    const filename = `${partialName}-partial.json`;
    fs.copyFile(`${defaultDir}/${filename}`, `${dir}/${filename}`, (err) => {
      if (err) {
        console.error(err);
      }
    });
  }
}

function writeOutput(
  local: CoreDeploy,
  remotes: CoreDeploy[],
  dir: string,
  isFreshDeploy = false,
) {
  const config = CoreDeploy.buildConfig(local, remotes);
  const sdk = CoreDeploy.buildSDK(local, remotes);
  const name = local.chain.name;

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    `${dir}/${name}_config.json`,
    JSON.stringify(config, null, 2),
  );
  fs.writeFileSync(`${dir}/${name}_sdk.json`, JSON.stringify(sdk, null, 2));
  fs.writeFileSync(
    `${dir}/${name}_contracts.json`,
    JSON.stringify(local.contractOutput, null, 2),
  );
  if (isFreshDeploy) {
    fs.writeFileSync(
      `${dir}/${name}_verification.json`,
      JSON.stringify(local.verificationInput, null, 2),
    );
  }
}

/**
 * Outputs the values for chains that have been deployed.
 *
 * @param deploys - The array of chain deploys
 */
export function writeDeployOutput(deploys: CoreDeploy[]) {
  log(`Have ${deploys.length} deploys`);
  const dir = getPathToDeployConfig(deploys[0].config.environment);
  for (const local of deploys) {
    // get remotes
    const remotes = deploys
      .slice()
      .filter((remote) => remote.chain.domain !== local.chain.domain);

    writeOutput(local, remotes, dir);
  }
  writePartials(dir);
}

/**
 * Outputs the values for chains that have been deployed.
 *
 * @param deploys - The array of chain deploys
 */
export function writeHubAndSpokeOutput(
  hub: CoreDeploy,
  newSpokes: CoreDeploy[],
  oldSpokes: CoreDeploy[] = [],
) {
  log(
    `Have 1 Hub and ${newSpokes.length + oldSpokes.length} Spoke deploys`,
  );

  const dir = getPathToDeployConfig(hub.config.environment);

  // write spoke outputs
  for (const spoke of newSpokes) {
    writeOutput(spoke, [hub], dir);
  }

  // write hub output
  const isFreshDeploy = oldSpokes.length == 0;
  writeOutput(hub, [...newSpokes, ...oldSpokes], dir, isFreshDeploy);

  // write partials
  writePartials(dir);
}
