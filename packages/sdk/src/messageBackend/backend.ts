import { NomadContext } from '..';
import { Dispatch } from '../messages/types';

/**
 * Abstract class required for operation of NomadMessage
 */
export abstract class MessageBackend {
  abstract getContext(): NomadContext;
  abstract getDispatches(
    tx: string,
    limit?: number,
  ): Promise<Dispatch[] | undefined>;
  abstract getFirstMessageHash(tx: string): Promise<string | undefined>;
  abstract getDispatchByMessageHash(messageHash: string): Promise<Dispatch | undefined>;

  abstract dispatchTx(messageHash: string): Promise<string | undefined>;
  abstract updateTx(messageHash: string): Promise<string | undefined>;
  abstract relayTx(messageHash: string): Promise<string | undefined>;
  abstract processTx(messageHash: string): Promise<string | undefined>;

  abstract dispatchedAt(messageHash: string): Promise<Date | undefined>;
  abstract updatedAt(messageHash: string): Promise<Date | undefined>;
  abstract relayedAt(messageHash: string): Promise<Date | undefined>;
  abstract processedAt(messageHash: string): Promise<Date | undefined>;

  abstract destinationDomainId(
    messageHash: string,
  ): Promise<number | undefined>;
}
