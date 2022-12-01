import { NomadContext } from '@nomad-xyz/sdk';
import { MonitoringContext } from './monitoringContext';
import { TaskRunner } from './taskRunner';

export class HomeStatusCollector extends TaskRunner {
  ctx: NomadContext;

  constructor(ctx: NomadContext, mc: MonitoringContext) {
    super(mc);
    this.ctx = ctx;
  }

  cooldown(): number {
    return 180;
  }

  tasks(): Promise<void>[] {
    return [this.checkAllHomes()];
  }

  async checkAllHomes(): Promise<void> {
    await this.checkHomes(this.ctx.domainNumbers);
  }

  async checkHomes(networks: (string | number)[]): Promise<void> {
    await Promise.all(
      networks.map(async (n) => {
        try {
          await this.checkHome(n);
        } catch (e) {
          this.logger.error(`Failed to check home ${n} with error:`, e);
        }
      }),
    );
  }

  async checkHome(nameOrDomain: string | number): Promise<void> {
    const domain = this.ctx.resolveDomain(nameOrDomain);
    const home = this.ctx.mustGetCore(domain).home;
    console.log(`Check home for ${nameOrDomain}`);
    const state = await this.record(
      home.state(),
      'RPC',
      'HomeState',
      this.ctx.getDomain(domain)?.name.toString() || 'lol',
    );
    console.log(`Checked home for ${nameOrDomain}`);
    if (state === 2) {
      this.metrics.setHomeState(nameOrDomain.toString(), true);
    } else {
      this.metrics.setHomeState(nameOrDomain.toString(), false);
    }
  }
}
