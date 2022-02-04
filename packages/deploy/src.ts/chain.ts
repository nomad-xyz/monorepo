import * as ethers from 'ethers';
import { BigNumber } from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import { ProxyAddresses } from './proxyUtils';

type Address = string;
export type DeployEnvironment = 'dev' | 'staging' | 'prod';

export type CoreContractAddresses = {
  upgradeBeaconController: Address;
  xAppConnectionManager: Address;
  updaterManager: Address;
  governance: ProxyAddresses;
  home: ProxyAddresses;
  replicas?: Record<string, ProxyAddresses>;
};

export type CoreDeployAddresses = CoreContractAddresses & {
  recoveryManager: Address;
  updater: Address;
  governor?: { address: Address; domain: number };
};

export type Eip1559PricingJson = {
  maxFeePerGas: string | number;
  maxPriorityFeePerGas: string | number;
};

export type Eip1559Pricing = {
  maxFeePerGas?: ethers.BigNumber;
  maxPriorityFeePerGas?: ethers.BigNumber;
};

export type GasJson = {
  limit?: string | number;
  price?: string | number | Eip1559PricingJson;
};

export interface ChainJson {
  name: string;
  rpc: string;
  domain: number;
  deployerKey?: string;
  gas?: GasJson;
  confirmations?: number;
  chunk: number;
  timelag: number;
}

export interface Gas {
  limit: ethers.BigNumber;
  price: ethers.BigNumber | Eip1559Pricing;
}

export type Chain = {
  name: string;
  provider: ethers.providers.JsonRpcProvider;
  deployer: ethers.Signer;
  gas: Gas;
  config: ChainJson;
  confirmations: number;
  domain: number;
};

export function deployEnvironment(): DeployEnvironment {
  const e = process.env.NOMAD_DEPLOY_ENVIRONMENT;

  if (e === 'staging') {
    return 'staging';
  } else if (e === 'prod') {
    return 'prod';
  }

  return 'dev';
}

// want this to be a constant. it's a function due to lack of immutability
export const DEFAULT_GAS: Readonly<Gas> = {
  limit: BigNumber.from(6_000_000), // 6 million gas
  price: BigNumber.from('20000000000'), // 20 gwei
};

export function parseGas(config: GasJson): Gas {
  let price: ethers.BigNumber | Eip1559Pricing = {};

  if (!config.price) {
    price = DEFAULT_GAS.price;
  } else if (
    typeof config.price === 'string' ||
    typeof config.price === 'number'
  ) {
    price = BigNumber.from(config.price);
  } else {
    if (config.price.maxPriorityFeePerGas) {
      price.maxPriorityFeePerGas = BigNumber.from(
        config.price.maxPriorityFeePerGas,
      );
    }
    if (config.price.maxFeePerGas) {
      price.maxFeePerGas = BigNumber.from(config.price.maxFeePerGas);
    }
  }

  return {
    limit: DEFAULT_GAS.limit,
    price,
  };
}

export function toChain(config: ChainJson): Chain {
  const provider = new ethers.providers.JsonRpcProvider(config.rpc);
  const signer = new ethers.Wallet(config.deployerKey!, provider);
  const deployer = new NonceManager(signer);
  return {
    domain: config.domain,
    name: config.name,
    provider,
    deployer,
    confirmations: config.confirmations ?? 5,
    gas: config.gas ? parseGas(config.gas) : DEFAULT_GAS,
    config,
  };
}

export type RustIndex = {
  from: string;
  chunk: string; // TODO
};

export type RustSigner = {
  key: string;
  type: string; // TODO
};

export type RustConnection = {
  type: string; // TODO
  url: string;
};

export type RustContractBlock = {
  address: string;
  domain: string;
  name: string;
  rpcStyle: string; // TODO
  timelag: number;
  connection: RustConnection;
};

export type RustConfig = {
  environment: string;
  signers: Record<string, RustSigner>;
  replicas: Record<string, RustContractBlock>;
  home: RustContractBlock;
  tracing: {
    level: string;
    fmt: 'json' | 'pretty';
  };
  db: string;
  index?: RustIndex;
};
