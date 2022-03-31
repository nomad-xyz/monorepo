import { BigNumber, ethers } from "ethers";
import { EventType, NomadEvent } from "./event";
import { Statistics } from "./types";

import { parseMessage, AnnotatedDispatch, AnnotatedProcess, AnnotatedUpdate, NomadContext, NomadMessage } from "@nomad-xyz/sdk";

import { AnnotatedSend, AnnotatedReceive, BridgeContext, parseBody, ParsedTransferMessage, BridgeMessage } from "@nomad-xyz/sdk-bridge";
import { parseAction } from "@nomad-xyz/sdk-govern";
import { DB } from "./db";
import Logger from "bunyan";
import { Padded } from "./utils";
import EventEmitter from "events";
import { MadEvent } from "./mad";
import { Result } from "ethers/lib/utils";
import { TypedEvent } from "@nomad-xyz/contracts-bridge/dist/src/common";

class StatisticsCollector {
  s: Statistics;
  constructor(domains: number[]) {
    this.s = new Statistics(domains);
  }

  addDispatched(domain: number) {
    this.s.counts.total.dispatched += 1;
    this.s.counts.domainStatistics.get(domain)!.dispatched += 1;
  }

  addUpdated(domain: number) {
    this.s.counts.total.updated += 1;
    this.s.counts.domainStatistics.get(domain)!.updated += 1;
  }

  addRelayed(domain: number) {
    this.s.counts.total.relayed += 1;
    this.s.counts.domainStatistics.get(domain)!.relayed += 1;
  }

  addReceived(domain: number) {
    this.s.counts.total.received += 1;
    this.s.counts.domainStatistics.get(domain)!.received += 1;
  }

  addProcessed(domain: number) {
    this.s.counts.total.processed += 1;
    this.s.counts.domainStatistics.get(domain)!.processed += 1;
  }

  contributeToCount(m: NomadMessagex) {
    switch (m.state) {
      case MsgState.Dispatched:
        this.addDispatched(m.origin);
        break;
      case MsgState.Updated:
        this.addUpdated(m.origin);
        break;
      case MsgState.Relayed:
        this.addRelayed(m.origin);
        break;
      case MsgState.Received:
        this.addReceived(m.origin);
        break;
      case MsgState.Processed:
        this.addProcessed(m.origin);
        break;
      default:
        break;
    }
  }

  stats(): Statistics {
    return this.s;
  }
}

type MadEventX = MadEvent<Result, TypedEvent<Result>, AnnotatedSend | AnnotatedReceive | AnnotatedDispatch | AnnotatedUpdate | AnnotatedProcess>;

export abstract class Consumer extends EventEmitter {
  abstract consume(evens: MadEventX[]): Promise<void>;
  abstract stats(): Statistics;
}

enum MsgState {
  Dispatched,
  Updated,
  Relayed,
  Received,
  Processed,
}

class GasUsed {
  dispatch: ethers.BigNumber;
  update: ethers.BigNumber;
  relay: ethers.BigNumber;
  receive: ethers.BigNumber;
  process: ethers.BigNumber;

  constructor() {
    this.dispatch = ethers.BigNumber.from(0);
    this.update = ethers.BigNumber.from(0);
    this.relay = ethers.BigNumber.from(0);
    this.receive = ethers.BigNumber.from(0);
    this.process = ethers.BigNumber.from(0);
  }

  serialize() {
    return {
      gasAtDispatch: this.dispatch.toHexString(),
      gasAtUpdate: this.update.toHexString(),
      gasAtRelay: this.relay.toHexString(),
      gasAtReceive: this.receive.toHexString(),
      gasAtProcess: this.process.toHexString(),
    };
  }

  static deserialize(o: {
    gasAtDispatch: string;
    gasAtUpdate: string;
    gasAtRelay: string;
    gasAtReceive: string;
    gasAtProcess: string;
  }): GasUsed {
    let g = new GasUsed();
    g.dispatch = ethers.BigNumber.from(o.gasAtDispatch);
    g.update = ethers.BigNumber.from(o.gasAtUpdate);
    g.relay = ethers.BigNumber.from(o.gasAtRelay);
    g.receive = ethers.BigNumber.from(o.gasAtReceive);
    g.process = ethers.BigNumber.from(o.gasAtProcess);
    return g;
  }
}

class Timings {
  dispatchedAt: number;
  updatedAt: number;
  relayedAt: number;
  processedAt: number;
  receivedAt: number;

  constructor(ts: number) {
    this.dispatchedAt = ts;
    this.updatedAt = 0;
    this.relayedAt = 0;
    this.processedAt = 0;
    this.receivedAt = 0;
  }

  updated(ts: number) {
    this.updatedAt = ts;
  }

  relayed(ts: number) {
    this.relayedAt = ts;
  }

  received(ts: number) {
    this.receivedAt = ts;
  }

  processed(ts: number) {
    this.processedAt = ts;
  }

  toUpdate(): number | undefined {
    if (this.updatedAt) {
      return this.updatedAt - this.dispatchedAt;
    }
    return undefined;
  }

  toRelay(): number | undefined {
    if (this.relayedAt) {
      return this.relayedAt - (this.updatedAt || this.dispatchedAt); // because of the problem with time that it is not ideal from RPC we could have skipped some stages. we take the last available
    }
    return undefined;
  }

  toReceive(): number | undefined {
    if (this.receivedAt) {
      return (
        this.receivedAt -
        (this.relayedAt || this.updatedAt || this.dispatchedAt)
      ); // because of the problem with time that it is not ideal from RPC we could have skipped some stages. we take the last available
    }
    return undefined;
  }

  toProcess(): number | undefined {
    if (this.processedAt) {
      return (
        this.processedAt - // Attention:   this.receivedAt is not what we are interested here
        (this.relayedAt || this.updatedAt || this.dispatchedAt)
      ); // because of the problem with time that it is not ideal from RPC we could have skipped some stages. we take the last available
    }
    return undefined;
  }

  serialize() {
    return {
      dispatchedAt: Math.floor(this.dispatchedAt / 1000),
      updatedAt: Math.floor(this.updatedAt / 1000),
      relayedAt: Math.floor(this.relayedAt / 1000),
      processedAt: Math.floor(this.processedAt / 1000),
      receivedAt: Math.floor(this.receivedAt / 1000),
    };
  }

  static deserialize(s: {
    dispatchedAt: number;
    updatedAt: number;
    relayedAt: number;
    processedAt: number;
    receivedAt: number;
  }): Timings {
    const t = new Timings(s.dispatchedAt * 1000);
    t.updatedAt = s.updatedAt * 1000;
    t.relayedAt = s.relayedAt * 1000;
    t.processedAt = s.processedAt * 1000;
    t.receivedAt = s.receivedAt * 1000;
    return t;
  }
}

enum MessageType {
  NoMessage,
  TransferMessage,
  GovernanceMessage,
}

export type MinimumSerializedNomadMessage = {
  origin: number; // m.origin,
  destination: number; //   m.destination,
  nonce: number; //   m.nonce,
  root: string; //   m.root,
  messageHash: string; //   m.hash,
  leafIndex: string; //   BigNumber.from(m.leaf_index),
  body: string; //   m.raw,
  dispatchBlock: number; //   m.block,
  dispatchedAt: number; //   Number(m.dispatched_at),
  updatedAt: number; //   Number(m.updated_at),
  relayedAt: number; //   Number(m.relayed_at),
  receivedAt: number; //   Number(m.received_at),
  processedAt: number; //   Number(m.processed_at),
  sender: string | null; //   m.sender || '',
  tx: string | null; //   m.evm || ''
  state: MsgState;
  gasAtDispatch: string;
  gasAtUpdate: string;
  gasAtRelay: string;
  gasAtReceive: string;
  gasAtProcess: string;
};

export type ExtendedSerializedNomadMessage = MinimumSerializedNomadMessage & {
  internalSender: string; // PADDED! // internalSender: this.internalSender,
  internalRecipient: string; // PADDED! // internalRecipient: this.internalRecipient,
  // hasMessage: MessageType | null,// hasMessage: this.hasMessage,
  // bridgeMsgType: this.transferMessage.action.type,
  recipient: string | null; // PADDED!// bridgeMsgTo: this.recipient(), // PADDED!
  amount: string | null; // bridgeMsgAmount: this.transferMessage.action.amount.toHexString(),
  allowFast: boolean; // bridgeMsgAllowFast: this.transferMessage.action.allowFast,
  detailsHash: string | null; // bridgeMsgDetailsHash: this.transferMessage.action.detailsHash,
  tokenDomain: number | null; // bridgeMsgTokenDomain: this.tokenDomain(),
  tokenId: string | null; // PADDED! // bridgeMsgTokenId: this.tokenId(), // PADDED!
};

export class NomadMessagex {
  origin: number;
  destination: number;
  nonce: number;
  root: string;
  messageHash: string;
  leafIndex: ethers.BigNumber;
  sender?: string;
  internalSender: Padded; // PADDED!
  internalRecipient: Padded; // PADDED!

  body: string;
  hasMessage: MessageType;
  transferMessage?: ParsedTransferMessage;

  state: MsgState;
  dispatchBlock: number;
  tx?: string;

  timings: Timings;
  gasUsed: GasUsed;
  logger: Logger;

  constructor(
    origin: number,
    destination: number,
    nonce: number,
    root: string,
    messageHash: string,
    leafIndex: ethers.BigNumber,
    // destinationAndNonce: ethers.BigNumber,
    body: string,
    dispatchedAt: number,
    dispatchBlock: number,
    logger: Logger,
    gasUsed?: GasUsed
  ) {
    this.origin = origin;
    this.destination = destination;
    this.nonce = nonce;
    this.root = root.toLowerCase();
    this.messageHash = messageHash.toLowerCase();
    this.leafIndex = leafIndex;

    this.body = body;
    const parsed = parseMessage(body);
    this.internalSender = new Padded(parsed.sender); // PADDED!
    this.internalRecipient = new Padded(parsed.recipient); // PADDED!
    this.hasMessage = MessageType.NoMessage;

    this.tryParseMessage(parsed.body);

    this.state = MsgState.Dispatched;
    this.timings = new Timings(dispatchedAt);
    this.dispatchBlock = dispatchBlock;
    this.gasUsed = gasUsed || new GasUsed();
    this.logger = logger.child({ messageHash });
  }

  // PADDED!
  /**
   * PADDED!
   */
  recipient(): Padded | undefined {
    return this.transferMessage
      ? new Padded(this.transferMessage!.action.to)
      : undefined;
  }

  // PADDED!
  /**
   * PADDED!
   */
  tokenId(): Padded | undefined {
    return this.transferMessage
      ? new Padded(this.transferMessage!.token.id as string)
      : undefined;
  }

  tokenDomain(): number | undefined {
    return this.transferMessage
      ? (this.transferMessage?.token.domain as number)
      : undefined;
  }

  amount(): BigNumber | undefined {
    return this.transferMessage
      ? this.transferMessage?.action.amount
      : undefined;
  }

  allowFast(): boolean {
    return !!this.transferMessage?.action.allowFast;
  }

  detailsHash(): string | undefined {
    return this.transferMessage
      ? this.transferMessage?.action.detailsHash
      : undefined;
  }

  update(ts: number, gasUsed: BigNumber) {
    if (this.state < MsgState.Updated) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Updated} (Updated)`
      );
      this.state = MsgState.Updated;
      this.timings.updated(ts);
      this.gasUsed.update = gasUsed;
      return true;
    }
    this.logger.debug(
      `The message is in the higher state for being Updated. Want < ${MsgState.Updated}, is ${this.state}`
    );
    return false;
  }

  relay(ts: number, gasUsed: BigNumber) {
    if (this.state < MsgState.Relayed) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Relayed} (Relayed)`
      );
      this.state = MsgState.Relayed;
      this.timings.relayed(ts);
      this.gasUsed.relay = gasUsed;
      return true;
    }
    this.logger.debug(
      `The message is in the higher state for being Relayed. Want < ${MsgState.Relayed}, is ${this.state}`
    );
    return false;
  }

  receive(ts: number, gasUsed: BigNumber) {
    if (this.state < MsgState.Received) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Received} (Received)`
      );
      this.state = MsgState.Received;
      this.timings.received(ts);
      this.gasUsed.receive = gasUsed;
      return true;
    }
    this.logger.debug(
      `The message is in the higher state for being Received. Want < ${MsgState.Received}, is ${this.state}`
    );
    return false;
  }

  process(ts: number, gasUsed: BigNumber) {
    if (this.state < MsgState.Processed) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Processed} (Processed)`
      );
      this.state = MsgState.Processed;
      this.timings.processed(ts);
      this.gasUsed.process = gasUsed;
      return true;
    }
    this.logger.debug(
      `The message is in the higher state for being Proce. Want < ${MsgState.Processed}, is ${this.state}`
    );
    return false;
  }

  static deserialize(s: MinimumSerializedNomadMessage, logger: Logger) {
    const m = new NomadMessage(
      s.origin,
      s.destination,
      s.nonce,
      s.root,
      s.messageHash,
      BigNumber.from(s.leafIndex),
      s.body,
      s.dispatchedAt * 1000,
      s.dispatchBlock,
      logger.child({ messageSource: "deserialize" })
    );
    m.timings.updated(s.updatedAt * 1000);
    m.timings.relayed(s.relayedAt * 1000);
    m.timings.received(s.receivedAt * 1000);
    m.timings.processed(s.processedAt * 1000);

    m.gasUsed.dispatch = ethers.BigNumber.from(s.gasAtDispatch);
    m.gasUsed.update = ethers.BigNumber.from(s.gasAtUpdate);
    m.gasUsed.relay = ethers.BigNumber.from(s.gasAtRelay);
    m.gasUsed.receive = ethers.BigNumber.from(s.gasAtReceive);
    m.gasUsed.process = ethers.BigNumber.from(s.gasAtProcess);

    m.sender = s.sender || undefined;
    m.tx = s.tx || undefined;
    m.state = s.state;
    return m;
  }

  serialize(): ExtendedSerializedNomadMessage {
    return {
      origin: this.origin,
      destination: this.destination,
      nonce: this.nonce,
      root: this.root,
      messageHash: this.messageHash,
      leafIndex: this.leafIndex.toHexString(),
      sender: this.sender || null,
      state: this.state,
      ...this.timings.serialize(),
      tx: this.tx || null,
      body: this.body,
      dispatchBlock: this.dispatchBlock,
      internalSender: this.internalSender.valueOf(),
      internalRecipient: this.internalRecipient.valueOf(),
      // hasMessage: this.hasMessage,
      recipient: this.recipient()?.valueOf() || null,
      amount: this.amount()?.toHexString() || null,
      allowFast: this.allowFast(),
      detailsHash: this.detailsHash() || null,
      tokenDomain: this.tokenDomain() || null,
      tokenId: this.tokenId()?.valueOf() || null,
      ...this.gasUsed.serialize(),
    };
  }

  tryParseMessage(body: string) {
    this.tryParseTransferMessage(body) || this.tryParseGovernanceMessage(body);
  }

  tryParseTransferMessage(body: string): boolean {
    try {
      this.transferMessage = parseBody(body);
      this.hasMessage = MessageType.TransferMessage;
      return true;
    } catch (e) {
      return false;
    }
  }

  tryParseGovernanceMessage(body: string): boolean {
    try {
      const message = parseAction(body);
      if (message.type == "batch") {
        message.batchHash;
      } else {
        message.address;
        message.domain;
      }
      // this.bridgeMsgType = message.type;
      this.hasMessage = MessageType.GovernanceMessage;
      return true;
    } catch (e) {
      return false;
    }
  }

  get originAndRoot(): string {
    return `${this.origin}${this.root}`;
  }
}

class SenderLostAndFound {
  p: Processor;
  dispatchEventsWithMessages: [NomadEvent, NomadMessage][];
  bridgeRouterSendEvents: NomadEvent[];
  constructor(p: Processor) {
    this.p = p;
    this.dispatchEventsWithMessages = [];
    this.bridgeRouterSendEvents = [];
  }

  bridgeRouterSend(e: NomadEvent): string | undefined {
    // check if we have dispatch events with block >= current && block <= current + 4;
    const hash = this.findMatchingDispatchAndUpdateAndRemove(e);
    if (hash) {
      return hash;
    } else {
      //add event for further fixing from dispatch side
      this.bridgeRouterSendEvents.push(e);
      return undefined;
    }
  }
  findMatchingDispatchAndUpdateAndRemove(
    brSend: NomadEvent
  ): string | undefined {
    const index = this.dispatchEventsWithMessages.findIndex(([dispatch, m]) =>
      this.match(dispatch, brSend, m)
    );

    if (index >= 0) {
      const some = this.dispatchEventsWithMessages.at(index);
      if (some) {
        const [_, msg] = some;
        msg.sender = brSend.eventData.from!;
        msg.tx = brSend.eventData.evmHash!;
        this.dispatchEventsWithMessages.splice(index, 1);
        return msg.messageHash;
      }
    }
    return undefined;
  }

  match(dispatch: NomadEvent, brSend: NomadEvent, m: NomadMessage): boolean {
    return (
      brSend.eventData.toDomain! === m.destination && //brSend.eventData.token?.toLowerCase() === m.bridgeMsgTokenId?.toLowerCase() &&
      new Padded(brSend.eventData.toId!).toEVMAddress() ===
        m.recipient()!.toEVMAddress() &&
      brSend.eventData.amount!.eq(m.amount()!) &&
      brSend.block === dispatch.block //&&  // (dispatch.block - brSend.block <= 2 || brSend.block - dispatch.block <= 30)
    );
  }

  findMatchingBRSendUpdateAndRemove(
    dispatch: NomadEvent,
    m: NomadMessage
  ): boolean {
    const index = this.bridgeRouterSendEvents.findIndex((brSend) =>
      this.match(dispatch, brSend, m)
    );
    if (index >= 0) {
      const brSend = this.bridgeRouterSendEvents.at(index);
      if (brSend) {
        m.sender = brSend.eventData.from!;
        m.tx = brSend.eventData.evmHash!;
      }
      this.bridgeRouterSendEvents.splice(index, 1);
      return true;
    }
    return false;
  }

  dispatch(e: NomadEvent, m: NomadMessage): boolean {
    if (m.hasMessage !== MessageType.TransferMessage) return false;

    if (this.findMatchingBRSendUpdateAndRemove(e, m)) {
      m.logger.info(`SenderLostAndFound found existing Sent event`);
      return true;
    } else {
      m.logger.info(
        `SenderLostAndFound haven't found existing Sent event, pushing to dispatched`
      );
      this.dispatchEventsWithMessages.push([e, m]);
      return false;
    }
  }
}

export class Processor extends Consumer {
  messages: NomadMessage[];
  sdks: [NomadContext, BridgeContext];
  msgToIndex: Map<string, number>;
  msgByOriginAndRoot: Map<string, number[]>;
  consumed: number; // for debug
  domains: number[];
  syncQueue: string[];
  db: DB;
  logger: Logger;
  senderRegistry: SenderLostAndFound;

  constructor(sdks: [NomadContext, BridgeContext], db: DB, logger: Logger) {
    super();
    this.sdks = sdks;
    this.messages = [];
    this.msgToIndex = new Map();
    this.msgByOriginAndRoot = new Map();
    this.consumed = 0;
    this.domains = [];
    this.syncQueue = [];
    this.senderRegistry = new SenderLostAndFound(this);

    this.db = db;
    this.logger = logger.child({ span: "consumer" });
  }

  async consume(events: MadEventX[]): Promise<void> {
    for (const event of events) {
      if (!event.event.eventName) throw new Error(`EVENT doesnt have an eventname: ${event}`); 
      if (event.event.eventName === 'Send') {
        const e = event as any as MadEvent<Result, TypedEvent<Result>, AnnotatedSend>;
        this.bridgeRouterSend(e);
        // this.dispatched(event);
      } else if (event.event.eventName === "Dispatch") {
        const e = event as any as MadEvent<Result, TypedEvent<Result>, AnnotatedDispatch>;
        this.dispatched(e);
      } else if (event.event.eventName === "Update") {
        const e = event as any as MadEvent<Result, TypedEvent<Result>,AnnotatedUpdate>;
        const a = e.event.event.args;
        // if at home
        if (a.homeDomain === e.event.domain) {
          this.homeUpdate(e);
        } else {
          this.replicaUpdate(e);
        }
      } else if (event.event.eventName === "Process") {
        const e = event as any as MadEvent<Result, TypedEvent<Result>,AnnotatedProcess>;
        this.process(e);
      } else if (event.event.eventName === "Receive") {
        const e = event as any as MadEvent<Result, TypedEvent<Result>,AnnotatedReceive>;
        this.bridgeRouterReceive(e);
      }

      this.consumed += 1;
    }

    await this.sync();
  }

  async sync() {
    const [inserts, updates] = await this.getMsgForSync();

    this.logger.info(
      `Inserting ${inserts.length} messages and updating ${updates.length}`
    );

    await Promise.all([
      this.db.insertMessage(inserts),
      this.db.updateMessage(updates),
    ]);
  }

  addToSyncQueue(hash: string) {
    if (this.syncQueue.indexOf(hash) < 0) this.syncQueue.push(hash);
  }

  async getMsgForSync(): Promise<[NomadMessage[], NomadMessage[]]> {
    let existingHashes = await this.db.getExistingHashes();

    const msgsForSync = this.syncQueue
      .reduce(
        (acc: [string[], string[]], hash, i) => {
          existingHashes.indexOf(hash) < 0
            ? acc[0].push(hash)
            : acc[1].push(hash);
          return acc;
        },
        [[], []]
      )
      .map(this.hash2msg.bind(this)) as [NomadMessage[], NomadMessage[]];

    this.syncQueue = [];

    return msgsForSync;
  }

  hash2msg(hashes: string[]): NomadMessage[] {
    return hashes.map((hash) => this.getMsg(hash)!).filter((m) => !!m);
  }

  dispatched(e: MadEvent<Result, TypedEvent<Result>, AnnotatedDispatch>) {

    const m = new NomadMessage(this.sdks[0], e.event);
    this.add(m);
    this.addToSyncQueue(m.bodyHash);
    this.senderRegistry.dispatch(e, m);

    /*

    const m = new NomadMessage(
      e.domain,
      ...e.destinationAndNonce(),
      e.eventData.committedRoot!,
      e.eventData.messageHash!,
      e.eventData.leafIndex!,
      e.eventData.message!,
      e.ts,
      e.block,
      this.logger.child({ messageSource: "consumer" })
    );

    let logger = m.logger.child({ eventName: "dispatched" });

    m.gasUsed.dispatch = e.gasUsed;

    this.senderRegistry.dispatch(e, m);

    this.add(m);
    this.addToSyncQueue(m.messageHash);
    const gas = e.gasUsed.toNumber();
    // this.logger.warn(`!Gas for dispatched from ${m.origin, m.destination} to ${m.origin, m.destination} (${e.tx}) = ${gas} (${e.gasUsed})`);
    this.emit("dispatched", m.origin, m.destination, gas);
    logger.debug(`Created message`);
    */

    if (!this.domains.includes(e.event.domain)) this.domains.push(e.event.domain);
  }

  bridgeRouterSend(e: MadEvent<Result, TypedEvent<Result>, AnnotatedDispatch>) {

    const m = new NomadMessage(this.sdks[0], e.event);
    
    BridgeMessage.fromNomadMessage()


    // let logger = this.logger.child({ eventName: "bridgeSent" });
    const hash = this.senderRegistry.bridgeRouterSend(e);
    // if (hash) {
    //   logger.child({ messageHash: hash }).debug(`Found dispatched message`);
    //   this.addToSyncQueue(hash);
    // } else {
    //   logger.warn(
    //     { tx: e.tx, domain: e.domain },
    //     `Haven't found a message for BridgeReceived event`
    //   );
    // }
  }

  homeUpdate(e: NomadEvent) {
    let logger = this.logger.child({ eventName: "updated" });
    const ms = this.getMsgsByOriginAndRoot(e.domain, e.eventData.oldRoot!);
    if (ms.length) {
      ms.forEach((m) => {
        if (m.update(e.ts, e.gasUsed)) {
          this.addToSyncQueue(m.messageHash);

          this.emit(
            "updated",
            m.origin,
            m.destination,
            m.timings.toUpdate(),
            e.gasUsed.toNumber()
          );
        }
      });
    } else {
      logger.warn(
        { origin: e.replicaOrigin, root: e.eventData.oldRoot! },
        `Haven't found a message for Update event`
      );
    }
  }

  replicaUpdate(e: NomadEvent) {
    let logger = this.logger.child({ eventName: "relayed" });
    const ms = this.getMsgsByOriginAndRoot(
      e.replicaOrigin,
      e.eventData.oldRoot!
    );

    if (ms.length) {
      ms.forEach((m) => {
        if (m.relay(e.ts, e.gasUsed)) {
          this.addToSyncQueue(m.messageHash);
          this.emit(
            "relayed",
            m.origin,
            m.destination,
            m.timings.toRelay(),
            e.gasUsed.toNumber()
          );
        }
      });
    } else {
      logger.warn(
        { origin: e.replicaOrigin, root: e.eventData.oldRoot! },
        `Haven't found a message for ReplicaUpdate event`
      );
    }
  }

  process(e: NomadEvent) {
    let logger = this.logger.child({ eventName: "processed" });
    const m = this.getMsg(e.eventData.messageHash!);
    if (m) {
      if (m.process(e.ts, e.gasUsed)) {
        this.addToSyncQueue(m.messageHash);
        this.emit(
          "processed",
          m.origin,
          m.destination,
          m.timings.toProcess(),
          e.gasUsed.toNumber()
        );
      }
    } else {
      logger.warn(
        { messageHash: e.eventData.messageHash! },
        `Haven't found a message for Processed event`
      );
    }
  }

  

  bridgeRouterReceive(e: NomadEvent) {
    const m = this.getMsgsByOriginAndNonce(...e.originAndNonce());
    let logger = this.logger.child({ eventName: "bridgeReceived" });

    if (m) {
      if (m.receive(e.ts, e.gasUsed)) {
        this.addToSyncQueue(m.messageHash);
        const gas = e.gasUsed.toNumber();
        this.emit(
          "received",
          m.origin,
          m.destination,
          m.timings.toReceive(),
          gas
        );
      }
    } else {
      let [origin, nonce] = e.originAndNonce();
      logger.warn(
        { origin, nonce },
        `Haven't found a message for BridgeReceived event`
      );
    }
  }

  add(m: NomadMessage) {
    const index = this.messages.length;
    this.msgToIndex.set(m.messageHash, index);
    const msgByOriginAndRoot = this.msgByOriginAndRoot.get(m.originAndRoot);
    if (msgByOriginAndRoot) {
      msgByOriginAndRoot.push(index);
    } else {
      this.msgByOriginAndRoot.set(m.originAndRoot, [index]);
    }

    this.messages.push(m);
  }

  getMsg(id: string | number): NomadMessage | undefined {
    if (typeof id === "string") {
      const msgIndex = this.msgToIndex.get(id);
      if (msgIndex) return this.messages[msgIndex];
    } else {
      return this.messages[id];
    }
    return undefined;
  }

  getMsgsByOriginAndRoot(origin: number, root: string): NomadMessage[] {
    const originAndRoot = `${origin}${root}`;
    const msgIndexs = this.msgByOriginAndRoot.get(originAndRoot);
    if (msgIndexs) return msgIndexs.map((msgIndex) => this.messages[msgIndex]);
    return [];
  }

  getMsgsByOriginAndNonce(
    origin: number,
    nonce: number
  ): NomadMessage | undefined {
    return this.messages.find((m) => m.nonce === nonce && m.origin === origin);
  }

  stats(): Statistics {
    const collector = new StatisticsCollector(this.domains);

    this.messages.forEach((m) => {
      collector.contributeToCount(m);
    });

    return collector.stats();
  }
}
