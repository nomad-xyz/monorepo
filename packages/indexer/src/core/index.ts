import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import { Processor } from "./consumer";
import { Orchestrator } from "./orchestrator";
import * as dotenv from "dotenv";
import { IndexerCollector } from "./metrics";
import { DB } from "./db";
import Logger from "bunyan";
import { run as runApi } from "./api";
dotenv.config({});

export async function run(
  sdk: BridgeContext,
  db: DB,
  logger: Logger,
  metrics: IndexerCollector
) {
  const c = new Processor(db, logger);

  const o = new Orchestrator(sdk, c, metrics, logger, db);

  if (!!process.env.DEBUG_PORT) runApi(o, logger.child({ span: "debugApi" }));

  await o.init();
  await o.startConsuming();
}
