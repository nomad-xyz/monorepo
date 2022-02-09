import { Annotated } from '.';
import { NomadContext } from '..';
import { Domain } from '@nomad-xyz/multi-provider';
import { Result } from '@ethersproject/abi';
import { TypedEvent, TypedEventFilter } from '@nomad-xyz/core-contracts';

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
): Promise<Array<Annotated<T, TypedEvent<T & U>>>> {
  const events = await getEvents(
    context,
    nameOrDomain,
    contract,
    filter,
    startBlock,
    endBlock,
  );
  return Annotated.fromEvents(context.resolveDomain(nameOrDomain), events);
}

export async function getEvents<T extends Result, U>(
  context: NomadContext,
  nameOrDomain: string | number,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
): Promise<Array<TypedEvent<T & U>>> {
  const domain = context.mustGetDomain(nameOrDomain);
  if (domain.paginate) {
    return getPaginatedEvents(
      context,
      domain,
      contract,
      filter,
      startBlock,
      endBlock,
    );
  }
  return contract.queryFilter(filter, startBlock, endBlock);
}

async function getPaginatedEvents<T extends Result, U>(
  context: NomadContext,
  domain: Domain,
  contract: TSContract<T, U>,
  filter: TypedEventFilter<T, U>,
  startBlock?: number,
  endBlock?: number,
): Promise<Array<TypedEvent<T & U>>> {
  if (!domain.paginate) {
    throw new Error('Domain need not be paginated');
  }
  // get the first block by params
  // or domain deployment block
  const firstBlock = startBlock
    ? Math.max(startBlock, domain.paginate.from)
    : domain.paginate.from;
  // get the last block by params
  // or current block number
  let lastBlock;
  if (!endBlock) {
    const provider = context.mustGetProvider(domain.id);
    lastBlock = await provider.getBlockNumber();
  } else {
    lastBlock = endBlock;
  }
  // query domain pagination limit at a time, concurrently
  const eventArrayPromises = [];
  for (
    let from = firstBlock;
    from <= lastBlock;
    from += domain.paginate.blocks
  ) {
    const nextFrom = from + domain.paginate.blocks;
    const to = Math.min(nextFrom, lastBlock);
    const eventArrayPromise = contract.queryFilter(filter, from, to);
    eventArrayPromises.push(eventArrayPromise);
  }
  // await promises & concatenate results
  const eventArrays = await Promise.all(eventArrayPromises);
  let events: Array<TypedEvent<T & U>> = [];
  for (const eventArray of eventArrays) {
    events = events.concat(eventArray);
  }
  return events;
}
