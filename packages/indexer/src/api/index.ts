import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';
import http from 'http';
import {
  getDB,
  getGraphqlSchema,
  getMetricsMiddleware,
  initSentry,
  startMetricsServer,
} from './utils';
import * as Sentry from '@sentry/node';
import { isProduction, port } from '../config';
import router from './routes';

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

// add all the routes
app.use('/', router);

// TODO: consider supporting top level await in monorepo
// (eg: module: es2022, target: >es2017 in the tsconfig)
(async () => {
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
      prisma: (await getDB()).client,
    },
  });

  if (isProduction) {
    // The error handler must be before any other error middleware and after all controllers
    app.use(Sentry.Handlers.errorHandler());
  }

  startMetricsServer();

  app.use(getMetricsMiddleware());

  await graphqlServer.start();
  graphqlServer.applyMiddleware({ app });

  httpServer.listen({ port });
})();
