import { ethers } from 'ethers';
import { Domain } from './domains';
import { MultiProvider } from './provider';

/**
 * Abstract class for managing collections of contracts.
 *
 * This class holds a context (based on the {@link MultiProvider}) and
 * retrieves connections for contracts from it.
 */
export abstract class Contracts<U extends Domain, T extends MultiProvider<U>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly args: any[];

  readonly domain: string;
  protected context: T;

  /**
   *
   * @param args Any arguments for the Contracts object.
   */
  constructor(context: T, domain: string, ...args: any[]) {
    this.context = context;
    this.args = args;
    this.domain = domain;
  }

  get connection(): ethers.Signer | ethers.providers.Provider | undefined {
    return this.context.getConnection(this.domain);
  }

  get domainNumber(): number {
    return this.context.resolveDomain(this.domain);
  }
}
