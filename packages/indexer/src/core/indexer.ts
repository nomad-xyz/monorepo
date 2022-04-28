import { Orchestrator } from "./orchestrator";
import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import fs from "fs";
import {
  EventType,
  NomadishEvent,
  EventSource,
  eventTypeToOrder,
  onlyUniqueEvents,
} from "./event";
import { Home, Replica } from "@nomad-xyz/contracts-core";
import { ethers } from "ethers";
import { FailureCounter, KVCache, replacer, retry, reviver } from "./utils";
import { BridgeRouter } from "@nomad-xyz/contracts-bridge";
import pLimit from "p-limit";
import { RpcRequestMethod } from "./metrics";
import Logger from "bunyan";
import { createClient } from "redis";
import { RedisClient } from "./types";

type ShortTx = {
  gasPrice?: ethers.BigNumber;
  timestamp: number;
  from: string;
  to?: string;
  gasLimit: ethers.BigNumber;
};

function blockSpeed(
  from: number,
  to: number,
  start: Date,
  finish: Date
): number {
  const blocks = to - from + 1;
  const timeS = (finish.valueOf() - start.valueOf()) / 1000;
  const speed = blocks / timeS;
  return speed;
}

function txEncode(tx: ShortTx): string {
  const {
    gasPrice, // ?
    timestamp,
    from,
    to, // ?
    gasLimit,
  } = tx as ShortTx;
  return JSON.stringify(
    {
      gasPrice, // ?
      timestamp,
      from,
      to, // ?
      gasLimit,
    },
    replacer
  );
}

function txDecode(encoded: string): ShortTx {
  return JSON.parse(encoded, reviver);
}

type ShortTxReceipt = {
  effectiveGasPrice: ethers.BigNumber;
  cumulativeGasUsed: ethers.BigNumber;
  gasUsed: ethers.BigNumber;
  from: string;
  to: string;
  status?: number;
};

function txReceiptEncode(receipt: ethers.providers.TransactionReceipt): string {
  const { effectiveGasPrice, cumulativeGasUsed, from, to, gasUsed, status } =
    receipt as ShortTxReceipt;
  return JSON.stringify(
    {
      effectiveGasPrice,
      cumulativeGasUsed,
      from,
      to,
      gasUsed,
      status,
    },
    replacer
  );
}

function txReceiptDecode(encoded: string): ShortTxReceipt {
  return JSON.parse(encoded, reviver);
}

const BATCH_SIZE = process.env.BATCH_SIZE
  ? parseInt(process.env.BATCH_SIZE)
  : 2000;
const RETRIES = 100;
const TO_BLOCK_LAG = 1;
const FROM_BLOCK_LAG = 2;

export class Indexer {
  domain: number;
  sdk: BridgeContext;
  orchestrator: Orchestrator;
  persistance: Persistance;
  blockCache: KVCache;
  blockTimestampCache: KVCache;
  txCache: KVCache;
  txReceiptCache: KVCache;
  limit: pLimit.Limit;
  lastBlock: number;
  logger: Logger;
  lastIndexed: Date;
  failureCounter: FailureCounter;
  develop: boolean;

  eventCallback: undefined | ((event: NomadishEvent) => void);

  constructor(
    domain: number,
    sdk: BridgeContext,
    orchestrator: Orchestrator,
    redis?: RedisClient
  ) {
    this.domain = domain;
    this.sdk = sdk;
    this.orchestrator = orchestrator;
    this.develop = false;
    if (this.develop) {
      this.persistance = new RamPersistance(
        `/tmp/persistance_${this.domain}.json`
      );
    } else {
      this.persistance = new RedisPersistance(domain, redis);
    }
    this.blockCache = new KVCache(
      "b_" + String(this.domain),
      this.orchestrator.db
    );
    this.blockTimestampCache = new KVCache(
      "bts_" + String(this.domain),
      this.orchestrator.db
    );
    this.txCache = new KVCache(
      "tx_" + String(this.domain),
      this.orchestrator.db
    );
    this.txReceiptCache = new KVCache(
      "txr_" + String(this.domain),
      this.orchestrator.db
    );
    // 20 concurrent requests per indexer
    this.limit = pLimit(this.domainToLimit());
    this.lastBlock = 0;
    this.logger = orchestrator.logger.child({
      span: "indexer",
      network: this.network,
      domain: this.domain,
    });
    this.lastIndexed = new Date(0);
    this.failureCounter = new FailureCounter(60); // 1 hour
  }

  domainToLimit(): number {
    return (
      {
        1650811245: 20,
        6648936: 20,
      }[this.domain] || 100
    );
  }

  get provider(): ethers.providers.Provider {
    return this.sdk.getProvider(this.domain)!;
  }

  get network(): string {
    return this.orchestrator.domain2name(this.domain);
  }

  async getBlockInfoLegacy(
    blockNumber: number
  ): Promise<[number, Map<string, string>]> {
    const possibleBlock = await this.blockCache.get(String(blockNumber));
    if (possibleBlock) {
      const [ts, txs] = possibleBlock.split(".");
      const x: string[] = txs.split(",");
      const senders2hashes: Map<string, string> = new Map(
        x.map((tx) => tx.split(":") as [string, string])
      );
      return [parseInt(ts), senders2hashes];
    }

    const [block, error] = await retry(
      async () => {
        return await this.limit(async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetBlockWithTxs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await this.provider.getBlockWithTransactions(blockNumber);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetBlockWithTxs,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        });
      },
      RETRIES,
      (error: any) => {
        this.orchestrator.metrics.incRpcErrors(
          RpcRequestMethod.GetBlockWithTxs,
          this.network,
          error.code
        );
        this.logger.warn(
          `Retrying after RPC Error... Block: ${blockNumber}, Error: ${error.code}, msg: ${error.message}`
        );
        this.failureCounter.add();
      }
    );
    if (!block) {
      throw new Error(
        `An RPC foo error occured, retried exhausted. Block: ${blockNumber} Error: ${error}`
      );
    }
    const time = block.timestamp * 1000;
    const senders2hashes: Map<string, string> = new Map(
      block.transactions.map((tx) => [tx.from, tx.hash])
    );
    const senders2hashesStr = Array.from(senders2hashes.entries())
      .map(([from, hash]) => `${from}:${hash}`)
      .join(",");
    await this.blockCache.set(
      String(blockNumber),
      `${time}.${senders2hashesStr}`
    );
    // await this.block2timeCache.set(String(blockNumber), String(block.transactions.map(tx => tx.from).join(',')));
    return [time, senders2hashes];
  }

  async getBlockTimestamp(blockNumber: number): Promise<number> {
    const possible = await this.blockTimestampCache.get(String(blockNumber));
    if (possible) {
      return parseInt(possible);
    }

    const [block, error] = await retry(
      async () => {
        return await this.limit(async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetBlock,
            this.network
          );
          const start = new Date().valueOf();
          const r = await this.provider.getBlock(blockNumber);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetBlock,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        });
      },
      RETRIES,
      (error: any) => {
        this.orchestrator.metrics.incRpcErrors(
          RpcRequestMethod.GetBlock,
          this.network,
          error.code
        );
        this.logger.warn(
          `Retrying after RPC Error... Block number: ${blockNumber}, Error: ${error.code}, msg: ${error.message}`
        );
        this.failureCounter.add();
      }
    );
    if (!block) {
      throw new Error(
        `An RPC foo error occured, retried exhausted. Block number: ${blockNumber} Error: ${error}`
      );
    }

    const timestamp = block.timestamp * 1000;

    await this.blockTimestampCache.set(String(blockNumber), String(timestamp));

    return timestamp;
  }

  async getTransaction(hash: string, forceTimestamp = false): Promise<ShortTx> {
    const possible = await this.txCache.get(hash);
    if (possible) {
      return txDecode(possible);
    }

    const [tx, error] = await retry(
      async () => {
        return await this.limit(async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetTx,
            this.network
          );
          const start = new Date().valueOf();
          const r = await this.provider.getTransaction(hash);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetTx,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        });
      },
      RETRIES,
      (error: any) => {
        this.orchestrator.metrics.incRpcErrors(
          RpcRequestMethod.GetTx,
          this.network,
          error.code
        );
        this.logger.warn(
          `Retrying after RPC Error... TX hash: ${hash}, Error: ${error.code}, msg: ${error.message}`
        );
        this.failureCounter.add();
      }
    );
    if (!tx) {
      this.logger.error(
        `An RPC error occured, retried exhausted. TX hash: ${hash} Error: ${error}`
      );
      throw new Error(
        `An RPC foo error occured, retried exhausted. TX hash: ${hash} Error: ${error}`
      );
    }

    let timestamp: number;

    if (forceTimestamp) {
      timestamp = new Date().valueOf();
    } else if (!tx.timestamp) {
      if (!tx.blockNumber)
        throw new Error(
          `An RPC foo error occured. TX hash: ${hash} has no blockNumber. WTF?`
        );
      this.failureCounter.add();

      timestamp = await this.getBlockTimestamp(tx.blockNumber!);
    } else {
      timestamp = tx.timestamp! * 1000;
    }

    let shortTx = {
      gasPrice: tx.gasPrice,
      timestamp,
      from: tx.from,
      to: tx.to,
      gasLimit: tx.gasLimit,
    };

    await this.txCache.set(hash, txEncode(shortTx));

    return shortTx;
  }

  async getTransactionReceipt(hash: string): Promise<ShortTxReceipt> {
    const possible = await this.txReceiptCache.get(hash);
    if (possible) {
      return txReceiptDecode(possible);
    }

    const [receipt, error] = await retry(
      async () => {
        return await this.limit(async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetTxReceipt,
            this.network
          );
          const start = new Date().valueOf();
          const r = await this.provider.getTransactionReceipt(hash);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetTxReceipt,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        });
      },
      RETRIES,
      (error: any) => {
        this.orchestrator.metrics.incRpcErrors(
          RpcRequestMethod.GetTxReceipt,
          this.network,
          error.code
        );
        this.logger.warn(
          `Retrying after RPC Error... , Error: ${error.code}, msg: ${error.message}`
        );
        this.failureCounter.add();
      }
    );
    if (!receipt) {
      this.logger.error(
        `An RPC error occured, retried exhausted. TX hash: ${hash} Error: ${error}`
      );
      throw new Error(
        `An RPC receipt error occured, retried exhausted. TX hash: ${hash} Error: ${error}`
      );
    }

    await this.txReceiptCache.set(hash, txReceiptEncode(receipt));

    return receipt;
  }

  async getAdditionalInfo(
    hash: string
  ): Promise<{ timestamp: number; gasUsed: ethers.BigNumber; from: string }> {
    const { timestamp } = await this.getTransaction(hash, false);

    const { gasUsed, from } = await this.getTransactionReceipt(hash);

    return { timestamp, gasUsed, from };
  }

  async init() {
    await this.blockCache.init();
    await this.persistance.init();
  }

  get height(): number {
    return this.persistance.height;
  }

  get from(): number {
    return this.persistance.from;
  }

  home(): Home {
    return this.sdk.getCore(this.domain)!.home;
  }

  bridgeRouter(): BridgeRouter {
    return this.sdk.mustGetBridge(this.domain).bridgeRouter;
  }

  replicaForDomain(domain: number): Replica {
    return this.sdk.getReplicaFor(domain, this.domain)!;
  }

  async updateAll(replicas: number[]) {
    const from = Math.max(
      this.lastBlock + 1,
      this.persistance.height,
      this.sdk.getBridge(this.domain)?.deployHeight || 0
    );
    const [to, error] = await retry(
      async () => {
        this.orchestrator.metrics.incRpcRequests(
          RpcRequestMethod.GetBlockNumber,
          this.network
        );
        const start = new Date().valueOf();
        const r = await this.provider.getBlockNumber();
        this.orchestrator.metrics.observeRpcLatency(
          RpcRequestMethod.GetBlockNumber,
          this.network,
          new Date().valueOf() - start
        );
        return r - TO_BLOCK_LAG;
      },
      RETRIES,
      (error: any) => {
        this.orchestrator.metrics.incRpcErrors(
          RpcRequestMethod.GetBlockNumber,
          this.network,
          error.code
        );
        this.logger.warn(
          `Retrying after RPC Error on .getBlockNumber() method... Error: ${error}, msg: ${error.message}`
        );
        this.failureCounter.add();
      }
    );
    if (!to) {
      throw new Error(
        `Retrying .getBlockNumber() method... exhausted maximum retry count. Throwing: ${error}`
      );
    }

    if (from > to) {
      this.logger.info(
        `Skipped fetching events, because from is higher than to. From: ${from}, to: ${to}`
      );
      return [];
    }

    this.logger.info(`Fetching events for from: ${from}, to: ${to}`);

    const fetchEvents = async (
      from: number,
      to: number
    ): Promise<NomadishEvent[]> => {
      const homeEvents = await this.fetchHome(from, to);
      const replicasEvents = (
        await Promise.all(replicas.map((r) => this.fetchReplica(r, from, to)))
      ).flat();
      const bridgeRouterEvents = await this.fetchBridgeRouter(from, to);

      return [...homeEvents, ...replicasEvents, ...bridgeRouterEvents];
    };

    const allEvents: NomadishEvent[] = [];

    const domain2batchSize = new Map([
      [1650811245, 500],
      [6648936, 5000],
    ]);

    const batchSize = domain2batchSize.get(this.domain) || BATCH_SIZE;
    let batchFrom = from;
    let batchTo = Math.min(to, from + batchSize);
    const startAll = new Date();

    while (true) {
      const done = Math.floor(((batchTo - from + 1) / (to - from + 1)) * 100);
      this.logger.debug(
        `Fetching batch of events for from: ${batchFrom}, to: ${batchTo}, [${done}%]`
      );

      const insuredBatchFrom = batchFrom - FROM_BLOCK_LAG;

      const startBatch = new Date();
      const events = await fetchEvents(insuredBatchFrom, batchTo);
      const finishBatch = new Date();
      if (!events) throw new Error(`KEk`);
      events.sort((a, b) =>
        a.ts === b.ts ? eventTypeToOrder(a) - eventTypeToOrder(b) : a.ts - b.ts
      );
      await this.persistance.store(...events);
      try {
        if (this.develop) {
          this.dummyTestEventsIntegrity(batchTo);
          this.logger.debug(
            `Integrity test PASSED between ${insuredBatchFrom} and ${batchTo}`
          );
        }
      } catch (e) {
        const pastFrom = batchFrom;
        const pastTo = batchTo;
        batchFrom = batchFrom - batchSize / 2;
        batchTo = batchFrom + batchSize;
        this.logger.warn(
          `Integrity test not passed between ${pastFrom} and ${pastTo}, recollecting between ${batchFrom} and ${batchTo}: ${e}`
        );
        continue;
      }
      const filteredEvents = events.filter((newEvent) =>
        allEvents.every(
          (oldEvent) => newEvent.uniqueHash() !== oldEvent.uniqueHash()
        )
      );
      allEvents.push(...filteredEvents);
      const speed = blockSpeed(batchFrom, batchTo, startBatch, finishBatch);
      this.logger.debug(
        `Fetched batch for domain ${this.domain}. Blocks: ${
          batchTo - batchFrom + 1
        } (${speed}b/sec). Got events: ${filteredEvents.length}`
      );
      if (batchTo >= to) break;
      batchFrom = batchTo + 1;
      batchTo = Math.min(to, batchFrom + batchSize);
    }

    const finishedAll = new Date();

    if (!allEvents) throw new Error("kek");

    allEvents.sort((a, b) => {
      if (a.ts === b.ts) {
        return eventTypeToOrder(a) - eventTypeToOrder(b);
      } else {
        return a.ts - b.ts;
      }
    });

    const allEventsUnique = onlyUniqueEvents(allEvents);

    if (this.develop || true) this.dummyTestEventsIntegrity();
    const speed = blockSpeed(from, to, startAll, finishedAll);
    this.logger.info(
      `Fetched all for domain ${this.domain}. Blocks: ${
        to - from + 1
      } (${speed}b/sec). Got events: ${allEventsUnique.length}`
    );
    this.lastBlock = to;

    return allEventsUnique;
  }

  // TODO: Just the last ones received
  async dummyTestEventsIntegrity(blockTo?: number) {
    // Get all events for the domain
    let allEvents = await this.persistance.allEvents();
    // If there is a max block requirement, proceed only with them
    if (blockTo) allEvents = allEvents.filter((e) => e.block <= blockTo);

    if (allEvents.length === 0) {
      this.logger.debug(`No events to test integrity!!!`);
      return;
    }

    // Creating a map of roots, which looks like this
    // {root0:root1, root1:root2, root2:root4, ...}
    const homeRoots = new Map<string, string>();
    let initialHomeRoot = "";
    let initialHomeTimestamp = Number.MAX_VALUE;
    let homeRootsTotal = 0;

    type ReplicaDomainInfo = {
      root: string;
      ts: number;
      roots: Map<string, string>;
      total: number;
    };

    const initialReplica: Map<number, ReplicaDomainInfo> = new Map();

    // For every event
    for (const event of allEvents) {
      // if it is a home update
      if (event.eventType == EventType.HomeUpdate) {
        const { oldRoot, newRoot } = event.eventData as {
          oldRoot: string;
          newRoot: string;
        };
        // add the root and increment
        homeRoots.set(oldRoot, newRoot);
        homeRootsTotal += 1;
        // if the event is the oldest in the set, we make the root be the initial one
        if (event.ts < initialHomeTimestamp) {
          initialHomeTimestamp = event.ts;
          initialHomeRoot = oldRoot;
        }
        // or Replica update
      } else if (event.eventType == EventType.ReplicaUpdate) {
        const { oldRoot, newRoot } = event.eventData as {
          oldRoot: string;
          newRoot: string;
        };
        const domain = event.replicaOrigin;
        if (!initialReplica.has(domain)) {
          initialReplica.set(domain, {
            root: "",
            ts: Number.MAX_VALUE,
            roots: new Map(),
            total: 0,
          });
        }
        const replica = initialReplica.get(domain)!;
        replica.roots.set(oldRoot, newRoot);
        replica.total += 1;
        if (event.ts < replica.ts) {
          replica.ts = event.ts;
          replica.root = oldRoot;
        }
      }
    }

    const homeRootsObserved = homeRootsTotal;
    while (true) {
      let newRoot = homeRoots.get(initialHomeRoot);
      if (newRoot) {
        initialHomeRoot = newRoot;
        homeRootsTotal -= 1;
      } else {
        break;
      }
    }
    if (homeRootsTotal !== 0) {
      // fs.writeFileSync(`/outputs/kek${this.domain}.json`, JSON.stringify(allEvents, replacer));
      throw new Error(
        `${this.domain}: Left roots for home supposed to be 0, but is ${homeRootsTotal} from total of ${homeRootsObserved}`
      );
    }

    for (const [domain, replica] of initialReplica) {
      let root = replica.root;
      let total = replica.total;
      while (true) {
        let newRoot = replica.roots.get(root);
        if (newRoot) {
          root = newRoot;
          total -= 1;
        } else {
          break;
        }
      }
      if (total !== 0)
        throw new Error(
          `${this.domain}: Left roots for replica ${domain} supposed to be 0, but is ${total} replica for domain ${domain}`
        );
    }
  }

  savePersistance() {
    this.persistance.persist();
  }

  async fetchBridgeRouter(from: number, to: number) {
    const br = this.bridgeRouter();
    const allEvents = [];
    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await br.queryFilter(br.filters.Send(), from, to);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetLogs,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        },
        RETRIES,
        (e) => {
          this.orchestrator.metrics.incRpcErrors(
            RpcRequestMethod.GetBlockNumber,
            this.network,
            e.code
          );
          this.logger.warn(
            `Some error happened at retrying getting logs for BridgeRouter.Send event between blocks ${from} and ${to}, error: ${e.message}`
          );
          this.failureCounter.add();
        }
      );
      if (error) {
        this.logger.error(
          `Couldn't recover the error after ${RETRIES} retries`
        );
        throw error;
      }
      if (events === undefined) {
        throw new Error(
          `There is no error, but events for some reason are still undefined`
        );
      }
      const parsedEvents = await Promise.all(
        events.map(async (event) => {
          let { timestamp, gasUsed } = await this.getAdditionalInfo(
            event.transactionHash
          );
          return new NomadishEvent(
            this.domain,
            EventType.BridgeRouterSend,
            0,
            timestamp,
            event.blockNumber,
            EventSource.Fresh,
            gasUsed,
            event.transactionHash,
            {
              token: event.args[0],
              from: event.args[1],
              toDomain: event.args[2],
              toId: event.args[3],
              amount: event.args[4],
              fastLiquidityEnabled: event.args[5],
            }
          );
        })
      );
      allEvents.push(...parsedEvents);
    }

    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await br.queryFilter(br.filters.Receive(), from, to);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetLogs,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        },
        RETRIES,
        (e) => {
          this.orchestrator.metrics.incRpcErrors(
            RpcRequestMethod.GetLogs,
            this.network,
            e.code
          );
          this.logger.warn(
            `Some error happened at retrying getting logs for BridgeRouter.Receive event between blocks ${from} and ${to}, error: ${e.message}`
          );
          this.failureCounter.add();
        }
      );
      if (error) {
        this.logger.error(
          `Couldn't recover the error after ${RETRIES} retries`
        );
        throw error;
      }
      if (events === undefined) {
        throw new Error(
          `There is no error, but events for some reason are still undefined`
        );
      }
      const parsedEvents = await Promise.all(
        events.map(async (event) => {
          let { timestamp, gasUsed } = await this.getAdditionalInfo(
            event.transactionHash
          );
          return new NomadishEvent(
            this.domain,
            EventType.BridgeRouterReceive,
            0,
            timestamp,
            event.blockNumber,
            EventSource.Fresh,
            gasUsed,
            event.transactionHash,
            {
              originAndNonce: event.args[0],
              token: event.args[1],
              recipient: event.args[2],
              liquidityProvider: event.args[3],
              amount: event.args[4],
            }
          );
        })
      );
      allEvents.push(...parsedEvents);
    }

    return allEvents;
  }

  async fetchHome(from: number, to: number) {
    let fetchedEvents: NomadishEvent[] = [];

    const home = this.home();
    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await home.queryFilter(home.filters.Dispatch(), from, to);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetLogs,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        },
        RETRIES,
        (e) => {
          this.orchestrator.metrics.incRpcErrors(
            RpcRequestMethod.GetLogs,
            this.network,
            e.code
          );
          this.logger.warn(
            `Some error happened at retrying getting logs for Home.Dispatch event between blocks ${from} and ${to}, error: ${e.message}`
          );
          this.failureCounter.add();
        }
      );
      if (error) {
        this.logger.error(
          `Couldn't recover the error after ${RETRIES} retries`
        );
        throw error;
      }
      if (events === undefined) {
        throw new Error(
          `There is no error, but events for some reason are still undefined`
        );
      }

      const parsedEvents = await Promise.all(
        events.map(async (event) => {
          let { timestamp, gasUsed } = await this.getAdditionalInfo(
            event.transactionHash
          );

          return new NomadishEvent(
            this.domain,
            EventType.HomeDispatch,
            0,
            timestamp,
            event.blockNumber,
            EventSource.Fresh,
            gasUsed,
            event.transactionHash,
            {
              messageHash: event.args[0],
              leafIndex: event.args[1],
              destinationAndNonce: event.args[2],
              committedRoot: event.args[3],
              message: event.args[4],
            }
          );
        })
      );

      fetchedEvents.push(...parsedEvents);
    }

    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await home.queryFilter(home.filters.Update(), from, to);
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetLogs,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        },
        RETRIES,
        (e) => {
          this.orchestrator.metrics.incRpcErrors(
            RpcRequestMethod.GetLogs,
            this.network,
            e.code
          );
          this.logger.warn(
            `Some error happened at retrying getting logs for Home.Update event between blocks ${from} and ${to}, error: ${e.message}`
          );
          this.failureCounter.add();
        }
      );
      if (error) {
        this.logger.error(
          `Couldn't recover the error after ${RETRIES} retries`
        );
        throw error;
      }
      if (events === undefined) {
        throw new Error(
          `There is no error, but events for some reason are still undefined`
        );
      }

      const parsedEvents = await Promise.all(
        events.map(async (event) => {
          let { timestamp, gasUsed } = await this.getAdditionalInfo(
            event.transactionHash
          );
          return new NomadishEvent(
            this.domain,
            EventType.HomeUpdate,
            0,
            timestamp,
            event.blockNumber,
            EventSource.Fresh,
            gasUsed,
            event.transactionHash,
            {
              homeDomain: event.args[0],
              oldRoot: event.args[1],
              newRoot: event.args[2],
              signature: event.args[3],
            }
          );
        })
      );
      fetchedEvents.push(...parsedEvents);
    }

    return fetchedEvents;
  }

  async fetchReplica(domain: number, from: number, to: number) {
    let fetchedEvents: NomadishEvent[] = [];

    const replica = this.replicaForDomain(domain);
    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await replica.queryFilter(
            replica.filters.Update(),
            from,
            to
          );
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetLogs,
            this.network,
            new Date().valueOf() - start
          );
          return r;
        },
        RETRIES,
        (e) => {
          this.orchestrator.metrics.incRpcErrors(
            RpcRequestMethod.GetLogs,
            this.network,
            e.code
          );
          this.logger.warn(
            `Some error happened at retrying getting logs for Replica(of ${domain}, at ${this.domain}).Update event between blocks ${from} and ${to}, error: ${e.message}`
          );
          this.failureCounter.add();
        }
      );
      if (error) {
        this.logger.error(
          `Couldn't recover the error after ${RETRIES} retries`
        );
        throw error;
      }
      if (events === undefined) {
        throw new Error(
          `There is no error, but events for some reason are still undefined`
        );
      }

      const parsedEvents = await Promise.all(
        events.map(async (event) => {
          let { timestamp, gasUsed } = await this.getAdditionalInfo(
            event.transactionHash
          );
          return new NomadishEvent(
            this.domain,
            EventType.ReplicaUpdate,
            domain,
            timestamp,
            event.blockNumber,
            EventSource.Fresh,
            gasUsed,
            event.transactionHash,
            {
              homeDomain: event.args[0],
              oldRoot: event.args[1],
              newRoot: event.args[2],
              signature: event.args[3],
            }
          );
        })
      );
      fetchedEvents.push(...parsedEvents);
    }

    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await replica.queryFilter(
            replica.filters.Process(),
            from,
            to
          );
          this.orchestrator.metrics.observeRpcLatency(
            RpcRequestMethod.GetLogs,
            this.network,
            new Date().valueOf() - start
          );

          return r;
        },
        RETRIES,
        (e) => {
          this.orchestrator.metrics.incRpcErrors(
            RpcRequestMethod.GetLogs,
            this.network,
            e.code
          );
          this.logger.warn(
            `Some error happened at retrying getting logs for Replica(of ${domain}, at ${this.domain}).Process event between blocks ${from} and ${to}, error: ${e.message}`
          );
          this.failureCounter.add();
        }
      );
      if (error) {
        this.logger.error(
          `Couldn't recover the error after ${RETRIES} retries`
        );
        throw error;
      }
      if (events === undefined) {
        throw new Error(
          `There is no error, but events for some reason are still undefined`
        );
      }

      const parsedEvents = await Promise.all(
        events.map(async (event) => {
          let { timestamp, gasUsed } = await this.getAdditionalInfo(
            event.transactionHash
          );
          return new NomadishEvent(
            this.domain,
            EventType.ReplicaProcess,
            domain,
            timestamp,
            event.blockNumber,
            EventSource.Fresh,
            gasUsed,
            event.transactionHash,
            {
              messageHash: event.args[0],
              success: event.args[1],
              returnData: event.args[2],
            }
          );
        })
      );
      fetchedEvents.push(...parsedEvents);
    }
    return fetchedEvents;
  }
}

export abstract class Persistance {
  initiated: boolean;
  from: number;
  height: number;
  constructor() {
    this.initiated = false;
    this.from = -1;
    this.height = -1;
  }

  abstract store(...events: NomadishEvent[]): Promise<void>;
  abstract init(): Promise<void>;
  abstract sortSorage(): void;
  abstract allEvents(): Promise<NomadishEvent[]>;
  abstract persist(): void;
}

export class RedisPersistance extends Persistance {
  client: RedisClient;
  domain: number;

  constructor(domain: number, client?: RedisClient) {
    super();
    this.client =
      client ||
      createClient({
        url: process.env.REDIS_URL || "redis://redis:6379",
      });
    this.domain = domain;

    this.client.on("error", (err) => console.log("Redis Client Error", err));
  }

  async updateFromTo(block: number) {
    if (block < this.from || this.from === -1) this.from = block;
    if (block > this.height || this.height === -1) this.height = block;
    await this.client.hSet(`from`, String(this.domain), String(this.from));
    await this.client.hSet(`height`, String(this.domain), String(this.height));
  }

  async store(...events: NomadishEvent[]): Promise<void> {
    let fromChanged = false;
    let heightChanged = false;
    const promises = [];
    const block2Events: Map<number, NomadishEvent[]> = new Map();
    for (const event of events) {
      if (event.block < this.from || this.from === -1) {
        this.from = event.block;
        fromChanged = true;
      }
      if (event.block > this.height || this.height === -1) {
        this.height = event.block;
        heightChanged = true;
      }
      const block = block2Events.get(event.block);
      if (block) {
        block.push(event);
      } else {
        block2Events.set(event.block, [event]);
      }
    }

    await Promise.all(
      Array.from(block2Events.entries()).map(async ([block, events]) => {
        const eventsBefore: NomadishEvent[] = JSON.parse(
          (await this.client.hGet(
            `${this.domain}nomad_message`,
            String(block)
          )) || "[]",
          reviver
        );
        const eventsToAdd = events.filter((e) => {
          return (
            eventsBefore.findIndex(
              (eb) => e.uniqueHash() != eb.uniqueHash()
            ) === -1
          );
        });
        promises.push(
          this.client.hSet(
            `${this.domain}nomad_message`,
            String(block),
            JSON.stringify([...eventsBefore, ...eventsToAdd], replacer)
          )
        );
        promises.push(this.client.sAdd(`${this.domain}blocks`, String(block)));
      })
    );

    if (fromChanged)
      promises.push(
        this.client.hSet(`from`, String(this.domain), String(this.from))
      );
    if (heightChanged)
      promises.push(
        this.client.hSet(`height`, String(this.domain), String(this.height))
      );

    await Promise.all(promises);
  }
  async init(): Promise<void> {
    // await this.client.connect();

    const from = await this.client.hGet(`from`, String(this.domain));
    const height = await this.client.hGet(`height`, String(this.domain));

    if (from) this.from = parseInt(from);
    if (height) this.height = parseInt(height);
  }
  sortSorage(): void {}
  async allEvents(): Promise<NomadishEvent[]> {
    // console.log(`Getting all events for ${this.domain}`)
    const blocks = (await this.client.sMembers(`${this.domain}blocks`))
      .map((s) => parseInt(s))
      .sort();
    const x = await Promise.all(
      blocks.map((block) =>
        this.client.hGet(`${this.domain}nomad_message`, String(block))
      )
    );
    const events = x
      .filter((z) => z != "")
      .map((s) => JSON.parse(s!, reviver) as NomadishEvent[])
      .flat();

    const uniqueEvents = onlyUniqueEvents(events);

    // console.log(`Sorting all events for ${this.domain}`)

    uniqueEvents.sort((a, b) => {
      if (a.ts === b.ts) {
        return eventTypeToOrder(a) - eventTypeToOrder(b);
      } else {
        return a.ts - b.ts;
      }
    });
    // console.log(`Returning all events for ${this.domain}`)

    return uniqueEvents;
  }
  persist(): void {}
}

export class RamPersistance extends Persistance {
  block2events: Map<number, NomadishEvent[]>;
  blocks: number[];
  storePath: string;

  constructor(storePath: string) {
    super();
    this.block2events = new Map();
    this.blocks = [];
    this.storePath = storePath;
  }

  updateFromTo(block: number) {
    if (block < this.from || this.from === -1) this.from = block;
    if (block > this.height || this.height === -1) this.height = block;
  }

  async store(...events: NomadishEvent[]): Promise<void> {
    for (const event of events) {
      const block = this.block2events.get(event.block);
      if (block) {
        if (block.some((e) => e.uniqueHash() === event.uniqueHash())) {
          continue;
        }
        block.push(event);
      } else {
        this.block2events.set(event.block, [event]);
      }
      this.updateFromTo(event.block);
      if (this.blocks.indexOf(event.block) < 0) {
        this.blocks.push(event.block);
        this.blocks = this.blocks.sort();
      }
    }
    this.persist();
  }
  async init(): Promise<void> {
    try {
      await this.load();
    } catch (_) {}
    return;
  }
  sortSorage() {
    this.blocks = this.blocks.sort();
  }

  iter(): EventsRange {
    return new EventsRange(this);
  }

  persistToFile() {
    fs.writeFileSync(
      this.storePath,
      JSON.stringify(
        {
          block2events: this.block2events,
          blocks: this.blocks,
          initiated: this.initiated,
          from: this.from,
          height: this.height,
          storePath: this.storePath,
        },
        replacer
      )
    );
  }

  persistToDB() {}

  persist() {
    this.persistToFile();
    this.persistToDB();
  }

  async load() {
    this.loadFromFile();
  }

  loadFromFile() {
    const object = JSON.parse(
      fs.readFileSync(this.storePath, "utf8"),
      reviver
    ) as {
      block2events: Map<number, NomadishEvent[]>;
      blocks: number[];
      initiated: boolean;
      from: number;
      height: number;
    };
    this.block2events = object.block2events;
    this.blocks = object.blocks;
    this.initiated = object.initiated;
    this.from = object.from;
    this.height = object.height;
  }

  async allEvents(): Promise<NomadishEvent[]> {
    return Array.from(this.iter());
  }
}

export class EventsRange implements Iterable<NomadishEvent> {
  private _p: RamPersistance;
  private _cacheBlockIndex: number;
  private _position: number;
  private nextDone: boolean;

  constructor(p: RamPersistance) {
    this._p = p;
    this._cacheBlockIndex = 0;
    this._position = 0;
    this.nextDone = false;
  }
  cachedBlockIndex(index: number): number | undefined {
    return this._p.blocks.at(index);
  }

  next(value?: any): IteratorResult<NomadishEvent> {
    if (this.nextDone) return { done: true, value: undefined };
    let done = false;
    const blockNumber = this.cachedBlockIndex(this._cacheBlockIndex);
    if (!blockNumber) {
      return { done: true, value: undefined };
    }
    const block = this._p.block2events.get(blockNumber);
    if (!block) {
      return { done: true, value: undefined };
    }
    let _value = block.at(this._position)!;

    // calculating next positions
    if (this._position + 1 < block.length) {
      this._position += 1;
    } else {
      const nextIndex = this._cacheBlockIndex + 1;
      const nextBlockNumber = this.cachedBlockIndex(nextIndex);
      if (!nextBlockNumber) {
        this.nextDone = true;
      } else {
        if (this._p.block2events.get(nextBlockNumber)) {
          this._cacheBlockIndex = nextIndex;
          this._position = 0;
        } else {
          this.nextDone = true;
        }
      }
    }

    return {
      done,
      value: _value,
    };
  }

  [Symbol.iterator]() {
    return this;
  }
}
