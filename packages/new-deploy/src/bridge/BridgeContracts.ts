import * as contracts from '@nomad-xyz/contracts-bridge';
import {
  UpgradeBeaconController__factory,
  UpgradeBeaconProxy__factory,
  UpgradeBeacon__factory,
} from '@nomad-xyz/contracts-core';

import { ethers } from 'ethers';
import { utils } from '@nomad-xyz/multi-provider';
import * as config from '@nomad-xyz/configuration';

import Contracts from '../Contracts';
import DeployContext from '../DeployContext';

export abstract class AbstractBridgeDeploy<T> extends Contracts<T> {
  // Placeholder for future multi-VM abstraction
}

export default class BridgeContracts extends AbstractBridgeDeploy<config.EvmBridgeContracts> {
  protected keys: ReadonlyArray<keyof config.EvmBridgeContracts> = [
    'bridgeRouter',
    'tokenRegistry',
    'bridgeToken',
    'ethHelper',
    'deployHeight',
  ];

  constructor(
    context: DeployContext,
    domain: string,
    data?: config.EvmBridgeContracts,
  ) {
    super(context, domain, data);
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
      this.data.bridgeRouter.proxy,
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
      this.data.tokenRegistry.proxy,
      this.connection,
    );
  }

  set tokenRegistry(proxy: config.Proxy) {
    this._data.tokenRegistry = proxy;
  }

  get ethHelperContract(): contracts.ETHHelper | undefined {
    if (!this.data.ethHelper) return undefined;

    return contracts.ETHHelper__factory.connect(
      this.data.ethHelper,
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

  private async deployTokenImplementation(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);

    // don't redeploy
    if (this.data.bridgeToken?.implementation) return;

    const factory = new contracts.BridgeToken__factory(this.deployer);
    const impl = await factory.deploy(this.overrides);
    await impl.deployTransaction.wait(this.confirmations);

    if (!this._data.bridgeToken) {
      this._data.bridgeToken = {
        implementation: '',
        proxy: '',
        beacon: '',
      };
    }

    this._data.bridgeToken.implementation = impl.address;
    this.context.pushVerification(name, {
      name: 'BridgeToken',
      address: impl.address,
    });
  }

  // TODO: DRY
  private async deployProxy(
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

  private async deployBeacon(proxy: Partial<config.Proxy>): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const core = this.context.mustGetCore(this.domain);
    const implementation = proxy.implementation;
    if (!implementation)
      throw new Error('Tried to deploy beacon without initial implementation');
    // don't redeploy
    if (proxy.beacon) return;

    const ubc = core.upgradeBeaconController.address;
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

    // ensure the implementation exists
    await this.deployTokenImplementation();
    const implAddress = this.data.bridgeToken?.implementation;
    if (!implAddress) throw new Error('unreachable');

    // don't redeploy
    if (!this.data.bridgeRouter) throw new Error('unreachable');
    if (this.data.bridgeToken?.beacon) return;

    // preconditions
    const controller = this.context.mustGetCore(this.domain)
      .upgradeBeaconController.address;

    const factory = new UpgradeBeacon__factory(this.deployer);
    const beacon = await factory.deploy(
      implAddress,
      controller,
      this.overrides,
    );
    await beacon.deployTransaction.wait(this.confirmations);

    this.data.bridgeRouter.beacon = beacon.address;
    this.context.pushVerification(name, {
      name: 'UpgradeBeacon',
      address: beacon.address,
      constructorArguments: [implAddress, controller],
    });
  }

  async deployTokenRegistry(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const core = this.context.mustGetCore(this.domain);
    // don't redeploy
    if (this.data.tokenRegistry) return;

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
      address: implementation.address,
    });
  }

  async deployBridgeRouter(): Promise<void> {
    const name = this.context.resolveDomainName(this.domain);
    const core = this.context.mustGetCore(this.domain);

    if (!this.data.tokenRegistry)
      throw new Error('need token registry to deploy bridge');

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

    const factory = new contracts.ETHHelper__factory(this.deployer);
    const helper = await factory.deploy(
      config.bridgeConfiguration.weth,
      this.data.bridgeRouter.proxy,
      this.overrides,
    );

    this._data.ethHelper = helper.address;
    this.context.pushVerification(name, {
      name: 'EthHelper',
      address: helper.address,
      constructorArguments: [
        config.bridgeConfiguration.weth,
        this.data.bridgeRouter.proxy,
      ],
    });
  }

  async enrollBridgeRouter(
    remote: string | number,
  ): Promise<ethers.PopulatedTransaction[]> {
    const remoteBridge = this.context.mustGetBridge(remote);
    const remoteDomain = this.context.resolveDomain(remote);

    const remoteRouter = remoteBridge.data.bridgeRouter?.proxy;
    if (!remoteRouter)
      throw new Error('Remote deploy incomplete. No BridgeRouter');

    const tx = await this.bridgeRouterContract.enrollRemoteRouter(
      remoteDomain,
      utils.canonizeId(remoteRouter),
      this.overrides,
    );
    await tx.wait(this.confirmations);
    return [];
  }

  async deployCustomTokens(): Promise<void> {
    const config = this.context.mustGetDomainConfig(this.domain);

    // Skip if not configured
    const customs = config.bridgeConfiguration.customs;
    if (!customs) return;

    if (!this.data.customs) this._data.customs = [];

    const implementation = this.data.bridgeToken?.implementation;
    const router = this.data.bridgeRouter?.proxy;
    const core = this.context.mustGetCore(this.domain);
    if (!implementation)
      throw new Error('Need bridge token impl to deploy custom');
    if (!router) throw new Error('Need bridge router to deploy custom token');
    // factories
    const ubcFactory = new UpgradeBeaconController__factory(this.deployer);
    const beaconFactory = new UpgradeBeacon__factory(this.deployer);
    const proxyFactory = new UpgradeBeaconProxy__factory(this.deployer);

    await Promise.all(
      customs.map(async (custom) => {
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
          await tokenProxy.transferOwnership(router)
        ).wait(this.confirmations);

        // enroll the custom representation
        const enroll = await this.tokenRegistryContract.enrollCustom(
          custom.token.domain,
          utils.canonizeId(custom.token.id),
          proxy.address,
          this.overrides,
        );
        await enroll.wait(this.confirmations);

        this.data.customs?.push({
          ...custom,
          controller: controller.address,
          addresses: {
            implementation,
            proxy: proxy.address,
            beacon: beacon.address,
          },
        });
      }),
    );
  }

  async relinquish(): Promise<void> {
    const core = this.context.mustGetCore(this.domain);
    const governance = core.governanceRouter.address;

    const contracts = [this.tokenRegistryContract, this.bridgeRouterContract];
    const deployer = await this.deployer.getAddress();

    // conditional to avoid erroring
    const txns = await Promise.all(
      contracts.map(async (contract) => {
        const owner = await contract.owner();
        if (utils.equalIds(owner, deployer)) {
          return await contract.transferOwnership(governance, this.overrides);
        }
      }),
    );

    await Promise.all(
      txns.map(async (tx) => {
        if (tx) await tx.wait(this.confirmations);
      }),
    );
  }
}
