import { ethers } from 'ethers';
import { hash } from './utils';

export interface Dispatch {
  messageHash: string;
  leafIndex: ethers.BigNumber;
  destinationAndNonce: ethers.BigNumber;
  committedRoot: string;
  message: string;
}

export interface Send {
  token: string;
  from: string;
  toDomain: number;
  toId: string;
  amount: ethers.BigNumber;
  fastLiquidityEnabled: boolean;
}

export interface Update {
  homeDomain: number;
  oldRoot: string;
  newRoot: string;
  signature: string;
}

export interface Receive {
  originAndNonce: ethers.BigNumber;
  token: string;
  recipient: string;
  liquidityProvider: string;
  amount: ethers.BigNumber;
}

export interface Process {
  messageHash: string;
  success: boolean;
  returnData: string;
}

export type EventDataNormal = Dispatch | Send | Update | Receive | Process;

export enum EventType {
  HomeDispatch = 'homeDispatch',
  HomeUpdate = 'homeUpdate',
  ReplicaUpdate = 'replicaUpdate',
  ReplicaProcess = 'replicaProcess',
  BridgeRouterSend = 'bridgeRouterSend',
  BridgeRouterReceive = 'bridgeRouterReceive',
}

export function eventTypeToOrder(eventType: NomadishEvent) {
  switch (eventType.eventType) {
    case EventType.HomeDispatch:
      return 0;
    case EventType.BridgeRouterSend:
      return 1;
    case EventType.HomeUpdate:
      return 2;
    case EventType.ReplicaUpdate:
      return 3;
    case EventType.BridgeRouterReceive:
      return 5;
    case EventType.ReplicaProcess:
      return 4;
    default:
      console.log(eventType);
      throw new Error(`Unknown event type: ${eventType.eventType}`);
  }
}

export enum EventSource {
  Fresh = 'fresh',
  Storage = 'storage',
}

export type EventData = {
  messageHash?: string;
  leafIndex?: ethers.BigNumber;
  destinationAndNonce?: ethers.BigNumber;
  committedRoot?: string;
  oldRoot?: string;
  newRoot?: string;
  success?: boolean;
  returnData?: ethers.utils.BytesLike;
  message?: string;
  signature?: string;
  homeDomain?: number;
  // Bridge router options
  token?: string;
  from?: string;
  toDomain?: number;
  toId?: string;
  amount?: ethers.BigNumber;
  fastLiquidityEnabled?: boolean;
  originAndNonce?: ethers.BigNumber;
  recipient?: string;
  liquidityProvider?: string;
  evmHash?: string;
};

export function uniqueHash(d: EventData): string {
  return hash(
    d.messageHash || 'undefined',
    d.leafIndex?.toHexString() || 'undefined',
    d.destinationAndNonce?.toHexString() || 'undefined',
    d.committedRoot || 'undefined',
    d.oldRoot || 'undefined',
    d.newRoot || 'undefined',
    d.success ? 'true' : 'false',
    d.returnData?.toString() || 'undefined',
    d.message || 'undefined',
    d.signature || 'undefined',
    d.homeDomain?.toString() || 'undefined',
    d.token || 'undefined',
    d.from || 'undefined',
    d.toDomain?.toString() || 'undefined',
    d.toId || 'undefined',
    d.amount?.toHexString() || 'undefined',
    d.fastLiquidityEnabled ? 'true' : 'false',
    d.originAndNonce?.toHexString() || 'undefined',
    d.recipient || 'undefined',
    d.liquidityProvider || 'undefined',
    d.evmHash || 'undefined',
  );
}

export class NomadishEvent {
  domain: number;
  eventType: EventType;
  replicaOrigin: number;
  ts: number;
  block: number;
  source: EventSource;
  gasUsed: ethers.BigNumber;
  tx: string;
  eventData: EventDataNormal;

  constructor(
    domain: number,
    eventType: EventType,
    replicaOrigin: number,
    ts: number,
    block: number,
    source: EventSource,
    gasUsed: ethers.BigNumber,
    tx: string,
    eventData: EventDataNormal,
  ) {
    this.domain = domain;
    this.eventType = eventType;
    this.replicaOrigin = replicaOrigin;
    this.ts = ts;

    this.eventData = eventData;

    this.block = block;
    this.source = source;
    this.gasUsed = gasUsed;
    this.tx = tx;
  }

  destinationAndNonce(): [number, number] {
    if (this.eventType !== EventType.HomeDispatch) {
      throw new Error(
        `Destination method is not availiable for non home-dispatch`,
      );
    }
    const [destination, nonce] = parseDestinationAndNonce(
      (this.eventData as Dispatch).destinationAndNonce!,
    );
    return [destination, nonce];
  }

  originAndNonce(): [number, number] {
    if (this.eventType !== EventType.BridgeRouterReceive) {
      throw new Error(
        `Destination method is not availiable for non BridgeRouterReceive`,
      );
    }
    const [origin, nonce] = parseDestinationAndNonce(
      (this.eventData as Receive).originAndNonce!,
    );
    return [origin, nonce];
  }

  toObject() {
    return {
      domain: this.domain,
      eventType: this.eventType,
      replicaOrigin: this.replicaOrigin,
      ts: this.ts,
      eventData: this.eventData,
      block: this.block,
      source: EventSource.Storage,
      gasUsed: this.gasUsed,
      tx: this.tx,
    };
  }

  static fromObject(v: any): NomadishEvent {
    const e = v as {
      domain: number;
      eventType: EventType;
      replicaOrigin: number;
      ts: number;
      eventData: EventDataNormal;
      block: number;
      gasUsed: ethers.BigNumber;
      tx: string;
    };
    return new NomadishEvent(
      e.domain,
      e.eventType,
      e.replicaOrigin,
      e.ts,
      e.block,
      EventSource.Storage,
      e.gasUsed,
      e.tx,
      e.eventData,
    );
  }

  uniqueHash(): string {
    return hash(
      this.domain.toString(),
      this.eventType,
      this.replicaOrigin.toString(),
      uniqueHash(this.eventData),
      this.gasUsed.toString(),
      this.tx,
    );
  }
}

function parseDestinationAndNonce(
  h: ethers.BigNumber | { hex?: string; _hex?: string },
): [number, number] {
  let hexString = '';
  if (h instanceof ethers.BigNumber) {
    hexString = h.toHexString();
  } else {
    const hex = h.hex || h._hex;
    if (!hex) throw new Error(`Has no hex: ${JSON.stringify(h)}`);
    hexString = hex;
  }

  const without0x = hexString.slice(2);
  const destinationLength = without0x.length - 8;
  const destinationHex = ethers.BigNumber.from(
    '0x' + without0x.slice(0, destinationLength),
  );
  const nonceHex = ethers.BigNumber.from(
    '0x' + without0x.slice(destinationLength),
  );
  return [destinationHex.toNumber(), nonceHex.toNumber()];
}

export function onlyUniqueEvents(arr: NomadishEvent[]): NomadishEvent[] {
  const hashfull: [string, NomadishEvent][] = arr.map((e) => [
    e.uniqueHash(),
    e,
  ]);
  return hashfull
    .filter(([h, _], i, arr) => {
      return arr.findIndex(([hh, _]) => hh === h) === i;
    })
    .map(([_, e]) => e);
}
