import { parseAction } from '@nomad-xyz/sdk-govern';
import {  parseMessage } from '@nomad-xyz/sdk';
import {
  BridgeContext,
  parseBody,
  ParsedTransferMessage,
} from '@nomad-xyz/sdk-bridge';
import { AnyGovernanceMessage } from '@nomad-xyz/sdk-govern/dist/GovernanceMessage';
import Logger from 'bunyan';
import { BigNumber, ethers } from 'ethers';
import { Consumer, GasUsed, StatisticsCollector, Timings } from './consumer';
import {
  Dispatch,
  EventType,
  NomadishEvent,
  Process,
  Receive,
  Send,
  Update,
} from './event';
import { Padded, replacer, reviver, shuffle } from './utils';
import { DB } from './db';
import { Statistics, RedisClient } from './types';
import fs from 'fs';
import pLimit from 'p-limit';
import { getRedis } from './redis';

function fsLog(s: string, l?: string) {
  fs.appendFileSync(l || './lol.txt', s + '\n');
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
  origin: number;
  destination: number;
  nonce: number;
  root: string;
  messageHash: string;
  leafIndex: string;
  body: string;
  dispatchBlock: number;
  dispatchedAt: number;
  updatedAt: number;
  relayedAt: number;
  receivedAt: number;
  processedAt: number;
  sender: string | null;
  tx: string | null;
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
  internalSender: string;
  internalRecipient: string;
  msgType: MessageType;
  recipient: string | null;
  amount: string | null;
  allowFast: boolean;
  detailsHash: string | null;
  tokenDomain: number | null;
  tokenId: string | null;
  confirmAt: number;
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
    };
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
  internalSender: Padded;
  internalRecipient: Padded;

  body: string;
  msgType: MessageType;
  transferMessage?: ParsedTransferMessage;
  governanceMessage?: AnyGovernanceMessage;

  state: MsgState;
  dispatchBlock: number;
  tx?: string;

  timings: Timings;
  gasUsed: GasUsed;
  logger: Logger;
  checkbox: Checkbox;

  sdk: BridgeContext;

  constructor(
    origin: number,
    destination: number,
    nonce: number,
    root: string,
    messageHash: string,
    leafIndex: ethers.BigNumber,
    body: string,
    dispatchedAt: number,
    dispatchBlock: number,
    logger: Logger,
    sdk: BridgeContext,
    gasUsed?: GasUsed,
  ) {
    this.origin = origin;
    this.destination = destination;
    this.nonce = nonce;
    this.root = root.toLowerCase();
    this.messageHash = messageHash.toLowerCase();
    this.leafIndex = leafIndex;

    this.body = body;
    const parsed = parseMessage(body);
    this.internalSender = new Padded(parsed.sender);
    this.internalRecipient = new Padded(parsed.recipient);
    this.msgType = MessageType.NoMessage;

    this.tryParseMessage(parsed.body);

    this.state = MsgState.Dispatched;
    this.timings = new Timings(dispatchedAt);
    this.dispatchBlock = dispatchBlock;
    this.gasUsed = gasUsed || new GasUsed();
    this.logger = logger.child({ messageHash });
    this.checkbox = new Checkbox();
    this.sdk = sdk;
  }

  recipient(): Padded | undefined {
    return this.transferMessage
      ? new Padded(this.transferMessage!.action.to)
      : undefined;
  }

  tokenId(): Padded | undefined {
    return this.transferMessage
      ? new Padded(this.transferMessage!.token.id as string)
      : undefined;
  }

  get confirmAt(): number {
    if (this.timings.relayedAt === 0) return 0;
    if (!this.sdk.domainNumbers.includes(this.destination)) return 0;

    const optimisticSecondsUnknown =
      this.sdk.conf.protocol.networks[
        this.sdk.resolveDomainName(this.destination)
      ].configuration.optimisticSeconds;
    if (!optimisticSecondsUnknown) return 0;

    const relayedAt = Math.floor(this.timings.relayedAt / 1000);

    if (typeof optimisticSecondsUnknown === 'string') {
      return relayedAt + parseInt(optimisticSecondsUnknown);
    } else {
      return relayedAt + optimisticSecondsUnknown;
    }
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

  update(event: NomadishEvent) {
    this.timings.updated(event.ts);
    this.gasUsed.update = event.gasUsed;
    this.checkbox.updated = true;
    if (this.state < MsgState.Updated) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Updated} (Updated)`,
      );
      this.state = MsgState.Updated;

      return true;
    }
    this.logger.debug(
      `The message is in the higher state for being Updated. Want < ${MsgState.Updated}, is ${this.state}`,
    );
    return false;
  }

  relay(event: NomadishEvent) {
    this.timings.relayed(event.ts);
    this.gasUsed.relay = event.gasUsed;
    this.checkbox.relayed = true;
    if (this.state < MsgState.Relayed) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Relayed} (Relayed)`,
      );
      this.state = MsgState.Relayed;

      return true;
    }
    this.logger.debug(
      `The message is in the higher state for being Relayed. Want < ${MsgState.Relayed}, is ${this.state}`,
    );
    return false;
  }

  receive(event: NomadishEvent) {
    this.timings.received(event.ts);
    this.gasUsed.receive = event.gasUsed;
    this.checkbox.received = true;
    if (this.state < MsgState.Received) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Received} (Received)`,
      );
      this.state = MsgState.Received;

      return true;
    }
    this.logger.debug(
      `The message is in the higher state for being Received. Want < ${MsgState.Received}, is ${this.state}`,
    );
    return false;
  }

  process(event: NomadishEvent) {
    this.timings.processed(event.ts);
    this.gasUsed.process = event.gasUsed;
    this.checkbox.processed = true;

    if (this.state < MsgState.Processed) {
      this.logger.debug(
        `Updated message from state ${this.state} to ${MsgState.Processed} (Processed)`,
      );
      this.state = MsgState.Processed;

      return true;
    }

    this.logger.debug(
      `The message is in the higher state for being Proce. Want < ${MsgState.Processed}, is ${this.state}`,
    );
    return false;
  }

  static deserialize(
    s: MinimumSerializedNomadMessage,
    logger: Logger,
    sdk: BridgeContext,
  ) {
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
      logger.child({ messageSource: 'deserialize' }),
      sdk,
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
      msgType: this.msgType,
      recipient: this.recipient()?.valueOf() || null,
      amount: this.amount()?.toHexString() || null,
      allowFast: this.allowFast(),
      detailsHash: this.detailsHash() || null,
      tokenDomain: this.tokenDomain() || null,
      tokenId: this.tokenId()?.valueOf() || null,
      ...this.gasUsed.serialize(),
      ...this.checkbox.serialize(),
      confirmAt: this.confirmAt,
    };
  }

  tryParseMessage(body: string) {
    this.tryParseTransferMessage(body) || this.tryParseGovernanceMessage(body);
  }

  tryParseTransferMessage(body: string): boolean {
    try {
      this.transferMessage = parseBody(body);
      this.msgType = MessageType.TransferMessage;
      return true;
    } catch (e) {
      return false;
    }
  }

  tryParseGovernanceMessage(body: string): boolean {
    try {
      const message = parseAction(body);
      if (message.type == 'batch') {
        message.batchHash;
      } else {
        message.address;
        message.domain;
      }
      this.msgType = MessageType.GovernanceMessage;
      return true;
    } catch (e) {
      return false;
    }
  }

  get originAndRoot(): string {
    return `${this.origin}${this.root}`;
  }
}

class EventsPool {
  redis: RedisClient;
  // db: DB;
  pool: {
    send: Map<string, string>;
    update: Map<string, string[]>;
    relay: Map<string, string[]>;
    receive: Map<string, string>;
    process: Map<string, string>;
  };

  constructor(redis?: RedisClient) {
    this.redis = redis || getRedis();
    this.pool = {
      send: new Map(),
      update: new Map(),
      relay: new Map(),
      receive: new Map(),
      process: new Map(),
    };
  }

  async storeEvent(e: NomadishEvent) {
    const value = JSON.stringify(e.toObject(), replacer);
    if (e.eventType === EventType.BridgeRouterSend) {
      const eventData = e.eventData as Send;
      const key = `${eventData.toDomain};${Padded.fromWhatever(
        eventData.toId,
      ).toEVMAddress()};${eventData.amount.toHexString()};${e.block}`;
      await this.redis.hSet('send', key, value);

      // fsLog(`store event send ${JSON.stringify(e.toObject())} {destination:${eventData.toDomain},recipient:${Padded.fromWhatever(eventData.toId).valueOf()}}`, )
    } else if (e.eventType === EventType.HomeUpdate) {
      const eventData = e.eventData as Update;
      // fsLog(`store event home updtae ${JSON.stringify(e.toObject())} {origin:${eventData.homeDomain},root:${eventData.oldRoot}}`, );
      const key = `${eventData.homeDomain};${eventData.oldRoot}`;
      const exists = await this.redis.hExists('update', key);
      if (!exists) {
        await this.redis.hSet('update', key, JSON.stringify([value]));
      } else {
        const values = (await this.redis.hGet('update', key))!;
        const valuesStr: string[] = JSON.parse(values);

        if (valuesStr.indexOf(value) < 0) {
          valuesStr.push(value);
          await this.redis.hSet('update', key, JSON.stringify(valuesStr));
        }
      }
    } else if (e.eventType === EventType.ReplicaUpdate) {
      const eventData = e.eventData as Update;
      // fsLog(`store event replica updtae ${JSON.stringify(e.toObject())} {origin:${eventData.homeDomain},root:${eventData.oldRoot}}`, )
      const key = `${eventData.homeDomain};${eventData.oldRoot}`;
      const exists = await this.redis.hExists('relay', key);
      if (!exists) {
        await this.redis.hSet('relay', key, JSON.stringify([value]));
      } else {
        const values = (await this.redis.hGet('relay', key))!;
        const valuesStr: string[] = JSON.parse(values);

        if (valuesStr.indexOf(value) < 0) {
          valuesStr.push(value);
          await this.redis.hSet('relay', key, JSON.stringify(valuesStr));
        }
      }
    } else if (e.eventType === EventType.BridgeRouterReceive) {
      const [origin, nonce] = e.originAndNonce();
      const eventData = e.eventData as Receive;

      const key = `${origin};${nonce};${
        eventData.amount?.toHexString() || '-'
      };${Padded.fromWhatever(eventData.recipient).valueOf()}`;
      await this.redis.hSet('receive', key, value);
      // fsLog(`store event BridgeRouterReceive ${JSON.stringify(e.toObject())} {origin:${origin},nonce:${nonce}}`, )
    } else if (e.eventType === EventType.ReplicaProcess) {
      const eventData = e.eventData as Process;
      const key = eventData.messageHash;
      await this.redis.hSet('process', key, value);

      // fsLog(`store event process ${JSON.stringify(e.toObject())} {hash:${eventData.messageHash}}`, )
    }
  }

  async getSend(
    destination: number,
    recipient: Padded,
    amount: ethers.BigNumber,
    block: number,
  ): Promise<NomadishEvent | null> {
    const key = `${destination};${recipient.toEVMAddress()};${amount.toHexString()};${block}`;
    const value = await this.redis.hGet('send', key);
    if (!value) return null;

    return JSON.parse(value, reviver);
  }

  async getUpdate(origin: number, root: string): Promise<NomadishEvent[]> {
    const key = `${origin};${root}`;
    const values = await this.redis.hGet('update', key);
    if (!values) return [];
    const valuesArr: string[] = JSON.parse(values);

    return valuesArr.map((v) => JSON.parse(v, reviver));
  }
  async getRelay(origin: number, root: string) {
    const key = `${origin};${root}`;
    const values = await this.redis.hGet('relay', key);
    if (!values) return [];
    const valuesArr: string[] = JSON.parse(values);

    return valuesArr.map((v) => JSON.parse(v, reviver));
  }
  async getProcess(messageHash: string): Promise<NomadishEvent | null> {
    const value = await this.redis.hGet('process', messageHash);
    if (!value) return null;

    return JSON.parse(value, reviver);
  }
  async getReceive(
    origin: number,
    nonce: number,
    amount: BigNumber | undefined,
    recipient: Padded | undefined,
  ): Promise<NomadishEvent | null> {
    const key = `${origin};${nonce};${amount?.toHexString() || '-'};${
      recipient?.valueOf() || '-'
    }`;
    const value = await this.redis.hGet('receive', key);
    if (!value) return null;

    return JSON.parse(value, reviver);
  }
}

export class ProcessorV2 extends Consumer {
  pool: EventsPool; // Where all unused events are waiting for the previous events to come. They can stay in pool max X hours
  domains: number[];
  db: DB;
  dbPLimit: pLimit.Limit;
  logger: Logger;
  sdk: BridgeContext;

  constructor(db: DB, logger: Logger, redis: RedisClient, sdk: BridgeContext) {
    super();

    this.pool = new EventsPool(redis);
    this.domains = sdk.domainNumbers || [];

    this.sdk = sdk;

    this.db = db;
    this.dbPLimit = pLimit(10);
    this.logger = logger.child({ span: 'consumer' });
  }

  async consume(events: NomadishEvent[]): Promise<void> {
    // just to prevent from running for now.
    // fs.writeFileSync(`/Users/daniilnaumetc/code/nomad/monorepo/checks_to_main/packages/indexer/batches/${iii++}_${events.length}.json`, JSON.stringify(events.map(e => e.toObject())))

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
    }
  }

  async dispatched(e: NomadishEvent) {
    const { committedRoot, messageHash, leafIndex, message } =
      e.eventData as Dispatch;
    const m = new NomadMessage(
      e.domain,
      ...e.destinationAndNonce(),
      committedRoot,
      messageHash,
      leafIndex,
      message,
      e.ts,
      e.block,
      this.logger.child({ messageSource: 'consumer' }),
      this.sdk,
    );

    const logger = m.logger.child({ eventName: 'dispatched' });

    // logger.warn(`I HAVEN"T CHECKED IF MESSAGE EXISTS ALREADY`)

    this.emit('dispatched', m, e);
    logger.debug(`Created message`);

    if (!this.domains.includes(e.domain)) this.domains.push(e.domain);

    // fsLog(`Created message with messageHash {hash:${m.messageHash}}`)

    await this.checkAndUpdateAll(m, 'insert');

    await this.insertMessage(m);
    // fsLog(`INSERTED {hash:${m.messageHash}}`)
  }

  async checkAndUpdateSend(m: NomadMessage) {
    if (m.msgType !== MessageType.TransferMessage)
      throw new Error(`Message not a transfer message`);
    // destination, new Padded(recipient), amount, block, token . destination: number, recipient: Padded, amount: ethers.BigNumber, block: number, tokenId: Padded
    const event: NomadishEvent | null = await this.pool.getSend(
      m.destination,
      m.recipient()!,
      m.amount()!,
      m.dispatchBlock,
    );
    // fsLog(`checkAndUpdateSend with messageHash, event found: ${!!event} {hash:${m.messageHash}}`)
    if (event) {
      this.msgSend(event, m);
    }
  }

  msgSend(event: NomadishEvent, message: NomadMessage) {
    const eventData = event.eventData as Send;
    message.sender = eventData.from;
    message.tx = event.tx;
    message.checkbox.sent = true;
  }

  msgUpdate(event: NomadishEvent, message: NomadMessage) {
    if (message.update(event)) {
      this.emit('updated', message, event);
    }
  }

  msgRelay(event: NomadishEvent, message: NomadMessage) {
    if (message.relay(event)) {
      this.emit('relayed', message, event);
    }
  }

  msgReceive(event: NomadishEvent, message: NomadMessage) {
    if (message.receive(event)) {
      this.emit('received', message, event);
    }
  }

  msgProcess(event: NomadishEvent, message: NomadMessage) {
    if (message.process(event)) {
      this.emit('processed', message, event);
    }
  }

  async checkAndUpdateUpdate(m: NomadMessage) {
    const events: NomadishEvent[] = await this.pool.getUpdate(m.origin, m.root);
    // fsLog(`checkAndUpdateUpdate with messageHash, events found: ${events.length} {hash:${m.messageHash}}`)
    events.forEach((event) => {
      this.msgUpdate(event, m);
    });
  }

  async checkAndUpdateRelay(m: NomadMessage) {
    const events: NomadishEvent[] = await this.pool.getRelay(m.origin, m.root);
    // fsLog(`checkAndUpdateRelay with messageHash, events found: ${events.length} {hash:${m.messageHash}}`)
    events.forEach((event) => {
      this.msgRelay(event, m);
    });
  }

  async checkAndUpdateProcess(m: NomadMessage) {
    const event: NomadishEvent | null = await this.pool.getProcess(
      m.messageHash,
    );
    // fsLog(`checkAndUpdateProcess with messageHash , event found: ${!!event} {hash:${m.messageHash}}`)
    if (event) {
      this.msgProcess(event, m);
    }
  }

  async checkAndUpdateReceive(m: NomadMessage) {
    const event: NomadishEvent | null = await this.pool.getReceive(
      m.origin,
      m.nonce,
      m.amount(),
      m.recipient(),
    );
    // fsLog(`checkAndUpdateReceive with messageHash , event found: ${!!event} {hash:${m.messageHash}}`)
    if (event) {
      this.msgReceive(event, m);
    }
  }

  async checkAndUpdateAll(m: NomadMessage, s?: string) {
    // fsLog(`checkAndUpdateAll after ${s}: ${m.checkbox.sent},${m.checkbox.updated},${m.checkbox.relayed},${m.checkbox.received},${m.checkbox.processed} {hash:${m.messageHash}}`)
    if (!m.checkbox.sent) {
      if (m.msgType === MessageType.TransferMessage) {
        await this.checkAndUpdateSend(m);
      } else if (m.msgType === MessageType.GovernanceMessage) {
      }
    }

    if (!m.checkbox.updated && m.state !== MsgState.Updated) {
      await this.checkAndUpdateUpdate(m);
    }
    if (!m.checkbox.relayed && m.state !== MsgState.Relayed) {
      await this.checkAndUpdateRelay(m);
    }
    if (!m.checkbox.received && m.state !== MsgState.Received) {
      if (m.msgType === MessageType.TransferMessage) {
        await this.checkAndUpdateReceive(m);
      } else if (m.msgType === MessageType.GovernanceMessage) {
      }
    }
    if (!m.checkbox.processed && m.state !== MsgState.Processed) {
      await this.checkAndUpdateProcess(m);
    }
  }

  async homeUpdate(e: NomadishEvent) {
    const logger = this.logger.child({ eventName: 'updated' });
    const oldRoot = (e.eventData as Update).oldRoot;
    const ms = await this.getMsgsByOriginAndRoot(e.domain, oldRoot);
    // fsLog(`HomeUpdate actually happened {root:${oldRoot},origin:${e.domain}}`);

    // IMPORTANT! we still store the event for update and relay even though it is already appliable, but it needs to be checked for dups
    await this.pool.storeEvent(e);

    if (ms.length) {
      await Promise.all(
        ms.map(async (m) => {
          this.msgUpdate(e, m);
          await this.checkAndUpdateAll(m, 'homeUpdate');
          await this.updateMessage(m);
        }),
      );
    } else {
      logger.warn(
        { origin: e.replicaOrigin, root: oldRoot },
        `Haven't found a message for Update event`,
      );
    }
  }

  async replicaUpdate(e: NomadishEvent) {
    const logger = this.logger.child({ eventName: 'relayed' });
    const oldRoot = (e.eventData as Update).oldRoot;
    // fsLog(
    //   `ReplicaUpdate actually happened {root:${oldRoot},origin:${e.domain}}`,
    // );
    const ms = await this.getMsgsByOriginAndRoot(e.replicaOrigin, oldRoot);

    // IMPORTANT! we still store the event for update and relay even though it is already appliable, but it needs to be checked for dups
    await this.pool.storeEvent(e);

    if (ms.length) {
      await Promise.all(
        ms.map(async (m) => {
          this.msgRelay(e, m);
          await this.checkAndUpdateAll(m, 'replicaUpdate');
          await this.updateMessage(m);
        }),
      );
    } else {
      logger.warn(
        { origin: e.replicaOrigin, root: oldRoot },
        `Haven't found a message for ReplicaUpdate event`,
      );
    }
  }

  async process(e: NomadishEvent) {
    const logger = this.logger.child({ eventName: 'processed' });
    const messageHash = (e.eventData as Process).messageHash;
    // fsLog(`Process actually happened {hash:${messageHash}}`)
    const m = await this.getMsg(messageHash);
    if (m) {
      this.msgProcess(e, m);
      await this.checkAndUpdateAll(m, 'process');
      await this.updateMessage(m);
    } else {
      await this.pool.storeEvent(e);
      logger.warn(
        { messageHash },
        `Haven't found a message for Processed event`,
      );
    }
  }

  async bridgeRouterSend(e: NomadishEvent) {
    const logger = this.logger.child({ eventName: 'bridgeSent' });
    const block = e.block;
    const {
      toDomain: destination,
      toId: recipient,
      amount,
    } = e.eventData as Send;

    const m = await this.getMsgBySendValues(
      destination,
      Padded.fromWhatever(recipient),
      amount,
      block,
    );

    // fsLog(`Just received Send and message found: ${!!m} ${JSON.stringify(e.toObject())}... select * from messages where destination = ${destination} and recipient = '${Padded.fromWhatever(recipient).valueOf()}' and amount = '${amount.toHexString()}' and block = ${block} and tokenId = '${Padded.fromWhatever(token).valueOf()}' ... {destination:${destination},recipient:${Padded.fromWhatever(recipient).valueOf()}}`, )

    if (m) {
      this.msgSend(e, m);
      await this.checkAndUpdateAll(m, 'bridgeRouterSend');
      await this.updateMessage(m);
    } else {
      await this.pool.storeEvent(e);
      logger.warn(
        { destination, recipient, amount },
        `Haven't found a message for Send event`,
      );
    }
  }

  async bridgeRouterReceive(e: NomadishEvent) {
    const m = await this.getMsgByOriginAndNonce(...e.originAndNonce());
    const logger = this.logger.child({ eventName: 'bridgeReceived' });

    if (m) {
      this.msgReceive(e, m);
      await this.checkAndUpdateAll(m, 'bridgeRouterReceive');
      await this.updateMessage(m);
    } else {
      await this.pool.storeEvent(e);
      const [origin, nonce] = e.originAndNonce();
      logger.warn(
        { origin, nonce },
        `Haven't found a message for BridgeReceived event`,
      );
    }
  }

  async insertMessage(m: NomadMessage) {
    await this.db.insertMessage([m]);
  }
  async updateMessage(m: NomadMessage) {
    await this.dbPLimit(async () => {
      await this.db.updateMessage([m]);
    });
  }

  async getMsgBySendValues(
    destination: number,
    recipient: Padded,
    amount: ethers.BigNumber,
    block: number,
  ): Promise<NomadMessage | null> {
    return await this.db.getMessageBySendValues(
      destination,
      recipient,
      amount,
      block,
    );
  }

  async getMsg(id: string): Promise<NomadMessage | null> {
    return await this.db.getMessageByHash(id);
  }

  async getMsgsByOriginAndRoot(
    origin: number,
    root: string,
  ): Promise<NomadMessage[]> {
    return await this.db.getMessagesByOriginAndRoot(origin, root);
  }

  async getMsgByOriginAndNonce(
    origin: number,
    nonce: number,
  ): Promise<NomadMessage | null> {
    return await this.db.getMessageByOriginAndNonce(origin, nonce);
  }

  async stats(): Promise<Statistics> {
    const collector = new StatisticsCollector(this.domains);

    const messages = await this.db.getAllMessages();

    messages.forEach((m) => {
      collector.contributeToCount(m);
    });

    return collector.stats();
  }
}
