import 'reflect-metadata';

import express, { Response } from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';

import { NonEmptyArray } from 'type-graphql';

import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';

import http from 'http';

import { prefix } from '../core/metrics';

import promBundle from 'express-prom-bundle';

import { register } from 'prom-client';

import { createLogger } from '../core/utils';
import { db } from './services';
import { environment, logLevel } from '../config';

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
import { randomString } from '../core/utils';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { isProduction, useAllResolvers, metricsPort, port } from '../config';
import router from './routes';

const app = express();

if (isProduction) {
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

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(cors());
app.disable('x-powered-by');

app.use('/', router);

// TODO: consider supporting top level await in monorepo
// (eg: module: es2022, target: >es2017 in the tsconfig)
let schema;
(async () => {
  // TODO: consider moving to a separate file
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

  schema = await buildSchema({
    resolvers: resolversToBuild,
    validate: false,
  });
})();

const httpServer = http.createServer(app);

const graphqlServer = new ApolloServer({
  schema,
  csrfPrevention: true,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    ApolloServerPluginLandingPageGraphQLPlayground({}),
  ],
  introspection: true,
  context: {
    prisma: db.client,
  },
});

if (isProduction) {
  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());
}

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

const metricsServer = express();

metricsServer.get('/metrics', async (_, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const logger = createLogger('indexer api - metrics', environment, logLevel);

logger.info(
  {
    endpoint: `http://0.0.0.0:${metricsPort}/metrics`,
  },
  'Prometheus metrics exposed',
);

metricsServer.listen(metricsPort);

app.use(metricsMiddleware);

graphqlServer.start();

graphqlServer.applyMiddleware({ app });

httpServer.listen({ port });
