import { Router } from 'express';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { register } from 'prom-client';
import { useAllResolvers } from '../config';
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
import { randomString } from '../core/utils';
import { prefix } from '../core/metrics';
import promBundle from 'express-prom-bundle';
import Logger from 'bunyan';

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

export const getMetricsMiddleware = (): promBundle.Middleware => {
  // Kludge. I don't know how to prevent promBundle from exposing metricsPath
  const metricsPath = '/' + randomString(20); // '/metrics'

  const metricsMiddleware = promBundle({
    httpDurationMetricName: prefix + '_api',
    buckets: [0.1, 0.3, 0.6, 1, 1.5, 2.5, 5],
    includeMethod: true,
    includePath: true,
    metricsPath,
    promRegistry: register,
  });

  return metricsMiddleware;
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
