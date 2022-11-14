// TODO: import sdk + register from prom-client

console.log('hello monitor');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Metrics = number[];
const metrics: Metrics = [];

// NOTE: this is the general idea
//  while True:
//    fetch events that are required to calculate a metric
//    save result to memory
//    record observation with prometheus
//    sleep for a while

(async () => {
  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    console.log('inside while loop. metrics: ', metrics);

    // TODO: get the new events from sdk and calculate metrics
    const newMetrics: Metrics = [Math.random()];

    // update in memory metrics
    metrics.push(...newMetrics);

    // sleep for some time before starting again
    await sleep(1000);
  }
})();

/*
  OTHER TODOS:
  - setup helm (can prob just copy from the old monitor package)
  - quick mvp as first goal: health check for monitor itself

  HELPFUL LINKS:
  - old monitor package: https://github.com/nomad-xyz/monorepo/tree/9fa23397d65b1fc9855bb6060d430f54519f3871/packages/monitor

*/
