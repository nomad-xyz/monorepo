import * as core from './core';
import { DB } from './core/db';
import { createLogger } from './core/utils';
import { IndexerCollector } from './core/metrics';
import { getSdk } from './core/sdk';
import { startTokenUpdater } from './tokens';
import {
  program,
  environment,
  configOverrideLocation,
  metricsPort,
  logLevel,
  Program,
} from './config';

(async () => {
  const logger = createLogger('indexer', environment, logLevel);
  const m = new IndexerCollector(environment, logger);

  const sdk = await getSdk(configOverrideLocation || environment);

  const db = new DB(m, logger, sdk);
  await db.connect();

  if (program === Program.API) {
    await startTokenUpdater(sdk, db, logger);
    logger.info(`Finished api run`);
  } else if (program === Program.CORE) {
    m.startServer(metricsPort);
    await core.run(sdk, db, logger, m);
  } else {
    logger.warn(`Starting all on the same process...`);
    await startTokenUpdater(sdk, db, logger);
    await Promise.all([core.run(sdk, db, logger, m)]).catch((e) =>
      logger.error(`Error happened during run of api or core:`, e),
    );
  }
})();
