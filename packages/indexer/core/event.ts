import { ethers } from "ethers";
import { hash } from "./utils";

export enum ContractType {
  Home = "home",
  Replica = "replica",
  BridgeRouter = "bridgeRouter",
}

export enum EventType {
  HomeDispatch = "homeDispatch",
  HomeUpdate = "homeUpdate",
  ReplicaUpdate = "replicaUpdate",
  ReplicaProcess = "replicaProcess",
  BridgeRouterSend = "bridgeRouterSend",
  BridgeRouterReceive = "bridgeRouterReceive",
}

export enum EventSource {
  Fetch = "fetch",
  Storage = "storage",
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
    d.leafIndex?.toHexString()  || 'undefined',
    d.destinationAndNonce?.toHexString() || 'undefined',
    d.committedRoot || 'undefined',
    d.oldRoot || 'undefined',
    d.newRoot || 'undefined',
    d.success ? 'true' : 'false',
    d.returnData?.toString()  || 'undefined',
    d.message || 'undefined',
    d.signature || 'undefined',
    d.homeDomain?.toString()  || 'undefined',
    d.token || 'undefined',
    d.from || 'undefined',
    d.toDomain?.toString()  || 'undefined',
    d.toId || 'undefined',
    d.amount?.toHexString()  || 'undefined',
    d.fastLiquidityEnabled ? 'true' : 'false',
    d.originAndNonce?.toHexString()  || 'undefined',
    d.recipient || 'undefined',
    d.liquidityProvider || 'undefined',
    d.evmHash || 'undefined',
  )
}

export class NomadEvent {
  domain: number;
  eventType: EventType;
  contractType: ContractType;
  replicaOrigin: number;
  ts: number;
  eventData: EventData;
  block: number;
  source: EventSource;
  gasUsed: ethers.BigNumber;
  tx: string;

  constructor(
    domain: number,
    eventType: EventType,
    contractType: ContractType,
    replicaOrigin: number,
    ts: number,
    eventData: EventData,
    block: number,
    source: EventSource,
    gasUsed: ethers.BigNumber,
    tx: string,
  ) {
    this.domain = domain;
    this.eventType = eventType;
    this.contractType = contractType;
    this.replicaOrigin = replicaOrigin;
    this.ts =
      /*source === EventSource.Fetch && */ contractType == ContractType.Home ||
      contractType == ContractType.BridgeRouter
        ? ts - 45000
        : ts; // if the event was fetched from RPC for past (we asked RPC when event happened) happened on another chain we want to make sure that event at chain of origin happened before it was relayed to destination
    this.eventData = eventData;
    this.block = block;
    this.source = source;
    this.gasUsed = gasUsed;
    this.tx = tx;
  }

  destinationAndNonce(): [number, number] {
    if (this.eventType !== EventType.HomeDispatch) {
      throw new Error(
        `Destination method is not availiable for non home-dispatch`
      );
    }
    const [destination, nonce] = parseDestinationAndNonce(
      this.eventData.destinationAndNonce!
    );
    return [destination, nonce];
  }

  originAndNonce(): [number, number] {
    if (this.eventType !== EventType.BridgeRouterReceive) {
      throw new Error(
        `Destination method is not availiable for non BridgeRouterReceive`
      );
    }
    const [origin, nonce] = parseDestinationAndNonce(
      this.eventData.originAndNonce!
    );
    return [origin, nonce];
  }

  toObject() {
    return {
      domain: this.domain,
      eventType: this.eventType,
      contractType: this.contractType,
      replicaOrigin: this.replicaOrigin,
      ts: this.ts,
      eventData: this.eventData,
      block: this.block,
      source: EventSource.Storage,
      gasUsed: this.gasUsed,
      tx: this.tx,
    };
  }

  static fromObject(v: any): NomadEvent {
    const e = v as {
      domain: number;
      eventType: EventType;
      contractType: ContractType;
      replicaOrigin: number;
      ts: number;
      eventData: EventData;
      block: number;
      gasUsed: ethers.BigNumber;
      tx: string;
    };
    return new NomadEvent(
      e.domain,
      e.eventType,
      e.contractType,
      e.replicaOrigin,
      e.ts,
      e.eventData,
      e.block,
      EventSource.Storage,
      e.gasUsed,
      e.tx,
    );
  }

  uniqueHash(): string {
    return hash(this.domain.toString(), this.eventType, this.replicaOrigin.toString(), this.block.toString(), uniqueHash(this.eventData), this.gasUsed.toString(), this.tx)
  }
}

function parseDestinationAndNonce(
  h: ethers.BigNumber | { hex?: string; _hex?: string }
): [number, number] {
  let hexString = "";
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
    "0x" + without0x.slice(0, destinationLength)
  );
  const nonceHex = ethers.BigNumber.from(
    "0x" + without0x.slice(destinationLength)
  );
  return [destinationHex.toNumber(), nonceHex.toNumber()];
}
