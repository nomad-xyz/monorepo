import { ethers } from 'ethers';
import { compareEvents, blocksToSeconds } from '../../utils';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';
import { EventType, IndexType, MonitorSingle } from '../../monitorSingle';
import { E2ELatencyMetrics } from './metrics';
import { MonitorConfig } from '../../config';

type Result = ethers.utils.Result;

// Monitor for relayer from 1 home to n replicas
export class E2ELatencyMonitor extends MonitorSingle {
  private dispatchesForReplica: Map<string, TypedEvent<Result>[]>;
  private replicaProcesses: Map<string, TypedEvent<Result>[]>;

  constructor(config: MonitorConfig) {
    super(config);

    this.dispatchesForReplica = new Map();
    this.replicaProcesses = new Map();

    this.remotes.forEach((remote) => {
      this.dispatchesForReplica.set(remote, []);
      this.replicaProcesses.set(remote, []);
    });
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
          this.dispatchesForReplica.set(remote, []);
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
          `Failed to retrieve replica process events: ${e}. Trying again...`,
        );

        this.remotes.forEach((remote) => {
          this.replicaProcesses.set(remote, []);
        });
        continue;
      }
    }

    // Start at last 2 messages for each replica
    this.remotes.forEach((remote) => {
      const existingDispatchesForReplica =
        this.dispatchesForReplica.get(remote)!;
      this.dispatchesForReplica.set(
        remote,
        existingDispatchesForReplica.slice(
          existingDispatchesForReplica.length - 2,
        ),
      );

      const existingProcessesForReplica = this.replicaProcesses.get(remote)!;
      this.replicaProcesses.set(
        remote,
        existingProcessesForReplica.slice(
          existingDispatchesForReplica.length - 20,
        ),
      );
    });

    const fetchDispatchesTask = super.fetchInLoop(
      this,
      this.fetchDispatches,
      30,
    );
    const fetchProcessesTask = super.fetchInLoop(
      this,
      this.fetchReplicaProcesses,
      30,
    );
    const reportTask = super.reportInLoop(this, this.reportLatencies, 15);
    await Promise.all([fetchDispatchesTask, fetchProcessesTask, reportTask]);
  }

  async fetchDispatches() {
    const newHomeDispatches = await super.query(
      this.origin,
      EventType.Dispatch,
      IndexType.Incremental,
    );

    for (const remote of this.remotes) {
      const newDispatchesForReplica = super.filterDispatchesForReplica(
        remote,
        newHomeDispatches,
      );

      const existingDispatchesForReplica =
        this.dispatchesForReplica.get(remote)!;
      this.dispatchesForReplica.set(
        remote,
        existingDispatchesForReplica
          .concat(newDispatchesForReplica)
          .sort(compareEvents),
      );
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
      let updatedProcesses = existingProcesses
        .concat(newReplicaProcesses)
        .sort(compareEvents);

      this.replicaProcesses.set(remote, updatedProcesses);
    }
  }

  async reportLatencies() {
    const originProvider = super.networkToProvider(this.origin);
    for (const remote of this.remotes) {
      const dispatchesForReplica = this.dispatchesForReplica.get(remote)!;
      const replicaProcesses = this.replicaProcesses.get(remote)!;

      for (const dispatch of dispatchesForReplica) {
        const matchingProcessIndex = replicaProcesses.findIndex(
          (process) => process.args.messageHash == dispatch.args.messageHash,
        );
        const matchingProcess = replicaProcesses[matchingProcessIndex];

        if (matchingProcess == undefined) {
          this.logInfo(
            `No matching processes found for ${this.origin}-->${remote} with message hash: ${dispatch.args.messageHash}.`,
          );
          break;
        } else {
          try {
            const dispatchBlock = dispatch.blockNumber;
            const currentRemoteBlock = await originProvider.getBlockNumber();

            // Time difference is calculated by difference in time between
            // dispatch block number and current block number on the origin
            // network. Assumption is that we pick up the process event approx.
            // the same time it happened.
            const blockDiff = currentRemoteBlock - dispatchBlock;
            const secondsDiff = blocksToSeconds(this.origin, blockDiff);

            super.logInfo(
              `[Report ${this.origin} --> ${remote}] E2E latency for message with hash ${matchingProcess.args.messageHash}: ${secondsDiff} seconds.`,
            );

            (this.metrics as E2ELatencyMetrics).reportTotalMessageLatency(
              this.origin,
              remote,
              secondsDiff,
            );

            // Now that we've seen processed message, delete data from memory
            this.dispatchesForReplica.set(
              remote,
              this.dispatchesForReplica.get(remote)!.slice(1),
            );
            const cleanedReplicaProcesses = this.replicaProcesses
              .get(remote)!
              .splice(matchingProcessIndex, 1);
            this.replicaProcesses.set(remote, cleanedReplicaProcesses);
          } catch (e) {
            this.logError(`Failed to calculate/report process latency: ${e}`);
          }
        }
      }
    }
  }
}
