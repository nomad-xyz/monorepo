import * as core from "./core";
import * as api from "./api";
import { DB } from "./core/db";
import { createLogger } from "./core/utils";
import { IndexerCollector } from "./core/metrics";
import { getBridgeContext, getSDKs } from "./core/sdk";
import { startTokenUpdater } from "./tokens";

export type NomadEnvironment = "development" | "staging" | "production";
const environment = process.env.ENVIRONMENT! as NomadEnvironment;
export type Program = "api" | "core";


const program = process.env.PROGRAM! as Program;

(async () => {
  const logger = createLogger("indexer", environment);
  const m = new IndexerCollector(environment, logger);

  const db = new DB(m, logger);
  await db.connect();

  const sdks = getSDKs(environment);
  // const sdk = getBridgeContext(environment);

  if (program === "api") {
    
    const i = startTokenUpdater(sdks[1], db, logger);
    await api.run(db, logger);
    clearInterval(await i);

  } else if (program === "core") {

    m.startServer(3000);
    await core.run(sdks, db, logger, m);

  } else {

    logger.warn(`Starting all on the same process...`);
    const i = startTokenUpdater(sdks[1], db, logger);
    await Promise.all([
      api.run(db, logger),
      core.run(sdks, db, logger, m),
    ]).catch(e => logger.error(`Error happened during run of api or core: ${e}`));
    clearInterval(await i);

  }
})();
