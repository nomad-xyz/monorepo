import * as core from "./core";
import * as api from "./api";
import { DB } from "./core/db";
import { createLogger } from "./core/utils";
import { IndexerCollector } from "./core/metrics";

export type NomadEnvironment = "development" | "staging" | "production";
export type Program = "api" | "core";

const environment = process.env.ENVIRONMENT! as NomadEnvironment;
const program = process.env.PROGRAM! as Program;

(async () => {
  const logger = createLogger("indexer", environment);
  const m = new IndexerCollector(environment, logger);
  

  const db = new DB(m, logger);
  await db.connect();


  if (program === "api") {
    await api.run(db, logger);
  } else if (program === "core") {
    m.startServer(3000);
    await core.run(db, environment, logger, m);
  } else {
    logger.warn(`Started both indexer and api on the same process.`);
    await Promise.all([
      api.run(db, logger),
      core.run(db, environment, logger, m),
    ]);
  }
})();
