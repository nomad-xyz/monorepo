import * as core from './core';
import * as api from './api';
import { DB } from './core/db';
import { createLogger } from './core/utils';
import { IndexerCollector } from './core/metrics';
import { getSdk } from './core/sdk';
import { startTokenUpdater } from './tokens';

export type NomadEnvironment = 'development' | 'staging' | 'production';
export type Program = 'api' | 'core';

const environment = process.env.ENVIRONMENT! as NomadEnvironment;
const configOverrideLocation = process.env.CONFIG_OVERRIDE_LOCATION;
const program = process.env.PROGRAM! as Program;
const logLevel = (process.env.LOG_LEVEL || 'debug') as BunyanLevel;
const metricsPort = parseInt(process.env.METRICS_PORT || "9090");

(async () => {
  const logger = createLogger('indexer', environment);
  const m = new IndexerCollector(environment, logger);

  const sdk = await getSdk(configOverrideLocation || environment);

  const db = new DB(m, logger, sdk);
  await db.connect();

  if (program === 'api') {
    /* const [s, p] = */ await startTokenUpdater(sdk, db, logger);
    await api.run(db, logger);
    logger.info(`Finished api run`);
    // s();
    // await p;
    // clearInterval(i);
  } else if (program === 'core') {
    m.startServer(metricsPort);
    await core.run(sdk, db, logger, m);
  } else {
    logger.warn(`Starting all on the same process...`);
    /*const [s, p] = */ await startTokenUpdater(sdk, db, logger);
    await Promise.all([
      api.run(db, logger),
      core.run(sdk, db, logger, m),
    ]).catch((e) =>
      logger.error(`Error happened during run of api or core:`, e),
    );
    // s();
    // await p;
    // clearInterval(i);
  }
})();
