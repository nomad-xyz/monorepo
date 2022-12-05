import { constants, getDefaultProvider, VoidSigner } from 'ethers';
import { NomadContext } from '../src/index';
import * as config from '@nomad-xyz/configuration';

const ENVIRONMENTS = ['development', 'production'];
const domainA = 1001;
const domainB = 1002;

describe('NomadContext', () => {
  // TODO: figure out a better unit test this
  // we should not fetch from a hosted url in our unit tests
  it.skip('fetches from hosted configs', async () => {
    for (const env of ENVIRONMENTS) {
      const context = await NomadContext.fetch(env, false);
      expect(context).toBeDefined();
    }
  });

  // TODO: figure out a better unit test this
  // we should not fetch from a hosted url in our unit tests
  it.skip('Is properly instantiated from a NomadConfig', async () => {
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
      expect(governor).toEqual(conf.protocol.governor);

      // Gets governor core
      const govCore = await context.governorCore();
      expect(context.resolveDomain(govCore.domain)).toEqual(
        conf.protocol.governor.domain,
      );

      // For each home domain, check core info
      for (const homeDomain of domains) {
        const homeConfCore = conf.core[
          homeDomain
        ] as config.EthereumCoreDeploymentInfo;
        const confNetwork = conf.protocol.networks[homeDomain];
        const core = context.mustGetCore(homeDomain);

        // Gets home
        expect(core.home.address).toEqual(homeConfCore.home.proxy);

        // Gets governance router
        expect(core.governanceRouter.address).toEqual(
          homeConfCore.governanceRouter.proxy,
        );

        // Gets xapp connection manager
        expect(core.xAppConnectionManager.address).toEqual(
          homeConfCore.xAppConnectionManager,
        );

        // Gets replicas for home domain
        for (const remoteDomain of confNetwork.connections) {
          const remoteConfCore = conf.core[
            remoteDomain
          ] as config.EthereumCoreDeploymentInfo;
          const replica = context.mustGetReplicaFor(homeDomain, remoteDomain);
          expect(replica.address).toEqual(
            remoteConfCore.replicas[homeDomain].proxy,
          );
        }

        // returns undefined if no replica exists
        expect(() => core.getReplica('none')).toThrow();
      }
    }
  });

  it.skip('fails if given bad rpc provider string', () => {
    // TODO
  });

  it('gets replica by name or domain', () => {
    const context = new NomadContext('development');
    context.registerRpcProvider(domainA, 'http://dummy-rpc-url');
    context.registerRpcProvider(domainB, 'http://dummy-rpc-url');
    const core = context.mustGetCore(domainA);
    const replica = core.getReplica(domainB);
    expect(replica).toBeDefined();
    const replicaFor = context.getReplicaFor(domainA, domainB);
    expect(replicaFor).toBeDefined();
  });

  it('maintains connection when registering and unregistering signers', () => {
    const conf = config.getBuiltin('development');
    const context = new NomadContext(conf);
    const signer = new VoidSigner(constants.AddressZero);
    const provider = getDefaultProvider();
    context.domainNames.forEach((domain) => {
      context.registerProvider(domain, provider);
    });
    context.registerSigner(domainA, signer);
    context.registerSigner(domainB, signer);
    context.unregisterSigner(domainA);
    expect(context.getConnection(domainA)).toBeDefined();
    context.clearSigners();
    expect(context.getConnection(domainA)).toBeDefined();
    expect(context.getConnection(domainB)).toBeDefined();
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
