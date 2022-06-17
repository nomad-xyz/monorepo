import { IndexerCollector } from '../core/metrics';
import { createLogger } from '../core/utils';
import { getSdk } from '../core/sdk';
import { DB } from '../core/db';
import { configOverrideLocation, environment, logLevel } from '../config';

const logger = createLogger('indexer api - db', environment, logLevel);
const indexerMetrics = new IndexerCollector(environment, logger);

const connectToDatabase = async () => {
  const sdk = await getSdk(configOverrideLocation || environment);

  const db = new DB(indexerMetrics, logger, sdk);
  await db.connect();

  return db;
};

let db: DB;
(async () => {
  db = await connectToDatabase();
})();

export { db };
