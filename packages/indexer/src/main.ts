import * as core from './core';
import { DB } from './core/db';
import { run as apiRun } from './api';
import { createLogger } from './core/utils';
import { IndexerCollector } from './core/metrics';
import { getSdk } from './core/sdk';
import { startTokenUpdater } from './tokens';
import {
  program,
  environment,
  configOverrideLocation,
  // metricsPort,
  logLevel,
  Program,
} from './config';

(async () => {
  const loggerName = program === Program.API ? 'indexer_api' : 'indexer';

  const logger = createLogger(loggerName, environment, logLevel);
  const m = new IndexerCollector(environment, logger);

  const sdk = await getSdk(configOverrideLocation || environment);

  const db = new DB(m, logger, sdk);
  await db.connect();

  if (program === Program.API) {
    await startTokenUpdater(sdk, db, logger);
    await apiRun(db, logger);
    logger.info(`Finished api run`);
  } else if (program === Program.CORE) {
    m.startServer(3000); // should be `metricsPort`, but thats a huge kludge now till next week :D
    await core.run(sdk, db, logger, m);
  } else {
    logger.error(`Cannot run both at the same time`);
    process.exit(1);
  }
})();
