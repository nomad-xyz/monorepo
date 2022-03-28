import { before, describe, it } from 'mocha';
import { expect } from 'chai';
import { constants, getDefaultProvider, VoidSigner } from 'ethers';
import { NomadContext, CoreContracts } from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';
import { LocalGovernor, RemoteGovernor } from '../dist/CoreContracts';
// import { setupTwo } from './testAgents';

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
    // it('fails if given bad rpc provider string', () => {

    // });

    it('maintains connection when registering and unregistering signers', () => {
      const conf = config.getBuiltin('development');
      const context = new NomadContext(conf);
      const signer = new VoidSigner(constants.AddressZero);
      const provider = getDefaultProvider()
      context.domainNames.forEach(domain => {
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

    it('maintains a list of Homes in failed state', () => {
      // const conf = config.getBuiltin('development');
      // const context = new NomadContext(conf);
      // expect(context.blacklist().size).to.equal(0);
      // const home = context.mustGetCore(3000).home;
      // const testHome = new TestHome(home);
      
      // import { ethers } from 'ethers';
      // import { Key, utils } from '../src';

      // import { setupTwo } from './common';
      // import { TokenIdentifier, FailedHomeError } from '@nomad-xyz/sdk/nomad';

      // TODO:
      // async function testSdkFailedHome() {
      //   let success = false;

      //   const { tom, jerry, tomActor, jerryActor, n } = await setupTwo();
      //   const nomadContext = n.multiprovider!;

      //   try {
      //     const address = new Key().toAddress();

      //     const tomHome = n.getCore(tom).home;
      //     if (!tomHome) throw new Error(`no home`);

      //     const replica = n.getCore(jerry).getReplica(tom.domain)!;
      //     if (!replica) throw new Error(`no replica`);

      //     await (
      //       await tomHome.dispatch(
      //         jerry.domain,
      //         ethers.utils.hexZeroPad(address, 32),
      //         Buffer.from(`01234567890123456789012345678`, 'utf8'),
      //       )
      //     ).wait();

      //     console.log(`Dispatched test transaction to tomHome`);

      //     const [committedRoot] = await tomHome.suggestUpdate();

      //     const updater = await n.getUpdater(tom);

      //     const fraudRoot =
      //       '0x8bae0a4ab4517a16816ef67120f0e3350d595e014158ba72c3626d8c66b67e53';

      //     const { signature: improperSignature } = await updater.signUpdate(
      //       committedRoot,
      //       fraudRoot,
      //     );

      //     // Submit fraud to tom home
      //     await (
      //       await tomHome.update(committedRoot, fraudRoot, improperSignature)
      //     ).wait();

      //     const state = await tomHome.state();
      //     if (state !== 2) {
      //       throw new Error('Tom home not failed after improper update!');
      //     }

      //     console.log(`Submitted fraud update to tom home!`);

      //     const token: TokenIdentifier = {
      //       domain: tom.domain,
      //       id: '0x111111',
      //     };

      //     // Try to send token through SDK and expect error after preflight check
      //     try {
      //       await nomadContext.send(
      //         tom.name,
      //         jerry.name,
      //         token,
      //         100,
      //         '0x222222222',
      //         false,
      //         {
      //           gasLimit: 10000000,
      //         },
      //       );
      //     } catch (e) {
      //       // Expect failed home error
      //       if (!(e instanceof FailedHomeError)) {
      //         throw new Error('Error was not of type FailedHomeError');
      //       }

      //       // Expect blacklist to be populated
      //       if (!nomadContext.blacklist().has(tom.domain)) {
      //         throw new Error('SDK did not black list he failed tom home!');
      //       }

      //       success = true;
      //       }
      //     } catch (e) {
      //       console.error(`Test failed:`, e);
      //     }

      //     // Teardown
      //     await n.end();

      //     await Promise.all([tom.down(), jerry.down()]);

      //     if (!success) process.exit(1);
      //   }

      //   (async () => {
      //     await testSdkFailedHome();
      //   })();
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
      const errMsg = 'No provider or signer. Call `connect` first.'

      // TODO: allow name or domain?
      expect(() => coreContracts.getReplica('kovan')).to.throw(errMsg);
      expect(() => coreContracts.home).to.throw(errMsg);
      expect(() => coreContracts.governanceRouter).to.throw(errMsg);
      expect(() => coreContracts.xAppConnectionManager).to.throw(errMsg);
    });

    it('gets governor and stores in class state', async () => {
      const provider = getDefaultProvider();
      coreContracts.connect(provider);

      const localGovernor: LocalGovernor = {
        location: 'local',
        identifier: conf.protocol.governor.id
      };
      const remoteGovernor: RemoteGovernor = {
        location: 'remote',
        domain: 2000
      }

      let governor = await coreContracts.governor();
      expect(governor).to.equal(localGovernor);

      // should retrieve from class state second time
      governor = await coreContracts.governor();
      expect(governor).to.equal(localGovernor);

      // gets governor from non-governor chain
      const nonGovCore = new CoreContracts('kovan', conf.core['kovan']);

      governor = await nonGovCore.governor();
      expect(governor).to.equal(remoteGovernor);
    });
  })
});
