import * as config from '@nomad-xyz/configuration';
import * as deploy from '../src';

describe('deploy', () => {
  describe('DeployContext', () => {
    it('converts itself to a NomadContext and registers providers', async () => {
      const conf = config.getBuiltin('development');

      const ctx = new deploy.DeployContext(conf);
      ctx.registerRpcProvider('rinkeby', 'http://dummyurl.com');

      const nomadCtx = ctx.asNomadContext;
      expect(nomadCtx.getConnection('rinkeby')).toBeDefined;
    });
  });
});
