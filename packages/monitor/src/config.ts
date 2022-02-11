import * as dotenv from 'dotenv';
import Logger from 'bunyan';
import * as contexts from './registerContext';
import { NomadContext } from '@nomad-xyz/sdk';
import { HealthMetricsCollector } from './bridgeHealth/healthMetrics';
import { MetricsCollector } from './metrics';
import { setRpcProviders } from './registerContext';
import { RelayLatencyMetrics } from './latencies/relayer/metrics';
import { ProcessLatencyMetrics } from './latencies/processor/metrics';
import { E2ELatencyMetrics } from './latencies/e2e/metrics';

dotenv.config({ path: process.env.CONFIG_PATH ?? '.env' });
const environment = process.env.ENVIRONMENT ?? 'development';

export class MonitorConfig {
  origin: string;
  remotes: string[];
  context: NomadContext;
  metrics: MetricsCollector;
  logger: Logger;
  googleCredentialsFile: string;

  constructor(script: string, origin: string) {
    prepareContext();

    const environment = process.env.ENVIRONMENT ?? 'development';

    this.origin = origin;
    this.remotes = getNetworks().filter((m) => m != origin);
    switch(environment){
      case 'production': {
        this.context = contexts.mainnet
        break;
      }
      case 'staging': {
        this.context = contexts.staging
        break;
      }
      default: {
        this.context = contexts.dev
        break;
      }
    }
    this.metrics = getMetrics(script);
    this.logger = createLogger(script);
    this.googleCredentialsFile =
      process.env.GOOGLE_CREDENTIALS_FILE ?? './credentials.json';
  }
}

function createLogger(script: string) {
  return Logger.createLogger({
    name: `contract-metrics-${script}`,
    serializers: Logger.stdSerializers,
    level: 'debug',
    environment: environment,
  });
}

function getMetrics(script: string): MetricsCollector {
  let metrics;
  switch (script) {
    case 'health':
      metrics = new HealthMetricsCollector(environment, createLogger(script));
      break;
    case 'e2e':
      metrics = new E2ELatencyMetrics(environment, createLogger(script));
      break;
    case 'relayer':
      metrics = new RelayLatencyMetrics(environment, createLogger(script));
      break;
    case 'processor':
      metrics = new ProcessLatencyMetrics(environment, createLogger(script));
      break;
    case 'tokens':
      metrics = undefined;
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
