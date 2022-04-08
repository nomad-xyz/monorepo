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

import { expect } from 'chai';
import { log, assertBeaconProxy } from '../utils';

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

  getReplica(nameOrDomain: string | number): contracts.Replica {
    const domain = this.context.resolveDomain(nameOrDomain);
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
    const um = await factory.deploy(utils.evmId(updater), this.overrides);
    this._data.updaterManager = um.address;
    await um.deployTransaction.wait(this.confirmations);

    // update records
    this.context.pushVerification(name, {
      name: 'UpdaterManager',
      address: um.address,
      constructorArguments: [updater],
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
    const beacon = await factory.deploy(implementation, ubc, this.overrides);
    proxy.beacon = beacon.address;
    await beacon.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'UpgradeBeacon',
      address: beacon.address,
      constructorArguments: [implementation, ubc],
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
    const prx = await factory.deploy(beacon, initData, this.overrides);
    proxy.proxy = prx.address;
    await prx.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'UpgradeBeaconProxy',
      address: prx.address,
      constructorArguments: [beacon, initData],
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
    const home = await factory.deploy(configuration.domain);
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
      address: home.address,
      constructorArguments: [configuration.domain],
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
    const router = await factory.deploy(
      config.domain,
      config.configuration.governance.recoveryTimelock,
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
      address: router.address,
      constructorArguments: [
        config.domain,
        config.configuration.governance.recoveryTimelock,
      ],
    });
  }

  async deployUnenrolledReplica(homeDomain: string | number): Promise<void> {
    const local = this.context.resolveDomainName(this.domain);
    const home = this.context.resolveDomainName(homeDomain);
    const localConfig = this.context.mustGetDomainConfig(local);
    const homeConfig = this.context.mustGetDomainConfig(home);
    const homeCore = this.context.mustGetCore(local);

    // don't redeploy existing replica
    if (this.data.replicas && this.data.replicas[home]) return;
    log(`deploy Replica for ${home} on ${local}`);

    const root = await homeCore.home.committedRoot();

    const initData =
      contracts.Replica__factory.createInterface().encodeFunctionData(
        'initialize',
        [
          homeConfig.domain,
          utils.evmId(homeConfig.configuration.updater),
          root,
          homeConfig.configuration.optimisticSeconds,
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
      const replica = await factory.deploy(
        localConfig.domain,
        localConfig.configuration.processGas,
        localConfig.configuration.reserveGas,
        // localConfig.configuration.maximumGas,  // future
        this.overrides,
      );
      await replica.deployTransaction.wait(this.confirmations);

      this.context.pushVerification(local, {
        name: 'Replica',
        address: replica.address,
        constructorArguments: [
          localConfig.domain,
          localConfig.configuration.processGas,
          localConfig.configuration.reserveGas,
        ],
      });
      proxy = await this.newProxy(replica.address, initData);
    }
    if (!this._data.replicas) this._data.replicas = {};
    this._data.replicas[home] = proxy;
  }

  async enrollReplica(
    homeDomain: string | number,
  ): Promise<CallBatch | undefined> {
    const local = this.context.resolveDomainName(this.domain);
    const home = this.context.resolveDomainName(homeDomain);
    const homeConfig = this.context.mustGetDomainConfig(home);

    const replica = this.getReplica(home)?.address;
    if (!replica)
      throw new Error(
        `Cannot enroll replica for ${home} on ${local}. Replica does not exist`,
      );

    // skip if already enrolled
    const replicaAlreadyEnrolled = await this.xAppConnectionManager.isReplica(
      replica,
    );
    if (replicaAlreadyEnrolled) return;
    log(`enroll Replica for ${home} on ${local}`);

    // Check that this key has permissions to set this
    const owner = await this.xAppConnectionManager.owner();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      const tx =
        await this.xAppConnectionManager.populateTransaction.ownerEnrollReplica(
          replica,
          homeConfig.domain,
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
      homeConfig.domain,
      this.overrides,
    );
    await tx.wait(this.confirmations);
  }

  async enrollWatchers(
    homeDomain: string | number,
  ): Promise<CallBatch | undefined> {
    const local = this.context.resolveDomainName(this.domain);
    const home = this.context.resolveDomainName(homeDomain);
    const homeConfig = this.context.mustGetDomainConfig(home);
    const localConfig = this.context.mustGetDomainConfig(local);

    // want an async filter, but this'll have to do
    // We make an array with the enrolled status of each watcher, then filter
    // the watchers based on that status array. Mapping ensures that the status
    // is at the same index as the watcher, so we use the index in the filter.
    // This allows us to skip enrolling watchers that are already enrolled
    const watchers = localConfig.configuration.watchers;
    const enrollmentStatuses = await Promise.all(
      watchers.map(async (watcher) => {
        return await this.xAppConnectionManager.watcherPermission(
          utils.evmId(watcher),
          homeConfig.domain,
        );
      }),
    );
    const watchersToEnroll = watchers.filter(
      (_, idx) => !enrollmentStatuses[idx],
    );

    if (watchersToEnroll.length == 0) return;
    log(`enroll Watchers for ${home} on ${local}`);

    // Check that this key has permissions to set this
    const owner = await this.xAppConnectionManager.owner();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      const txns = await Promise.all(
        watchersToEnroll.map(async (watcher) => {
          return await this.xAppConnectionManager.populateTransaction.setWatcherPermission(
            utils.evmId(watcher),
            homeConfig.domain,
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
          homeConfig.domain,
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
    if (!utils.equalIds(enrolledRemote, ethers.constants.AddressZero)) return;
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
  ): Promise<void> {
    if (!this.data.home)
      throw new Error(`Home is not defined for domain ${this.domain}`);
    if (!this.data.updaterManager)
      throw new Error(
        `UpdaterManager is not defined for domain ${this.domain}`,
      );
    if (!this.data.governanceRouter)
      throw new Error(
        `GovernanceRouter is not defined for domain ${this.domain}`,
      );
    const replicas = this.data.replicas;
    if (!replicas)
      throw new Error(`Replicas is not defined for domain ${this.domain}`);
    if (!this.data.upgradeBeaconController)
      throw new Error(
        `upgradeBeaconController is not defined for domain ${this.domain}`,
      );
    if (!this.data.xAppConnectionManager)
      throw new Error(
        `xAppConnectionManager is not defined for domain ${this.domain}`,
      );

    const isGovernor = governorDomain === this.domainNumber;
    const domainConfig = this.context.mustGetDomainConfig(this.domain);
    /*
    Check list:
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
    
    # UpgradeBeaconController
     * owner
    */

    //  ========= Home =========
    // Home upgrade setup contracts are defined
    assertBeaconProxy(this.data.home, 'Home');

    // updaterManager is set on Home
    const updaterManager = await this.home.updaterManager();
    expect(utils.equalIds(updaterManager, this.data.updaterManager)).to.be.true;

    // state
    const state = await this.home.state();
    expect(state).to.equal(1);

    // updater
    const homeUpdater = await this.home.updater();
    expect(utils.equalIds(homeUpdater, domainConfig.configuration.updater)).to
      .be.true;

    // localDomain
    const homeLocalDomain = await this.home.localDomain();
    expect(homeLocalDomain).to.equal(this.domainNumber);

    // owner
    const homeOwner = await this.home.owner();
    expect(utils.equalIds(homeOwner, this.governanceRouter.address)).to.be.true;

    //  ========= UpdaterManager =========
    // updater
    const updaterAtUpdaterManager = await this.updaterManager.updater();
    expect(
      utils.equalIds(
        updaterAtUpdaterManager,
        domainConfig.configuration.updater,
      ),
    ).to.be.true;

    // owner
    const updaterManagersOwner = await this.updaterManager.owner();
    expect(utils.equalIds(updaterManagersOwner, this.governanceRouter.address))
      .to.be.true;

    //  ========= xAppConnectionManager =========
    // home
    const xappHome = await this.xAppConnectionManager.home();
    expect(utils.equalIds(xappHome, this.data.home.proxy)).to.be.true;
    // owner
    const xappsOwner = await this.xAppConnectionManager.owner();
    expect(utils.equalIds(xappsOwner, this.governanceRouter.address)).to.be
      .true;

    for (const remoteDomain of remoteDomains) {
      const remoteDomainNumber =
        this.context.mustGetDomain(remoteDomain).domain;
      assertBeaconProxy(replicas[remoteDomain], `${remoteDomain}'s replica`);

      const assumedDomain = await this.xAppConnectionManager.replicaToDomain(
        replicas[remoteDomain].proxy,
      );
      expect(assumedDomain).to.equal(remoteDomainNumber);
      // domainToReplica
      const assumedReplicaAddress =
        await this.xAppConnectionManager.domainToReplica(remoteDomainNumber);
      expect(
        utils.equalIds(assumedReplicaAddress, replicas[remoteDomain].proxy),
      ).to.be.true;
      // watcherPermission

      for (const watcher of domainConfig.configuration.watchers) {
        const watcherPermission =
          await this.xAppConnectionManager.watcherPermission(
            watcher,
            remoteDomainNumber,
          );
        expect(watcherPermission).to.be.true;
      }
    }

    //  ========= GovRouter =========
    // GovernanceRouter upgrade setup contracts are defined
    assertBeaconProxy(this.data.governanceRouter, 'Governance router');
    // localDomain
    const govLocalDomain = await this.governanceRouter.localDomain();
    expect(govLocalDomain).to.equal(this.domainNumber);
    // recoveryTimelock
    const recoveryTimelock = await this.governanceRouter.recoveryTimelock();
    expect(
      ethers.BigNumber.from(
        domainConfig.configuration.governance.recoveryTimelock,
      ).toHexString(),
    ).to.equal(recoveryTimelock.toHexString());
    // recoveryActiveAt
    const recoveryActiveAt = await this.governanceRouter.recoveryActiveAt();
    expect(recoveryActiveAt.eq(0)).to.be.true;
    // recoveryManager
    const recoveryManager = await this.governanceRouter.recoveryManager();
    expect(
      utils.equalIds(
        domainConfig.configuration.governance.recoveryManager,
        recoveryManager,
      ),
    );
    // governor
    const govId = await this.governanceRouter.governor();
    if (!this.context.protocol) throw new Error('protocol config not defined');
    const expectedGovId = isGovernor
      ? this.context.protocol.governor.id
      : ethers.constants.AddressZero;
    expect(utils.equalIds(expectedGovId, govId)).to.be.true;
    // governorDomain
    const govDomain = await this.governanceRouter.governorDomain();
    const expectedGovDomain = this.context.protocol.governor.domain;
    expect(govDomain).to.equal(expectedGovDomain);
    // xAppConnectionManager
    const xAppConnectionManager =
      await this.governanceRouter.xAppConnectionManager();
    expect(
      utils.equalIds(this.data.xAppConnectionManager, xAppConnectionManager),
    ).to.be.true;
    // routers
    for (const domain of remoteDomains) {
      const remoteDomainNumber = this.context.mustGetDomain(domain).domain;
      const remoteRouter = await this.governanceRouter.routers(
        remoteDomainNumber,
      );
      expect(
        utils.equalIds(
          this.context.mustGetCore(domain).governanceRouter.address,
          remoteRouter,
        ),
      ).to.be.true;
    }
    // domains
    const connections: number[] = domainConfig.connections
      .map((d) => this.context.mustGetDomain(d).domain)
      .sort();
    const domainsOnChain: number[] = await Promise.all(
      connections.map((_, i: number) => this.governanceRouter.domains(i)),
    );
    domainsOnChain.sort();
    expect(connections.every((v, i) => v === domainsOnChain[i])).to.be.true;

    let threw = false;
    try {
      await this.governanceRouter.domains(connections.length);
    } catch (_) {
      threw = true;
    }
    expect(threw).to.be.true;

    //  ========= UpgradeBeaconController =========
    // owner
    const beaconOwner = await this.upgradeBeaconController.owner();
    expect(utils.equalIds(beaconOwner, this.governanceRouter.address)).to.be
      .true;

    if (remoteDomains.length > 0) {
      // expect all replicas to have to same implementation and upgradeBeacon
      const firstReplica = replicas[remoteDomains[0]];
      const replicaImpl = firstReplica.implementation;
      const replicaBeacon = firstReplica.beacon;
      // check every other implementation/beacon matches the first
      remoteDomains.slice(1).forEach((remoteDomain) => {
        const replica = replicas[remoteDomain];
        const implementation = replica.implementation;
        const beacon = replica.beacon;
        expect(utils.equalIds(implementation, replicaImpl));
        expect(utils.equalIds(beacon, replicaBeacon));
      });
    }
  }

  checkVerificationInput(name: string, addr: string): void {
    this.context.checkVerificationInput(this.domain, name, addr);
  }
}
