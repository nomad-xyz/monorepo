import { request, gql } from 'graphql-request';
import { MessageStages, MonitoringCollector } from './server';
import { TaskRunner } from './taskRunner';

export const defaultGoldSkySecret = "mpa%H&RAHu9;eUe";

export class Goldsky extends TaskRunner {
    protected secret: string;
    metrics: MonitoringCollector;

    constructor(secret: string, mc: MonitoringCollector) {
      super();
        this.secret = secret;
        this.metrics = mc;
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

  async runTasks() {
    await Promise.all([
      this.numMessages(),
    ])
  }

  async numMessages(){
    const query = gql`
      query Query {
        number_messages {
          origin,
          destination,
          dispatched,
          updated,
          relayed,
          processed
        }
      }
    `;
  
      const response = await request(this.uri, query, {}, this.headers);
      response.number_messages.forEach((row: any) => {

        const origin =  parseInt(row.origin);
        const destination =  parseInt(row.destination);

        this.metrics.setNumMessages(MessageStages.Dispatched, origin.toString(), destination.toString(), parseInt(row.dispatched))
        this.metrics.setNumMessages(MessageStages.Updated, origin.toString(), destination.toString(), parseInt(row.updated))
        this.metrics.setNumMessages(MessageStages.Relayed, origin.toString(), destination.toString(), parseInt(row.relayed))
        this.metrics.setNumMessages(MessageStages.Processed, origin.toString(), destination.toString(), parseInt(row.processed))
      
      })
  }

  // async numEvents(){
  //   const query = gql`
  //       query MyQuery {
  //           events_aggregate {
  //           aggregate {
  //               count
  //           }
  //           }
  //       }
  //   `;
  
  //     const response = await request(this.uri, query, {}, this.headers);
  //     return parseInt(response.events_aggregate.aggregate.count);
  // }
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
