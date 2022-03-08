export enum LogLevel {
  log,
  error,
  warn,
  info,
  debug,
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel | number | undefined) {
    this.level = level || LogLevel.log;
  }

  setLevel(level: LogLevel | number) {
    this.level = level;
  }

  private shouldPrint(level: LogLevel | number): boolean {
    return this.level >= level;
  }

  log(...args: any[]) {
    if (this.shouldPrint(LogLevel.log)) {
      console.log(...args);
    }
  }

  error(...args: any[]) {
    if (this.shouldPrint(LogLevel.error)) {
      console.error(...args);
    }
  }

  warn(...args: any[]) {
    if (this.shouldPrint(LogLevel.warn)) {
      console.warn(...args);
    }
  }

  info(...args: any[]) {
    if (this.shouldPrint(LogLevel.info)) {
      console.info(...args);
    }
  }

  debug(...args: any[]) {
    if (this.shouldPrint(LogLevel.debug)) {
      console.debug(...args);
    }
  }
}
