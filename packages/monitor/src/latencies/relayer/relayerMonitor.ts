import { ethers } from 'ethers';
import { blocksToSeconds } from '../../utils';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';
import { EventType, IndexType, MonitorSingle } from '../../monitorSingle';
import { RelayLatencyMetrics } from './metrics';
import { MonitorConfig } from '../../config';

// Monitor for relayer from 1 home to n replicas
export class RelayLatencyMonitor extends MonitorSingle {
  private readonly agent: string = 'relayer';
  private homeUpdates: TypedEvent<ethers.utils.Result>[];
  private replicaUpdates: Map<string, TypedEvent<ethers.utils.Result>[]>;

  // per replica mapping of replica --> index of latest relayed home update in
  // homeUpdates
  private lastRelayedHomeUpdateIndexes: Map<string, number>;

  constructor(config: MonitorConfig) {
    super(config);

    this.homeUpdates = [];
    this.replicaUpdates = new Map();
    config.remotes.forEach((remote) => {
      this.replicaUpdates.set(remote, []);
    });

    this.lastRelayedHomeUpdateIndexes = new Map();
  }

  async start(): Promise<void> {
    // Fetch updates in loop until we have successfully gotten all of them
    while (true) {
      try {
        await this.fetchUpdates();
        break;
      } catch (e) {
        this.logError(
          `Failed to retrieve update events: ${e}. Trying again...`,
        );

        this.homeUpdates = [];
        this.remotes.forEach((remote) => {
          this.replicaUpdates.set(remote, []);
        });
        continue;
      }
    }

    this.remotes.forEach((remote) =>
      this.lastRelayedHomeUpdateIndexes.set(
        remote,
        this.homeUpdates.length - 1,
      ),
    );

    const fetchTask = super.fetchInLoop(this, this.fetchUpdates, 30);
    const reportTask = super.reportInLoop(this, this.reportRelayLatencies, 15);
    await Promise.all([fetchTask, reportTask]);
  }

  async fetchUpdates() {
    const newHomeUpdates = await super.query(
      this.origin,
      EventType.Update,
      IndexType.Incremental,
    );
    this.homeUpdates = this.homeUpdates.concat(newHomeUpdates);

    for (const remote of this.remotes) {
      const newReplicaUpdates = await super.query(
        remote,
        EventType.Update,
        IndexType.Incremental,
      );
      const existingUpdates = this.replicaUpdates.get(remote)!;
      this.replicaUpdates.set(
        remote,
        existingUpdates.concat(newReplicaUpdates),
      );
    }
  }

  async reportRelayLatencies() {
    const originProvider = super.networkToProvider(this.origin);

    for (const remote of this.remotes) {
      const lastRelayedHomeUpdateIndexes =
        this.lastRelayedHomeUpdateIndexes.get(remote)!;

      const newHomeUpdates = this.homeUpdates.slice(
        lastRelayedHomeUpdateIndexes,
      );
      for (const homeUpdate of newHomeUpdates) {
        const matchingReplicaUpdate = this.findMatchingReplicaUpdate(
          remote,
          homeUpdate,
        );

        if (matchingReplicaUpdate != undefined) {
          break;
        } else {
          try {
            const homeUpdateBlock = homeUpdate.blockNumber;
            const currentBlock = await originProvider.getBlockNumber();

            // Use block number and current block as approximation
            const blockDiff = currentBlock - homeUpdateBlock;
            const secondsDiff = blocksToSeconds(this.origin, blockDiff);

            super.logInfo(
              `[Report ${
                this.origin
              } --> ${remote}] Relay latency for update with new root ${
                (homeUpdate as any).args.newRoot
              } on replica ${remote}: ${secondsDiff} seconds.`,
            );

            (this.metrics as RelayLatencyMetrics).reportRelayedUpdateLatency(
              this.agent,
              this.origin,
              remote,
              secondsDiff,
            );

            this.lastRelayedHomeUpdateIndexes.set(
              remote,
              this.lastRelayedHomeUpdateIndexes.get(remote)! + 1,
            );
          } catch (e) {
            this.logError(
              `Failed to calculate/report relay latency for ${this.origin} --> ${remote}: ${e}`,
            );
          }
        }
      }
    }
  }

  private findMatchingReplicaUpdate(
    remote: string,
    homeUpdate: TypedEvent<ethers.utils.Result>,
  ): TypedEvent<ethers.utils.Result> | undefined {
    const replicaUpdates = this.replicaUpdates.get(remote)!;
    return replicaUpdates.find(
      (update: any) => update.args.newRoot == (homeUpdate.args as any).newRoot,
    );
  }
}
