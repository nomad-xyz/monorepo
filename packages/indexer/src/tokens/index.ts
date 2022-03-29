import { utils } from "@nomad-xyz/multi-provider";
import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config({});

import { PrismaClient } from "@prisma/client";

const abi = [
  "function name() public view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function totalSupply() public view returns (uint256)",
];

function erc20(id: string, provider: ethers.providers.Provider) {
  return new ethers.Contract(utils.evmId(id), abi, provider);
}

type Fword = string | [string, ...any];

class F {
  f: ethers.Contract;
  p: Promise<any>[];
  constructor(f: ethers.Contract) {
    this.f = f;
    this.p = [];
  }

  with(...fwords: Fword[]) {
    for (const fword of fwords) {
      if (typeof fword === "string") {
        this.p.push(this.f.functions[fword]());
      } else {
        this.p.push(this.f.functions[fword.shift()](...fword));
      }
    }
    return this;
  }

  async all(): Promise<any[]> {
    return Promise.all(this.p);
  }
}

class TokenFetcher {
  prisma: PrismaClient;
  sdk: BridgeContext;
  constructor(prisma: PrismaClient, sdk: BridgeContext) {
    this.prisma = prisma;
    this.sdk = sdk;
  }

  async connect() {
    await this.prisma.$connect();
  }

  async fetch(id: string, domain: number) {
    const provider = this.sdk.mustGetProvider(domain);
    const token = erc20(id, provider);
    let name: string;
    let decimals: number;
    let symbol: string;
    let totalSupply: ethers.BigNumber;
    let balance: ethers.BigNumber;
    try {
      [[name], [decimals], [symbol], [totalSupply], [balance]] = await new F(
        token
      )
        .with("name", "decimals", "symbol", "totalSupply", [
          "balanceOf",
          this.sdk.mustGetBridge(domain).bridgeRouter.address,
        ])
        .all();
    } catch (e) {
      console.error(`Failed getting info for ${id} ${origin}`);
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

    let remotes: number[];
    if (domain === this.sdk.governor.domain) {
      remotes = this.sdk.domainNumbers.filter(
        (remoteDomain) => remoteDomain !== domain
      );
    } else {
      remotes = [this.sdk.governor.domain];
    }

    await Promise.all(
      remotes.map(async (remoteDomain) => {
        let remoteId: string;
        try {
          remoteId = await this.sdk
            .mustGetBridge(remoteDomain)
            .tokenRegistry.getRepresentationAddress(domain, id);
        } catch (e: any) {
          if (e?.code !== "CALL_EXCEPTION") throw e;
          return;
        }
        if (remoteId === "0x" + "00".repeat(20)) {
          return;
        }
        const provider = this.sdk.mustGetProvider(remoteDomain);
        const token = erc20(remoteId, provider);

        let _name: string;
        let _decimals: number;
        let _symbol: string;
        let _totalSupply: ethers.BigNumber;
        try {
          [[_name], [_decimals], [_symbol], [_totalSupply]] = await new F(token)
            .with("name", "decimals", "symbol", "totalSupply")
            .all();
        } catch (e) {
          console.error(`Failed getting info for ${id} ${domain}`);
          return;
        }

        if (name !== _name) throw new Error(`---->name`);
        if (decimals !== _decimals) throw new Error(`---->decimals`);
        if (symbol !== _symbol) throw new Error(`---->symbol`);
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
      })
    );
  }
}

const environment = "production";

function getSdk() {
  let sdk: BridgeContext;
  if (environment === "production") {
    sdk = new BridgeContext("production");
  } else if (environment === "staging") {
    sdk = new BridgeContext("staging");
  } else if (environment === "development") {
    sdk = new BridgeContext("development");
  } else {
    throw new Error(`Enviroment '${environment}' is not suppoerted`);
  }

  sdk.domainNumbers.forEach((domain: number) => {
    const name = sdk.mustGetDomain(domain).name.toUpperCase();
    const rpcEnvKey = `${name}_RPC`;
    const rpc = process.env[rpcEnvKey];

    if (!rpc)
      throw new Error(
        `RPC url for domain ${domain} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`
      );

    sdk.registerRpcProvider(domain, rpc);
  });

  return sdk;
}

const tokens: [string, number][] = [
  [
    "0x0000000000000000000000000bf0d26a527384bcc4072a6e2bca3fc79e49fa2d",
    6648936,
  ],
  [
    "0x0000000000000000000000002260fac5e5542a773aa44fbcfedf7c193bc2c599",
    6648936,
  ],
  [
    "0x0000000000000000000000003432b6a60d23ca0dfca7761b7ab56459d9c964d0",
    6648936,
  ],
  [
    "0x0000000000000000000000006b175474e89094c44da98b954eedeac495271d0f",
    6648936,
  ],
  [
    "0x000000000000000000000000853d955acef822db058eb8505911ed77f175b99e",
    6648936,
  ],
  [
    "0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    6648936,
  ],
  [
    "0x000000000000000000000000acc15dc74880c9944775448304b263d191c6077f",
    1650811245,
  ],
  [
    "0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    6648936,
  ],
  [
    "0x000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7",
    6648936,
  ],
  [
    "0x000000000000000000000000f0dc76c22139ab22618ddfb498be1283254612b1",
    6648936,
  ],
];

(async () => {
  const sdk = getSdk();

  const prisma = new PrismaClient();
  const f = new TokenFetcher(prisma, sdk);
  await f.connect();

  for (const [id, domain] of tokens) {
    await f.fetch(id, domain);
  }
})();
