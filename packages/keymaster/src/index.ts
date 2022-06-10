import { readConfig, sleep } from "./utils";
import { Keymaster } from "./keymaster";

async function run(configPath: string, port: number, dryrun = false) {
  const config = readConfig(configPath);
  const km = new Keymaster(config).init();
  km.ctx.metrics.startServer(port);

  while (true) {
    await km.checkAndPayAllNetworks(dryrun);

    await sleep(60 * 1000);
  }
}

const DRY_RUN = process.env.DRY_RUN === "true";
const configPath = process.env.CONFIG_PATH || `/configs/keymaster.json`;

(async () => {
  await run(configPath, 9090, DRY_RUN);
})();
