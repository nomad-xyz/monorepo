import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import Logger from 'bunyan';
import { Orchestrator } from './orchestrator';
import { ProcessorV2 } from './consumerV2';
dotenv.config({});

function fail(res: any, code: number, reason: string) {
  return res.status(code).json({ error: reason });
}

const PORT = process.env.DEBUG_PORT || '1337';

export async function run(o: Orchestrator, logger: Logger) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const log = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    logger.info(`request to ${req.url}`);
    next();
  };

  app.get('/healthcheck', log, (req, res) => {
    res.send('OK!');
  });

  app.get('/version', log, (_, res) => {
    res.send(process.env.GIT_COMMIT);
  });

  app.get('/hash/:hash', log, async (req, res) => {
    const p = o.consumer as ProcessorV2;
    const message = await p.getMsg(req.params.hash);
    if (message) {
      return res.json(message.serialize());
    } else {
      return res.status(404).json({});
    }
  });

  app.get('/tx/:tx', log, async (req, res) => {
    const p = o.consumer as ProcessorV2;
    const messages = await p.db.getMessageByEvm(req.params.tx);

    if (messages.length > 0) {
      return res.json(messages[0].serialize());
    } else {
      return res.status(404).json({});
    }
  });

  app.get('/status', log, async (req, res) => {
    const promises: Promise<
      [
        number,
        {
          lastIndexed: number;
          numMessages: number;
          numRpcFailures: number;
          blocksToTarget: number;
        },
      ]
    >[] = Array.from(o.indexers.entries()).map(
      async ([domain, indexer]): Promise<
        [
          number,
          {
            lastIndexed: number;
            numMessages: number;
            numRpcFailures: number;
            blocksToTarget: number;
          },
        ]
      > => {
        return [
          domain,
          {
            lastIndexed: indexer.lastIndexed.valueOf(),
            numMessages: await o.db.getMessageCount(domain),
            numRpcFailures: indexer.failureCounter.num(),
            blocksToTarget: indexer.targetTo - indexer.lastBlock,
          },
        ];
      },
    );
    const entries = await Promise.all(promises);

    // const x = new Map(entries);
    return res.json(Object.fromEntries(entries));
  });

  app.get('/msg/:origin/:state', log, async (req, res) => {
    const { origin: originStr, state: stateStr } = req.params;
    let origin: number, state: number;

    try {
      origin = parseInt(originStr);
      state = parseInt(stateStr);
    } catch (e) {
      return res
        .status(407)
        .json({ error: `One of the params (origin or stage) is invalid` });
    }

    const p = o.consumer as ProcessorV2;
    const messages = await p.db.getMessagesByOriginAndStateNumber(
      origin,
      state,
    );
    // const messages = Array.from(p.messages).filter(
    //   (m) => m.origin === origin && m.state === state
    // );
    if (messages.length) {
      return res.json(messages.map((m) => m.serialize()));
    } else {
      return res.status(404).json({});
    }
  });

  app.post('/redis_height', log, async (req, res) => {
    const heights = req.body as RedisHeight[];

    for (const { domain, block } of heights) {
      const indexer = o.indexers.get(domain);
      if (!indexer) {
        return res.status(404).json({
          error: `Indexer for domain ${domain} not found, please check the query`,
        });
      }

      indexer.setForceFrom(block);
    }

    return res.status(200).json({});
  });

  app.listen(PORT, () => {
    logger.info(`Server is running at https://localhost:${PORT}`);
  });
}

interface RedisHeight {
  domain: number;
  block: number;
}
