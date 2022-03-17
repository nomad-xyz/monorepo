import * as dotenv from 'dotenv';
import Logger from 'bunyan';
import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import { HealthMetricsCollector } from './healthMetrics';
import { MetricsCollector } from '../metrics';
import * as configuration from "@nomad-xyz/configuration";

dotenv.config({ path: process.env.MONITOR_CONFIG_PATH ?? '.env' });

export class MonitorConfig {
  origin: string;
  context: BridgeContext;
  metrics: MetricsCollector;
  logger: Logger;
  googleCredentialsFile: string;

  constructor(script: string, origin: string) {
    const environment = process.env.MONITOR_ENVIRONMENT ?? 'development';
    const logLevel = process.env.MONITOR_LOG_LEVEL ?? 'debug'
    this.origin = origin;
    this.context = new BridgeContext(environment)
    this.logger = createLogger(script, environment, logLevel);
    this.metrics = getMetrics(script, environment, this.logger);
  }
}

function createLogger(script: string, environment: string, logLevel: string) {
  return Logger.createLogger({
    name: `monitor-${script}`,
    serializers: Logger.stdSerializers,
    level: logLevel,
    environment: environment,
  });
}

function getMetrics(script: string, environment: string, logger: Logger): MetricsCollector {
  let metrics;
  switch (script) {
    case 'health':
      metrics = new HealthMetricsCollector(environment, logger);
      break;
    default:
      throw new Error('Must define a monitor script to run!');
  }

  return metrics as MetricsCollector;
}

function getNetworks() {
  let networks = [];
  switch (environment) {
    case 'production':
      networks = ['ethereum', 'moonbeam'];
      break;

    case 'staging':
      networks = ['kovan', 'moonbasealpha'];
      break;
    
    default:
      networks = ['kovan', 'moonbasealpha'];
      break;
  }

  return networks;
}

export function getRpcsFromEnv() {
  return {
    celoRpc: process.env.CELO_RPC ?? '',
    ethereumRpc: process.env.ETHEREUM_RPC ?? '',
    polygonRpc: process.env.POLYGON_RPC ?? '',
    alfajoresRpc: process.env.ALFAJORES_RPC ?? '',
    kovanRpc: process.env.KOVAN_RPC ?? '',
    rinkebyRpc: process.env.RINKEBY_RPC ?? '',
    moonbasealphaRpc: process.env.MOONBASEALPHA_RPC ?? '',
    moonbeamRpc: process.env.MOONBEAM_RPC ?? ''
  };
}

export function prepareContext() {
  const rpcs = getRpcsFromEnv();
  setRpcProviders(rpcs);
}

export function buildConfig(script: string) {
  prepareContext();

  return {
    baseLogger: createLogger(script),
    metrics: getMetrics(script),
    networks: getNetworks(),
    environment: environment,
    googleCredentialsFile:
      process.env.GOOGLE_CREDENTIALS_FILE ?? './credentials.json',
  };
}
