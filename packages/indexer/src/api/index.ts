import 'reflect-metadata';

import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';

import { NonEmptyArray } from 'type-graphql';

import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';

import http from 'http';

import { DB, MsgRequest } from '../core/db';
import { prefix } from '../core/metrics';

import * as dotenv from 'dotenv';
import Logger from 'bunyan';
import promBundle from 'express-prom-bundle';

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

dotenv.config({});

function fail(res: any, code: number, reason: string) {
  return res.status(code).json({ error: reason });
}

const PORT = process.env.PORT;

const useAllResolvers =
  process.env.API_USE_ALL_RESOLVERS &&
  process.env.API_USE_ALL_RESOLVERS === 'TRUE';

export async function run(db: DB, logger: Logger) {
  const app = express();
  app.use(cors());
  app.disable('x-powered-by');

  const log = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    logger.info(`request to ${req.url}`);
    next();
  };

  const metricsMiddleware = promBundle({
    httpDurationMetricName: prefix + '_api',
    buckets: [0.1, 0.3, 0.6, 1, 1.5, 2.5, 5],
    includeMethod: true,
    includePath: true,
    metricsPath: '/metrics',
  });
  metricsMiddleware;

  app.use(metricsMiddleware);

  app.get('/healthcheck', log, (req, res) => {
    res.send('OK!');
  });

  app.get('/version', log, (_, res) => {
    res.send(process.env.GIT_COMMIT);
  });

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
          TokenOrderByWithRelationInput,
          TokenRelationFilter,
          ReplicaOrderByRelationAggregateInput,
        ];

  const schema = await buildSchema({
    resolvers: resolversToBuild,
    validate: false,
  });

  const httpServer = http.createServer(app);

  const server = new ApolloServer({
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

  app.get('/tx/:tx', log, async (req, res) => {
    const messages = await db.getMessageByEvm(req.params.tx);
    return res.json(messages.map((m) => m.serialize()));
  });

  app.get('/hash/:hash', log, async (req, res) => {
    const message = await db.getMessageByHash(req.params.hash);
    if (!message) return res.status(404).json({});
    return res.json(message.serialize());
  });

  app.get(
    '/tx',
    log,
    async (req: express.Request<{}, {}, {}, MsgRequest>, res) => {
      const { size: sizeStr } = req.query;

      try {
        if (sizeStr && parseInt(sizeStr) > 100)
          return fail(res, 403, 'maximum page size is 30');

        const messages = await db.getMessages(req.query);

        return res.json(messages.map((m) => m.serialize()));
      } catch (e) {
        fail(res, 403, 'something went wrong');
      }
    },
  );

  await server.start();

  server.applyMiddleware({ app });

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: PORT }, resolve),
  );
}
