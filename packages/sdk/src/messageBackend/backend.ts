import { Dispatch } from "../messages";

/**
 * Abstract class required for operation of NomadMessage
 */
 export abstract class MessageBackend {
    abstract getDispatch(tx: string): Promise<Dispatch | undefined>;
    abstract getMessageHash(tx: string): Promise<string | undefined>;
    abstract dispatchTx(messageHash: string): Promise<string | undefined>;
    abstract updateTx(messageHash: string): Promise<string | undefined>;
    abstract relayTx(messageHash: string): Promise<string | undefined>;
    abstract processTx(messageHash: string): Promise<string | undefined>;
    abstract confirmAt(messageHash: string): Promise<Date | undefined>;
}