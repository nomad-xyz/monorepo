import { NomadContext } from "@nomad-xyz/sdk";
import Logger from "bunyan";
import { MonitoringCollector } from "./metrics";
import { TaskRunner } from "./taskRunner";
import { sleep } from "./utils";

export class HomeStatusCollector extends TaskRunner {
    ctx: NomadContext;
    logger: Logger;
    _metrics: MonitoringCollector;
  
    constructor(
      ctx: NomadContext,
      logger: Logger,
      metrics: MonitoringCollector,
    ) {
      super();
      this.ctx = ctx;
      this.logger = logger;
      this._metrics = metrics;
    }

    get metrics(): MonitoringCollector {
      return this._metrics;
    }
  
    async runTasks(): Promise<void> {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        console.log(`Started HomeStatus`);
        const start = Date.now();
  
        await Promise.all([
          this.checkAllHomes(),
        ]);
  
        const time = (Date.now() - start)/1000;
        console.log(`Finished HomeStatus after ${time.toFixed()} seconds, waiting 3 minutes`);
        await sleep(180000);
      }
    }
  
    async checkAllHomes(): Promise<void> {
      await this.checkHomes(this.ctx.domainNumbers);
    }
  
    async checkHomes(networks: (string | number)[]): Promise<void> {
      for (const n of networks) {
        await this.checkHome(n);
      }
    }
  
    async checkHome(nameOrDomain: string | number): Promise<void> {
      const domain = this.ctx.resolveDomain(nameOrDomain);
      const home = this.ctx.mustGetCore(domain).home;
      console.log(`Check home ${nameOrDomain}`);
      const state = await this.record(home.state(), 'RPC', 'HomeState', this.ctx.getDomain(domain)?.name.toString() || 'lol' );
      console.log(`Got home ${nameOrDomain}`);
      if (state === 2) {
        this.metrics.setHomeState(nameOrDomain.toString(), true);
      } else {
        this.metrics.setHomeState(nameOrDomain.toString(), false);
      }
    }
  
    // async healthy(): Promise<boolean> {
    //   try {
    //     const state = await this.home.state();
    //     if (state !== 1) {
    //       return false;
    //     } else {
    //       return true;
    //     }
    //   } catch (e: any) {
    //     this.logger.warn(
    //       `Couldn't collect home state for ${this.domain} domain. Error: ${e.message}`,
    //     );
    //     throw new Error()
    //     // TODO! something
    //   }
    //   return true; // BAD!!!
    // }
  
    // get failed(): boolean {
    //   return !this.healthy;
    // }
  }
  