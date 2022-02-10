import { ethers } from 'ethers';
import { NomadContext } from '@nomad-xyz/sdk';
import { Home, Replica } from '@nomad-xyz/contract-interfaces/core';
import Logger from 'bunyan';
import { RelayLatencyMonitor } from './latencies/relayer/relayerMonitor';
import { ProcessorLatencyMonitor } from './latencies/processor/processorMonitor';
import { BridgeHealthMonitor } from './bridgeHealth/healthMonitor';
import { MetricsCollector } from './metrics';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';
import { getEvents } from '@nomad-xyz/sdk/nomad/events/fetch';
import { parseMessage } from '@nomad-xyz/sdk/nomad/messages/NomadMessage';
import { E2ELatencyMonitor } from './latencies/e2e/e2eMonitor';
import { MonitorConfig } from './config';

type Result = ethers.utils.Result;
type Provider = ethers.providers.Provider;

export enum EventType {
  Dispatch = 'dispatch',
  Update = 'update',
  Process = 'process',
}

export enum IndexType {
  Incremental,
  FromZero,
}

export abstract class MonitorSingle {
  origin: string;
  remotes: string[];
  home: Home;
  replicas: Map<string, Replica>;
  lastSeenBlocks: Map<string, number>;
  context: NomadContext;
  logger: Logger;
  metrics: MetricsCollector;

  constructor(config: MonitorConfig) {
    this.origin = config.origin;
    this.remotes = config.remotes;
    this.context = config.context;

    this.home = config.context.mustGetCore(config.origin).home as Home;
    this.replicas = new Map();
    config.remotes.forEach((remote) => {
      const replica = config.context.mustGetReplicaFor(config.origin, remote);
      this.replicas.set(remote, replica as Replica);
    });

    this.lastSeenBlocks = new Map();

    this.logger = config.logger;
    this.metrics = config.metrics;
  }

  abstract start(): Promise<void>;

  public async main() {
    this.metrics.startServer(9090);
    await this.initializeStartBlocks();
    await this.start();
  }

  private async initializeStartBlocks() {
    const originProvider = this.networkToProvider(this.origin);
    const latestOriginBlock = await originProvider.getBlockNumber();
    Object.values(EventType).forEach((eventType) => {
      this.lastSeenBlocks.set(
        this.origin + eventType,
        latestOriginBlock - 1000,
      );
    });

    this.remotes.forEach(async (remote) => {
      const remoteProvider = this.networkToProvider(remote);
      const latestRemoteBlock = await remoteProvider.getBlockNumber();
      Object.values(EventType).forEach((eventType) => {
        this.lastSeenBlocks.set(remote + eventType, latestRemoteBlock - 1000);
      });
    });
  }

  public networkToDomain(network: string): number {
    return this.context.mustGetDomain(network).id;
  }

  public networkToProvider(network: string): Provider {
    const domain = this.networkToDomain(network);
    return this.context.mustGetProvider(domain);
  }

  public logInfo(message: string) {
    this.logger.info(message);
  }

  public logDebug(message: string) {
    this.logger.debug(message);
  }

  public logError(message: string) {
    this.logger.error(message);
  }

  private getFilter(network: string, eventType: EventType) {
    if (network == this.origin) {
      switch (eventType) {
        case EventType.Dispatch:
          return this.home.filters.Dispatch();
        case EventType.Update:
          return this.home.filters.Update();
        case EventType.Process:
          throw new Error('No Process events on home!');
      }
    } else {
      const replica = this.replicas.get(network)!;
      switch (eventType) {
        case EventType.Dispatch:
          throw new Error('No Dispatch events on replica!');
        case EventType.Update:
          return replica.filters.Update();
        case EventType.Process:
          return replica.filters.Process();
      }
    }
  }

  async query(
    network: string,
    eventType: EventType,
    indexType: IndexType = IndexType.FromZero,
  ): Promise<TypedEvent<Result>[]> {
    const provider = this.networkToProvider(network);
    const latestBlock = await provider.getBlockNumber();

    let lastSeenBlock, from;
    if (indexType == IndexType.Incremental) {
      lastSeenBlock = this.lastSeenBlocks.get(network + eventType);
      from = lastSeenBlock == undefined ? undefined : lastSeenBlock + 1;
    } else {
      lastSeenBlock = undefined;
      from = undefined;
    }

    if (from != undefined && from >= latestBlock) {
      // Return empty array of events if caught up to tip
      this.logInfo(
        `Caught up to tip on ${network}, returning empty array of events.`,
      );
      return new Promise((resolve) => resolve([] as TypedEvent<Result>[]));
    } else {
      const contract =
        network == this.origin ? this.home : this.replicas.get(network)!;
      const filter = this.getFilter(network, eventType);

      try {
        this.logInfo(
          `[Fetch] Fetching ${eventType} for ${network} at blocks ${
            from ?? 0
          }..${latestBlock}`,
        );
        const events = await getEvents(
          this.context,
          network,
          contract,
          filter,
          from,
          latestBlock,
        );

        this.lastSeenBlocks.set(network + eventType, latestBlock);
        return events;
      } catch (e) {
        this.logger.error(`Error querying data: ${e}`);
        // bubble this up for next layer to deal with
        throw e;
      }
    }
  }

  filterDispatchesForReplica(remote: string, dispatches: TypedEvent<Result>[]) {
    const domain = this.networkToDomain(remote);
    return dispatches.filter((dispatch: any) => {
      const encodedMessage = parseMessage(dispatch.args.message as string);
      return encodedMessage.destination == domain;
    });
  }

  async fetchInLoop(
    object:
      | E2ELatencyMonitor
      | RelayLatencyMonitor
      | ProcessorLatencyMonitor
      | BridgeHealthMonitor,
    fetch: () => Promise<void>,
    pauseSeconds: number,
  ) {
    const pause = pauseSeconds * 1000;
    while (true) {
      this.logger.debug(`[Fetch] Sleeping for ${pauseSeconds} seconds.`);
      await new Promise((resolve) => setTimeout(resolve, pause));

      try {
        await fetch.call(object);
      } catch (e) {
        this.logError(`Failed to fetch data: ${e}`);
      }
    }
  }

  async reportInLoop(
    object:
      | E2ELatencyMonitor
      | RelayLatencyMonitor
      | ProcessorLatencyMonitor
      | BridgeHealthMonitor,
    report: () => Promise<void>,
    pauseSeconds: number,
  ) {
    const pause = pauseSeconds * 1000;
    while (true) {
      this.logger.debug(`[Report] Sleeping for ${pauseSeconds} seconds.`);
      await new Promise((resolve) => setTimeout(resolve, pause));

      await report.call(object);
    }
  }
}
