import * as config from '@nomad-xyz/configuration';
import * as contracts from '@nomad-xyz/contracts-core';
import {
  Home__factory,
  UpdaterManager__factory,
  UpgradeBeaconController__factory,
  UpgradeBeaconProxy__factory,
  UpgradeBeacon__factory,
  XAppConnectionManager__factory,
} from '@nomad-xyz/contracts-core';
import { utils } from '@nomad-xyz/multi-provider';
import { ethers } from 'ethers';
import { Call, CallBatch } from '@nomad-xyz/sdk-govern';

import Contracts from '../Contracts';
import { DeployContext } from '../DeployContext';

import { log } from '../utils';
import { CheckList } from '../Checklist';

export abstract class AbstractCoreDeploy<T> extends Contracts<T> {
  // Placeholder for future multi-VM abstraction
}

export default class EvmCoreDeploy extends AbstractCoreDeploy<config.EvmCoreContracts> {
  protected keys: ReadonlyArray<keyof config.EvmCoreContracts> = [
    'upgradeBeaconController',
    'xAppConnectionManager',
    'updaterManager',
    'governanceRouter',
    'home',
    'replicas',
    'deployHeight',
  ];

  constructor(
    context: DeployContext,
    domain: string,
    data?: config.EvmCoreContracts,
  ) {
    super(context, domain, data);
  }

  assertIsComplete(): void {
    if (!this.data.replicas) this._data.replicas = {};
    super.assertIsComplete();
  }

  get upgradeBeaconController(): contracts.UpgradeBeaconController {
    if (!this.data.upgradeBeaconController) {
      throw new Error('Missing upgradeBeaconController address');
    }
    return contracts.UpgradeBeaconController__factory.connect(
      utils.evmId(this.data.upgradeBeaconController),
      this.context.mustGetConnection(this.domain),
    );
  }

  get xAppConnectionManager(): contracts.XAppConnectionManager {
    if (!this.data.xAppConnectionManager) {
      throw new Error('Missing xAppConnectionManager address');
    }
    return contracts.XAppConnectionManager__factory.connect(
      utils.evmId(this.data.xAppConnectionManager),
      this.context.mustGetConnection(this.domain),
    );
  }

  get updaterManager(): contracts.UpdaterManager {
    if (!this.data.updaterManager) {
      throw new Error('Missing updaterManager address');
    }
    return contracts.UpdaterManager__factory.connect(
      utils.evmId(this.data.updaterManager),
      this.context.mustGetConnection(this.domain),
    );
  }

  get governanceRouter(): contracts.GovernanceRouter {
    if (!this.data.governanceRouter) {
      throw new Error('Missing governanceRouter address');
    }
    return contracts.GovernanceRouter__factory.connect(
      utils.evmId(this.data.governanceRouter.proxy),
      this.context.mustGetConnection(this.domain),
    );
  }

  get home(): contracts.Home {
    if (!this.data.home) {
      throw new Error('Missing home address');
    }
    return contracts.Home__factory.connect(
      utils.evmId(this.data.home.proxy),
      this.context.mustGetConnection(this.domain),
    );
  }

  // Returns an array containing the names of known replicas
  get replicas(): ReadonlyArray<string> {
    return Object.keys(this.data.replicas ?? {});
  }

  get deployer(): ethers.Signer {
    return this.context.getDeployer(this.domain);
  }

  get connection(): ethers.Signer | ethers.providers.Provider {
    return this.context.mustGetConnection(this.domain);
  }

  get confirmations(): number {
    const { confirmations } = this.context.mustGetDomainConfig(
      this.domain,
    ).specs;
    return utils.parseInt(confirmations);
  }

  get overrides(): ethers.Overrides {
    return this.context.overrides.get(this.domain) || {};
  }

  get domainNumber(): number {
    return this.context.resolveDomain(this.domain);
  }

  getReplica(domain: string): contracts.Replica {
    const replicas = this.data.replicas;

    if (!replicas || !replicas[domain]) {
      throw new Error(`Missing replicas address for domain ${domain}`);
    }
    return contracts.Replica__factory.connect(
      utils.evmId(replicas[domain].proxy),
      this.context.mustGetConnection(this.domain),
    );
  }

  anyReplicaProxy(): config.Proxy | undefined {
    const replicas = this.data.replicas;
    if (!replicas) return;
    const keys = Object.keys(replicas);
    const key = keys[0];
    if (!key) return;
    return replicas[key] as config.Proxy;
  }

  async recordStartBlock(): Promise<void> {
    if (this.data.deployHeight && this.data.deployHeight !== 0) return;
    const provider = this.context.mustGetProvider(this.domain);
    this._data.deployHeight = await provider.getBlockNumber();
  }

  async deployUpgradeBeaconController(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);

    // don't redeploy
    if (this.data.upgradeBeaconController) return;
    log(`deploy UBC on ${name}`);

    const factory = new UpgradeBeaconController__factory(
      this.context.getDeployer(name),
    );
    const ubc = await factory.deploy(this.overrides);
    this._data.upgradeBeaconController = ubc.address;
    await ubc.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'UpgradeBeaconController',
      specifier: contracts.UBC_SPECIFIER,
      address: ubc.address,
    });
  }

  async deployUpdaterManager(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);

    // don't redeploy
    if (this.data.updaterManager) return;
    log(`deploy UpdaterManager on ${name}`);

    // run deployment
    const updater =
      this.context.mustGetDomainConfig(name).configuration.updater;
    const factory = new UpdaterManager__factory(this.context.getDeployer(name));

    const constructorArguments = [utils.evmId(updater)];
    const um = await factory.deploy(constructorArguments[0], this.overrides);
    this._data.updaterManager = um.address;
    await um.deployTransaction.wait(this.confirmations);

    // update records
    this.context.pushVerification(name, {
      name: 'UpdaterManager',
      specifier: contracts.UPDATER_MANAGER_SPECIFIER,
      address: um.address,
      constructorArguments,
      encodedConstructorArguments:
        UpdaterManager__factory.createInterface().encodeDeploy(
          constructorArguments,
        ),
    });
  }

  async deployXAppConnectionManager(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);

    // don't redeploy
    if (this.data.xAppConnectionManager) return;
    log(`deploy xAppConnectionManager on ${name}`);

    // run deployment
    const factory = new XAppConnectionManager__factory(
      this.context.getDeployer(name),
    );
    const xcm = await factory.deploy(this.overrides);
    this._data.xAppConnectionManager = xcm.address;
    await xcm.deployTransaction.wait(this.confirmations);

    // update records
    this.context.pushVerification(name, {
      name: 'XAppConnectionManager',
      specifier: contracts.XCM_SPECIFIER,
      address: xcm.address,
    });
  }

  async deployBeacon(proxy: Partial<config.Proxy>): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);

    const implementation = proxy.implementation;
    if (!implementation)
      throw new Error('Tried to deploy beacon without initial implementation');
    // don't redeploy
    if (proxy.beacon) return;
    log(`  deploy Beacon on ${name}`);

    const ubc = this.upgradeBeaconController?.address;
    if (!ubc) throw new Error('Cannot deploy proxy without UBC');
    const factory = new UpgradeBeacon__factory(this.context.getDeployer(name));

    const constructorArguments = [implementation, ubc];
    const beacon = await factory.deploy(
      constructorArguments[0],
      constructorArguments[1],
      this.overrides,
    );
    proxy.beacon = beacon.address;
    await beacon.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'UpgradeBeacon',
      specifier: contracts.UPGRADE_BEACON_SPECIFIER,
      address: beacon.address,
      constructorArguments,
      encodedConstructorArguments:
        UpgradeBeacon__factory.createInterface().encodeDeploy(
          constructorArguments,
        ),
    });
  }

  async deployProxy(
    initData: ethers.BytesLike,
    proxy: Partial<config.Proxy>,
  ): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    log(`  deploy Proxy on ${name}`);

    const beacon = proxy.beacon;
    if (!beacon) throw new Error('Tried to deploy proxy without beacon');

    const factory = new UpgradeBeaconProxy__factory(
      this.context.getDeployer(name),
    );
    const constructorArguments = [beacon, initData];
    const prx = await factory.deploy(
      beacon, // constructorArguments[0],
      constructorArguments[1],
      this.overrides,
    );

    proxy.proxy = prx.address;
    await prx.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'UpgradeBeaconProxy',
      specifier: contracts.UBP_SPECIFIER,
      address: prx.address,
      constructorArguments,
      encodedConstructorArguments:
        UpgradeBeaconProxy__factory.createInterface().encodeDeploy(
          constructorArguments,
        ),
    });
  }

  async newProxy(
    implementation: string,
    initData: ethers.BytesLike,
  ): Promise<config.Proxy> {
    const proxy = { implementation };

    await this.deployBeacon(proxy);
    await this.deployProxy(initData, proxy);

    return proxy as config.Proxy;
  }

  async duplicateProxy(
    proxy: config.Proxy,
    initData: ethers.BytesLike,
  ): Promise<config.Proxy> {
    const newProxy = {
      implementation: proxy.implementation,
      beacon: proxy.beacon,
    };
    await this.deployProxy(initData, newProxy);
    return newProxy as config.Proxy;
  }

  // This function MUST be called at deploy time. If deployer is not still
  // governor on this core, it will error.
  //
  // TODO: make this gracefully handle post-deploy home switching by returning
  // a `ethers.PopulatedTransaction[]`
  async deployHome(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);

    // don't redeploy
    if (this.data.home) return;
    log(`deploy Home on ${name}`);

    const updaterManager = this.updaterManager?.address;
    if (!updaterManager)
      throw new Error("Can't deploy home without updater manager");

    const configuration = this.context.mustGetDomainConfig(this.domain);

    const factory = new Home__factory(this.context.getDeployer(this.domain));

    const constructorArguments = [configuration.domain];
    const home = await factory.deploy(constructorArguments[0], this.overrides);

    await home.deployTransaction.wait(this.confirmations);

    const initData = Home__factory.createInterface().encodeFunctionData(
      'initialize',
      [updaterManager],
    );

    const proxy = await this.newProxy(home.address, initData);
    this._data.home = proxy;

    await Promise.all([
      this.xAppConnectionManager.setHome(proxy.proxy),
      this.updaterManager.setHome(proxy.proxy),
    ]);

    this.context.pushVerification(name, {
      name: 'Home',
      specifier: contracts.HOME_SPECIFIER,
      address: home.address,
      constructorArguments,
      encodedConstructorArguments:
        contracts.Home__factory.createInterface().encodeDeploy(
          constructorArguments,
        ),
    });
  }

  async deployGovernanceRouter(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    // don't redeploy
    if (this.data.governanceRouter) return;
    log(`deploy GovernanceRouter ${name}`);

    const xAppConnectionManager = this.xAppConnectionManager?.address;
    if (!xAppConnectionManager)
      throw new Error(
        'Tried to deploy governance router without xappconnectionmanager',
      );

    const config = this.context.mustGetDomainConfig(this.domain);

    const factory = new contracts.GovernanceRouter__factory(
      this.context.getDeployer(this.domain),
    );

    const constructorArguments = [
      config.domain,
      config.configuration.governance.recoveryTimelock,
    ];
    const router = await factory.deploy(
      constructorArguments[0],
      constructorArguments[1],
      this.overrides,
    );
    await router.deployTransaction.wait(this.confirmations);

    const initData =
      contracts.GovernanceRouter__factory.createInterface().encodeFunctionData(
        'initialize',
        [
          xAppConnectionManager,
          utils.evmId(config.configuration.governance.recoveryManager),
        ],
      );
    const proxy = await this.newProxy(router.address, initData);
    this._data.governanceRouter = proxy;
    this.context.pushVerification(name, {
      name: 'GovernanceRouter',
      specifier: contracts.GOVERNANCE_ROUTER_SPECIFIER,
      address: router.address,
      constructorArguments,
      encodedConstructorArguments:
        contracts.GovernanceRouter__factory.createInterface().encodeDeploy(
          constructorArguments,
        ),
    });
  }

  async deployUnenrolledReplica(remoteDomain: string | number): Promise<void> {
    const local = this.context.resolveDomainName(this.domain);
    const remote = this.context.resolveDomainName(remoteDomain);
    const localConfig = this.context.mustGetDomainConfig(local);
    const remoteConfig = this.context.mustGetDomainConfig(remote);
    const remoteCore = this.context.mustGetCore(remote);

    // don't redeploy existing replica
    if (this.data.replicas && this.data.replicas[remote]) return;
    log(`deploy Replica for ${remote} on ${local}`);

    const root = await remoteCore.home.committedRoot();

    const initData =
      contracts.Replica__factory.createInterface().encodeFunctionData(
        'initialize',
        [
          remoteConfig.domain,
          utils.evmId(remoteConfig.configuration.updater),
          root,
          remoteConfig.configuration.optimisticSeconds,
        ],
      );

    const anyReplicaProxy = this.anyReplicaProxy();

    let proxy;
    if (anyReplicaProxy) {
      proxy = await this.duplicateProxy(anyReplicaProxy, initData);
    } else {
      const factory = new contracts.Replica__factory(
        this.context.getDeployer(local),
      );

      const constructorArguments = [localConfig.domain];
      const replica = await factory.deploy(
        constructorArguments[0],
        this.overrides,
      );
      await replica.deployTransaction.wait(this.confirmations);

      this.context.pushVerification(local, {
        name: 'Replica',
        specifier: contracts.REPLICA_SPECIFIER,
        address: replica.address,
        constructorArguments,
        encodedConstructorArguments:
          contracts.Replica__factory.createInterface().encodeDeploy(
            constructorArguments,
          ),
      });
      proxy = await this.newProxy(replica.address, initData);
    }
    if (!this._data.replicas) this._data.replicas = {};
    this._data.replicas[remote] = proxy;
  }

  async enrollReplica(
    remoteDomain: string | number,
  ): Promise<CallBatch | undefined> {
    const local = this.context.resolveDomainName(this.domain);
    const remote = this.context.resolveDomainName(remoteDomain);
    const remoteConfig = this.context.mustGetDomainConfig(remote);

    const replica = this.getReplica(remote)?.address;
    if (!replica)
      throw new Error(
        `Cannot enroll replica for ${remote} on ${local}. Replica does not exist`,
      );

    // skip if already enrolled
    const replicaAlreadyEnrolled = await this.xAppConnectionManager.isReplica(
      replica,
    );
    if (replicaAlreadyEnrolled) return;
    log(`enroll Replica for ${remote} on ${local}`);

    // Check that this key has permissions to set this
    const owner = await this.xAppConnectionManager.owner();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      const tx =
        await this.xAppConnectionManager.populateTransaction.ownerEnrollReplica(
          replica,
          remoteConfig.domain,
          this.overrides,
        );
      const batch = CallBatch.fromContext(this.context.asNomadContext);
      // safe as populateTransaction always sets `to`
      batch.push(this.domainNumber, tx as Call);
      return batch;
    }

    // If we can use deployer ownership
    const tx = await this.xAppConnectionManager.ownerEnrollReplica(
      replica,
      remoteConfig.domain,
      this.overrides,
    );
    await tx.wait(this.confirmations);
  }

  async enrollWatchers(
    remoteDomain: string | number,
  ): Promise<CallBatch | undefined> {
    const local = this.context.resolveDomainName(this.domain);
    const remote = this.context.resolveDomainName(remoteDomain);
    const remoteConfig = this.context.mustGetDomainConfig(remote);

    // want an async filter, but this'll have to do
    // We make an array with the enrolled status of each watcher, then filter
    // the watchers based on that status array. Mapping ensures that the status
    // is at the same index as the watcher, so we use the index in the filter.
    // This allows us to skip enrolling watchers that are already enrolled
    const watchers = remoteConfig.configuration.watchers;

    const enrollmentStatuses = await Promise.all(
      watchers.map(async (watcher) => {
        return await this.xAppConnectionManager.watcherPermission(
          utils.evmId(watcher),
          remoteConfig.domain,
        );
      }),
    );
    const watchersToEnroll = watchers.filter(
      (_, idx) => !enrollmentStatuses[idx],
    );

    if (watchersToEnroll.length == 0) return;
    log(`enroll Watchers for ${remote} on ${local}`);

    // Check that this key has permissions to set this
    const owner = await this.xAppConnectionManager.owner();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      const txns = await Promise.all(
        watchersToEnroll.map(async (watcher) => {
          return await this.xAppConnectionManager.populateTransaction.setWatcherPermission(
            utils.evmId(watcher),
            remoteConfig.domain,
            true,
            this.overrides,
          );
        }),
      );

      const batch = CallBatch.fromContext(this.context.asNomadContext);
      // safe as populateTransaction always sets `to`
      batch.push(this.domainNumber, txns as Call[]);
      return batch;
    }

    // If we can use deployer ownership
    const txns = await Promise.all(
      watchersToEnroll.map((watcher) =>
        this.xAppConnectionManager.setWatcherPermission(
          utils.evmId(watcher),
          remoteConfig.domain,
          true,
          this.overrides,
        ),
      ),
    );
    await Promise.race(txns.map((tx) => tx.wait(this.confirmations)));
    return;
  }

  async enrollGovernanceRouter(
    remoteDomain: string | number,
  ): Promise<CallBatch | undefined> {
    const local = this.context.resolveDomainName(this.domain);
    const remote = this.context.resolveDomainName(remoteDomain);
    const remoteCore = this.context.mustGetCore(remote);
    const remoteConfig = this.context.mustGetDomainConfig(remote);

    // don't re-enroll if already enrolled
    const enrolledRemote = await this.governanceRouter.routers(
      remoteConfig.domain,
    );
    if (utils.equalIds(enrolledRemote, remoteCore.governanceRouter.address))
      return;
    log(`enroll GovernanceRouter for ${remote} on ${local}`);

    // Check that this key has permissions to set this
    const owner = await this.governanceRouter.governor();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      const call =
        await this.governanceRouter.populateTransaction.setRouterLocal(
          remoteConfig.domain,
          utils.canonizeId(remoteCore.governanceRouter.address),
        );
      const batch = CallBatch.fromContext(this.context.asNomadContext);
      // safe as populateTransaction always sets `to`
      batch.push(this.domainNumber, call as Call);
      return batch;
    }

    // If we can use deployer ownership
    const tx = await this.governanceRouter.setRouterLocal(
      remoteConfig.domain,
      utils.canonizeId(remoteCore.governanceRouter.address),
    );
    await tx.wait(this.confirmations);
    return;
  }

  async enrollRemote(remoteDomain: string | number): Promise<CallBatch> {
    await this.deployUnenrolledReplica(remoteDomain);
    const batches = await Promise.all([
      this.enrollReplica(remoteDomain),
      this.enrollWatchers(remoteDomain),
      this.enrollGovernanceRouter(remoteDomain),
    ]);

    return CallBatch.flatten(this.context.asNomadContext, batches);
  }

  async relinquish(): Promise<void> {
    const local = this.context.resolveDomainName(this.domain);
    const governance = this.governanceRouter.address;
    const deployer = await this.deployer.getAddress();

    const contracts = [
      this.updaterManager,
      this.xAppConnectionManager,
      this.upgradeBeaconController,
      this.home,
      ...this.replicas.map((domain) => this.getReplica(domain)),
    ];

    // conditional to avoid erroring
    const txns = await Promise.all(
      contracts.map(async (contract) => {
        const owner = await contract.owner();
        if (utils.equalIds(owner, deployer)) {
          log(`transfer core ownership on ${local}`);
          return await contract.transferOwnership(governance, this.overrides);
        }
      }),
    );

    await Promise.race(
      txns.map(async (tx) => {
        if (tx) await tx.wait();
      }),
    );
  }

  /// Transfers governorship on this core to the appropriate remote domain or
  /// local address. If this is not run during deploy time (i.e. while the
  /// deployer owns the governance router) this instead returns a list of
  /// governance transactions that must be made in order to transfer
  /// governorship
  async appointGovernor(): Promise<void> {
    const governor = this.context.data.protocol.governor;
    const local = this.context.resolveDomainName(this.domain);
    const localDomain = this.context.resolveDomain(this.domain);

    // Check that the deployer key has permissions to transfer governor
    const owner = await this.governanceRouter.governor();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If the deployer key DOES have permissions to transfer governor,
    if (utils.equalIds(owner, deployer)) {
      // if the deployer key is the rightful governor, don't attempt to transfer gov
      if (utils.equalIds(owner, governor.id) && governor.domain == localDomain)
        return;
      log(`appoint governor on ${local}`);

      // submit transaction to transfer governor
      const tx = await this.governanceRouter.transferGovernor(
        governor.domain,
        utils.evmId(governor.id),
        this.overrides,
      );
      await tx.wait(this.confirmations);
    }
  }

  async checkDeploy(
    remoteDomains: string[],
    governorDomain: number,
  ): Promise<CheckList> {
    const checklist = new CheckList(`${this.domain.toUpperCase()}`, 'CORE');
    // What's the purpose of this checks? If I remove them from from the config, I get an error from parsing the config
    checklist.addCheck({
      msg: `Home is in config`,
      check: () => checklist.exists(this.data.home),
    });
    checklist.addCheck({
      msg: 'Home BeaconProxy is in config',
      check: () => checklist.assertBeaconProxy(this.data.home),
    });
    checklist.addCheck({
      msg: `UpdaterManager is in config`,
      check: () => checklist.exists(this.data.updaterManager),
    });
    checklist.addCheck({
      msg: `GovernanceRouter is in config`,
      check: () => checklist.exists(this.data.governanceRouter),
    });
    checklist.addCheck({
      msg: `UpgradeBeaconController is in config`,
      check: () => checklist.exists(this.data.upgradeBeaconController),
    });
    checklist.addCheck({
      msg: `xAppConnectionManager is in config`,
      check: () => checklist.exists(this.data.xAppConnectionManager),
    });
    checklist.addCheck({
      msg: 'Replicas are in config',
      check: () => checklist.exists(this.data.replicas),
    });
    // protocol
    checklist.addCheck({
      msg: 'Protocol is in config',
      check: () => checklist.exists(this.context.protocol),
    });

    const isGovernor = governorDomain === this.domainNumber;
    const domainConfig = this.context.mustGetDomainConfig(this.domain);

    /*
    Check list:
    # UpgradeBeaconController
     * owner

    # Home
     * updaterManager
     * state
     * updater
     * localDomain
     * onwer

    # UpdaterManager
     * updater
     * owner

    # xAppConnectionManager
     * home
     * owner
     * replicaToDomain
     * domainToReplica
     * watcherPermission

    # GovernanceRouter
     * localDomain
     * recoveryTimelock
     * recoveryActiveAt
     * recoveryManager
     * governor
     * governorDomain
     * xAppConnectionManager
     * routers
     * domains
    */

    //  ========= UpgradeBeaconController =========
    // owner
    checklist.addCheck({
      msg: 'UpgradeBeacon Controller is owned by the Governance Router',
      check: async () => {
        const beaconOwner = await this.upgradeBeaconController.owner();
        checklist.equalIds(beaconOwner, this.governanceRouter.address);
      },
    });

    //  ========= Home =========
    // updaterManager is set on Home
    checklist.addCheck({
      msg: 'Home UpdaterManager is correctly configured',
      check: async () => {
        const updaterManager = await this.home.updaterManager();
        checklist.equalIds(updaterManager, this.data.updaterManager);
      },
    });
    // state
    checklist.addCheck({
      msg: 'Home state is active',
      check: async () => {
        const state = await this.home.state();
        checklist.equals(1, state);
      },
    });
    // updater
    checklist.addCheck({
      msg: 'Home Updater is correctly configured',
      check: async () => {
        const homeUpdater = await this.home.updater();
        checklist.equalIds(homeUpdater, domainConfig.configuration.updater);
      },
    });
    // localDomain
    checklist.addCheck({
      msg: 'Home local domain is correctly configured',
      check: async () => {
        const homeLocalDomain = await this.home.localDomain();
        checklist.equals(homeLocalDomain, this.domainNumber);
      },
    });
    // owner
    checklist.addCheck({
      msg: 'Home is owned by the GovernanceRouter',
      check: async () => {
        const homeowner = await this.home.owner();
        checklist.equalIds(homeowner, this.governanceRouter.address);
      },
    });

    //  ========= UpdaterManager =========
    // updater
    checklist.addCheck({
      msg: 'UpdaterManager Updater is correctly configured',
      check: async () => {
        const updater = await this.updaterManager.updater();
        checklist.equalIds(updater, domainConfig.configuration.updater);
      },
    });
    //owner
    checklist.addCheck({
      msg: 'UpdaterManager is owned by the GovernanceRouter',
      check: async () => {
        const owner = await this.updaterManager.owner();
        checklist.equalIds(owner, this.governanceRouter.address);
      },
    });

    //  ========= xAppConnectionManager =========
    // home
    checklist.addCheck({
      msg: `xAppConnectionManager Home is correctly configured`,
      check: async () => {
        const home = await this.xAppConnectionManager.home();
        checklist.equalIds(home, this.data.home?.proxy);
      },
    });

    // owner
    checklist.addCheck({
      msg: 'xAppConnectionManager is owned by the GovernanceRouter',
      check: async () => {
        const owner = await this.xAppConnectionManager.owner();
        checklist.equalIds(owner, this.governanceRouter.address);
      },
    });

    //  ========= GovernanceRouter =========
    // GovernanceRouter upgrade setup contracts are defined
    // localDomain
    checklist.addCheck({
      msg: 'GovernanceRouter localDomain is correctly configured',
      check: async () => {
        const govLocalDomain = await this.governanceRouter.localDomain();
        checklist.equals(this.domainNumber, govLocalDomain);
      },
    });
    // recoveryTimelock
    checklist.addCheck({
      msg: 'GovernaceRouter recoveryTimeLock is correctly configured',
      check: async () => {
        const recoveryTimeLock = await this.governanceRouter.recoveryTimelock();
        checklist.equals(
          ethers.BigNumber.from(
            domainConfig.configuration.governance.recoveryTimelock,
          ).toHexString(),
          recoveryTimeLock.toHexString(),
        );
      },
    });
    // recoveryActiveAt
    checklist.addCheck({
      msg: 'GovernanceRouter recovery is not initiated',
      check: async () => {
        const recoveryActiveAt = await this.governanceRouter.recoveryActiveAt();
        checklist.equals(true, recoveryActiveAt.eq(0));
      },
    });
    // recoveryManager
    checklist.addCheck({
      msg: 'GovernanceRouter RecoveryManager address is properly set',
      check: async () => {
        const recoveryManager = await this.governanceRouter.recoveryManager();
        checklist.equalIds(
          domainConfig.configuration.governance.recoveryManager,
          recoveryManager,
        );
      },
    });
    checklist.addCheck({
      msg: 'Governor Address is correctly configured',
      check: async () => {
        const govId = await this.governanceRouter.governor();
        const expectedGovId = isGovernor
          ? this.context.protocol?.governor?.id
          : ethers.constants.AddressZero;
        checklist.equals(expectedGovId, govId);
      },
    });
    checklist.addCheck({
      msg: 'Governor Domain is correctly configured',
      check: async () => {
        const govDomain = await this.governanceRouter.governorDomain();
        const expectedGovDomain = this.context.protocol?.governor?.domain;
        checklist.equals(expectedGovDomain, govDomain);
      },
    });
    checklist.addCheck({
      msg: 'GovernanceRouter xAppConnectionManager is correctly configured',
      check: async () => {
        const xAppConnectionManager =
          await this.governanceRouter.xAppConnectionManager();
        checklist.equalIds(
          xAppConnectionManager,
          this.data.xAppConnectionManager?.toString(),
        );
      },
    });

    for (const remoteDomain of remoteDomains) {
      const remoteDomainPrint = CheckList.colorDomain(remoteDomain);
      const remoteDomainNumber =
        this.context.mustGetDomain(remoteDomain).domain;
      const replica = this.getReplica(remoteDomain);
      const remoteConfig = this.context.mustGetDomainConfig(remoteDomain);

      //  ========= Replica =========
      checklist.addCheck({
        msg: `Replica for ${remoteDomainPrint} Updater is correctly configured`,
        check: async () => {
          const replicaUpdater = await replica.updater();
          const configUpdater = remoteConfig.configuration.updater;
          checklist.equalIds(replicaUpdater, configUpdater);
        },
      });
      checklist.addCheck({
        msg: `Replica for ${remoteDomainPrint} is owned by the GovernanceRouter`,
        check: async () => {
          const replicaOwner = await replica.owner();
          checklist.equalIds(replicaOwner, this.governanceRouter.address);
        },
      });

      //  ========= Remote Enrollment =========
      // replicaToDomain
      checklist.addCheck({
        msg: `Replica for ${remoteDomainPrint} is enrolled in the xAppConnectionManager (replicaToDomain)`,
        check: async () => {
          const assumedDomain =
            await this.xAppConnectionManager.replicaToDomain(replica.address);
          checklist.equals(remoteDomainNumber, assumedDomain);
        },
      });
      // domainToReplica
      checklist.addCheck({
        msg: `Replica for ${remoteDomainPrint} is enrolled in the xAppConnectionManager (domainToReplica)`,
        check: async () => {
          const assumedReplicaAddress =
            await this.xAppConnectionManager.domainToReplica(
              remoteDomainNumber,
            );
          checklist.equalIds(assumedReplicaAddress, replica.address);
        },
      });
      // watcher permissions
      for (const watcher of remoteConfig.configuration.watchers) {
        const abbrevWatcher = watcher.slice(0, 6) + '...';
        checklist.addCheck({
          msg: `Watcher permissions for ${abbrevWatcher} on ${remoteDomainPrint} are configured`,
          check: async () => {
            const watcherPermission =
              await this.xAppConnectionManager.watcherPermission(
                watcher,
                remoteDomainNumber,
              );
            checklist.equals(true, watcherPermission);
          },
        });
      }
      // governance router enrolled
      checklist.addCheck({
        msg: `Governance Router for ${remoteDomainPrint} is enrolled`,
        check: async () => {
          const remoteRouter = await this.governanceRouter.routers(
            remoteDomainNumber,
          );
          checklist.equalIds(
            this.context.mustGetCore(remoteDomainNumber).governanceRouter
              .address,
            remoteRouter,
          );
        },
      });
    }
    await checklist.executeChecks();
    return checklist;
  }

  checkVerificationInput(name: string, addr: string): void {
    this.context.checkVerificationInput(this.domain, name, addr);
  }
}
