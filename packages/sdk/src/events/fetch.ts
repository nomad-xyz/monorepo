import { Annotated } from './index';
import { NomadContext } from '..';
import { Result } from '@ethersproject/abi';
import { TypedEvent, TypedEventFilter } from '@nomad-xyz/contracts-core';

import * as config from '@nomad-xyz/configuration';

// specifies an interface shared by the TS generated contracts
export interface TSContract<T extends Result, U> {
  queryFilter(
    event: TypedEventFilter<T, U>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined,
  ): Promise<Array<TypedEvent<T & U>>>;
}

export async function queryAnnotatedEvents<T extends Result, U>(
  context: NomadContext,
  nameOrDomain: string | number,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
  wait?: number, // in milliseconds
): Promise<Array<Annotated<T, TypedEvent<T & U>>>> {
  const events = await getEvents(
    context,
    nameOrDomain,
    contract,
    filter,
    startBlock,
    endBlock,
    wait,
  );
  return Annotated.fromEvents(context.resolveDomain(nameOrDomain), events);
}

export async function queryAnnotatedEvent<T extends Result, U>(
  context: NomadContext,
  nameOrDomain: string | number,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
  wait?: number, // in milliseconds
): Promise<Annotated<T, TypedEvent<T & U>> | undefined> {
  const event = await getEvent(
    context,
    nameOrDomain,
    contract,
    filter,
    startBlock,
    endBlock,
    wait,
  );
  if (!event) return;
  return Annotated.fromEvent(context.resolveDomain(nameOrDomain), event);
}

export async function getEvents<T extends Result, U>(
  context: NomadContext,
  nameOrDomain: string | number,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
  wait?: number, // in milliseconds
): Promise<Array<TypedEvent<T & U>>> {
  const domain = context.mustGetDomain(nameOrDomain);

  if (domain.specs.indexPageSize) {
    return getPaginatedEvents(
      context,
      domain,
      contract,
      filter,
      startBlock,
      endBlock,
      wait,
    );
  }
  return contract.queryFilter(filter, startBlock, endBlock);
}

export async function getEvent<T extends Result, U>(
  context: NomadContext,
  nameOrDomain: string | number,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
  wait?: number, // in milliseconds
): Promise<TypedEvent<T & U> | undefined> {
  const domain = context.mustGetDomain(nameOrDomain);

  if (domain.specs.indexPageSize) {
    return getPaginatedEvent(
      context,
      domain,
      contract,
      filter,
      startBlock,
      endBlock,
      wait,
    );
  }
  const events = await contract.queryFilter(filter, startBlock, endBlock);
  return events[0];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getPaginatedEvents<T extends Result, U>(
  context: NomadContext,
  domain: config.Domain,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
  wait?: number, // in milliseconds
): Promise<Array<TypedEvent<T & U>>> {
  const { indexPageSize } = domain.specs;
  if (!indexPageSize) {
    throw new Error('Domain need not be paginated');
  }

  const core = context.mustGetCore(domain.name);

  // get the first block by params
  // or domain deployment block
  const firstBlock = startBlock
    ? Math.max(startBlock, core.deployHeight)
    : core.deployHeight;
  // get the last block by params
  // or current block number
  let lastBlock;
  if (!endBlock) {
    const provider = context.mustGetProvider(domain.domain);
    lastBlock = await provider.getBlockNumber();
  } else {
    lastBlock = endBlock;
  }
  // query domain pagination limit at a time, concurrently
  let events: Array<TypedEvent<T & U>> = [];
  for (
    let from = firstBlock;
    from <= lastBlock;
    from += indexPageSize
  ) {
    console.log('block: ', from)
    const nextFrom = from + indexPageSize;
    const to = Math.min(nextFrom, lastBlock);
    const eventArray = await contract.queryFilter(filter, from, to);
    // concatenate results
    events = events.concat(eventArray);

    // sleep between paginations to avoid rate limiting
    if (wait) {
      await sleep(wait);
    }
  }
  return events;
}

async function getPaginatedEvent<T extends Result, U>(
  context: NomadContext,
  domain: config.Domain,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
  wait?: number, // in milliseconds
): Promise<TypedEvent<T & U> | undefined> {
  const { indexPageSize } = domain.specs;
  if (!indexPageSize) {
    throw new Error('Domain need not be paginated');
  }

  const core = context.mustGetCore(domain.name);

  // get the first block by params
  // or domain deployment block
  const firstBlock = startBlock
    ? Math.max(startBlock, core.deployHeight)
    : core.deployHeight;
  // get the last block by params
  // or current block number
  let lastBlock;
  if (!endBlock) {
    const provider = context.mustGetProvider(domain.domain);
    lastBlock = await provider.getBlockNumber();
  } else {
    lastBlock = endBlock;
  }

  for (
    let from = firstBlock;
    from <= lastBlock;
    from += indexPageSize
  ) {
    const nextFrom = from + indexPageSize;
    const to = Math.min(nextFrom, lastBlock);
    const eventArray = await contract.queryFilter(filter, from, to);
    if (eventArray.length === 1) {
      return eventArray[0];
    } else if (eventArray.length > 1) {
      throw new Error('Multiple events');
    }
    // sleep between paginations to avoid rate limiting
    if (wait) {
      await sleep(wait);
    }
  }
  return undefined;
}
