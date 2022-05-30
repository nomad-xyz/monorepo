import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import { RateLimiter } from 'limiter';

const SINGLE_REQUEST_CU = 25;

export interface CupsLimiterStrategy {
  cu: number;
  ms: number;
  cupsPerGetBlock: number;
  cupsPerGetTransaction: number;
  cupsPerGetTransactionReceipt: number;
  cupsPerGetBlockNumber: number;
  cupsPerGetLogs: number;
}

export interface RPPLimiterStrategy {
  requests: number;
  ms: number;
}

export const DefaultCups = {
  cupsPerGetBlock: 16,
  cupsPerGetTransaction: 17,
  cupsPerGetTransactionReceipt: 15,
  cupsPerGetBlockNumber: 10,
  cupsPerGetLogs: 75,
};

export const infuraDefaultLimiterStrategyDaily: RPPLimiterStrategy = {
  requests: 100_000,
  ms: 24 * 60 * 60 * 1000,
};

export const xxDefaultLimiterStrategy: CupsLimiterStrategy = {
  cu: 1.15 * SINGLE_REQUEST_CU,
  ms: 1000,
  ...DefaultCups,
};

export const infuraDefaultLimiterStrategy: CupsLimiterStrategy = {
  cu: 1.15 * SINGLE_REQUEST_CU,
  ms: 1000,
  ...DefaultCups,
};

export const alchemyDefaultLimiterStrategy: CupsLimiterStrategy = {
  cu: 330,
  ms: 1000,
  cupsPerGetBlock: 16,
  cupsPerGetTransaction: 17,
  cupsPerGetTransactionReceipt: 15,
  cupsPerGetBlockNumber: 10,
  cupsPerGetLogs: 75,
};

const MAX_CUPS = 75;

export class RPCRateLimiter {
  limiter: RateLimiter;
  strategy: CupsLimiterStrategy;
  constructor(strategy: CupsLimiterStrategy | RPPLimiterStrategy) {
    if ('cu' in strategy) {
      this.strategy = strategy;
    } else if ('requests' in strategy) {
      this.strategy = {
        cu: strategy.requests,
        ms: strategy.ms,
        cupsPerGetBlock: 16,
        cupsPerGetTransaction: 17,
        cupsPerGetTransactionReceipt: 15,
        cupsPerGetBlockNumber: 10,
        cupsPerGetLogs: 75,
      };
    } else {
      throw new Error(`Limiting strategy undefined`);
    }

    const multiplier = Math.ceil(MAX_CUPS / this.strategy.cu);
    const tokensPerInterval = MAX_CUPS * multiplier;
    const interval = this.strategy.ms * multiplier;

    this.limiter = new RateLimiter({ tokensPerInterval, interval });
  }

  async getBlockWithTransactions() {
    await this.limiter.removeTokens(this.strategy.cupsPerGetBlock || 1);
  }

  async getBlock() {
    await this.limiter.removeTokens(this.strategy.cupsPerGetBlock);
  }

  async getTransaction() {
    await this.limiter.removeTokens(this.strategy.cupsPerGetTransaction);
  }

  async getTransactionReceipt() {
    await this.limiter.removeTokens(this.strategy.cupsPerGetTransactionReceipt);
  }

  async getBlockNumber() {
    await this.limiter.removeTokens(this.strategy.cupsPerGetBlockNumber);
  }

  async getLogs() {
    await this.limiter.removeTokens(this.strategy.cupsPerGetLogs);
  }
}

export function strategyFromRPP(rps: number, secs = 1): CupsLimiterStrategy {
  return {
    cu: rps * SINGLE_REQUEST_CU,
    ms: secs * 1000,
    ...DefaultCups,
  };
}

export function tryLimitStrategyByName(
  name: string,
): CupsLimiterStrategy | RPPLimiterStrategy | undefined {
  const _name = name.toLowerCase();
  switch (_name) {
    case 'moonbeam':
      return strategyFromRPP(3.9); // 1.9
    case 'milkomedac1':
      return strategyFromRPP(3.86); // 1.86
    case 'xdai':
      return strategyFromRPP(3.1); // 2.61
    case 'evmos':
      return strategyFromRPP(2.1); // 0.93
    case 'evmostestnet':
      return strategyFromRPP(2.1); // 0.93
    case 'avalanche':
      return strategyFromRPP(3.66); // 3.66
    case 'candle':
        return strategyFromRPP(2.1); // 0.93
    default:
      return;
  }
}

export function tryLimitStrategyByUrl(
  url: string,
): CupsLimiterStrategy | RPPLimiterStrategy | undefined {
  const _url = url.toLowerCase();
  if (_url.includes('alchemy')) {
    return alchemyDefaultLimiterStrategy;
  } else if (_url.includes('infura')) {
    return infuraDefaultLimiterStrategy;
  }
}

export function getRateLimit(
  sdk: BridgeContext,
  domain: number,
): RPPLimiterStrategy | CupsLimiterStrategy {
  const name = sdk.mustGetDomain(domain).name.toUpperCase();
  const rpcEnvKey = `${name}_RPC`;
  const defaultRPC = sdk.conf.rpcs[name]?.[0];
  const rpc = process.env[rpcEnvKey] || defaultRPC;

  if (!rpc)
    throw new Error(
      `RPC url for domain ${domain} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`,
    );

  let strategy: CupsLimiterStrategy | RPPLimiterStrategy | undefined;
  if (!rpc.includes(',')) {
    sdk.registerRpcProvider(domain, rpc);

    strategy = tryLimitStrategyByUrl(rpc);
  }

  if (!strategy) {
    strategy = tryLimitStrategyByName(name) || strategyFromRPP(1);
  }

  return strategy;
}
