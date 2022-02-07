import { BytesLike, ethers, Signer } from 'ethers';
import {
  UpgradeBeaconController,
  UpgradeBeaconController__factory,
} from '@nomad-xyz/core-contracts';
import {
  BridgeRouter,
  BridgeToken,
  BridgeToken__factory,
  MockCore,
  MockCore__factory,
  MockWeth,
  MockWeth__factory,
  TokenRegistry,
} from '@nomad-xyz/bridge-contracts';
import { ContractVerificationInput } from '../deploy';
import { BridgeContracts } from './BridgeContracts';
import * as process from '.';
import { Chain, DEFAULT_GAS } from '../chain';

import { TokenIdentifier } from '@nomad-xyz/sdk/nomad/tokens';
import { CoreConfig } from '../core/CoreDeploy';

function toBytes32(address: string): string {
  return '0x' + '00'.repeat(12) + address.slice(2);
}

export async function getTestChain(
  ethers: any,
  domain: number,
  updater: string,
  watchers: string[],
  recoveryManager?: string,
): Promise<[Chain, CoreConfig]> {
  const [, , , , , , , deployer] = await ethers.getSigners();
  return [
    {
      name: 'hh',
      provider: ethers.provider,
      deployer,
      gas: DEFAULT_GAS,
      confirmations: 0,
      domain,
      config: {
        domain,
        name: 'hh',
        rpc: 'NA',
        chunk: 2000,
        timelag: 5,
      },
    },
    {
      environment: 'dev',
      recoveryTimelock: 1,
      recoveryManager: recoveryManager || ethers.constants.AddressZero,
      updater,
      optimisticSeconds: 3,
      watchers,
      processGas: 850_000,
      reserveGas: 15_000,
    },
  ];
}

// A BridgeRouter deployed with a mock Core suite.
//
// Intended usage: instatiate in hardhat tests with `deploy`. Interact with
// the Bridge contracts as normal. Dispatch messages to the bridge using
// router's `handle` function. The test signer is pre-authorized. Messages the
// router dispatches will be logged in the `Enqueue` event on the `MockCore`
// contract.
export default class TestBridgeDeploy {
  signer: Signer;
  ubc: UpgradeBeaconController;
  mockCore: MockCore;
  mockWeth: MockWeth;
  contracts: BridgeContracts;
  verificationInput: ContractVerificationInput[];
  localDomain: number;
  chain: Chain;
  test = true;

  constructor(
    signer: Signer,
    ubc: UpgradeBeaconController,
    mockCore: MockCore,
    mockWeth: MockWeth,
    contracts: BridgeContracts,
    domain: number,
    chain: Chain,
    callerKnowsWhatTheyAreDoing = false,
  ) {
    if (!callerKnowsWhatTheyAreDoing) {
      throw new Error("Don't instantiate via new.");
    }
    this.signer = signer;
    this.ubc = ubc;
    this.mockCore = mockCore;
    this.mockWeth = mockWeth;
    this.contracts = contracts;
    this.verificationInput = [];
    this.localDomain = domain;
    this.config.weth = mockWeth.address;
    this.chain = chain;
  }

  static async deploy(ethers: any, signer: Signer): Promise<TestBridgeDeploy> {
    const mockCore = await new MockCore__factory(signer).deploy();
    const mockWeth = await new MockWeth__factory(signer).deploy();
    const ubc = await new UpgradeBeaconController__factory(signer).deploy();
    const contracts = new BridgeContracts();
    const domain = await mockCore.localDomain();
    const [chain] = await getTestChain(ethers, domain, '', []);
    chain.deployer = signer;

    const deploy = new TestBridgeDeploy(
      signer,
      ubc,
      mockCore,
      mockWeth,
      contracts,
      domain,
      chain,
      true,
    );

    await process.deployTokenUpgradeBeacon(deploy);
    await process.deployTokenRegistry(deploy);
    await process.deployBridgeRouter(deploy);
    await process.deployEthHelper(deploy);

    // enroll the signer as a remote BridgeRouter
    // so the test BridgeRouter will accept messages
    // directly from the signer
    await contracts.bridgeRouter?.proxy.enrollRemoteRouter(
      1,
      toBytes32(await signer.getAddress()),
    );

    // transfer ownership of the token registry to the bridge router
    await contracts.tokenRegistry!.proxy.transferOwnership(
      contracts.bridgeRouter!.proxy.address,
    );

    return deploy;
  }

  get ubcAddress(): string {
    return this.ubc.address;
  }

  get deployer(): Signer {
    return this.chain.deployer;
  }

  get coreContractAddresses() {
    return {
      xAppConnectionManager: this.mockCore.address,
      home: { proxy: this.mockCore.address },
      governance: { proxy: this.mockCore.address },
    };
  }

  get coreDeployPath() {
    return '';
  }
  get overrides() {
    return {};
  }
  get config() {
    return { weth: this.mockWeth.address };
  }

  get bridgeRouter(): BridgeRouter | undefined {
    return this.contracts.bridgeRouter?.proxy;
  }

  get tokenRegistry(): TokenRegistry | undefined {
    return this.contracts.tokenRegistry?.proxy;
  }

  get remoteDomain(): number {
    return 1;
  }

  get testToken(): string {
    return `0x${'11'.repeat(32)}`;
  }

  get testName(): string {
    return 'NomadTest';
  }

  get testSymbol(): string {
    return 'TEST';
  }

  get testDecimals(): number {
    return 18;
  }

  get testTokenId(): TokenIdentifier {
    return {
      domain: this.remoteDomain,
      id: this.testToken,
    };
  }

  async getTestRepresentation(): Promise<BridgeToken | undefined> {
    return await this.getRepresentation(this.remoteDomain, this.testToken);
  }

  async getRepresentation(
    domain: number,
    canonicalTokenAddress: BytesLike,
  ): Promise<BridgeToken | undefined> {
    const reprAddr = await this.tokenRegistry![
      'getLocalAddress(uint32,bytes32)'
    ](domain, canonicalTokenAddress);

    if (reprAddr === ethers.constants.AddressZero || domain === 0) {
      return undefined;
    }

    return BridgeToken__factory.connect(reprAddr, this.signer);
  }
}
