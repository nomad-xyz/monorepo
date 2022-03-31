import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import { Processor } from "./consumer";
import { Orchestrator } from "./orchestrator";
import * as dotenv from "dotenv";
import { IndexerCollector } from "./metrics";
import { DB } from "./db";
import Logger from "bunyan";
import { run as runApi } from "./api";
import { NomadContext } from "@nomad-xyz/sdk";
dotenv.config({});

export async function run(
  sdks: [NomadContext, BridgeContext],
  db: DB,
  logger: Logger,
  metrics: IndexerCollector
) {
  const c = new Processor(sdks, db, logger);

  const o = new Orchestrator(sdks, c, metrics, logger, db);

  if (!!process.env.DEBUG_PORT) runApi(o, logger.child({ span: "debugApi" }));

  await o.init();
  await o.startConsuming();
}
