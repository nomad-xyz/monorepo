import { before, describe, it } from 'mocha';
import { expect } from 'chai';
import { constants, getDefaultProvider, VoidSigner } from 'ethers';
import { NomadContext, CoreContracts } from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';
// import { LocalGovernor, RemoteGovernor } from '../dist/CoreContracts';

const ENVIRONMENTS = ['test', 'development', 'staging', 'production'];

describe('sdk', async () => {
  describe('NomadContext', () => {
    it('Is properly instantiated from a NomadConfig', async () => {
      for (const env of ENVIRONMENTS) {
        const conf = config.getBuiltin(env);
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
          const noReplica = core.getReplica('none');
          expect(noReplica).to.be.undefined;
        }
      }
    });

    it('errors if signer is registered without a provider', () => {
      const conf = config.getBuiltin('development');
      const context = new NomadContext(conf);
      const signer = new VoidSigner(constants.AddressZero);
      const err = 'Must have a provider before registering signer';
      expect(() => context.registerSigner(2000, signer)).to.throw(err);
    });

    // TODO:
    it.skip('fails if given bad rpc provider string');

    it('maintains connection when registering and unregistering signers', () => {
      const conf = config.getBuiltin('development');
      const context = new NomadContext(conf);
      const signer = new VoidSigner(constants.AddressZero);
      const provider = getDefaultProvider();
      context.domainNames.forEach((domain) => {
        context.registerProvider(domain, provider);
      });
      context.registerSigner(2000, signer);
      context.registerSigner(3000, signer);
      context.unregisterSigner(2000);
      expect(context.getConnection(2000)).to.not.be.undefined;
      context.clearSigners();
      expect(context.getConnection(2000)).to.not.be.undefined;
      expect(context.getConnection(3000)).to.not.be.undefined;
    });
  });

  describe('CoreContracts', () => {
    let conf: config.NomadConfig;
    let coreContracts: CoreContracts;

    before('instantiates contracts', () => {
      conf = config.getBuiltin('development');
      coreContracts = new CoreContracts('rinkeby', conf.core['rinkeby']);
    });
    it('errors if no provider or signer', () => {
      const errMsg = 'No provider or signer. Call `connect` first.';

      // TODO: allow name or domain?
      expect(() => coreContracts.getReplica('kovan')).to.throw(errMsg);
      expect(() => coreContracts.home).to.throw(errMsg);
      expect(() => coreContracts.governanceRouter).to.throw(errMsg);
      expect(() => coreContracts.xAppConnectionManager).to.throw(errMsg);
    });

    it.skip('gets governor and stores in class state', async () => {
      // TODO:
      // const provider = getDefaultProvider();
      // coreContracts.connect(provider);
      // const localGovernor: LocalGovernor = {
      //   location: 'local',
      //   identifier: conf.protocol.governor.id
      // };
      // const remoteGovernor: RemoteGovernor = {
      //   location: 'remote',
      //   domain: 2000
      // }
      // let governor = await coreContracts.governor();
      // expect(governor).to.equal(localGovernor);
      // // should retrieve from class state second time
      // governor = await coreContracts.governor();
      // expect(governor).to.equal(localGovernor);
      // // gets governor from non-governor chain
      // const nonGovCore = new CoreContracts('kovan', conf.core['kovan']);
      // governor = await nonGovCore.governor();
      // expect(governor).to.equal(remoteGovernor);
    });
  });
});
