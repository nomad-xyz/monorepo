import { getMonitorMetrics, writeUnprocessedMessages } from '../print';
import { HealthMetricsCollector } from './healthMetrics';
import { EventType, IndexType, MonitorSingle } from '../monitorSingle';
import { MonitorConfig } from '../config';

export class BridgeHealthMonitor extends MonitorSingle {
  constructor(config: MonitorConfig) {
    super(config);
  }

  async start(): Promise<void> {
    await super.reportInLoop(this, this.reportHealth, 120);
  }

  async reportHealth() {
    super.logInfo(`Checking ${this.origin}`);
    super.logInfo(`Get Dispatch logs from ${this.origin}`);
    let dispatchLogs, processLogs;
    try {
      dispatchLogs = await super.query(
        this.origin,
        EventType.Dispatch,
        IndexType.FromZero,
      );
    } catch (e) {
      super.logError(
        `Encountered error while fetching Dispatch logs for ${this.origin}, bailing: ${e}`,
      );
      return;
    }

    const processedLogs = [];
    for (const remote of this.remotes) {
      super.logInfo(`Get Process logs from ${remote} for ${this.origin}`);
      processLogs = await super.query(
        remote,
        EventType.Process,
        IndexType.FromZero,
      );
      try {
        dispatchLogs = await super.query(
          this.origin,
          EventType.Dispatch,
          IndexType.FromZero,
        );
      } catch (e) {
        super.logError(
          `Encountered error while fetching Process logs from ${remote} for ${this.origin}, bailing: ${e}`,
        );
        return;
      }
      processedLogs.push(...processLogs);
    }

    const unprocessedDetails = await this.getUnprocessedDetails(
      this.origin,
      dispatchLogs,
      processedLogs,
    );

    const summary = getMonitorMetrics(
      this.origin,
      dispatchLogs,
      processedLogs,
      unprocessedDetails,
    );
    super.logInfo(`${JSON.stringify(summary)}\n ${this.origin} Summary`);

    (this.metrics as HealthMetricsCollector).setBridgeState(
      this.origin,
      dispatchLogs.length,
      processedLogs.length,
      unprocessedDetails.length,
    );

    // write details to file
    writeUnprocessedMessages(unprocessedDetails, this.origin);
  }

  getUnprocessedDetails(
    origin: string,
    dispatchLogs: any[],
    processedLogs: any[],
  ) {
    const processedMessageHashes = processedLogs.map(
      (log: any) => log.args.messageHash,
    );
    const unprocessedMessages = dispatchLogs.filter(
      (log: any) => !processedMessageHashes.includes(log.args.messageHash),
    );
    const promises = unprocessedMessages.map(async (log) => {
      const transaction = await log.getTransaction();
      return {
        chain: origin,
        transactionHash: transaction.hash,
        messageHash: log.args[0],
        leafIndex: log.args[1].toNumber(),
      };
    });
    return Promise.all(promises);
  }
}
