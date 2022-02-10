import { ethers } from 'ethers';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';
import { EventType, IndexType, MonitorSingle } from '../../monitorSingle';
import {
  getFraudWindowSeconds,
  compareEvents,
  blocksToSeconds,
  getTimelagSeconds,
} from '../../utils';
import { ProcessLatencyMetrics } from './metrics';
import { MonitorConfig } from '../../config';

type Result = ethers.utils.Result;

// Monitor for processor from 1 home to n replicas
export class ProcessorLatencyMonitor extends MonitorSingle {
  private readonly agent: string = 'processor';
  private homeCommittedRootToDispatches: Map<any, TypedEvent<Result>[]>;
  private replicaUpdates: Map<string, TypedEvent<Result>[]>;
  private replicaProcesses: Map<string, TypedEvent<Result>[]>;

  // per replica mapping of replica --> index of latest relayed home update in
  // homeUpdates
  private lastSeenReplicaUpdateIndexes: Map<string, number>;

  constructor(config: MonitorConfig) {
    super(config);

    this.homeCommittedRootToDispatches = new Map();

    this.replicaUpdates = new Map();
    config.remotes.forEach((remote) => {
      this.replicaUpdates.set(remote, []);
    });
    this.replicaProcesses = new Map();
    config.remotes.forEach((remote) => {
      this.replicaProcesses.set(remote, []);
    });

    this.lastSeenReplicaUpdateIndexes = new Map();
  }

  async start(): Promise<void> {
    while (true) {
      try {
        await this.fetchDispatches();
        break;
      } catch (e) {
        this.logError(
          `Failed to retrieve dispatch events: ${e}. Trying again...`,
        );

        this.remotes.forEach((remote) => {
          this.homeCommittedRootToDispatches.set(remote, []);
        });
        continue;
      }
    }

    while (true) {
      try {
        await this.fetchReplicaProcesses();
        break;
      } catch (e) {
        this.logError(
          `Failed to retrieve dispatch events: ${e}. Trying again...`,
        );

        this.remotes.forEach((remote) => {
          this.replicaProcesses.set(remote, []);
        });
        continue;
      }
    }

    while (true) {
      try {
        await this.fetchReplicaUpdates();
        break;
      } catch (e) {
        this.logError(
          `Failed to retrieve update events: ${e}. Trying again...`,
        );

        this.remotes.forEach((remote) => {
          this.replicaUpdates.set(remote, []);
        });
        continue;
      }
    }

    // Start at 2 latest replica updates
    this.remotes.forEach((remote) => {
      this.replicaUpdates.set(
        remote,
        this.replicaUpdates
          .get(remote)!
          .slice(this.replicaUpdates.get(remote)!.length - 2),
      );
      this.lastSeenReplicaUpdateIndexes.set(remote, 0);
    });

    const fetchDispatchesTask = this.fetchInLoop(
      this,
      this.fetchDispatches,
      30,
    );
    const fetchReplicaUpdatesTask = this.fetchInLoop(
      this,
      this.fetchReplicaUpdates,
      30,
    );
    const fetchReplicaProcessesTask = this.fetchInLoop(
      this,
      this.fetchReplicaProcesses,
      30,
    );
    const reportProcessLatenciesTask = this.reportInLoop(
      this,
      this.reportProcessLatencies,
      15,
    );

    await Promise.all([
      fetchDispatchesTask,
      fetchReplicaUpdatesTask,
      fetchReplicaProcessesTask,
      reportProcessLatenciesTask,
    ]);
  }

  async fetchDispatches() {
    const homeDispatches = await super.query(
      this.origin,
      EventType.Dispatch,
      IndexType.Incremental,
    );
    homeDispatches.forEach((dispatch: any) => {
      const committedRoot = dispatch.args.committedRoot;

      const existingDispatches =
        this.homeCommittedRootToDispatches.get(committedRoot) ?? [];
      this.homeCommittedRootToDispatches.set(
        committedRoot,
        existingDispatches.concat([dispatch]),
      );
    });
  }

  async fetchReplicaUpdates() {
    for (const remote of this.remotes) {
      const newReplicaUpdates = await super.query(
        remote,
        EventType.Update,
        IndexType.Incremental,
      );
      const existingUpdates = this.replicaUpdates.get(remote)!;
      let updatedUpdates = existingUpdates
        .concat(newReplicaUpdates)
        .sort(compareEvents);

      this.replicaUpdates.set(remote, updatedUpdates);
    }
  }

  async fetchReplicaProcesses() {
    for (const remote of this.remotes) {
      const newReplicaProcesses = await super.query(
        remote,
        EventType.Process,
        IndexType.Incremental,
      );
      const existingProcesses = this.replicaProcesses.get(remote)!;
      let updatedProcesses = existingProcesses.concat(newReplicaProcesses);
      updatedProcesses.sort(compareEvents);

      this.replicaProcesses.set(remote, updatedProcesses);
    }
  }

  async reportProcessLatencies() {
    for (const remote of this.remotes) {
      const lastSeenReplicaUpdateIndex =
        this.lastSeenReplicaUpdateIndexes.get(remote)!;

      const newReplicaUpdates = this.replicaUpdates
        .get(remote)!
        .slice(lastSeenReplicaUpdateIndex);

      for (const replicaUpdate of newReplicaUpdates) {
        const dispatchesUnderUpdate =
          this.homeCommittedRootToDispatches.get(replicaUpdate.args.oldRoot) ??
          [];

        const dispatchesForReplica = super.filterDispatchesForReplica(
          remote,
          dispatchesUnderUpdate,
        );

        const matchingProcesses = this.getMatchingProcesses(
          remote,
          dispatchesForReplica,
        );
        if (matchingProcesses.length == 0) {
          this.logInfo(
            `No matching processes found for ${this.origin}-->${remote} under update ${replicaUpdate.args.newRoot}.`,
          );
          break;
        }

        matchingProcesses.forEach(async (process) => {
          try {
            const latencySeconds = await this.calculateLatencyForProcess(
              remote,
              replicaUpdate,
              process,
            );

            super.logInfo(
              `[Report ${this.origin} --> ${remote}] Process latency for message with hash ${process.args.messageHash} on replica ${remote}: ${latencySeconds} seconds.`,
            );

            (
              this.metrics as ProcessLatencyMetrics
            ).reportProcessedMessageLatency(
              this.agent,
              this.origin,
              remote,
              latencySeconds,
            );
          } catch (e) {
            this.logError(`Failed to calculate/report Process latency: ${e}`);
          }
        });

        this.lastSeenReplicaUpdateIndexes.set(
          remote,
          this.lastSeenReplicaUpdateIndexes.get(remote)! + 1,
        );
      }
    }
  }

  getMatchingProcesses(remote: string, dispatches: TypedEvent<Result>[]) {
    let matchingProcesses = [];
    for (const dispatch of dispatches) {
      const dispatchMessageHash = dispatch.args.messageHash;
      const matchingProcess = this.replicaProcesses
        .get(remote)!
        .find((process: any) => {
          return process.args.messageHash == dispatchMessageHash;
        });

      if (matchingProcess != undefined) {
        matchingProcesses.push(matchingProcess);
      }
    }

    return matchingProcesses;
  }

  async calculateLatencyForProcess(
    remote: string,
    update: TypedEvent<Result>,
    process: TypedEvent<Result>,
  ): Promise<number> {
    const replicaUpdateBlock = update.blockNumber;
    const replicaProcessBlock = process.blockNumber;

    // Use block number and latest block as approximation
    const blockDiff = replicaProcessBlock - replicaUpdateBlock;
    const secondsDiff = blocksToSeconds(remote, blockDiff);

    return (
      secondsDiff -
      getFraudWindowSeconds(this.origin) -
      getTimelagSeconds(remote)
    );
  }
}
