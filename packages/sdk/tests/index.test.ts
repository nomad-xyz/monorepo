import { describe, it } from 'mocha';
import { expect } from 'chai';
import { constants, getDefaultProvider, VoidSigner } from 'ethers';
import { NomadContext } from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';

const ENVIRONMENTS = ['development', 'staging', 'production'];

describe('sdk', async () => {
  describe('NomadContext', () => {
    it('fetches from hosted configs', async () => {
      for (const env of ENVIRONMENTS) {
        const context = await NomadContext.fetch(env, false);
        expect(context).to.not.be.undefined;
      }
    });
    it('Is properly instantiated from a NomadConfig', async () => {
      for (const env of ENVIRONMENTS) {
        const conf = await NomadContext.fetchConfig(env);
        const context = new NomadContext(conf);
        const domains = conf.networks;

        // Register providers
        for (const domain of domains) {
          context.registerRpcProvider(domain, 'http://dummy-rpc-url');
        }

        // Gets governor
        const governor = context.governor;
        expect(governor).to.equal(conf.protocol.governor);

        // Gets governor core
        const govCore = await context.governorCore();
        expect(context.resolveDomain(govCore.domain)).to.equal(
          conf.protocol.governor.domain,
        );

        // For each home domain, check core info
        for (const homeDomain of domains) {
          const homeConfCore = conf.core[homeDomain];
          const confNetwork = conf.protocol.networks[homeDomain];
          const core = context.mustGetCore(homeDomain);

          // Gets home
          expect(core.home.address).to.equal(homeConfCore.home.proxy);

          // Gets governance router
          expect(core.governanceRouter.address).to.equal(
            homeConfCore.governanceRouter.proxy,
          );

          // Gets xapp connection manager
          expect(core.xAppConnectionManager.address).to.equal(
            homeConfCore.xAppConnectionManager,
          );

          // Gets replicas for home domain
          for (const remoteDomain of confNetwork.connections) {
            const remoteConfCore = conf.core[remoteDomain];
            const replica = context.mustGetReplicaFor(homeDomain, remoteDomain);
            expect(replica.address).to.equal(
              remoteConfCore.replicas[homeDomain].proxy,
            );
          }

          // returns undefined if no replica exists
          expect(() => core.getReplica('none')).to.throw;
        }
      }
    });

    // TODO:
    it.skip('fails if given bad rpc provider string');

    it('gets replica by name or domain', () => {
      const context = new NomadContext('development');
      context.registerRpcProvider(2001, 'http://dummy-rpc-url');
      context.registerRpcProvider(3001, 'http://dummy-rpc-url');
      const core = context.mustGetCore(2001);
      const replica = core.getReplica(3001);
      expect(replica).to.not.be.undefined;
      const replicaFor = context.getReplicaFor(2001, 3001);
      expect(replicaFor).to.not.be.undefined;
    });

    it('maintains connection when registering and unregistering signers', () => {
      const conf = config.getBuiltin('development');
      const context = new NomadContext(conf);
      const signer = new VoidSigner(constants.AddressZero);
      const provider = getDefaultProvider();
      context.domainNames.forEach((domain) => {
        context.registerProvider(domain, provider);
      });
      context.registerSigner(2001, signer);
      context.registerSigner(3001, signer);
      context.unregisterSigner(2001);
      expect(context.getConnection(2001)).to.not.be.undefined;
      context.clearSigners();
      expect(context.getConnection(2001)).to.not.be.undefined;
      expect(context.getConnection(3001)).to.not.be.undefined;
    });
  });

  // describe.skip('CoreContracts', () => {
  //   let conf: config.NomadConfig;
  //   let coreContracts: CoreContracts<NomadContext>;
  //   let context: NomadContext;

  //   before('instantiates contracts', () => {
  //     conf = config.getBuiltin('development');
  //     context = new NomadContext(conf);
  //     coreContracts = new CoreContracts(
  //       context,
  //       'rinkeby',
  //       conf.core['rinkeby'],
  //     );
  //   });

  //   it('gets governor and stores in class state', async () => {
  //     // TODO:
  //     const provider = getDefaultProvider();
  //     coreContracts.connect(provider);
  //     const localGovernor: LocalGovernor = {
  //       location: 'local',
  //       identifier: conf.protocol.governor.id
  //     };
  //     const remoteGovernor: RemoteGovernor = {
  //       location: 'remote',
  //       domain: 2000
  //     }
  //     let governor = await coreContracts.governor();
  //     expect(governor).to.equal(localGovernor);
  //     // should retrieve from class state second time
  //     governor = await coreContracts.governor();
  //     expect(governor).to.equal(localGovernor);
  //     // gets governor from non-governor chain
  //     const nonGovCore = new CoreContracts('kovan', conf.core['kovan']);
  //     governor = await nonGovCore.governor();
  //     expect(governor).to.equal(remoteGovernor);
  //   });
  // });
});
