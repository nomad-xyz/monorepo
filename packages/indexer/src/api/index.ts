import express from "express";
import cors from "cors";
import { graphqlHTTP } from "express-graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";

import { DB, MsgRequest } from "../core/db";
import { prefix } from "../core/metrics";

import * as dotenv from "dotenv";
import Logger from "bunyan";
import promBundle from "express-prom-bundle";

dotenv.config({});

function fail(res: any, code: number, reason: string) {
  return res.status(code).json({ error: reason });
}

const PORT = process.env.PORT;

export async function run(db: DB, logger: Logger) {
  const app = express();
  app.use(cors());

  const log = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.info(`request to ${req.url}`);
    next();
  };

  const metricsMiddleware = promBundle({
    httpDurationMetricName: prefix + "_api",
    buckets: [0.1, 0.3, 0.6, 1, 1.5, 2.5, 5],
    includeMethod: true,
    includePath: true,
    metricsPath: "/metrics",
  });
  metricsMiddleware;

  app.use(metricsMiddleware);

  // app.use(promMid({
  //   metricsPath: '/metrics',
  //   collectDefaultMetrics: true,
  //   requestDurationBuckets: [0.1, 0.5, 1, 1.5],
  //   requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
  //   responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
  //   prefix: prefix + '_api',
  // }));

  app.get("/healthcheck", log, (req, res) => {
    res.send("OK!");
  });

  const typeDefs = `
    type Message {
      id: Int!
      messageHash: String!
      origin: Int!
      destination: Int!
      nonce: Int!
      internalSender: String!
      internalRecipient: String!
      root: String!
      state: Int!
      dispatchBlock: Int!
      dispatchedAt: Int!
      updatedAt: Int!
      relayedAt: Int!
      receivedAt: Int!
      processedAt: Int!
      sender: String
      recipient: String
      amount: String
      allowFast: Boolean
      detailsHash: String
      tokenDomain: Int
      tokenId: String
      body: String!
      leafIndex: String!
      tx : String
      gasAtDispatch: String!
      gasAtUpdate: String!
      gasAtRelay: String!
      gasAtReceive: String!
      gasAtProcess: String!
      createdAt: Int!
      confirmAt: Int!
    }

    type Token {
      id: String!
      domain: Int!
      name: String!
      decimals: Int!
      symbol: String!
      totalSupply: String!
      balance: String!
    }

    type Replica {
      id: String!
      domain: Int!
      tokenId: String!
      tokenDomain: Int!
      totalSupply: String!
    }

    type Query {
      allMessages: [Message!]!
      messageByHash(txHash: String!): Message
      allTokens: [Token!]!
      allReplicas: [Replica!]!
      tokenReplica(id: String!, domain: Int!): Replica!
      tokenReplicas(id: String!): [Replica!]!
      tokenReplicasByOrigin(domain: Int!): [Replica!]!
      tokenReplicasByDestination(domain: Int!): [Replica!]!
    }
  `;

  const resolvers = {
    Query: {
      allMessages: () => {
        return db.client.messages.findMany();
      },
      messageByHash: (args: { txHash: string }) => {
        return db.client.messages.findFirst({
          where: { tx: args.txHash || undefined },
        });
      },
      allTokens: () => {
        return db.client.token.findMany();
      },
      allReplicas: () => {
        return db.client.replica.findMany();
      },
      tokenReplica: (
        _: any,
        { id, domain }: { id: string; domain: number }
      ) => {
        return db.client.replica.findFirst({
          where: {
            tokenId: id,
            tokenDomain: domain,
          },
        });
      },
      tokenReplicas: (
        _: any,
        { id }: { id: string }
      ) => {
        return db.client.replica.findMany({
          where: {
            tokenId: id,
          },
        });
      },
      tokenReplicasByOrigin: (
        _: any,
        { domain }: { domain: number }
      ) => {
        return db.client.replica.findMany({
          where: {
            tokenDomain: domain,
          },
        });
      },
      tokenReplicasByDestination: (
        _: any,
        { domain }: { domain: number }
      ) => {
        return db.client.replica.findMany({
          where: {
            domain,
          },
        });
      },
    },
  };

  const schema = makeExecutableSchema({
    resolvers,
    typeDefs,
  });

  app.use(
    "/graphql",
    graphqlHTTP({
      schema,
      graphiql: true,
    })
  );

  app.get("/tx/:tx", log, async (req, res) => {
    const messages = await db.getMessageByEvm(req.params.tx);
    return res.json(messages.map((m) => m.serialize()));
  });

  app.get("/hash/:hash", log, async (req, res) => {
    const message = await db.getMessageByHash(req.params.hash);
    if (!message) return res.status(404).json({});
    return res.json(message.serialize());
  });

  app.get(
    "/tx",
    log,
    async (req: express.Request<{}, {}, {}, MsgRequest>, res) => {
      const { size } = req.query;

      if (size && size > 30) return fail(res, 403, "maximum page size is 30");

      const messages = await db.getMessages(req.query);

      return res.json(messages.map((m) => m.serialize()));
    }
  );

  app.listen(PORT, () => {
    console.log(process.env.DATABASE_URL);
    logger.info(`Server is running at https://localhost:${PORT}`);
  });
}
