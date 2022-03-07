import { ethers } from 'ethers';
import { NomadContext, CoreContracts } from '@nomad-xyz/sdk';

import * as utils from './utils';
export { parseAction, Action } from './GovernanceMessage';

export type Address = string;

export interface Call {
  to: Address;
  data: ethers.utils.BytesLike;
}

export interface RemoteContents {
  [domain: string]: Call[];
}

export interface CallBatchContents {
  local: Call[];
  remote: RemoteContents;
}

export class CallBatch {
  readonly local: Readonly<Call>[];
  readonly remote: Map<number, Readonly<Call>[]>;
  private governorCore: CoreContracts;
  private context: NomadContext;
  private built?: ethers.PopulatedTransaction;

  constructor(
    context: NomadContext,
    governorDomain: number,
    callerKnowsWhatTheyAreDoing: boolean,
  ) {
    if (!callerKnowsWhatTheyAreDoing) {
      throw new Error(
        'Please instantiate this class using the fromContext method',
      );
    }
    this.context = context;
    this.governorCore = this.context.mustGetCore(governorDomain);
    this.remote = new Map();
    this.local = [];
  }

  static async fromContext(context: NomadContext): Promise<CallBatch> {
    const governorDomain = await context.governorDomain();
    return new CallBatch(context, governorDomain, true);
  }

  static async fromJSON(
    context: NomadContext,
    batchContents: CallBatchContents,
  ): Promise<CallBatch> {
    const batch = await CallBatch.fromContext(context);
    // push the local calls
    for (const local of batchContents.local) {
      batch.pushLocal(local);
    }
    // push the remote calls
    for (const domain of Object.keys(batchContents.remote)) {
      const calls = batchContents.remote[domain];
      for (const call of calls) {
        batch.pushRemote(parseInt(domain), call);
      }
    }
    // return the constructed batch
    return batch;
  }

  get domains(): number[] {
    return Array.from(this.remote.keys());
  }

  pushLocal(call: Partial<Call>): void {
    if (this.built)
      throw new Error('Batch has been built. Cannot push more calls');
    this.local.push(utils.normalizeCall(call));
  }

  pushRemote(domain: number, call: Partial<Call>): void {
    if (this.built)
      throw new Error('Batch has been built. Cannot push more calls');
    if (!this.context.getCore(domain))
      throw new Error('Domain not registered on NomadContext');
    const calls = this.remote.get(domain);
    const normalized = utils.normalizeCall(call);
    if (!calls) {
      this.remote.set(domain, [normalized]);
    } else {
      calls.push(normalized);
    }
  }

  // Build a governance transaction from this callbatch
  async build(): Promise<ethers.PopulatedTransaction> {
    if (this.built) return this.built;
    const [domains, remoteCalls] = utils.associateRemotes(this.remote);
    this.built =
      await this.governorCore.governanceRouter.populateTransaction.executeGovernanceActions(
        this.local,
        domains,
        remoteCalls,
      );
    return this.built;
  }

  // Return the batch hash for the specified domain
  batchHash(domain: number): string {
    const calls = this.remote.get(domain);
    if (!calls) throw new Error(`Not found calls for remote ${domain}`);
    return utils.batchHash(calls);
  }

  // Sign the governance batch and return a serialized transaction
  // Used by individual governors
  async sign(): Promise<string> {
    await this.build();
    const signer = this.governorCore.governanceRouter.signer;
    return signer.signTransaction(this.built as ethers.PopulatedTransaction);
  }

  // Execute the local governance calls immediately,
  // dispatch the remote governance calls to their respective domains
  async execute(): Promise<ethers.providers.TransactionResponse> {
    await this.build();
    const signer = this.governorCore.governanceRouter.signer;
    return signer.sendTransaction(this.built as ethers.PopulatedTransaction);
  }

  // Execute the remote governance calls for a domain
  // @dev ensure waitDomain returns before attempting to executeDomain
  async executeDomain(
    domain: number,
  ): Promise<ethers.providers.TransactionResponse> {
    const calls = this.remote.get(domain);
    if (!calls) throw new Error(`Not found calls for remote ${domain}`);
    const governanceRouter = this.context.mustGetCore(domain).governanceRouter;
    return governanceRouter.executeCallBatch(calls);
  }

  // Waits for a specified domain to receive its batch
  // Note that this does not call execute
  async waitDomain(
    domain: number,
  ): Promise<ethers.providers.TransactionReceipt> {
    const router = this.context.mustGetCore(domain).governanceRouter;
    const hash = this.batchHash(domain);
    const filter = router.filters.BatchReceived(hash);
    // construct a promise which will resolve
    // if an event listener fires for this batch
    const eventListener: Promise<ethers.Event> = new Promise((resolve) => {
      router.once(filter, resolve);
    });
    // check if the batch hash has already been received
    const events = await router.queryFilter(filter);
    // if not, await the event listener
    let event: ethers.Event;
    if (events.length == 0) {
      event = await eventListener;
    } else {
      event = events[events.length - 1];
    }
    // return the event transaction receipt
    return event.getTransactionReceipt();
  }

  // Waits for all participating domains to receive their batches
  // Note that this does not call execute
  async waitAll(): Promise<ethers.providers.TransactionReceipt[]> {
    return Promise.all(this.domains.map((domain) => this.waitDomain(domain)));
  }
}
