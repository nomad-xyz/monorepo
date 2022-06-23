import { Router } from 'express';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { IndexerCollector } from '../core/metrics';
import { createLogger } from '../core/utils';
import { getSdk } from '../core/sdk';
import { DB } from '../core/db';
import {
  useAllResolvers,
  configOverrideLocation,
  environment,
  logLevel,
} from '../config';
import { NonEmptyArray } from 'type-graphql';
import {
  resolvers,
  FindUniqueMessagesResolver,
  FindUniqueReplicaResolver,
  FindUniqueTokenResolver,
  FindFirstMessagesResolver,
  FindFirstReplicaResolver,
  FindFirstTokenResolver,
  FindManyMessagesResolver,
  FindManyReplicaResolver,
  FindManyTokenResolver,
  GroupByMessagesResolver,
  GroupByReplicaResolver,
  GroupByTokenResolver,
  ReplicaRelationsResolver,
  TokenOrderByWithRelationInput,
  TokenRelationFilter,
  TokenRelationsResolver,
  ReplicaOrderByRelationAggregateInput,
} from '@generated/type-graphql';
import { buildSchema } from 'type-graphql';
import { GraphQLSchema } from 'graphql';

const logger = createLogger('indexer api - db', environment, logLevel);
const indexerMetrics = new IndexerCollector(environment, logger);

// TODO: consider making this into a singleton instead of a factory
export const getDB = async (): Promise<DB> => {
  const sdk = await getSdk(configOverrideLocation || environment);

  const db = new DB(indexerMetrics, logger, sdk);
  await db.connect();

  return await db;
};

export const getGraphqlSchema = async (): Promise<GraphQLSchema> => {
  const resolversToBuild: NonEmptyArray<Function> | NonEmptyArray<string> =
    useAllResolvers
      ? resolvers
      : [
          FindUniqueMessagesResolver,
          FindUniqueReplicaResolver,
          FindUniqueTokenResolver,

          FindFirstMessagesResolver,
          FindFirstReplicaResolver,
          FindFirstTokenResolver,

          FindManyMessagesResolver,
          FindManyReplicaResolver,
          FindManyTokenResolver,

          GroupByMessagesResolver,
          GroupByReplicaResolver,
          GroupByTokenResolver,

          ReplicaRelationsResolver,
          TokenRelationsResolver,
          // additional, may be thrown. [Need to check!]
          TokenOrderByWithRelationInput,
          TokenRelationFilter,
          ReplicaOrderByRelationAggregateInput,
        ];

  return await buildSchema({
    resolvers: resolversToBuild,
    validate: false,
  });
};

export const initSentry = (app: Router): void => {
  Sentry.init({
    dsn: 'https://27adc9df48434fc7a99dddae76901884@o1081954.ingest.sentry.io/6508171',
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });
};
