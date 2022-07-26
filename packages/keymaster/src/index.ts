import { readConfig, sleep } from "./utils";
import { Keymaster } from "./keymaster";

const DRY_RUN = process.env.DRY_RUN === "true";
const METRICS_PORT = parseInt(process.env.METRICS_PORT || "9090") || 9090;
const CONFIG_PATH = process.env.CONFIG_PATH || `./config/keymaster.json`;
const PERIOD = parseInt(process.env.PERIOD || "60") || 60;
const NETWORK_ENABLED = process.env.NETWORK_ENABLED?.split(",") || [];

async function run(
  configPath: string,
  port: number,
  period: number,
  dryrun = false
) {
  const config = readConfig(configPath);
  const km = await new Keymaster(config).init();
  km.ctx.metrics.startServer(port);

  await km.checkAndPayEnabledNetworks(NETWORK_ENABLED, period, dryrun);
}

(async () => {
  await run(CONFIG_PATH, METRICS_PORT, PERIOD, DRY_RUN);
})();
