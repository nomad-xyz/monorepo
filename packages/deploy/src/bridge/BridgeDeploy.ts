import { Chain, ChainJson, CoreContractAddresses, toChain } from '../chain';
import { BridgeContractAddresses, BridgeContracts } from './BridgeContracts';
import {
  getPathToBridgeConfigFromCore,
  parseFileFromDeploy,
} from '../verification/readDeployOutput';
import { Deploy } from '../deploy';
import { ethers } from 'ethers';

export type BridgeConfig = {
  weth?: string;
};

export class BridgeDeploy extends Deploy<BridgeContracts> {
  readonly config: BridgeConfig;
  readonly coreDeployPath: string;
  readonly coreContractAddresses: CoreContractAddresses;

  constructor(
    chain: Chain,
    config: BridgeConfig,
    coreDeployPath: string,
    coreContracts?: CoreContractAddresses,
  ) {
    super(chain, new BridgeContracts());
    this.config = config;
    this.coreDeployPath = coreDeployPath;
    this.coreContractAddresses =
      coreContracts ||
      parseFileFromDeploy(coreDeployPath, chain.config.name, 'contracts');
  }

  get ubcAddress(): string | undefined {
    return this.coreContractAddresses.upgradeBeaconController;
  }

  get contractOutput(): BridgeContractAddresses {
    return this.contracts.toObject() as BridgeContractAddresses;
  }

  static freshFromConfig(
    config: ChainJson,
    coreDeployPath: string,
  ): BridgeDeploy {
    return new BridgeDeploy(toChain(config), {}, coreDeployPath);
  }
}

export class ExistingBridgeDeploy extends BridgeDeploy {
  constructor(
    chain: Chain,
    config: BridgeConfig,
    coreDeployPath: string,
    addresses?: BridgeContractAddresses,
    coreContracts?: CoreContractAddresses,
    signer?: ethers.Signer,
  ) {
    super(chain, config, coreDeployPath, coreContracts);

    if (!addresses) {
      const bridgeConfigPath = getPathToBridgeConfigFromCore(coreDeployPath);
      addresses = parseFileFromDeploy(
        bridgeConfigPath,
        chain.name,
        'contracts',
      );
    }

    this.contracts = BridgeContracts.fromAddresses(
      addresses!,
      signer || chain.provider,
    );
  }

  static withPath(
    chain: Chain,
    config: BridgeConfig,
    addresses: BridgeContractAddresses,
    coreDeployPath?: string,
    coreContracts?: CoreContractAddresses,
    signer?: ethers.Signer,
  ): ExistingBridgeDeploy {
    return new ExistingBridgeDeploy(
      chain,
      config,
      coreDeployPath || '/dev/null',
      addresses,
      coreContracts,
      signer,
    );
  }
}
