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
const metricsPort = process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : 9090;

(async () => {
  /* eslint-disable-next-line no-constant-condition */
  const logger = createLogger('monitoring', environment);
  const metrics = new MonitoringCollector(environment, logger);
  const mc = new MonitoringContext(environment, logger, metrics);

  const ctx = new NomadContext(environment);

  await Promise.all(ctx.domainNumbers.map(async (domainNumber) => {
    try {
      const p = ctx.getProvider(domainNumber);
      await p?.getBlockNumber();
    } catch(_) {
      const domainName = ctx.mustGetDomain(domainNumber).name;
      const envName = domainName.toUpperCase() + '_RPC';
      const rpcEndpoint = process.env[envName];
      if (rpcEndpoint) {
        ctx.registerRpcProvider(domainNumber, rpcEndpoint);
      } else {
        const errorMessage = `Couldn't get block number for domain ${domainNumber}. Please check if ${envName} env variable is present`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
  }));
    
  const goldsky = new Goldsky(defaultGoldSkySecret, mc);
  const homeStatus = new HomeStatusCollector(ctx, mc);
  const tasks: TaskRunner[] = [
    goldsky,
    homeStatus,
  ];

  const p = Promise.all(tasks.map(task => task.runTasks()));

  await Promise.all([
    p,
    metrics.startServer(metricsPort),
  ]);
})();

/*
  OTHER TODOS:
  - setup helm (can prob just copy from the old monitor package)
  - quick mvp as first goal: health check for monitor itself

  HELPFUL LINKS:
  - old monitor package: https://github.com/nomad-xyz/monorepo/tree/9fa23397d65b1fc9855bb6060d430f54519f3871/packages/monitor

*/
