import { BridgeContext } from "@nomad-xyz/sdk-bridge";
// import DeployContext from '../src/DeployContext';
// import * as sdk from '@nomad-xyz/sdk';
import { Processor } from "./consumer";
import { Orchestrator } from "./orchestrator";
import * as dotenv from "dotenv";
import { IndexerCollector } from "./metrics";
import { DB } from "./db";
import Logger from "bunyan";
import {run as runApi} from "./api";
dotenv.config({});

export async function run(db: DB, environment: string, logger: Logger, metrics: IndexerCollector) {
  let ctx: BridgeContext;
  if (environment === "production") {
    ctx = new BridgeContext("production");
  } else if (environment === "staging") {
    ctx = new BridgeContext("staging");
  } else if (environment === "development") {
    ctx = new BridgeContext("development");
  } else {
    throw new Error(`Enviroment '${environment}' is not suppoerted`);
  }

  ctx.domainNumbers.forEach((domain: number) => {
    const name = ctx.mustGetDomain(domain).name.toUpperCase();
    const rpcEnvKey = `${name}_RPC`;
    const rpc = process.env[rpcEnvKey];

    if (!rpc)
      throw new Error(
        `RPC url for domain ${domain} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`
      );

    ctx.registerRpcProvider(domain, rpc);
  });

  const c = new Processor(db, logger);

  const o = new Orchestrator(ctx, c, ctx.domainNumbers[0], metrics, logger, db);

  if (!!process.env.DEBUG_PORT) runApi(o, logger.child({span: 'debugApi'}));
  
  await o.init();
  await o.startConsuming();
}
