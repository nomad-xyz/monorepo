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
const METRICS_PORT = parseInt(process.env.METRICS_PORT || "9090") || 9090;
const CONFIG_PATH = process.env.CONFIG_PATH || `./config/keymaster.json`;

(async () => {
  await run(CONFIG_PATH, METRICS_PORT, DRY_RUN);
})();
