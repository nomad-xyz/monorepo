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
import { assertBeaconProxy, retry } from '../utils';
import { expect } from 'chai';

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

  checkComplete(): void {
    if (!this.data.customs) this._data.customs = [];
    super.checkComplete();
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
    const impl = await retry(() => factory.deploy(this.overrides), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract BridgeToken__factory`, e)
    }, 120_000, this.context.logger);
    await impl.deployTransaction.wait(this.confirmations);

    this.context.pushVerification(name, {
      name: 'BridgeToken',
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

    const factory = new UpgradeBeaconProxy__factory(
      this.context.getDeployer(name),
    );
    console.log(`---TR deploying UpgradeBeaconProxy__factory`)
    const prx = await retry(() => factory.deploy(beacon, initData, this.overrides), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract UpgradeBeaconProxy__factory`, e)
    }, 120_000, this.context.logger);
    console.log(`---TR deployed UpgradeBeaconProxy__factory`)
    proxy.proxy = prx.address;
    
    await retry(()=>prx.deployTransaction.wait(this.confirmations), 5, (e, i) =>{this.context.logger.debug(`Failed at ${i} waiting for bridge contract prx.deployTransaction`, e)}, 120_000, this.context.logger) ;
    console.log(`---TR waited UpgradeBeaconProxy__factory`)

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
    console.log(`---TR Deploying UpgradeBeacon__factory`)
    const factory = new UpgradeBeacon__factory(this.context.getDeployer(name));
    const beacon = await retry(async () => {
      try {
        console.log(`---xxxxxx UpgradeBeacon__factory`);
        const x = await factory.deploy(implementation, ubc, this.overrides);
        console.log(`---yyyyyy UpgradeBeacon__factory`);
        return x
      } catch(e) {
        console.log(`eeeeee->`, e);
        throw e
      }
    }, 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract UpgradeBeacon__factory`, e)
    }, 120_000, this.context.logger);
    console.log(`---TR DeployED UpgradeBeacon__factory`)
    proxy.beacon = beacon.address;
    await retry(()=>beacon.deployTransaction.wait(this.confirmations), 5, (e, i) =>{this.context.logger.debug(`Failed at ${i} waiting for bridge contract beacon.deployTransaction`, e)}, 120_000, this.context.logger) ;
    console.log(`---TR Waited UpgradeBeacon__factory`)

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
    console.log(`--TR Deployed deployBeacon`)

    await this.deployProxy(initData, proxy);
    console.log(`--TR Deployed deployProxy`)


    return proxy as config.Proxy;
  }

  async deployTokenUpgradeBeacon(): Promise<void> {
    // ensure the implementation exists. An undefined return value indicates
    // that the implementation already exists
    const proxy =
      (await this.deployTokenImplementation()) ?? this.data.bridgeToken;
    if (!proxy) throw new Error('unreachable');

    const implAddress = proxy?.implementation;
    if (!implAddress) throw new Error('unreachable');

    // don't redeploy
    if (proxy?.beacon) return;

    await this.deployBeacon(proxy);
    proxy.proxy = ethers.constants.AddressZero;
    this._data.bridgeToken = proxy as config.Proxy;
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

    
      this.context.logger.debug(`Token registry hustle start`, this.domain);
    const factory = new contracts.TokenRegistry__factory(this.deployer);
    const implementation = await retry(() => factory.deploy(this.overrides), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract TokenRegistry__factory`, e)
    }, 120_000, this.context.logger);
    console.log(`-TR Deployed`)

    this._data.tokenRegistry = await this.newProxy(
      implementation.address,
      initData,
    );
    console.log(`-TR Deployed new Proxy`)

    this.context.logger.debug(`Token registry hustle end`, this.domain);
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
    const implementation = await retry(() => factory.deploy(
      // config.bridgeConfiguration.mintGas,  // future
      // config.bridgeConfiguration.deployGas, // future
      this.overrides,
    ), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract BridgeRouter__factory`, e)
    }, 120_000, this.context.logger);

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
    const helper = await retry(() => factory.deploy(
      config.bridgeConfiguration.weth || '0x' + '00'.repeat(20), // WTF??
      this.data.bridgeRouter?.proxy || '0x' + '00'.repeat(20), // WTF??
      this.overrides,
    ), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract ETHHelper__factory`, e)
    }, 120_000, this.context.logger);

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

    // Check that this key has permissions to set this
    const owner = await this.bridgeRouterContract.owner();
    const deployer = ethers.utils.getAddress(await this.deployer.getAddress());

    // If we can't use deployer ownership
    if (!utils.equalIds(owner, deployer)) {
      return [
        await this.bridgeRouterContract.populateTransaction.enrollRemoteRouter(
          remoteDomain,
          utils.canonizeId(remoteRouter),
          this.overrides,
        ),
      ];
    }

    const tx = await this.bridgeRouterContract.enrollRemoteRouter(
      remoteDomain,
      utils.canonizeId(remoteRouter),
      this.overrides,
    );
    await tx.wait(this.confirmations);
    return [];
  }

  async deployCustomTokens(): Promise<ethers.PopulatedTransaction[]> {
    const config = this.context.mustGetDomainConfig(this.domain);

    // Skip if not configured
    const customs = config.bridgeConfiguration.customs;
    if (!customs) return [];

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
        // deploy the controller
        const controller = await retry(() => ubcFactory.deploy(this.overrides), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract UpgradeBeaconController__factory`, e)
    }, 120_000, this.context.logger);
        await controller.deployTransaction.wait(this.confirmations);

        // deploy the beacon
        const beacon = await retry(() => beaconFactory.deploy(
          implementation,
          controller.address,
          this.overrides,
        ), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract UpgradeBeacon__factory`, e)
    }, 120_000, this.context.logger);
        await beacon.deployTransaction.wait(this.confirmations);

        // deploy a proxy
        const proxy = await retry(() => proxyFactory.deploy(
          beacon.address,
          '0x',
          this.overrides,
        ), 5, (e, i) => {
      this.context.logger.debug(`Failed at ${i} deploying a contract UpgradeBeaconProxy__factory`, e)
    }, 120_000, this.context.logger);
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
              proxy.address,
              this.overrides,
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
    return enrollTxs.flat();
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

  async checkDeploy(): Promise<void> {
    if (!this.data.bridgeToken)
      throw new Error(`BridgeToken is not defined for domain ${this.domain}`);
    if (!this.data.bridgeRouter)
      throw new Error(`BridgeRouter is not defined for domain ${this.domain}`);
    if (!this.data.tokenRegistry)
      throw new Error(`TokenRegistry is not defined for domain ${this.domain}`);

    assertBeaconProxy(this.data.bridgeToken);
    assertBeaconProxy(this.data.bridgeRouter);

    const weth = this.context.mustGetDomainConfig(this.domain)
      .bridgeConfiguration.weth;

    if (weth) {
      expect(this.data.ethHelper).to.not.be.undefined;
    } else {
      expect(this.data.ethHelper).to.be.undefined;
    }

    expect(
      utils.equalIds(
        await this.bridgeRouterContract.owner(),
        this.context.cores[this.domain].governanceRouter.proxy,
      ),
    );

    // check verification addresses
    // TODO: add beacon and proxy where needed.
  }

  checkVerificationInput(name: string, addr: string): void {
    this.context.checkVerificationInput(this.domain, name, addr);
  }
}
