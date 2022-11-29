import { request, gql } from 'graphql-request';
import { MessageStages, MonitoringCollector } from './metrics';
import { TaskRunner } from './taskRunner';
import Logger from 'bunyan';

export const defaultGoldSkySecret = 'mpa%H&RAHu9;eUe';

export enum GoldSkyQuery {
  StagingProcessFailureEvents = 'StagingProcessFailureEvents',
  StagingRecoveryEvents = 'StagingRecoveryEvents',
  NumberMessages = 'NumberMessages',
}

export class Goldsky extends TaskRunner {
  protected secret: string;

  constructor(secret: string, logger: Logger, metrics: MonitoringCollector) {
    super(logger, metrics);
    this.secret = secret;
  }

  /**
   * Prepares a URI that is used for fetching messages
   *
   * @returns uri
   */
  get uri(): string {
    // return `https://${this.env}.goldsky.io/c/nomad/gql/v1/graphql`
    return `https://api.goldsky.io/c/nomad/gql/v1/graphql`;
  }

  /**
   * Prepares headers for connecting to hasura
   */
  get headers(): {
    'content-type': string;
    'x-goldsky-secret': string;
  } {
    return {
      'content-type': 'application/json',
      'x-goldsky-secret': this.secret,
    };
  }

  cooldown(): number {
    return 60;
  }

  tasks(): Promise<void>[] {
    return [
      this.numMessages(),
      this.numProcessFailureEvents(),
      this.numProcessRecoveryEvents(),
    ];
  }

  async numProcessFailureEvents(): Promise<void> {
    // TODO: since tables are labeled by environment, we should use a
    // different set of queries between staging / production.
    // tldr: Follow the convention we use in the gui.

    const query = gql`
      query StagingProcessFailureEvents {
        staging_process_failure_aggregate {
          nodes {
            amount
            asset
            _gs_chain
          }
        }
      }
    `;

    const response = await this.record(
      request(this.uri, query, {}, this.headers),
      'goldsky', GoldSkyQuery.StagingProcessFailureEvents, 'empty'
    );

    console.log('numProcessFailureEvents response', response);

    console.log('nodes', response.staging_process_failure_aggregate.nodes);

    // TODO: add method to MonitoringCollector class to inc numProcessFailureEvents counter
  }

  async numProcessRecoveryEvents(): Promise<void> {
    // TODO: since tables are labeled by environment, we should use a
    // different set of queries between staging / production.
    // tldr: Follow the convention we use in the gui.

    const query = gql`
      query StagingRecoveryEvents {
        staging_recovery_aggregate {
          nodes {
            _gs_chain
            amount
            asset
          }
        }
      }
    `;

    const response = await this.record(
      request(this.uri, query, {}, this.headers),
      'goldsky', GoldSkyQuery.StagingRecoveryEvents, 'empty'
    );

    console.log('numRecoveryEvents response', response);
    console.log(response.staging_recovery_aggregate.nodes);

    // TODO: add method to MonitoringCollector class to inc numRecoveryEvents counter
  }

  async numMessages(): Promise<void> {
    const query = gql`
      query NumberMessages {
        number_messages {
          origin
          destination
          dispatched
          updated
          relayed
          processed
        }
      }
    `;

    const response = await this.record(
      request(this.uri, query, {}, this.headers),
      'goldsky',
      GoldSkyQuery.NumberMessages,
      'kek',
    );
    response.number_messages.forEach(
      (row: {
        origin: string;
        destination: string;
        dispatched: string;
        updated: string;
        relayed: string;
        processed: string;
      }) => {
        const origin = parseInt(row.origin);
        const destination = parseInt(row.destination);

        this.metrics.setNumMessages(
          MessageStages.Dispatched,
          origin.toString(),
          destination.toString(),
          parseInt(row.dispatched),
        );
        this.metrics.setNumMessages(
          MessageStages.Updated,
          origin.toString(),
          destination.toString(),
          parseInt(row.updated),
        );
        this.metrics.setNumMessages(
          MessageStages.Relayed,
          origin.toString(),
          destination.toString(),
          parseInt(row.relayed),
        );
        this.metrics.setNumMessages(
          MessageStages.Processed,
          origin.toString(),
          destination.toString(),
          parseInt(row.processed),
        );
      },
    );
  }
}

/*
(async () => {
    let g = new Goldsky(defaultGoldSkySecret);
    const ms = await g.numMessages();
    console.log(ms)
    const es = await g.numEvents();
    console.log(es)
})();
*/
