import {
  Chain,
  ChainJson,
  CoreDeployAddresses,
  DeployEnvironment,
  RustConfig,
  RustContractBlock,
  toChain,
} from '../chain';
import { CoreContracts } from './CoreContracts';
import { Deploy } from '../deploy';
import { BigNumberish } from '@ethersproject/bignumber';
import fs from 'fs';
import { NomadDomain } from '@nomad-xyz/sdk/nomad';
import { ethers } from 'ethers';

type Address = string;

export type Governor = {
  domain: number;
  address: Address;
};
export type CoreConfig = {
  environment: DeployEnvironment;
  updater: Address;
  recoveryTimelock: number;
  recoveryManager: Address;
  optimisticSeconds: number;
  watchers: string[];
  governor?: Governor;
  processGas: BigNumberish;
  reserveGas: BigNumberish;
  fromBlock?: number;
};

export class CoreDeploy extends Deploy<CoreContracts> {
  config: CoreConfig;

  constructor(chain: Chain, config: CoreConfig, test = false) {
    super(chain, new CoreContracts(), test);
    this.config = config;
  }

  get contractOutput(): CoreDeployAddresses {
    const addresses: CoreDeployAddresses = {
      ...this.contracts.toObject(),
      recoveryManager: this.config.recoveryManager,
      updater: this.config.updater,
    };
    if (this.config.governor) {
      addresses.governor = {
        address: this.config.governor.address,
        domain: this.chain.domain,
      };
    }
    return addresses;
  }

  get ubcAddress(): Address | undefined {
    return this.contracts.upgradeBeaconController?.address;
  }

  async governor(): Promise<Address> {
    return this.config.governor?.address ?? (await this.deployer.getAddress());
  }

  static parseCoreConfig(config: ChainJson & CoreConfig): [Chain, CoreConfig] {
    const chain = toChain(config);
    return [
      chain,
      {
        environment: config.environment,
        updater: config.updater,
        watchers: config.watchers ?? [],
        recoveryManager: config.recoveryManager,
        recoveryTimelock: config.recoveryTimelock,
        optimisticSeconds: config.optimisticSeconds,
        processGas: config.processGas ?? 850_000,
        reserveGas: config.reserveGas ?? 15_000,
      },
    ];
  }

  static toRustConfigs(deploys: CoreDeploy[]): RustConfig[] {
    const configs: RustConfig[] = [];
    for (let i = 0; i < deploys.length; i++) {
      const local = deploys[i];

      // copy array so original is not altered
      const remotes = deploys
        .slice()
        .filter((remote) => remote.chain.domain !== local.chain.domain);

      // build and add new config
      configs.push(CoreDeploy.buildConfig(local, remotes));
    }
    return configs;
  }

  static buildSDK(local: CoreDeploy, remotes: CoreDeploy[]): NomadDomain {
    return {
      name: local.chain.name,
      id: local.chain.domain,
      paginate: {
        from: local.config.fromBlock || 0,
        blocks: local.chain.config.chunk || 2000,
      },
      home: local.contracts.home!.proxy.address,
      replicas: remotes.map((remote) => {
        return {
          domain: remote.chain.domain,
          address: local.contracts.replicas[remote.chain.domain].proxy.address,
        };
      }),
      governanceRouter: local.contracts.governance!.proxy.address,
      bridgeRouter: 'n/a',
      tokenRegistry: 'n/a',
      xAppConnectionManager: local.contracts.xAppConnectionManager!.address,
    };
  }

  static buildConfig(local: CoreDeploy, remotes: CoreDeploy[]): RustConfig {
    const home: RustContractBlock = {
      address: local.contracts.home!.proxy.address,
      domain: local.chain.domain.toString(),
      name: local.chain.name,
      rpcStyle: 'ethereum',
      timelag: local.chain.config.timelag,
      connection: {
        type: 'http',
        url: '',
      },
    };

    const rustConfig: RustConfig = {
      environment: local.config.environment,
      signers: {
        [home.name]: { key: '', type: 'hexKey' },
      },
      replicas: {},
      home,
      tracing: {
        level: 'debug',
        fmt: 'json',
      },
      db: 'db_path',
      index: {
        from: local.config.fromBlock?.toString() || '0',
        chunk: local.chain.config.chunk?.toString() || '2000',
      },
    };

    for (const remote of remotes) {
      if (!remote.contracts.replicas[local.chain.domain]) continue; // prevents from connecting not connected networks
      const replica: RustContractBlock = {
        address: remote.contracts.replicas[local.chain.domain].proxy.address,
        domain: remote.chain.domain.toString(),
        name: remote.chain.name,
        rpcStyle: 'ethereum',
        timelag: remote.chain.config.timelag,
        connection: {
          type: 'http',
          url: '',
        },
      };

      rustConfig.signers[replica.name] = { key: '', type: 'hexKey' };
      rustConfig.replicas[replica.name] = replica;
    }

    return rustConfig;
  }

  static freshFromConfig(chainConfig: ChainJson & CoreConfig): CoreDeploy {
    const [chain, config] = CoreDeploy.parseCoreConfig(chainConfig);
    return new CoreDeploy(chain, config);
  }

  async recordFromBlock() {
    if (!this.config.fromBlock) {
      this.config.fromBlock = await this.chain.provider.getBlockNumber();
    }
  }
}

export class ExistingCoreDeploy extends CoreDeploy {
  constructor(
    chain: Chain,
    config: CoreConfig,
    addresses: CoreDeployAddresses,
    signer?: ethers.Signer,
    test = false,
  ) {
    super(chain, config, test);
    this.contracts = CoreContracts.fromAddresses(
      addresses,
      signer || chain.provider,
    );
  }

  static withPath(
    chain: Chain,
    config: CoreConfig,
    path: string,
    signer?: ethers.Signer,
    test = false,
  ): ExistingCoreDeploy {
    const addresses: CoreDeployAddresses = JSON.parse(
      fs.readFileSync(`${path}/${chain.name}_contracts.json`) as any as string,
    );
    return new ExistingCoreDeploy(chain, config, addresses, signer, test);
  }
}
