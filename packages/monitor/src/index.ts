import { NomadContext } from "@nomad-xyz/sdk";
import { defaultGoldSkySecret, Goldsky } from "./goldsky";
import { MonitoringCollector} from "./metrics";
import { TaskRunner } from "./taskRunner";
import { createLogger } from "./utils";

import * as dotenv from 'dotenv';
import { HomeStatusCollector } from "./homeStatus";
import { MonitoringContext } from "./monitoringContext";
dotenv.config();

const environment = process.env.NOMAD_ENVIRONMENT || 'production';

(async () => {
  /* eslint-disable-next-line no-constant-condition */
  const logger = createLogger('monitoring', environment);
  const metrics = new MonitoringCollector(environment, logger);
  const mc = new MonitoringContext(environment, logger, metrics);

  const ctx = new NomadContext(environment);

  if (ctx.getDomain(6648936) ) {
    if (!process.env.ETH_RPC) {
      throw new Error("Should provide an ethereum rpc to ETH_RPC env variable")
    } else {
      ctx.registerRpcProvider(6648936, process.env.ETH_RPC);
    }
  }
    
  const goldsky = new Goldsky(defaultGoldSkySecret, mc);
  const homeStatus = new HomeStatusCollector(ctx, mc);
  const tasks: TaskRunner[] = [
    goldsky,
    homeStatus,
  ];

  const p = Promise.all(tasks.map(task => task.runTasks()));

  await Promise.all([
    p,
    metrics.startServer(3001),
  ]);
})();

/*
  OTHER TODOS:
  - setup helm (can prob just copy from the old monitor package)
  - quick mvp as first goal: health check for monitor itself

  HELPFUL LINKS:
  - old monitor package: https://github.com/nomad-xyz/monorepo/tree/9fa23397d65b1fc9855bb6060d430f54519f3871/packages/monitor

*/
