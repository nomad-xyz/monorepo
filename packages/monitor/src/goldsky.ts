import { request, gql } from 'graphql-request';
import { MessageStages } from './metrics';
import { TaskRunner } from './taskRunner';
import { MonitoringContext } from './monitoringContext';

export const defaultGoldSkySecret = 'mpa%H&RAHu9;eUe';

export enum GoldSkyQuery {
  ProcessFailureEvents = 'ProcessFailureEvents',
  RecoveryEvents = 'RecoveryEvents',
  NumberMessages = 'NumberMessages',
}

export class Goldsky extends TaskRunner {
  protected secret: string;

  constructor(secret: string, mc: MonitoringContext) {
    super(mc);
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
    const tableName = this.mc.environment + '_views_process_failure_view_aggregate';
    const query = gql`
      query ProcessFailureEvents {
        ${tableName} {
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
      'goldsky',
      GoldSkyQuery.ProcessFailureEvents,
      'empty',
    );

    // NOTE: uncomment to see shape of recovery events data
    // console.log('numProcessFailureEvents response', response);

    if (!response) {
      this.logger.warn(`Response is not present for query ${GoldSkyQuery.ProcessFailureEvents}`);
      return;
    }
    
    response[tableName].nodes.forEach((event: any) => {
      this.metrics.incNumProcessFailureEvents(event.asset);
    });
  }

  async numProcessRecoveryEvents(): Promise<void> {
    // TODO: since tables are labeled by environment, we should use a
    // different set of queries between staging / production.
    // tldr: Follow the convention we use in the gui.
    const tableName = this.mc.environment + '_views_recovery_view_aggregate';
    const query = gql`
      query RecoveryEvents {
        ${tableName} {
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
      'goldsky',
      GoldSkyQuery.RecoveryEvents,
      'empty',
    );

    // NOTE: uncomment to see shape of recovery events data
    // console.log('numRecoveryEvents response', response);

    type RecoveryEvent = {
      _gs_chain: string;
      amount: string;
      asset: string;
    };

    if (!response) {
      this.logger.warn(`Response is not present for query ${GoldSkyQuery.RecoveryEvents}`);
      return;
    }
    
    response[tableName].nodes.forEach(
      (event: RecoveryEvent) => {
        this.metrics.incNumRecoveryEvents(event.asset);
      },
    );
  }

  async numMessages(): Promise<void> {
    const tableName = this.mc.environment + '_views_number_messages';
    const query = gql`
      query NumberMessages {
        ${tableName} {
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
    if (!response) {
      this.logger.warn(`Response is not present for query ${GoldSkyQuery.NumberMessages}`);
      return;
    }

    response[tableName].forEach(
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
