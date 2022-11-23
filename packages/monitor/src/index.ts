import { NomadContext } from "@nomad-xyz/sdk";
import { defaultGoldSkySecret, Goldsky } from "./goldsky";
import { MonitoringCollector} from "./metrics";
import { TaskRunner } from "./taskRunner";
import { createLogger } from "./utils";

import * as dotenv from 'dotenv';
import { HomeStatusCollector } from "./homeStatus";
dotenv.config();


// TODO: import sdk + register from prom-client

console.log('hello monitor');

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// type Metrics = number[];
// const metrics: Metrics = [];

// NOTE: this is the general idea
// For each blocking task (or group of task) (so that some task won't block others - similar stuff has Keymaster):
//   while True:
//     fetch events that are required to calculate the metric
//     save result to memory
//     record observation with prometheus
//     sleep for a while

const environment = 'production';

(async () => {
  /* eslint-disable-next-line no-constant-condition */
  const logger = createLogger('monitoring', environment);
  const mc = new MonitoringCollector(environment, logger);

  const ctx = new NomadContext(environment);

  if (!process.env.ETH_RPC)
    throw new Error("Should provide an ethereum rpc to ETH_RPC env variable");

  ctx.registerRpcProvider(6648936, process.env.ETH_RPC);

  const goldsky = new Goldsky(defaultGoldSkySecret, mc);
  const homeStatus = new HomeStatusCollector(ctx, logger, mc);
  const tasks: TaskRunner[] = [
    goldsky,
    homeStatus,
  ];

  const p = Promise.all(tasks.map(task => task.runTasks()));

  await Promise.all([
    p,
    mc.startServer(3001),
  ]);


  // while (true) {
  //   console.log('inside while loop. metrics: ', metrics);

  //   // TODO: get the new events from sdk and calculate metrics
  //   const newMetrics: Metrics = [Math.random()];

  //   // update in memory metrics
  //   metrics.push(...newMetrics);

  //   // sleep for some time before starting again
  //   await sleep(1000);
  // }
})();

/*
  OTHER TODOS:
  - setup helm (can prob just copy from the old monitor package)
  - quick mvp as first goal: health check for monitor itself

  HELPFUL LINKS:
  - old monitor package: https://github.com/nomad-xyz/monorepo/tree/9fa23397d65b1fc9855bb6060d430f54519f3871/packages/monitor

*/
