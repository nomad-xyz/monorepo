import * as contracts from '@nomad-xyz/contracts-bridge';
import {
  UBP_SPECIFIER,
  UpgradeBeaconController__factory,
  UpgradeBeaconProxy__factory,
  UpgradeBeacon__factory,
  UPGRADE_BEACON_SPECIFIER,
} from '@nomad-xyz/contracts-core';

import { ethers } from 'ethers';
import { utils } from '@nomad-xyz/multi-provider';
import * as config from '@nomad-xyz/configuration';

import Contracts from '../Contracts';
import { DeployContext } from '../DeployContext';
import { log, assertBeaconProxy } from '../utils';
import { expect } from 'chai';
import { Call, CallBatch } from '@nomad-xyz/sdk-govern';

export abstract class AbstractBridgeDeploy<T> extends Contracts<T> {
  // Placeholder for future multi-VM abstraction
}

export default class BridgeContracts extends AbstractBridgeDeploy<config.EvmBridgeContracts> {
  protected keys: ReadonlyArray<keyof config.EvmBridgeContracts> = [
    'bridgeRouter',
    'tokenRegistry',
    'bridgeToken',
    'deployHeight',
  ];

  constructor(
    context: DeployContext,
    domain: string,
    data?: config.EvmBridgeContracts,
  ) {
    super(context, domain, data);
  }

  assertIsComplete(): void {
    if (!this.data.customs) this._data.customs = [];
    super.assertIsComplete();
  }

  get domainNumber(): number {
    return this.context.resolveDomain(this.domain);
  }

  get deployer(): ethers.Signer {
    return this.context.getDeployer(this.domain);
  }

  get connection(): ethers.Signer | ethers.providers.Provider {
    return this.context.mustGetConnection(this.domain);
  }

  get overrides(): ethers.Overrides | undefined {
    return this.context.overrides.get(this.domain);
  }

  get confirmations(): number {
    const { confirmations } = this.context.mustGetDomainConfig(
      this.domain,
    ).specs;
    return utils.parseInt(confirmations);
  }

  get bridgeRouterContract(): contracts.BridgeRouter {
    if (!this.data.bridgeRouter) {
      throw new Error('Missing bridgeRouter address');
    }
    return contracts.BridgeRouter__factory.connect(
      utils.evmId(this.data.bridgeRouter.proxy),
      this.connection,
    );
  }

  set bridgeRouter(proxy: config.Proxy) {
    this._data.bridgeRouter = proxy;
  }

  get tokenRegistryContract(): contracts.TokenRegistry {
    if (!this.data.tokenRegistry) {
      throw new Error('Missing tokenRegistry address');
    }
    return contracts.TokenRegistry__factory.connect(
      utils.evmId(this.data.tokenRegistry.proxy),
      this.connection,
    );
  }

  set tokenRegistry(proxy: config.Proxy) {
    this._data.tokenRegistry = proxy;
  }

  get ethHelperContract(): contracts.ETHHelper | undefined {
    if (!this.data.ethHelper) return undefined;

    return contracts.ETHHelper__factory.connect(
      utils.evmId(this.data.ethHelper),
      this.connection,
    );
  }

  set ethHelper(address: string) {
    this._data.ethHelper = address;
  }

  async recordStartBlock(): Promise<void> {
    if (this.data.deployHeight && this.data.deployHeight !== 0) return;
    const provider = this.context.mustGetProvider(this.domain);
    this._data.deployHeight = await provider.getBlockNumber();
  }

  private async deployTokenImplementation(): Promise<
    Partial<config.Proxy | undefined>
  > {
    const name = this.context.resolveDomainName(this.domain);

    // don't redeploy
    if (this.data.bridgeToken?.implementation) return;

    const factory = new contracts.BridgeToken__factory(this.deployer);
    const impl = await factory.deploy(this.overrides);
    await impl.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'BridgeToken',
      specifier: contracts.BRIDGE_TOKEN_SPECIFIER,
      address: impl.address,
    });

    return {
      implementation: impl.address,
    };
  }

  // TODO: DRY
  private async deployProxy(
    initData: ethers.BytesLike,
    proxy: Partial<config.Proxy>,
  ): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const beacon = proxy.beacon;
    if (!beacon) throw new Error('Tried to deploy proxy without beacon');
    if (proxy.proxy) return; // don't redploy
    log(`  deploy Proxy on ${name}`);

    const factory = new UpgradeBeaconProxy__factory(
      this.context.getDeployer(name),
    );

    const constructorArguments = [beacon, initData];
    const prx = await factory.deploy(
      beacon, //constructorArguments[0],
      constructorArguments[1],
      this.overrides,
    );
    proxy.proxy = prx.address;
    await prx.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'UpgradeBeaconProxy',
      specifier: UBP_SPECIFIER,
      address: prx.address,
      constructorArguments,
      encodedConstructorArguments:
        UpgradeBeaconProxy__factory.createInterface().encodeDeploy(
          constructorArguments,
        ),
    });
  }

  private async deployBeacon(proxy: Partial<config.Proxy>): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const core = this.context.mustGetCore(this.domain);
    const implementation = proxy.implementation;
    if (!implementation)
      throw new Error('Tried to deploy beacon without initial implementation');
    // don't redeploy
    if (proxy.beacon) return;
    log(`  deploy Beacon on ${name}`);

    const ubc = core.upgradeBeaconController.address;
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
      specifier: UPGRADE_BEACON_SPECIFIER,
      address: beacon.address,
      constructorArguments,
      encodedConstructorArguments:
        UpgradeBeacon__factory.createInterface().encodeDeploy(
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

  async deployTokenUpgradeBeacon(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);

    // ensure the implementation exists. An undefined return value indicates
    // that the implementation already exists
    const proxy =
      (await this.deployTokenImplementation()) ?? this.data.bridgeToken;
    if (!proxy) throw new utils.UnreachableError();

    const implAddress = proxy?.implementation;
    if (!implAddress) throw new utils.UnreachableError();

    // don't redeploy
    if (proxy?.beacon) return;
    log(`deploy BridgeToken UGB on ${name}`);

    await this.deployBeacon(proxy);
    proxy.proxy = ethers.constants.AddressZero;
    this._data.bridgeToken = proxy as config.Proxy;
  }

  async deployTokenRegistry(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const core = this.context.mustGetCore(this.domain);
    // don't redeploy
    if (this.data.tokenRegistry) return;
    log(`deploy TokenRegistry on ${name}`);

    // preconditions
    if (!this.data.bridgeToken?.beacon || this.data.bridgeToken?.beacon === '')
      throw new Error('Must have bridge token beacon to deploy registry');
    if (this.data.bridgeToken?.implementation === '')
      throw new Error('Must have bridge token impl to deploy registry');

    const initData =
      contracts.TokenRegistry__factory.createInterface().encodeFunctionData(
        'initialize',
        [this.data.bridgeToken.beacon, core.xAppConnectionManager.address],
      );

    const factory = new contracts.TokenRegistry__factory(this.deployer);
    const implementation = await factory.deploy(this.overrides);

    this._data.tokenRegistry = await this.newProxy(
      implementation.address,
      initData,
    );
    this.context.pushVerification(name, {
      name: 'TokenRegistry',
      specifier: contracts.TOKEN_REGISTRY_SPECIFIER,
      address: implementation.address,
    });
  }

  async deployBridgeRouter(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const core = this.context.mustGetCore(this.domain);

    if (!this.data.tokenRegistry)
      throw new Error('need token registry to deploy bridge');

    // don't redeploy
    if (this.data.bridgeRouter) return;
    log(`deploy BridgeRouter on ${name}`);

    const initData =
      contracts.BridgeRouter__factory.createInterface().encodeFunctionData(
        'initialize',
        [this.data.tokenRegistry.proxy, core.xAppConnectionManager.address],
      );

    const factory = new contracts.BridgeRouter__factory(this.deployer);
    const implementation = await factory.deploy(
      // config.bridgeConfiguration.mintGas,  // future
      // config.bridgeConfiguration.deployGas, // future
      this.overrides,
    );

    this._data.bridgeRouter = await this.newProxy(
      implementation.address,
      initData,
    );
    this.context.pushVerification(name, {
      name: 'BridgeRouter',
      specifier: contracts.BRIDGE_ROUTER_SPECIFIER,
      address: implementation.address,
    });
  }

  async deployEthHelper(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const config = this.context.mustGetDomainConfig(this.domain);

    // skip if not configured
    if (!config.bridgeConfiguration.weth) return;
    // don't redeploy
    if (this.data.ethHelper) return;
    // precondition
    if (!this.data.bridgeRouter)
      throw new Error('Must have bridge router to deploy eth helper');
    log(`deploy ETHHelper on ${name}`);

    const factory = new contracts.ETHHelper__factory(this.deployer);

    const constructorArguments = [
      config.bridgeConfiguration.weth,
      this.data.bridgeRouter.proxy,
    ];
    const helper = await factory.deploy(
      constructorArguments[0],
      constructorArguments[1],
      this.overrides,
    );

    this._data.ethHelper = helper.address;
    this.context.pushVerification(name, {
      name: 'ETHHelper',
      specifier: contracts.ETH_HELPER_SPECIFIER,
      address: helper.address,
      constructorArguments,
      encodedConstructorArguments:
        contracts.ETHHelper__factory.createInterface().encodeDeploy(
          constructorArguments,
        ),
    });
  }

  async enrollBridgeRouter(
    remote: string | number,
  ): Promise<CallBatch | undefined> {
    const remoteBridge = this.context.mustGetBridge(remote);
    const remoteDomain = this.context.resolveDomain(remote);
    const remoteConfig = this.context.mustGetDomainConfig(remote);
    const remoteName = this.context.resolveDomainName(remote);
    const local = this.context.resolveDomainName(this.domain);

    const remoteRouter = remoteBridge.data.bridgeRouter?.proxy;
    if (!remoteRouter)
      throw new Error('Remote deploy incomplete. No BridgeRouter');

    // don't re-enroll if already enrolled
    const enrolledRemote = await this.bridgeRouterContract.remotes(
      remoteConfig.domain,
    );
    if (!utils.equalIds(enrolledRemote, ethers.constants.AddressZero)) return;
    log(`enroll BridgeRouter for ${remoteName} on ${local}`);

    // Check that this key has permissions to set this
    const owner = await this.bridgeRouterContract.owner();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      const batch = CallBatch.fromContext(this.context.asNomadContext);
      const tx =
        await this.bridgeRouterContract.populateTransaction.enrollRemoteRouter(
          remoteDomain,
          utils.canonizeId(remoteRouter)
        );
      // safe as populateTransaction always sets `to`
      batch.push(this.domainNumber, tx as Call);
      return batch;
    }

    const tx = await this.bridgeRouterContract.enrollRemoteRouter(
      remoteDomain,
      utils.canonizeId(remoteRouter),
      this.overrides,
    );
    await tx.wait(this.confirmations);
    return;
  }

  async deployCustomTokens(): Promise<CallBatch | undefined> {
    const config = this.context.mustGetDomainConfig(this.domain);
    const name = this.context.resolveDomainName(this.domain);

    // Skip if not configured
    const customs = config.bridgeConfiguration.customs;
    if (!customs) return;

    if (!this.data.customs) this._data.customs = [];

    const implementation = this.data.bridgeToken?.implementation;
    const bridge = this.data.bridgeRouter?.proxy;
    const core = this.context.mustGetCore(this.domain);
    if (!implementation)
      throw new Error('Need bridge token impl to deploy custom');
    if (!bridge) throw new Error('Need bridge router to deploy custom token');
    // factories
    const ubcFactory = new UpgradeBeaconController__factory(this.deployer);
    const beaconFactory = new UpgradeBeacon__factory(this.deployer);
    const proxyFactory = new UpgradeBeaconProxy__factory(this.deployer);

    const enrollTxs = await Promise.all(
      customs.map(async (custom): Promise<ethers.PopulatedTransaction[]> => {
        // don't re-deploy custom if already deployed
        // TODO: break down each step, make idempotent
        const existingCustom = this.data.customs?.find(
          (potentialMatch) =>
            potentialMatch.token.id == custom.token.id &&
            potentialMatch.token.domain == custom.token.domain,
        );
        if (existingCustom) return [];
        log(`deploy ${custom.name} Custom Token on ${name}`);

        // deploy the controller
        const controller = await ubcFactory.deploy(this.overrides);
        await controller.deployTransaction.wait(this.confirmations);

        // deploy the beacon
        const beacon = await beaconFactory.deploy(
          implementation,
          controller.address,
          this.overrides,
        );
        await beacon.deployTransaction.wait(this.confirmations);

        // deploy a proxy
        const proxy = await proxyFactory.deploy(
          beacon.address,
          '0x',
          this.overrides,
        );
        await proxy.deployTransaction.wait(this.confirmations);

        // pre-emptively transfer ownership of controller to governance
        const relinquish = await controller.transferOwnership(
          core.governanceRouter.address,
          this.overrides,
        );
        await relinquish.wait(this.confirmations);

        const tokenProxy = contracts.BridgeToken__factory.connect(
          proxy.address,
          this.deployer,
        );

        // initialize the token proxy so that owner is set
        const initTx = await tokenProxy.initialize(this.overrides);
        await initTx.wait(this.confirmations);

        // set initial details
        await (
          await tokenProxy.setDetails(
            custom.name,
            custom.symbol,
            custom.decimals,
          )
        ).wait(this.confirmations);

        // transfer ownership to the bridge router
        await (
          await tokenProxy.transferOwnership(bridge)
        ).wait(this.confirmations);

        // add custom to data
        this.data.customs?.push({
          ...custom,
          controller: controller.address,
          addresses: {
            implementation,
            proxy: proxy.address,
            beacon: beacon.address,
          },
        });

        // enroll the custom representation
        // Check that this key has permissions to set this
        const owner = await this.tokenRegistryContract.owner();
        const deployer = ethers.utils.getAddress(
          await this.deployer.getAddress(),
        );

        // If we can't use deployer ownership
        if (!utils.equalIds(owner, deployer)) {
          return [
            await this.tokenRegistryContract.populateTransaction.enrollCustom(
              custom.token.domain,
              utils.canonizeId(custom.token.id),
              proxy.address
            ),
          ];
        }

        const enroll = await this.tokenRegistryContract.enrollCustom(
          custom.token.domain,
          utils.canonizeId(custom.token.id),
          proxy.address,
          this.overrides,
        );
        await enroll.wait(this.confirmations);
        return [];
      }),
    );
    const batch = CallBatch.fromContext(this.context.asNomadContext);
    // safe as populateTransaction always sets `to`
    enrollTxs.forEach((tx) => batch.push(this.domainNumber, tx as Call[]));
    return batch;
  }

  async relinquish(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const core = this.context.mustGetCore(this.domain);
    const governance = core.governanceRouter.address;

    const deployer = await this.deployer.getAddress();

    // transfer ownership of tokenRegistry to bridge
    const registryOwner = await this.tokenRegistryContract.owner();
    if (utils.equalIds(registryOwner, deployer)) {
      log(`transfer token registry ownership on ${name}`);
      const tx = await this.bridgeRouterContract.transferOwnership(this.bridgeRouterContract.address, this.overrides);
      await tx.wait(this.confirmations);
    }

    // transfer ownership of bridgeRouter to governance
    const bridgeOwner = await this.bridgeRouterContract.owner();
    if (utils.equalIds(bridgeOwner, deployer)) {
      log(`transfer bridge router ownership on ${name}`);
      const tx = await this.bridgeRouterContract.transferOwnership(governance, this.overrides);
      await tx.wait(this.confirmations);
    }
  }

  async checkDeploy(remoteDomains: string[]): Promise<void> {
    if (!this.data.bridgeToken)
      throw new Error(`BridgeToken is not defined for domain ${this.domain}`);
    if (!this.data.bridgeRouter)
      throw new Error(`BridgeRouter is not defined for domain ${this.domain}`);
    if (!this.data.tokenRegistry)
      throw new Error(`TokenRegistry is not defined for domain ${this.domain}`);

    assertBeaconProxy(this.data.bridgeToken);
    assertBeaconProxy(this.data.bridgeRouter);

    /*
    # BridgeRouter
      * owner
      * tokenRegistry
      * xAppConnectionManager
      * remotes

    # TokenRegistry
      * owner
      * xAppConnectionManager
      * tokenBeacon
    */

    const core = this.context.mustGetCore(this.domain);

    //  ========= BridgeRouter =========
    // BridgeRouter upgrade setup contracts are defined
    assertBeaconProxy(this.data.bridgeRouter, 'BridgeRouter');
    // owner
    const bridgeRouterOwner = await this.bridgeRouterContract.owner();
    expect(utils.equalIds(bridgeRouterOwner, core.governanceRouter.address)).to
      .be.true;
    // tokenRegistry
    const tokenRegistry = await this.bridgeRouterContract.tokenRegistry();
    expect(utils.equalIds(tokenRegistry, this.data.tokenRegistry.proxy)).to.be
      .true;
    // xAppConnectionManager
    const xApp = await this.bridgeRouterContract.xAppConnectionManager();
    expect(utils.equalIds(xApp, core.xAppConnectionManager.address)).to.be.true;
    // remotes
    for (const domain of remoteDomains) {
      const remoteDomainNumber = this.context.mustGetDomain(domain).domain;
      const remoteRouter = await this.bridgeRouterContract.remotes(
        remoteDomainNumber,
      );
      expect(
        utils.equalIds(
          this.context.mustGetBridge(domain).bridgeRouterContract.address,
          remoteRouter,
        ),
      ).to.be.true;
    }

    //  ========= tokenRegistry =========
    // TokenRegistry upgrade setup contracts are defined
    assertBeaconProxy(this.data.tokenRegistry, 'TokenRegistry');
    // owner
    const tokenRegistryOwner = await this.tokenRegistryContract.owner();
    expect(utils.equalIds(tokenRegistryOwner, this.bridgeRouterContract.address)).to
        .be.true;

    // xAppConnectionManager
    const xAppAddress =
      await this.tokenRegistryContract.xAppConnectionManager();
    expect(utils.equalIds(xAppAddress, core.xAppConnectionManager.address)).to
      .be.true;
    // tokenBeacon
    const tokenBeacon = await this.tokenRegistryContract.tokenBeacon();
    expect(utils.equalIds(tokenBeacon, this.data.bridgeToken.beacon)).to.be
      .true;

    //  ========= eth helper =========
    const weth = this.context.mustGetDomainConfig(this.domain)
      .bridgeConfiguration.weth;
    if (weth) {
      expect(this.data.ethHelper).to.not.be.undefined;
    } else {
      expect(this.data.ethHelper).to.be.undefined;
    }
  }

  checkVerificationInput(name: string, addr: string): void {
    this.context.checkVerificationInput(this.domain, name, addr);
  }
}
