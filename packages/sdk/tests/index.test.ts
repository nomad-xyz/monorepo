import { describe, it } from 'mocha';

import { expect } from 'chai';
import { NomadContext } from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';

const ENVIRONMENTS = ['test'];

describe('sdk', async () => {
  describe('NomadContext', () => {
    it('Is properly instantiated from a NomadConfig', async () => {
      for (const env of ENVIRONMENTS) {
        const conf = config.getBuiltin(env);
        const context = new NomadContext(conf);
        const domains = conf.networks;

        // Register providers
        for (const domain of domains) {
          const rpc = conf.rpcs[domain][0];
          context.registerRpcProvider(domain, rpc);
        }

        // Gets governor
        const governor = context.governor;
        expect(governor).to.equal(conf.protocol.governor);

        // For each home domain, check core info
        for (const homeDomain of domains) {
          const remoteDomains = domains.filter((d) => d != homeDomain);

          const confCore = conf.core[homeDomain];

          // Gets core
          const core = context.mustGetCore(homeDomain);
          expect(core.home.address).to.equal(confCore.home.proxy);

          // TODO: missing governance router proxy!
          // expect(core.governanceRouter.address).to.equal(
          //   confCore.governanceRouter.proxy,
          // );

          // Gets xapp connection manager
          expect(core.xAppConnectionManager.address).to.equal(
            confCore.xAppConnectionManager,
          );

          // Gets replicas for home domain
          for (const remoteDomain in remoteDomains) {
            const replica = context.getReplicaFor(homeDomain, remoteDomain);
            expect(typeof replica != 'undefined');
          }
        }
      }
    });
  });
});
