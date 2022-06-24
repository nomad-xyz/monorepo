import express, { Request, Response, NextFunction } from 'express';
import { gitCommit } from '../config';
import { DB, MsgRequest } from '../core/db';
import Logger from 'bunyan';

export async function getRouter(db: DB, logger: Logger) {
  const router = express.Router();

  // const logger = createLogger('indexer api - routes', environment, logLevel);

  const log = (req: Request, res: Response, next: NextFunction) => {
    logger.info(`request to ${req.url}`);
    next();
  };

  function fail(res: Response, code: number, reason: string) {
    return res.status(code).json({ error: reason });
  }

  router.get('/healthcheck', log, (_, res) => {
    res.send('OK!');
  });

  router.get('/version', log, (_, res) => {
    res.send(gitCommit);
  });

  router.get('/tx/:tx', log, async (req, res) => {
    const messages = await db.getMessageByEvm(req.params.tx);
    return res.json(messages.map((m) => m.serialize()));
  });

  router.get('/wrongReplicas', log, async (req, res) => {
    const replicas = await db.client.replica.findMany({
      include: { token: true },
    });

    // TODO: filter on the db with the query above
    const sadReplicas = replicas.filter((r) => {
      const t = r.token;
      return (
        t.name !== r.name || t.decimals !== r.decimals || t.symbol !== r.symbol
      );
    });

    return res.json(sadReplicas);
  });

  router.get('/domain/:domain', log, async (req, res) => {
    const { domain: domainStr } = req.params;

    const domainNumber = parseInt(domainStr);

    const domain: number | string = isNaN(domainNumber)
      ? domainStr
      : domainNumber;

    const sdk = db.sdk; // Should not get sdk like that, but it is ok for now
    try {
      const nomadDomain = sdk.getDomain(domain);
      if (nomadDomain) {
        const { name, domain } = nomadDomain;
        res.json({ data: { name, domain } });
        return;
      } else {
        logger.warn(`No domain found for '${domain}'`); // debug
      }
    } catch (e) {
      logger.warn(`Failed getting domain for request '${domain}', error: ${e}`); // debug
    }
    fail(res, 404, 'Domain not found');

    return;
  });

  router.get('/hash/:hash', log, async (req, res) => {
    const message = await db.getMessageByHash(req.params.hash);
    if (!message) return res.status(404).json({});
    return res.json(message.serialize());
  });

  router.get('/tx', log, async (req: Request<{}, {}, {}, MsgRequest>, res) => {
    const { size: sizeStr } = req.query;

    try {
      if (sizeStr && parseInt(sizeStr) > 100)
        return fail(res, 403, 'maximum page size is 30');

      const messages = await db.getMessages(req.query);

      return res.json(messages.map((m) => m.serialize()));
    } catch (e) {
      fail(res, 403, 'something went wrong');
    }
  });

  return router;
}
