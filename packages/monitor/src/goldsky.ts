import { request, gql } from 'graphql-request';

const defaultGoldSkySecret = "mpa%H&RAHu9;eUe";

class Goldsky {
    protected secret: string; 

    constructor(secret: string) {
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

  async numMessages(){
    const query = gql`
      query Query {
        number_messages {
          dispatched,
          updated,
          relayed,
          processed
        }
      }
    `;
  
      const response = await request(this.uri, query, {}, this.headers);
      const data = response.number_messages[0];
      return {
        dispatched: parseInt(data.dispatched),
        updated: parseInt(data.updated),
        relayed: parseInt(data.relayed),
        processed: parseInt(data.processed),
      }
  }

  async numEvents(){
    const query = gql`
        query MyQuery {
            events_aggregate {
            aggregate {
                count
            }
            }
        }
    `;
  
      const response = await request(this.uri, query, {}, this.headers);
      return parseInt(response.events_aggregate.aggregate.count);
  }
}

(async () => {
    let g = new Goldsky(defaultGoldSkySecret);
    const ms = await g.numMessages();
    console.log(ms)
    const es = await g.numEvents();
    console.log(es)
})();

