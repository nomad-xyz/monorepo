import * as dotenv from 'dotenv';
import { BunyanLevel } from './core/utils';

dotenv.config();

export enum NomadEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum Program {
  API = 'api',
  CORE = 'core',
}

export const environment = process.env.ENVIRONMENT as NomadEnvironment;
export const isProduction = environment === NomadEnvironment.PRODUCTION;
export const isDevelopment = environment === NomadEnvironment.DEVELOPMENT;
export const nodeEnv = process.env.NODE_ENV;

export const configOverrideLocation = process.env.CONFIG_OVERRIDE_LOCATION;
export const program = process.env.PROGRAM as Program;
export const logLevel = (process.env.LOG_LEVEL || 'debug') as BunyanLevel;

// CORE CONFIG
export const batchSize = parseInt(process.env.BATCH_SIZE || '2000');
export const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

// API CONFIG
export const metricsPort = parseInt(process.env.METRICS_PORT || '9090');
export const useAllResolvers = process.env.API_USE_ALL_RESOLVERS === 'TRUE';
export const gitCommit = process.env.GIT_COMMIT;
export const port = process.env.PORT;
