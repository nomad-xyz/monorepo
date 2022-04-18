import { parseAction } from "@nomad-xyz/sdk-govern";
import { parseMessage } from "@nomad-xyz/sdk";
import { parseBody, ParsedTransferMessage } from "@nomad-xyz/sdk-bridge";
import { AnyGovernanceMessage } from "@nomad-xyz/sdk-govern/dist/GovernanceMessage";
import Logger from "bunyan";
import { BigNumber, ethers } from "ethers";
import { Consumer, GasUsed, StatisticsCollector, Timings } from "./consumer";
import { Dispatch, EventType, NomadishEvent, Process, Receive, Send, Update } from "./event";
import { filter, Padded, retain } from "./utils";
import { DB } from "./db";
import { Statistics } from "./types";
// import e from "express";
// import pLimit from "p-limit";

let iii = 0;

function shuffle<V>(array: V[]): V[] {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function fsLog(s: string, l?: string) {
  fs.appendFileSync(l || './lol.txt', s+'\n');
}

enum MsgState {
    Dispatched,
    Updated,
    Relayed,
    Received,
    Processed,
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
    sent: boolean;
    updated: boolean;
    relayed: boolean;
    received: boolean;
    processed: boolean;
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

  class Checkbox {
      sent: boolean;
      updated: boolean;
      relayed: boolean;
      received: boolean;
      processed: boolean;
      constructor() {
        this.sent = false;
        this.updated = false;
        this.relayed = false;
        this.received = false;
        this.processed = false;
      }

      serialize() {
        return {
          sent: this.sent,
          updated: this.updated,
          relayed: this.relayed,
          received: this.received,
          processed: this.processed,
        }
      }
  }
  
  export class NomadMessage {
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
    governanceMessage?: AnyGovernanceMessage; 

    state: MsgState;
    dispatchBlock: number;
    tx?: string;
  
    timings: Timings;
    gasUsed: GasUsed;
    logger: Logger;
    checkbox: Checkbox;
  
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
      this.checkbox = new Checkbox();
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
      this.timings.updated(ts);
      this.gasUsed.update = gasUsed;
      this.checkbox.updated = true;
      if (this.state < MsgState.Updated) {
        this.logger.debug(
          `Updated message from state ${this.state} to ${MsgState.Updated} (Updated)`
        );
        this.state = MsgState.Updated;
        
        return true;
      }
      this.logger.debug(
        `The message is in the higher state for being Updated. Want < ${MsgState.Updated}, is ${this.state}`
      );
      return false;
    }
  
    relay(ts: number, gasUsed: BigNumber) {
      this.timings.relayed(ts);
      this.gasUsed.relay = gasUsed;
      this.checkbox.relayed = true;
      if (this.state < MsgState.Relayed) {
        this.logger.debug(
          `Updated message from state ${this.state} to ${MsgState.Relayed} (Relayed)`
        );
        this.state = MsgState.Relayed;
        

        return true;
      }
      this.logger.debug(
        `The message is in the higher state for being Relayed. Want < ${MsgState.Relayed}, is ${this.state}`
      );
      return false;
    }
  
    receive(ts: number, gasUsed: BigNumber) {
      this.timings.received(ts);
      this.gasUsed.receive = gasUsed;
      this.checkbox.received = true;
      if (this.state < MsgState.Received) {
        this.logger.debug(
          `Updated message from state ${this.state} to ${MsgState.Received} (Received)`
        );
        this.state = MsgState.Received;
        
        return true;
      }
      this.logger.debug(
        `The message is in the higher state for being Received. Want < ${MsgState.Received}, is ${this.state}`
      );
      return false;
    }
  
    process(ts: number, gasUsed: BigNumber) {
      this.timings.processed(ts);
      this.gasUsed.process = gasUsed;
      this.checkbox.processed = true;

      if (this.state < MsgState.Processed) {
        this.logger.debug(
          `Updated message from state ${this.state} to ${MsgState.Processed} (Processed)`
        );
        this.state = MsgState.Processed;
        
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
        ethers.BigNumber.from(s.leafIndex),
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

      m.checkbox.sent = s.sent;
      m.checkbox.updated = s.updated;
      m.checkbox.relayed = s.relayed;
      m.checkbox.received = s.received;
      m.checkbox.processed = s.processed;
  
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
        ...this.checkbox.serialize(),
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

// import pLimit from "p-limit";
import fs from 'fs';
import pLimit from "p-limit";

class EventsPool {

  plimit: {
    send: pLimit.Limit,
    update: pLimit.Limit,
    relay: pLimit.Limit,
    receive: pLimit.Limit,
    process: pLimit.Limit,
  };
    // db: DB;
    pool: {
      send: NomadishEvent[],
      update: NomadishEvent[],
      relay: NomadishEvent[],
      receive: NomadishEvent[],
      process: NomadishEvent[],
    };

    maxx: {
      send: number,
      update: number,
      relay: number,
      receive: number,
      process: number,
    };
    constructor() {
      this.pool = {
        send: [],
        update: [],
        relay: [],
        receive: [],
        process: [],
      }
      this.maxx = {
        send: 0,
        update: 0,
        relay: 0,
        receive: 0,
        process: 0,
      }

      this.plimit = {
        send: pLimit(1),
        update: pLimit(1),
        relay: pLimit(1),
        receive: pLimit(1),
        process: pLimit(1),
      }

      setInterval(() => {
        console.log(`In send pool there are events`, this.pool.send.length, this.maxx.send);
        console.log(`In update pool there are events`, this.pool.update.length, this.maxx.update);
        console.log(`In relay pool there are events`, this.pool.relay.length, this.maxx.relay);
        console.log(`In receive pool there are events`, this.pool.receive.length, this.maxx.receive);
        console.log(`In process pool there are events`, this.pool.process.length, this.maxx.process);
      }, 10000)
      setTimeout(() => {
        fsLog(this.pool.send.map(r => JSON.stringify(r.toObject())).join('\n'), './sendsx.txt')
        fsLog(this.pool.receive.map(r => JSON.stringify(r.toObject())).join('\n'), './receivesx.txt')
        fsLog(this.pool.process.map(r => JSON.stringify(r.toObject())).join('\n'), './processesx.txt')
      }, 100000)

        // this.db = db;
    }

    async storeEvent(e: NomadishEvent) {
      if      (e.eventType === EventType.BridgeRouterSend) {
        this.pool.send.push(e);
        const ev = e.eventData as Send
        fsLog(`store event send ${JSON.stringify(e.toObject())} {destination:${ev.toDomain},recipient:${Padded.fromWhatever(ev.toId).valueOf()}}`, )

      } else if (e.eventType === EventType.HomeUpdate) {
        const ev = e.eventData as Update
        fsLog(`store event home updtae ${JSON.stringify(e.toObject())} {origin:${ev.homeDomain},root:${ev.oldRoot}}`, )
        if (!this.pool.update.some(e => {
          const ve = e.eventData as Update;
          return ev.homeDomain === ve.homeDomain && ev.oldRoot === ve.oldRoot
        }))  this.pool.update.push(e);

       

      } else if (e.eventType === EventType.ReplicaUpdate) {
        const ev = e.eventData as Update
        fsLog(`store event replica updtae ${JSON.stringify(e.toObject())} {origin:${ev.homeDomain},root:${ev.oldRoot}}`, )
        if (!this.pool.relay.some(e => {
          const ve = e.eventData as Update;
          return ev.homeDomain === ve.homeDomain && ev.oldRoot === ve.oldRoot
        }))  this.pool.relay.push(e);

      } else if (e.eventType === EventType.BridgeRouterReceive) {
        this.pool.receive.push(e);
        // const ev = e.eventData as Receive
        const [origin, nonce] = e.originAndNonce()
        fsLog(`store event BridgeRouterReceive ${JSON.stringify(e.toObject())} {origin:${origin},nonce:${nonce}}`, )
      } else if (e.eventType === EventType.ReplicaProcess) {
        this.pool.process.push(e);
        const ev = e.eventData as Process
        fsLog(`store event process ${JSON.stringify(e.toObject())} {hash:${ev.messageHash}}`, )
      }
      if (this.maxx.send < this.pool.send.length) {
        this.maxx.send = this.pool.send.length
      }

      if (this.maxx.update < this.pool.update.length) {
        this.maxx.update = this.pool.update.length
      }

      if (this.maxx.relay < this.pool.relay.length) {
        this.maxx.relay = this.pool.relay.length
      }

      if (this.maxx.receive < this.pool.receive.length) {
        this.maxx.receive = this.pool.receive.length
      }

      if (this.maxx.process < this.pool.process.length) {
        this.maxx.process = this.pool.process.length
      }

    }

    async getSend(destination: number, recipient: Padded, amount: ethers.BigNumber, block: number): Promise<NomadishEvent | null> {
      const events = await this.plimit.send(async () => retain(this.pool.send, (e) => {
        const eventData = e.eventData as Send;
        // if (Math.random() <= 0.001) {
        //   fs.appendFileSync(`./kek.txt`, `${destination}===${eventData.toDomain};${recipient.toEVMAddress()}===${(Padded.fromWhatever(eventData.toId)).toEVMAddress()};${amount.toHexString()}===${eventData.amount.toHexString()};${block}===${e.block};${tokenId.toEVMAddress()}===${(Padded.fromWhatever(eventData.token)).toEVMAddress()}\n`)
        // }
        return destination === eventData.toDomain && 
          recipient.toEVMAddress() === (Padded.fromWhatever(eventData.toId)).toEVMAddress() && 
          amount.eq(eventData.amount) &&
          block === e.block
          // tokenId.toEVMAddress() === (Padded.fromWhatever(eventData.token)).toEVMAddress()
      }));
      
      if (events.length > 0) return events[0];
      return null;
    }

    async getUpdate(origin: number, root: string): Promise<NomadishEvent[]> {
      return await this.plimit.send(async () => filter(this.pool.update, (e) => {
        const eventData = e.eventData as Update;
        return eventData.oldRoot === root && eventData.homeDomain === origin
      }))
    }
    async getRelay(origin: number, root: string) {
      return await this.plimit.send(async () => filter(this.pool.relay, (e) => {
        const eventData = e.eventData as Update;
        return eventData.oldRoot === root && eventData.homeDomain === origin
      }))
    }
    async getProcess(messageHash: string): Promise<NomadishEvent | null> {
      const events = await this.plimit.send(async () => retain(this.pool.process, (e) => {
        const eventData = e.eventData as Process;
        return eventData.messageHash === messageHash
      }))

      if (events.length > 0) return events[0];
      return null;
    }
    async getReceive(origin: number, nonce: number): Promise<NomadishEvent | null> {
      const events = await this.plimit.send(async () => retain(this.pool.receive, (e) => {
        const [eventOrigin, eventNonce] = e.originAndNonce();
        return eventNonce === nonce && eventOrigin === origin
      }))

      if (events.length > 0) return events[0];
      return null;
    }
}


export class ProcessorV2 extends Consumer {
    pool: EventsPool; // Where all unused events are waiting for the previous events to come. They can stay in pool max X hours
    archive: NomadishEvent[]; // Where all unused events just go till the rest of the days
    // messages: NomadMessage[];
    // msgToIndex: Map<string, number>;
    // msgByOriginAndRoot: Map<string, number[]>;
    consumed: number; // for debug
    domains: number[];
    db: DB;
    dbPLimit: pLimit.Limit;
    logger: Logger;
    debugStats: {
      send: number;
      update: number;
      relay: number;
      receive: number;
      process: number;
    };
    debugStatsAfter: {
      send: number;
      update: number;
      relay: number;
      receive: number;
      process: number;
    };
  
    constructor(db: DB, logger: Logger) {
      super();
      this.pool = new EventsPool();
      this.archive = [];
      this.debugStats = {
        send: 0,
        update: 0,
        relay: 0,
        receive: 0,
        process: 0,
      }
      this.debugStatsAfter = {
        send: 0,
        update: 0,
        relay: 0,
        receive: 0,
        process: 0,
      }
      setInterval(() => {
        console.log(`==========================`);
        console.log(`Debug set send right away`, this.debugStats.send);
        console.log(`Debug set update right away`, this.debugStats.update);
        console.log(`Debug set relay right away`, this.debugStats.relay);
        console.log(`Debug set receive right away`, this.debugStats.receive);
        console.log(`Debug set process right away`, this.debugStats.process);

        console.log(`Debug set send AFTER away`, this.debugStatsAfter.send);
        console.log(`Debug set update AFTER away`, this.debugStatsAfter.update);
        console.log(`Debug set relay AFTER away`, this.debugStatsAfter.relay);
        console.log(`Debug set receive AFTER away`, this.debugStatsAfter.receive);
        console.log(`Debug set process AFTER away`, this.debugStatsAfter.process);
        console.log(`==========================`);

      }, 10000)
      // this.messages = [];
      // this.msgToIndex = new Map();
      // this.msgByOriginAndRoot = new Map();
      this.consumed = 0;
      this.domains = [];
  
      this.db = db;
      this.dbPLimit = pLimit(10);
      this.logger = logger.child({ span: "consumer" });
    }
  
    async consume(events: NomadishEvent[]): Promise<void> {
      // just to prevent from running for now.
      fs.writeFileSync(`/Users/daniilnaumetc/code/nomad/monorepo/checks_to_main/packages/indexer/batches/${iii++}_${events.length}.json`, JSON.stringify(events.map(e => e.toObject())))
      
      events = shuffle(events);
      for (const event of events) {
        if (event.eventType === EventType.HomeDispatch) {
          await this.dispatched(event);
        } else if (event.eventType === EventType.HomeUpdate) {
          await this.homeUpdate(event);
        } else if (event.eventType === EventType.ReplicaUpdate) {
          await this.replicaUpdate(event);
        } else if (event.eventType === EventType.ReplicaProcess) {
          await this.process(event);
        } else if (event.eventType === EventType.BridgeRouterSend) {
          await this.bridgeRouterSend(event);
        } else if (event.eventType === EventType.BridgeRouterReceive) {
          await this.bridgeRouterReceive(event);
        }
  
        this.consumed += 1;
      }
  
    //   await this.sync();
    }
  
    // async sync() {
    //   const [inserts, updates] = await this.getMsgForSync();
  
    //   this.logger.info(
    //     `Inserting ${inserts.length} messages and updating ${updates.length}`
    //   );
  
    //   await Promise.all([
    //     this.db.insertMessage(inserts),
    //     this.db.updateMessage(updates),
    //   ]);
    // }
  
    // addToSyncQueue(hash: string) {
    //   if (this.syncQueue.indexOf(hash) < 0) this.syncQueue.push(hash);
    // }
  
    // async getMsgForSync(): Promise<[NomadMessage[], NomadMessage[]]> {
    //   let existingHashes = await this.db.getExistingHashes();
  
    //   const msgsForSync = this.syncQueue
    //     .reduce(
    //       (acc: [string[], string[]], hash, i) => {
    //         existingHashes.indexOf(hash) < 0
    //           ? acc[0].push(hash)
    //           : acc[1].push(hash);
    //         return acc;
    //       },
    //       [[], []]
    //     )
    //     .map(this.hash2msg.bind(this)) as [NomadMessage[], NomadMessage[]];
  
    //   this.syncQueue = [];
  
    //   return msgsForSync;
    // }
  
    // hash2msg(hashes: string[]): NomadMessage[] {
    //   return hashes.map((hash) => this.getMsg(hash)!).filter((m) => !!m);
    // }
  
    async dispatched(e: NomadishEvent) {
        const {
            committedRoot,
            messageHash,
            leafIndex,
            message,
        } = e.eventData as Dispatch;
      const m = new NomadMessage(
        e.domain,
        ...e.destinationAndNonce(),
        committedRoot,
        messageHash,
        leafIndex,
        message,
        e.ts,
        e.block,
        this.logger.child({ messageSource: "consumer" })
      );
  
      let logger = m.logger.child({ eventName: "dispatched" });
  
      m.gasUsed.dispatch = e.gasUsed;
      const gas = e.gasUsed.toNumber();

      console.error(`I HAVEN"T CHECKED IF MESSAGE EXISTS ALREADY`)
  
        //   this.senderRegistry.dispatch(e, m);

        //   this.add(m);
        //   this.addToSyncQueue(m.messageHash);
      // this.logger.warn(`!Gas for dispatched from ${m.origin, m.destination} to ${m.origin, m.destination} (${e.tx}) = ${gas} (${e.gasUsed})`);
      // this.emit("dispatched", m.origin, m.destination, gas);
      logger.debug(`Created message`);
  
      if (!this.domains.includes(e.domain)) this.domains.push(e.domain);

      fsLog(`Created message with messageHash {hash:${m.messageHash}}`)

      await this.checkAndUpdateAll(m, 'insert');
    
      await this.insertMessage(m)
      fsLog(`INSERTED {hash:${m.messageHash}}`)
    }

    async checkAndUpdateSend(m: NomadMessage) {
      if (m.hasMessage !== MessageType.TransferMessage) throw new Error(`Message not a transfer message`);
      // destination, new Padded(recipient), amount, block, token . destination: number, recipient: Padded, amount: ethers.BigNumber, block: number, tokenId: Padded
        const event: NomadishEvent | null = await this.pool.getSend(m.destination, m.recipient()!, m.amount()!, m.dispatchBlock);
        fsLog(`checkAndUpdateSend with messageHash, event found: ${!!event} {hash:${m.messageHash}}`)
        if (event) {
            const eventData = event.eventData as Send;
            m.sender = eventData.from;
            m.tx = event.tx;
            m.checkbox.sent = true;
            this.debugStatsAfter.send += 1;
        }
    }

    async checkAndUpdateUpdate(m: NomadMessage) {
        const events: NomadishEvent[] = await this.pool.getUpdate(m.origin, m.root);
        fsLog(`checkAndUpdateUpdate with messageHash, events found: ${events.length} {hash:${m.messageHash}}`)
        events.forEach(event => {
          if (m.update(event.ts, event.gasUsed)) {
            // this.emit(
            //   "updated",
            //   m.origin,
            //   m.destination,
            //   m.timings.toUpdate(),
            //   event.gasUsed.toNumber()
            // );
            this.debugStatsAfter.update += 1;
          }
        })
    }

    async checkAndUpdateRelay(m: NomadMessage) {
      const events: NomadishEvent[] = await this.pool.getRelay(m.origin, m.root);
      fsLog(`checkAndUpdateRelay with messageHash, events found: ${events.length} {hash:${m.messageHash}}`)
      events.forEach(event => {
        if (m.relay(event.ts, event.gasUsed)) {
            // this.emit(
            //   "relayed",
            //   m.origin,
            //   m.destination,
            //   m.timings.toUpdate(),
            //   event.gasUsed.toNumber()
            // );
            this.debugStatsAfter.relay += 1;
        }
      })
    }

    async checkAndUpdateProcess(m: NomadMessage) {
        const event: NomadishEvent | null = await this.pool.getProcess(m.messageHash);
        fsLog(`checkAndUpdateProcess with messageHash , event found: ${!!event} {hash:${m.messageHash}}`)
        if (event) {
            if (m.process(event.ts, event.gasUsed)) {
                // this.emit(
                //   "processed",
                //   m.origin,
                //   m.destination,
                //   m.timings.toUpdate(),
                //   event.gasUsed.toNumber()
                // );
                this.debugStatsAfter.process += 1;
            }
        }
    }

    async checkAndUpdateReceive(m: NomadMessage) {
        const event: NomadishEvent | null = await this.pool.getReceive(m.origin, m.nonce);
        fsLog(`checkAndUpdateReceive with messageHash , event found: ${!!event} {hash:${m.messageHash}}`)
        if (event) {
            if (m.receive(event.ts, event.gasUsed)) {
                // this.emit(
                //   "received",
                //   m.origin,
                //   m.destination,
                //   m.timings.toUpdate(),
                //   event.gasUsed.toNumber()
                // );
                this.debugStatsAfter.receive += 1;
            }
        }
    }

    async checkAndUpdateAll(m: NomadMessage, s?: string) {
      fsLog(`checkAndUpdateAll after ${s}: ${m.checkbox.sent},${m.checkbox.updated},${m.checkbox.relayed},${m.checkbox.received},${m.checkbox.processed} {hash:${m.messageHash}}`)
        if (!m.checkbox.sent) {
            if (m.hasMessage === MessageType.TransferMessage) {
                await this.checkAndUpdateSend(m);
            } else if (m.hasMessage === MessageType.GovernanceMessage) {
    
            }
        }

        if (!m.checkbox.updated && m.state !== MsgState.Updated) {
            await this.checkAndUpdateUpdate(m);
        }
        if (!m.checkbox.relayed && m.state !== MsgState.Relayed) {
            await this.checkAndUpdateRelay(m);
        }
        if (!m.checkbox.received && m.state !== MsgState.Received) {
            if (m.hasMessage === MessageType.TransferMessage) {
                await this.checkAndUpdateReceive(m);
            } else if (m.hasMessage === MessageType.GovernanceMessage) {
    
            }
        }
        if (!m.checkbox.processed && m.state !== MsgState.Processed) {
            await this.checkAndUpdateProcess(m);
        }
    }
  
    async homeUpdate(e: NomadishEvent) {
          let logger = this.logger.child({ eventName: "updated" });
          const oldRoot = (e.eventData as Update).oldRoot;
          const ms = await this.getMsgsByOriginAndRoot(e.domain, oldRoot);
          fsLog(`HomeUpdate actually happened {root:${oldRoot},origin:${e.domain}}`)

          // IMPORTANT! we still store the event even though it is already appliable, but it needs to be checked for dups
          await this.pool.storeEvent(e)

          if (ms.length) {
            await Promise.all(ms.map(async (m) => {
              if (m.update(e.ts, e.gasUsed)) {
                // this.addToSyncQueue(m.messageHash);
                this.debugStats.update +=1;
    
                // this.emit(
                //   "updated",
                //   m.origin,
                //   m.destination,
                //   m.timings.toUpdate(),
                //   e.gasUsed.toNumber()
                // );

                
              }
              await this.checkAndUpdateAll(m, 'homeUpdate');
              await this.updateMessage(m)
            }));
          } else {
            
            logger.warn(
              { origin: e.replicaOrigin, root: oldRoot },
              `Haven't found a message for Update event`
            );
          }
        
    }
  
    async replicaUpdate(e: NomadishEvent) {
      let logger = this.logger.child({ eventName: "relayed" });
      const oldRoot = (e.eventData as Update).oldRoot;
      fsLog(`ReplicaUpdate actually happened {root:${oldRoot},origin:${e.domain}}`)
      const ms = await this.getMsgsByOriginAndRoot(
        e.replicaOrigin,
        oldRoot
      );

      // IMPORTANT! we still store the event even though it is already appliable, but it needs to be checked for dups
      await this.pool.storeEvent(e)

  
      if (ms.length) {
        await Promise.all(ms.map(async (m) => {
          if (m.relay(e.ts, e.gasUsed)) {
            this.debugStats.relay +=1;

            // this.emit(
            //   "relayed",
            //   m.origin,
            //   m.destination,
            //   m.timings.toRelay(),
            //   e.gasUsed.toNumber()
            // );
            
          }
          await this.checkAndUpdateAll(m, 'replicaUpdate');
            await this.updateMessage(m)
        }));
      } else {
        logger.warn(
          { origin: e.replicaOrigin, root: oldRoot },
          `Haven't found a message for ReplicaUpdate event`
        );
      }
    }
  
    async process(e: NomadishEvent) {
      let logger = this.logger.child({ eventName: "processed" });
      const messageHash = (e.eventData as Process).messageHash;
      fsLog(`Process actually happened {hash:${messageHash}}`)
      const m = await this.getMsg(messageHash);
      if (m) {
        if (m.process(e.ts, e.gasUsed)) {
          this.debugStats.process +=1;
          // this.emit(
          //   "processed",
          //   m.origin,
          //   m.destination,
          //   m.timings.toProcess(),
          //   e.gasUsed.toNumber()
          // );

          
        }
        await this.checkAndUpdateAll(m, 'process');
            await this.updateMessage(m)
      } else {
        await this.pool.storeEvent(e)
        logger.warn(
          { messageHash },
          `Haven't found a message for Processed event`
        );
      }
    }
  
    async bridgeRouterSend(e: NomadishEvent) {
      let logger = this.logger.child({ eventName: "bridgeSent" });
      const block = e.block;
      const {token, from, toDomain: destination, toId: recipient, amount} = (e.eventData as Send);
      
      const m = await this.getMsgBySendValues(destination, Padded.fromWhatever(recipient), amount, block);

      fsLog(`Just received Send and message found: ${!!m} ${JSON.stringify(e.toObject())}... select * from messages where destination = ${destination} and recipient = '${Padded.fromWhatever(recipient).valueOf()}' and amount = '${amount.toHexString()}' and block = ${block} and tokenId = '${Padded.fromWhatever(token).valueOf()}' ... {destination:${destination},recipient:${Padded.fromWhatever(recipient).valueOf()}}`, )
      // brSend.eventData.toDomain! === m.destination && //brSend.eventData.token?.toLowerCase() === m.bridgeMsgTokenId?.toLowerCase() &&
      // new Padded(brSend.eventData.toId!).toEVMAddress() ===
      //   m.recipient()!.toEVMAddress() &&
      // brSend.eventData.amount!.eq(m.amount()!) &&
      // brSend.block === dispatch.block

      if (m) {
        const eventData = e.eventData as Send;
        m.sender = eventData.from;
        m.tx = e.tx;
        m.checkbox.sent = true;
        this.debugStats.send +=1;

        await this.checkAndUpdateAll(m, 'bridgeRouterSend');
        await this.updateMessage(m)
      } else {
        await this.pool.storeEvent(e)
        logger.warn(
          { destination, recipient, amount },
          `Haven't found a message for Send event`
        );
      }

      // const hash = this.senderRegistry.bridgeRouterSend(e);
      // if (hash) {
      //   logger.child({ messageHash: hash }).debug(`Found dispatched message`);
      // } else {
      //   logger.warn(
      //     { tx: e.tx, domain: e.domain },
      //     `Haven't found a message for BridgeReceived event`
      //   );
      // }
    }
  
    async bridgeRouterReceive(e: NomadishEvent) {
      const m = await this.getMsgByOriginAndNonce(...e.originAndNonce());
      let logger = this.logger.child({ eventName: "bridgeReceived" });
  
      if (m) {
        if (m.receive(e.ts, e.gasUsed)) {
          const gas = e.gasUsed.toNumber();
          this.debugStats.receive +=1;

          // this.emit(
          //   "received",
          //   m.origin,
          //   m.destination,
          //   m.timings.toReceive(),
          //   gas
          // );
          
        }
        await this.checkAndUpdateAll(m, 'bridgeRouterReceive');
          await this.updateMessage(m)
      } else {
        await this.pool.storeEvent(e)
        let [origin, nonce] = e.originAndNonce();
        logger.warn(
          { origin, nonce },
          `Haven't found a message for BridgeReceived event`
        );
      }
    }
  
    async insertMessage(m: NomadMessage) {
      await this.db.insertMessage([m]);
    }
    // fix: get from db
    async updateMessage(m: NomadMessage) {
      // await this.db.prisma.token.upsert({
      //   where: {
      //     id_domain: {
      //       id,
      //       domain,
      //     },
      //   },
      //   update: data,
      //   create: data,
      // });
      // const
      await this.dbPLimit(async() => {
        await this.db.updateMessage([m]);
      })
      



      // const index = this.messages.length;
      // this.msgToIndex.set(m.messageHash, index);
      // const msgByOriginAndRoot = this.msgByOriginAndRoot.get(m.originAndRoot);
      // if (msgByOriginAndRoot) {
      //   msgByOriginAndRoot.push(index);
      // } else {
      //   this.msgByOriginAndRoot.set(m.originAndRoot, [index]);
      // }
  
      // this.messages.push(m);
    }

    async getMsgBySendValues(destination: number, recipient: Padded, amount: ethers.BigNumber, block: number, ): Promise<NomadMessage | null> {
      return await this.db.getMessageBySendValues(destination, recipient, amount, block);
    }

    // fix: get from db
    async getMsg(id: string ): Promise<NomadMessage | null> {
      return await this.db.getMessageByHash(id);
      // if (typeof id === "string") {
      //   const msgIndex = this.msgToIndex.get(id);
      //   if (msgIndex) return this.messages[msgIndex];
      // } else {
      //   return this.messages[id];
      // }
      // return undefined;
    }
  
    // fix: get from db
    async getMsgsByOriginAndRoot(origin: number, root: string): Promise<NomadMessage[]> {
      return await this.db.getMessagesByOriginAndRoot(origin, root);
      // const originAndRoot = `${origin}${root}`;
      // const msgIndexs = this.msgByOriginAndRoot.get(originAndRoot);
      // if (msgIndexs) return msgIndexs.map((msgIndex) => this.messages[msgIndex]);
      // return [];
    }
  
    // fix: get from db
    async getMsgByOriginAndNonce(
      origin: number,
      nonce: number
    ): Promise<NomadMessage | null> {
      return await this.db.getMessageByOriginAndNonce(origin, nonce);
      // return this.messages.find((m) => m.nonce === nonce && m.origin === origin);
    }
  
    async stats(): Promise<Statistics> {
      const collector = new StatisticsCollector(this.domains);

      // const messages = await this.db.getAllMessages();
  
      // messages.forEach((m) => {
      //   collector.contributeToCount(m);
      // });
  
      return collector.stats();
    }
  }