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

import Contracts from '../Contracts';
import DeployContext from '../DeployContext';

import { expect } from 'chai';
import { assertBeaconProxy } from '../utils';

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

  checkComplete(): void {
    if (!this.data.replicas) this._data.replicas = {};
    super.checkComplete();
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

    const homeCore = this.context.mustGetCore(local);

    const localConfig = this.context.mustGetDomainConfig(local);
    const homeConfig = this.context.mustGetDomainConfig(home);

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
  ): Promise<ethers.PopulatedTransaction[]> {
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
    if (replicaAlreadyEnrolled) return [];

    // Check that this key has permissions to set this
    const owner = await this.xAppConnectionManager.owner();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      return [
        await this.xAppConnectionManager.populateTransaction.ownerEnrollReplica(
          replica,
          homeConfig.domain,
          this.overrides,
        ),
      ];
    }

    // If we can use deployer ownership
    const tx = await this.xAppConnectionManager.ownerEnrollReplica(
      replica,
      homeConfig.domain,
      this.overrides,
    );
    await tx.wait(this.confirmations);
    return [];
  }

  async enrollWatchers(
    homeDomain: string | number,
  ): Promise<ethers.PopulatedTransaction[]> {
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
      return txns.filter(
        (x) => x !== undefined,
      ) as Array<ethers.PopulatedTransaction>;
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
    return [];
  }

  async enrollGovernanceRouter(
    remoteDomain: string | number,
  ): Promise<ethers.PopulatedTransaction[]> {
    const remote = this.context.resolveDomainName(remoteDomain);
    const remoteCore = this.context.mustGetCore(remote);
    const remoteConfig = this.context.mustGetDomainConfig(remote);

    // Check that this key has permissions to set this
    const owner = await this.governanceRouter.governor();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      return [
        await this.governanceRouter.populateTransaction.setRouterLocal(
          remoteConfig.domain,
          utils.canonizeId(remoteCore.governanceRouter.address),
        ),
      ];
    }

    // If we can use deployer ownership
    const tx = await this.governanceRouter.setRouterLocal(
      remoteConfig.domain,
      utils.canonizeId(remoteCore.governanceRouter.address),
    );
    await tx.wait(this.confirmations);
    return [];
  }

  async enrollRemote(
    remoteDomain: string | number,
  ): Promise<ethers.PopulatedTransaction[]> {
    await this.deployUnenrolledReplica(remoteDomain);
    const txns = await Promise.all([
      this.enrollReplica(remoteDomain),
      this.enrollWatchers(remoteDomain),
      this.enrollGovernanceRouter(remoteDomain),
    ]);
    return txns.flat();
  }

  async relinquish(): Promise<void> {
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

    // Check that the deployer key has permissions to transfer governor
    const owner = await this.governanceRouter.governor();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If the deployer key DOES have permissions to transfer governor,
    if (utils.equalIds(owner, deployer)) {
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
    // Home upgrade setup contracts are defined
    assertBeaconProxy(this.data.home, 'Home');

    // updaterManager is set on Home
    const updaterManager = await this.home.updaterManager();
    expect(utils.equalIds(updaterManager, this.data.updaterManager));

    // GovernanceRouter upgrade setup contracts are defined
    assertBeaconProxy(this.data.governanceRouter, 'Governance router');

    for (const domain of remoteDomains) {
      const domainNumber = this.context.mustGetDomain(domain).domain;
      // Replica upgrade setup contracts are defined
      assertBeaconProxy(replicas[domain], `${domain}'s replica`); // deploy.contracts.replicas[domain]!
      // governanceRouter for remote domain is registered
      const registeredRouter = await this.governanceRouter.routers(
        domainNumber,
      );
      expect(!utils.equalIds(registeredRouter, ethers.constants.AddressZero));
      // replica is enrolled in xAppConnectionManager
      const enrolledReplica = await this.xAppConnectionManager.domainToReplica(
        domainNumber,
      );
      expect(!utils.equalIds(enrolledReplica, ethers.constants.AddressZero));

      const owner = await this.xAppConnectionManager.owner();
      const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

      if (utils.equalIds(owner, deployer)) {
        const watchers =
        this.context.data.protocol.networks[this.domain].configuration.watchers;
        //watchers have permission in xAppConnectionManager
        watchers.forEach(async (watcher) => {
          const watcherPermissions =
            await this.xAppConnectionManager.watcherPermission(
              utils.evmId(watcher),
              domainNumber,
            );
          expect(watcherPermissions, `Watcher of '${this.domain}' at remote '${domain}' doesn't have permissions`).to.be.true;
        });
      }
    }

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

    // contracts are defined
    expect(this.data.updaterManager).to.not.be.undefined;
    expect(this.data.upgradeBeaconController).to.not.be.undefined;
    expect(this.data.xAppConnectionManager).to.not.be.undefined;

    // governor is set on governor chain, empty on others
    const gov = await this.governanceRouter.governor();
    const localDomain = await this.home.localDomain();
    if (governorDomain == localDomain) {
      expect(!utils.equalIds(gov, ethers.constants.AddressZero));
    } else {
      expect(utils.equalIds(gov, ethers.constants.AddressZero));
    }
    // governor domain is correct
    expect(
      await this.governanceRouter.governorDomain(),
      `this domain: ${this.domain} want ${governorDomain}`,
    ).to.equal(governorDomain);

    // Home is set on xAppConnectionManager
    const xAppManagerHome = await this.xAppConnectionManager.home();
    const homeAddress = this.data.home.proxy;
    expect(utils.equalIds(xAppManagerHome, homeAddress));

    // governance has ownership over following contracts
    const updaterManagerOwner = await this.updaterManager.owner();
    const xAppManagerOwner = await this.xAppConnectionManager.owner();
    const beaconOwner = await this.upgradeBeaconController.owner();
    const homeOwner = await this.home.owner();
    const governorAddr = this.data.governanceRouter.proxy;
    expect(utils.equalIds(updaterManagerOwner, governorAddr));
    expect(utils.equalIds(xAppManagerOwner, governorAddr));
    expect(utils.equalIds(beaconOwner, governorAddr));
    expect(utils.equalIds(homeOwner, governorAddr));

    // check verification addresses
    // TODO: add beacon and proxy where needed.
  }

  checkVerificationInput(name: string, addr: string): void {
    this.context.checkVerificationInput(this.domain, name, addr);
  }
}
