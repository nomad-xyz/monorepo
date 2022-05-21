import { utils } from '@nomad-xyz/multi-provider';
import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
dotenv.config({});

import { PrismaClient } from '@prisma/client';
import { DB } from '../core/db';
import Logger, { createLogger } from 'bunyan';
import { sleep } from '../core/utils';

const abi = [
  'function name() public view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function totalSupply() public view returns (uint256)',
];

function erc20(id: string, provider: ethers.providers.Provider) {
  return new ethers.Contract(utils.evmId(id), abi, provider);
}

type FrenSkills = string | [string, ...any];

class MakeFun {
  fren: ethers.Contract;
  presents: Promise<any>[];
  constructor(fren: ethers.Contract) {
    this.fren = fren;
    this.presents = [];
  }

  with(...skills: FrenSkills[]) {
    for (const skill of skills) {
      if (typeof skill === 'string') {
        this.presents.push(this.fren.functions[skill]());
      } else {
        this.presents.push(this.fren.functions[skill.shift()](...skill));
      }
    }
    return this;
  }

  async celebrate(): Promise<any[]> {
    return Promise.all(this.presents);
  }
}

class TokenFetcher {
  prisma: PrismaClient;
  sdk: BridgeContext;
  logger: Logger;
  constructor(prisma: PrismaClient, sdk: BridgeContext, logger: Logger) {
    this.prisma = prisma;
    this.sdk = sdk;
    this.logger = logger;
  }

  async connect() {
    await this.prisma.$connect();
  }

  async fetch(id: string, domain: number) {
    this.logger.debug(`Started fetching of token [${domain}, ${id}]`);
    const provider = this.sdk.mustGetProvider(domain);
    const token = erc20(id, provider);
    let name: string;
    let decimals: number;
    let symbol: string;
    let totalSupply: ethers.BigNumber;
    let balance: ethers.BigNumber;
    try {
      [[name], [decimals], [symbol], [totalSupply], [balance]] =
        await new MakeFun(token)
          .with('name', 'decimals', 'symbol', 'totalSupply', [
            'balanceOf',
            this.sdk.mustGetBridge(domain).bridgeRouter.address,
          ])
          .celebrate();
    } catch (e) {
      this.logger.error(`Failed getting info for ${id} ${domain}`);
      return;
    }

    const data = {
      id,
      domain,
      name,
      decimals,
      symbol,
      totalSupply: totalSupply.toHexString(),
      balance: balance.toHexString(),
    };

    // Updating data in the db
    await this.prisma.token.upsert({
      where: {
        id_domain: {
          id,
          domain,
        },
      },
      update: data,
      create: data,
    });

    this.logger.debug(`Updated token [${domain}, ${id}]`);

    // Determine remotes whether network is gov or not
    let remotes = this.sdk.domainNumbers.filter(
      (remoteDomain) => remoteDomain !== domain,
    );
    await Promise.all(
      remotes.map(async (remoteDomain) => {
        let remoteId: string;
        try {
          remoteId = await this.sdk
            .mustGetBridge(remoteDomain)
            .tokenRegistry.getRepresentationAddress(domain, id);
        } catch (e: any) {
          this.logger.debug(`Failed searching for replica from ${domain} at ${remoteDomain}. id: ${id}`)
          if (e?.code !== 'CALL_EXCEPTION') throw e;
          return;
        }
        if (remoteId === '0x' + '00'.repeat(20)) {
          this.logger.debug(`Haven't found the replica from ${domain} at ${remoteDomain}. id: ${id}`)
          return;
        }
        const provider = this.sdk.mustGetProvider(remoteDomain);
        const token = erc20(remoteId, provider);

        let _name: string;
        let _decimals: number;
        let _symbol: string;
        let _totalSupply: ethers.BigNumber;
        try {
          [[_name], [_decimals], [_symbol], [_totalSupply]] = await new MakeFun(
            token,
          )
            .with('name', 'decimals', 'symbol', 'totalSupply')
            .celebrate();
        } catch (e) {
          this.logger.error(`Failed getting info for replica from ${domain} as ${remoteDomain} id: ${id}, remoteId: ${remoteId}`);
          return;
        }

        if (name !== _name)
          this.logger.warn(
            `Original token name !== replica's _name in TokenFetcher.fetch(): ${name} !== ${_name}. Domain: ${remoteDomain}, id: ${remoteId}`,
          );
        if (decimals !== _decimals)
          this.logger.warn(
            `Original token decimals !== replica's _decimals in TokenFetcher.fetch(): ${decimals} !== ${_decimals}. Domain: ${remoteDomain}, id: ${remoteId}, name: ${name}, remote name: ${_name}`,
          );
        if (symbol !== _symbol)
          this.logger.warn(
            `Original token symbol !== replica's _symbol in TokenFetcher.fetch(): ${symbol} !== ${_symbol}. Domain: ${remoteDomain}, id: ${remoteId}, name: ${name}`,
          );
        // if (!balance.eq(_totalSupply)) console.warn(`totalSupply of ${symbol} (from ${domain}) at ${remoteDomain}\nis ${_totalSupply.toString()}\n want: ${balance}`);

        const data = {
          id: remoteId,
          domain: remoteDomain,
          token: {
            connect: {
              id_domain: {
                id,
                domain,
              },
            },
          },
          totalSupply: _totalSupply.toHexString(),
        };

        // Update replicas
        await this.prisma.replica.upsert({
          where: {
            id_domain: {
              id: remoteId,
              domain: remoteDomain,
            },
          },
          update: data,
          create: data,
        });

        this.logger.debug(
          `Updated Replica at doamin ${remoteDomain} for [${domain}, ${id}]`,
        );
      }),
    );
  }
}

export async function startTokenUpdater(
  sdk: BridgeContext,
  db: DB,
  logger: Logger,
): Promise<[() => void, Promise<void>]> {
  // Promise<[() => void, Promise<null>]>
  const f = new TokenFetcher(db.client, sdk, logger);
  await f.connect();

  const updateTokens = async () => {
    const tokens = await db.client.messages.findMany({
      select: {
        tokenId: true,
        tokenDomain: true,
      },
      distinct: ['tokenId', 'tokenDomain'],
      where: {},
    });
    logger.debug(`Found tokens:`, tokens.length);
    const result = await Promise.all(
      tokens
        .filter(({ tokenId, tokenDomain }) => tokenId && tokenDomain)
        .map(({ tokenId, tokenDomain }) => f.fetch(tokenId!, tokenDomain!)),
    );
    return result;
  };

  let stopper = false;

  const ff = () => {
    stopper = true;
  };

  const p: Promise<void> = new Promise(async (resolve, reject) => {
    let t = 0;
    while (true) {
      if (stopper) {
        resolve();
        break;
      }
      try {
        await updateTokens();
        t = 0;
        await sleep(5 * 60 * 1000);
      } catch (e) {
        logger.warn(`Failed updating tokens:`, e);
        if (t++ > 10) {
          logger.error(
            `Exhausted updating tokens retries (${t} retries). Going down... (probably with unhandled promise rejection)`,
          );
          reject();
          break;
        }
        await sleep(10 * 1000);
      }
    }
  });

  return [ff, p];
}
