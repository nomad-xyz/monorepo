import Logger from 'bunyan';

export enum BunyanLevel {
    FATAL = 'fatal',
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug',
    TRACE = 'trace',
  }
  
  export function createLogger(
    name: string,
    environment: string,
    level?: BunyanLevel,
  ): Logger {
    return Logger.createLogger({
      name,
      serializers: Logger.stdSerializers,
      level: level || 'debug',
      environment: environment,
    });
  }

  export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
