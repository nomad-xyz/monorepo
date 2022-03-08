import express from "express";
import { DB, MsgRequest } from "./db";
import * as dotenv from "dotenv";
import Logger from "bunyan";
import { Orchestrator } from "./orchestrator";
import { Processor } from "./consumer";
import { replacer } from "./utils";
dotenv.config({});

function fail(res: any, code: number, reason: string) {
  return res.status(code).json({ error: reason });
}

const PORT = process.env.DEBUG_PORT || '1337';

export async function run(o: Orchestrator, logger: Logger) {
  const app = express();

  const log = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.info(`request to ${req.url}`);
    next();
  };

  app.get("/healthcheck", log, (req, res) => {
    res.send("OK!");
  });

  app.get("/hash/:hash", log, async (req, res) => {
    const p = (o.consumer as Processor);
    const message = p.getMsg(req.params.hash);
    if (message) {
        return res.json(message.serialize());
    } else {
        return res.status(404).json({});
    }
  });

  app.get("/tx/:tx", log, async (req, res) => {
    const p = (o.consumer as Processor);
    const message = Array.from(p.messages).find(m => m.tx && m.tx! === req.params.tx);
    if (message) {
        return res.json(message.serialize());
    } else {
        return res.status(404).json({});
    }
  });

  app.get("/status", log, async (req, res) => {
    const promises: Promise<[number, {
      lastIndexed: number;
      numMessages: number;
      numRpcFailures: number;
    }]>[] = Array.from(o.indexers.entries()).map(async ([domain, indexer]): Promise<[number, {
      lastIndexed: number;
      numMessages: number;
      numRpcFailures: number;
    }]> => {
      return [domain, {
        lastIndexed: indexer.lastIndexed.valueOf(),
        numMessages: await o.db.getMessageCount(domain),
        numRpcFailures: indexer.failureCounter.num()
      }]
    });
    const entries = await Promise.all(
      promises
    );
    
    const x = new Map(
      entries
    );
    return res.json(JSON.stringify(x, replacer));
  })

  app.get("/msg/:origin/:state", log, async (req, res) => {

    const {origin: originStr, state: stateStr} = req.params;
    let origin: number, state: number;

    try {
        origin = parseInt(originStr);
        state = parseInt(stateStr);
    } catch(e) {
        return res.status(407).json({error: `One of the params (origin or stage) is invalid`});
    }

    const p = (o.consumer as Processor);
    const messages = Array.from(p.messages).filter(m => m.origin === origin && m.state === state);
    if (messages.length) {
        return res.json(messages.map(m => m.serialize()));
    } else {
        return res.status(404).json({});
    }
  });

  app.listen(PORT, () => {
    logger.info(`Server is running at https://localhost:${PORT}`);
  });
}
