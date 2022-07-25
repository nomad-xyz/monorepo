import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';
import http from 'http';
import promBundle from 'express-prom-bundle';
import { register } from 'prom-client';
import { getGraphqlSchema, initSentry } from './utils';
import * as Sentry from '@sentry/node';
import { isProduction, port } from '../config';
import { getRouter } from './routes';
import { DB } from '../core/db';
import Logger from 'bunyan';
import { prefix } from '../core/metrics';

export async function run(db: DB, logger: Logger) {
  const app = express();

  if (isProduction) {
    initSentry(app);
    // RequestHandler creates a separate execution context using domains, so that every
    // transaction/span/breadcrumb is attached to its own Hub instance
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
  }

  app.use(cors());
  app.disable('x-powered-by');

  app.use(
    promBundle({
      httpDurationMetricName: prefix + '_api',
      buckets: [0.1, 0.3, 0.6, 1, 1.5, 2.5, 5],
      includeMethod: true,
      includePath: true,
      promRegistry: register,
    }),
  );

  const router = await getRouter(db, logger);

  // add all the routes
  app.use('/', router);

  // TODO: consider supporting top level await in monorepo
  // (eg: module: es2022, target: >es2017 in the tsconfig)

  const httpServer = http.createServer(app);

  const graphqlServer = new ApolloServer({
    schema: await getGraphqlSchema(),
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
    introspection: true,
    context: {
      prisma: db.client,
    },
    cache: 'bounded',
  });

  if (isProduction) {
    // The error handler must be before any other error middleware and after all controllers
    app.use(Sentry.Handlers.errorHandler());
  }

  await graphqlServer.start();
  graphqlServer.applyMiddleware({ app });

  httpServer.listen({ port });
}
