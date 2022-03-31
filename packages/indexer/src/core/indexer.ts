import { Orchestrator } from "./orchestrator";
import { AnnotatedSend, BridgeContext, AnnotatedReceive, SendTypes, SendEvent, SendArgs } from "@nomad-xyz/sdk-bridge";
import { Annotated, AnnotatedDispatch, AnnotatedProcess, AnnotatedUpdate, NomadContext } from "@nomad-xyz/sdk";

import fs from "fs";
import { ContractType, EventType, NomadEvent, EventSource } from "./event";
import { Home, Replica } from "@nomad-xyz/contracts-core";
import { ethers } from "ethers";
import { FailureCounter, KVCache, replacer, retry, reviver } from "./utils";
import { BridgeRouter } from "@nomad-xyz/contracts-bridge";
import pLimit from "p-limit";
import { RpcRequestMethod } from "./metrics";
import Logger from "bunyan";

type ShortTx = {
  gasPrice?: ethers.BigNumber;
  timestamp: number;
  from: string;
  to?: string;
  gasLimit: ethers.BigNumber;
};

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

export class Indexer {
  domain: number;
  sdks: [NomadContext, BridgeContext];
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

  eventCallback: undefined | ((event: NomadEvent) => void);

  constructor(domain: number, sdks: [NomadContext, BridgeContext], orchestrator: Orchestrator) {
    this.domain = domain;
    this.sdks = sdks;
    this.orchestrator = orchestrator;
    this.develop = false;
    if (this.develop) {
      this.persistance = new RamPersistance(
        `/tmp/persistance_${this.domain}.json`
      );
    } else {
      this.persistance = new RedisPersistance(domain);
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
    return {
      1650811245: 20,
      6648936: 20,
    }[this.domain] || 100
  }

  get provider(): ethers.providers.Provider {
    return this.sdks[1].getProvider(this.domain)!;
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
        this.logger.warn(`Retrying after RPC Error... , Error: ${error.code}, msg: ${error.message}`);
        this.failureCounter.add();
      }
    );
    if (!receipt) {
      throw new Error(
        `An RPC foo error occured, retried exhausted. TX hash: ${hash} Error: ${error}`
      );
    }

    await this.txReceiptCache.set(hash, txReceiptEncode(receipt));

    return receipt;
  }

  async getAdditionalInfo(
    hash: string
  ): Promise<{ timestamp: number; gasUsed: ethers.BigNumber; from: string }> {
    const { timestamp } = await this.getTransaction(
      hash,
      !this.orchestrator.chaseMode
    );

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
    return this.sdks[1].getCore(this.domain)!.home;
  }

  bridgeRouter(): BridgeRouter {
    return this.sdks[1].mustGetBridge(this.domain).bridgeRouter;
  }

  replicaForDomain(domain: number): Replica {
    return this.sdks[1].getReplicaFor(domain, this.domain)!;
  }

  async updateAll(replicas: number[]) {
    let from = Math.max(
      this.lastBlock + 1,
      this.persistance.height,
      this.sdks[1].getBridge(this.domain)?.deployHeight || 0
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
        return r;
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
    ): Promise<MadEvent<Result, TypedEvent<Result>, (AnnotatedSend|AnnotatedReceive|AnnotatedDispatch|AnnotatedUpdate|AnnotatedProcess)>[]> => {
      const homeEvents = await this.fetchHome(from, to);
      const replicasEvents = (
        await Promise.all(replicas.map((r) => this.fetchReplica(r, from, to)))
      ).flat();
      const bridgeRouterEvents = await this.fetchBridgeRouter(from, to);

      return [...homeEvents, ...replicasEvents, ...bridgeRouterEvents];
    };

    const allEvents: MadEvent<Result, TypedEvent<Result>, (AnnotatedSend|AnnotatedReceive|AnnotatedDispatch|AnnotatedUpdate|AnnotatedProcess)>[] = [];

    const domain2batchSize = new Map([
      [1650811245, 500],
      [6648936, 5000],
    ]);

    const batchSize = domain2batchSize.get(this.domain) || BATCH_SIZE;
    let batchFrom = from;
    let batchTo = Math.min(to, from + batchSize);

    while (true) {
      const done = Math.floor(((batchTo - from + 1) / (to - from + 1)) * 100);
      this.logger.debug(
        `Fetching batch of events for from: ${batchFrom}, to: ${batchTo}, [${done}%]`
      );
      const events = await fetchEvents(batchFrom, batchTo);
      if (!events) throw new Error(`KEk`);
      events.sort((a, b) => a.timestamp - b.timestamp);
      // xxxxxxxx await this.persistance.store(...events);
      try {
        if (this.develop) {
          this.dummyTestEventsIntegrity(batchTo);
          this.logger.debug(
            `Integrity test PASSED between ${batchFrom} and ${batchTo}`
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
      allEvents.push(
        ...events.filter((newEvent) =>
          allEvents.every(
            (oldEvent) => newEvent.unique() !== oldEvent.unique()
          )
        )
      );
      if (batchTo >= to) break;
      batchFrom = batchTo + 1;
      batchTo = Math.min(to, batchFrom + batchSize);
    }

    if (!allEvents) throw new Error("kek");

    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    if (this.develop || true) this.dummyTestEventsIntegrity();
    this.logger.info(`Fetched all`);
    this.lastBlock = to;

    return allEvents;
  }

  // TODO: Just the last ones received
  async dummyTestEventsIntegrity(blockTo?: number) {
    let allEvents = await this.persistance.allEvents();
    if (blockTo) allEvents = allEvents.filter((e) => e.block <= blockTo);
    if (allEvents.length === 0) {
      this.logger.debug(`No events to test integrity!!!`);
      return;
    }

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

    for (const event of allEvents) {
      if (event.eventType == EventType.HomeUpdate) {
        const { oldRoot, newRoot } = event.eventData as {
          oldRoot: string;
          newRoot: string;
        };
        homeRoots.set(oldRoot, newRoot);
        homeRootsTotal += 1;
        if (event.ts < initialHomeTimestamp) {
          initialHomeTimestamp = event.ts;
          initialHomeRoot = oldRoot;
        }
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

    while (true) {
      let newRoot = homeRoots.get(initialHomeRoot);
      if (newRoot) {
        initialHomeRoot = newRoot;
        homeRootsTotal -= 1;
      } else {
        break;
      }
    }
    if (homeRootsTotal !== 0)
      throw new Error(
        `${this.domain}: Left roots for home supposed to be 0, but is ${homeRootsTotal}`
      );

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

  async fetchBridgeRouter(from: number, to: number): Promise<MadEvent<Result, TypedEvent<Result>, (AnnotatedSend| AnnotatedReceive)>[]> {
    const br = this.bridgeRouter();
    const allEvents: MadEvent<Result, TypedEvent<Result>, (AnnotatedSend| AnnotatedReceive)>[] = [];
    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );

          const start = new Date().valueOf();
          // const r = await queryAnnotatedBridgeEvents<SendTypes, SendArgs>(this.sdks[1], this.domain, br, br.filters.Send(), from, to);
          const r = await Annotated.fromEvents(this.sdks[1].resolveDomain(this.domain), await br.queryFilter(br.filters.Send(), from, to))
          // const r = await br.queryFilter(br.filters.Send(), from, to);
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
      // const x: Annotated<ethers.utils.Result, SendEvent> = events[0];
      // const x: AnnotatedSend = events[0] as any as Annotated<ethers.utils.Result, TypedEvent<SendTypes & SendArgs>>;

      allEvents.push(...await Promise.all(events.map(e => MadEvent.withProvider(e as any as AnnotatedSend, this.sdks[0].mustGetProvider(this.domain)))));


      // allEvents.push(...events.map(ev => ev as any as AnnotatedSend));
    }

    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          // const r = await br.queryFilter(br.filters.Receive(), from, to);
          const r = await Annotated.fromEvents(this.sdks[1].resolveDomain(this.domain), await br.queryFilter(br.filters.Receive(), from, to))
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
      
      allEvents.push(...await Promise.all(events.map(e => MadEvent.withProvider(e as any as AnnotatedReceive, this.sdks[0].mustGetProvider(this.domain)))));
      // allEvents.push(...events.map(ev => ev as any as AnnotatedReceive));
    }

    return allEvents;
  }

  async fetchHome(from: number, to: number): Promise<MadEvent<Result, TypedEvent<Result>, (AnnotatedDispatch| AnnotatedUpdate)>[]> {
    // let fetchedEvents: (AnnotatedDispatch| AnnotatedUpdate)[] = [];
    // const sdk = getNomadContext('production');
    const allEvents: MadEvent<Result, TypedEvent<Result>, (AnnotatedDispatch| AnnotatedUpdate)>[] = [];


    const home = this.home();
    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          
          const r = await Annotated.fromEvents(this.sdks[1].resolveDomain(this.domain), await home.queryFilter(home.filters.Dispatch(), from, to))
          // const r = await queryAnnotatedNomadEvents<DispatchTypes, DispatchArgs>(this.sdks[0], this.domain, home, home.filters.Dispatch(), from, to);
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


      allEvents.push(...await Promise.all(events.map(e => MadEvent.withProvider(e as any as AnnotatedDispatch, this.sdks[0].mustGetProvider(this.domain)))));
      // allEvents.push(...events.map(ev => ev as any as AnnotatedDispatch));
    }

    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          // const r = await home.queryFilter(home.filters.Update(), from, to);
          const r = await Annotated.fromEvents(this.sdks[1].resolveDomain(this.domain), await home.queryFilter(home.filters.Update(), from, to))
          // const r = await queryAnnotatedNomadEvents<UpdateTypes, UpdateArgs>(sdk, this.domain, home, home.filters.Update(), from, to);
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

      allEvents.push(...await Promise.all(events.map(e => MadEvent.withProvider(e as any as AnnotatedUpdate, this.sdks[0].mustGetProvider(this.domain)))));
    }

    return allEvents;
  }

  async fetchReplica(domain: number, from: number, to: number): Promise<MadEvent<Result, TypedEvent<Result>, (AnnotatedUpdate| AnnotatedProcess)>[]> {
    const allEvents: MadEvent<Result, TypedEvent<Result>, (AnnotatedUpdate|AnnotatedProcess)>[] = [];

    const replica = this.replicaForDomain(domain);
    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await Annotated.fromEvents(this.sdks[1].resolveDomain(this.domain), await replica.queryFilter(replica.filters.Update(), from, to))
          // const r = await queryAnnotatedNomadEvents<UpdateTypes, UpdateArgs>(this.sdks[0], this.domain, replica, replica.filters.Update(), from, to);
          // const r = await replica.queryFilter(
          //   replica.filters.Update(),
          //   from,
          //   to
          // );
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

      allEvents.push(...await Promise.all(events.map(e => MadEvent.withProvider(e as any as AnnotatedUpdate, this.sdks[0].mustGetProvider(this.domain)))));
      // allEvents.push(...events);
    }

    {
      const [events, error] = await retry(
        async () => {
          this.orchestrator.metrics.incRpcRequests(
            RpcRequestMethod.GetLogs,
            this.network
          );
          const start = new Date().valueOf();
          const r = await Annotated.fromEvents(this.sdks[1].resolveDomain(this.domain), await replica.queryFilter(replica.filters.Process(), from, to))
          // const r = await queryAnnotatedNomadEvents<ProcessTypes, ProcessArgs>(this.sdks[0], this.domain, replica, replica.filters.Process(), from, to);
          // const r = await replica.queryFilter(
          //   replica.filters.Process(),
          //   from,
          //   to
          // );
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

      // const parsedEvents = await Promise.all(
      //   events.map(async (event) => {
      //     const m = await MadMessage.fromNomadMessage(new NomadMessage(this.sdks[0], event));

          // let { timestamp, gasUsed } = await this.getAdditionalInfo(
          //   event.transactionHash
          // );
          // return new NomadEvent(
          //   this.domain,
          //   EventType.ReplicaProcess,
          //   ContractType.Replica,
          //   domain,
          //   timestamp,
          //   {
          //     messageHash: event.args[0],
          //     success: event.args[1],
          //     returnData: event.args[2],
          //   },
          //   event.blockNumber,
          //   EventSource.Fetch,
          //   gasUsed,
          //   event.transactionHash
          // );
      //   })
      // );
      allEvents.push(...await Promise.all(events.map(e => MadEvent.withProvider(e as any as AnnotatedProcess, this.sdks[0].mustGetProvider(this.domain)))));
    }
    return allEvents;
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

  abstract store(...events: NomadEvent[]): Promise<void>;
  abstract init(): Promise<void>;
  abstract sortSorage(): void;
  abstract allEvents(): Promise<NomadEvent[]>;
  abstract persist(): void;
}



// import { getNomadContext, getBridgeContext } from "./sdk";
// import { Result } from "ethers/lib/utils";
// import { MadMessage } from "./madMessage";
import { createClient, RedisClientType } from "redis";
import { TypedEvent } from "@nomad-xyz/contracts-bridge/dist/src/common";
import { MadEvent, MadMessage } from "./mad";
import { Result } from "ethers/lib/utils";

export class RedisPersistance extends Persistance {
  client: RedisClientType;
  domain: number;

  constructor(domain: number) {
    super();
    this.client = createClient({
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

  async store(...events: NomadEvent[]): Promise<void> {
    let fromChanged = false;
    let heightChanged = false;
    const promises = [];
    const block2Events: Map<number, NomadEvent[]> = new Map();
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

    for (const [block, events] of block2Events) {
      promises.push(
        this.client.hSet(
          `${this.domain}nomad_message`,
          String(block),
          JSON.stringify(events, replacer)
        )
      );
      promises.push(this.client.sAdd(`${this.domain}blocks`, String(block)));
    }

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
    await this.client.connect();

    const from = await this.client.hGet(`from`, String(this.domain));
    const height = await this.client.hGet(`height`, String(this.domain));

    if (from) this.from = parseInt(from);
    if (height) this.height = parseInt(height);
  }
  sortSorage(): void {}
  async allEvents(): Promise<NomadEvent[]> {
    const blocks = (await this.client.sMembers(`${this.domain}blocks`))
      .map((s) => parseInt(s))
      .sort();
    const x = await Promise.all(
      blocks.map((block) =>
        this.client.hGet(`${this.domain}nomad_message`, String(block))
      )
    );
    const q = x
      .filter((z) => z != "")
      .map((s) => JSON.parse(s!, reviver) as NomadEvent[])
      .flat();
    return q;
  }
  persist(): void {}
}

export class RamPersistance extends Persistance {
  block2events: Map<number, NomadEvent[]>;
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

  async store(...events: NomadEvent[]): Promise<void> {
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
      block2events: Map<number, NomadEvent[]>;
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

  async allEvents(): Promise<NomadEvent[]> {
    return Array.from(this.iter());
  }
}

export class EventsRange implements Iterable<NomadEvent> {
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

  next(value?: any): IteratorResult<NomadEvent> {
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























///////////////

// import { Domain } from '@nomad-xyz/multi-provider';
// import { TypedEvent, TypedEventFilter } from '@nomad-xyz/contracts-core';
// import { AnnotatedUpdate } from "@nomad-xyz/sdk";

// specifies an interface shared by the TS generated contracts
// export interface TSContract<T extends Result, U> {
//   queryFilter(
//     event: TypedEventFilter<T, U>,
//     fromBlockOrBlockhash?: string | number | undefined,
//     toBlock?: string | number | undefined,
//   ): Promise<Array<TypedEvent<T & U>>>;
// }

// export async function queryAnnotatedBridgeEvents<T extends Result, U>(
//   context: BridgeContext,
//   nameOrDomain: string | number,
//   contract: TSContract<T, U>,
//   filter: TypedEventFilter<T, U>,
//   startBlock?: number,
//   endBlock?: number,
// ): Promise<Array<Annotated<T, TypedEvent<T & U>>>> {
//   const events = await getEvents(
//     context,
//     nameOrDomain,
//     contract,
//     filter,
//     startBlock,
//     endBlock,
//   );
//   return Annotated.fromEvents(context.resolveDomain(nameOrDomain), events);
// }

// export async function getEvents<T extends Result, U>(
//   context: BridgeContext,
//   nameOrDomain: string | number,
//   contract: TSContract<T, U>,
//   filter: TypedEventFilter<T, U>,
//   startBlock?: number,
//   endBlock?: number,
// ): Promise<Array<TypedEvent<T & U>>> {
//   const domain = context.mustGetDomain(nameOrDomain);
//   if (domain.paginate) {
//     return getPaginatedEvents(
//       context,
//       domain,
//       contract,
//       filter,
//       startBlock,
//       endBlock,
//     );
//   }
//   return contract.queryFilter(filter, startBlock, endBlock);
// }

// async function getPaginatedEvents<T extends Result, U>(
//   context: BridgeContext,
//   domain: Domain,
//   contract: TSContract<T, U>,
//   filter: TypedEventFilter<T, U>,
//   startBlock?: number,
//   endBlock?: number,
// ): Promise<Array<TypedEvent<T & U>>> {
//   if (!domain.paginate) {
//     throw new Error('Domain need not be paginated');
//   }
//   // get the first block by params
//   // or domain deployment block
//   const firstBlock = startBlock
//     ? Math.max(startBlock, domain.paginate.from)
//     : domain.paginate.from;
//   // get the last block by params
//   // or current block number
//   let lastBlock;
//   if (!endBlock) {
//     const provider = context.mustGetProvider(domain.domain);
//     lastBlock = await provider.getBlockNumber();
//   } else {
//     lastBlock = endBlock;
//   }
//   // query domain pagination limit at a time, concurrently
//   const eventArrayPromises = [];
//   for (
//     let from = firstBlock;
//     from <= lastBlock;
//     from += domain.paginate.blocks
//   ) {
//     const nextFrom = from + domain.paginate.blocks;
//     const to = Math.min(nextFrom, lastBlock);
//     const eventArrayPromise = contract.queryFilter(filter, from, to);
//     eventArrayPromises.push(eventArrayPromise);
//   }
//   // await promises & concatenate results
//   const eventArrays = await Promise.all(eventArrayPromises);
//   let events: Array<TypedEvent<T & U>> = [];
//   for (const eventArray of eventArrays) {
//     events = events.concat(eventArray);
//   }
//   return events;
// }
