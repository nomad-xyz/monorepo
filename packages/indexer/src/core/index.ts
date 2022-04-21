import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import { ProcessorV2 } from "./consumerV2";
import { Orchestrator } from "./orchestrator";
import * as dotenv from "dotenv";
import { IndexerCollector } from "./metrics";
import { DB } from "./db";
import Logger from "bunyan";
import { run as runApi } from "./api";
import { createClient } from "redis";
dotenv.config({});

export async function run(
  sdk: BridgeContext,
  db: DB,
  logger: Logger,
  metrics: IndexerCollector
) {
  const redis = createClient({
    url: process.env.REDIS_URL || "redis://redis:6379",
  });

  await redis.connect();

  const c = new ProcessorV2(db, logger, redis, sdk.domainNumbers);

  const o = new Orchestrator(sdk, c, metrics, logger, db, redis);
  o.subscribeStatisticEvents();

  if (!!process.env.DEBUG_PORT) runApi(o, logger.child({ span: "debugApi" }));

  await o.init();
  await o.startConsuming();
}
