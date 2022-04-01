import { before, describe, it } from 'mocha';
import { expect } from 'chai';


import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import * as config from '@nomad-xyz/configuration';

import { NomadContext } from '@nomad-xyz/sdk';

const ENVIRONMENTS = ['test', 'development', 'staging', 'production'];


describe('sdk-bridge', async () => {
  describe('BridgeContext', () => {
    it('Is properly instantiated from a NomadConfig and then NomadContext', async () => {
      for (const env of ENVIRONMENTS) {
        const conf = config.getBuiltin(env);
        const nomadContext = new NomadContext(conf);
        const context = BridgeContext.fromNomadContext(nomadContext);
        const domains = conf.networks;

        // Register providers and test bridgeRouter, tokenRegistry and ethHelper
        for (const domain of domains) {
          context.registerRpcProvider(domain, 'http://dummy-rpc-url');

          const bridge = context.getBridge(domain);
          const confBridge = conf.bridge[domain];

          expect(bridge.bridgeRouter.address).to.equal(
            confBridge.bridgeRouter.proxy,
          );
          expect(bridge.tokenRegistry.address).to.equal(
            confBridge.tokenRegistry.proxy,
          );
          expect(bridge.ethHelper.address).to.equal(confBridge.ethHelper);
        }
      }
    });
  });

  describe('Nomad events', async () => {
    let conf;
    let context;

    before(() => {
      conf = config.getBuiltin('development');
      context = new BridgeContext(conf);

      // Register providers
      const domains = conf.networks;
      for (const domain of domains) {
        context.registerRpcProvider(domain, 'http://dummy-rpc-url');
      }
    });

    // TODO:
    // it('sends bridge transaction', async () => {
    //   const [bridgor] = await ethers.getSigners();
    //   const bridgorAddress = await bridgor.getAddress();
    //   const bridgorId = utils.hexlify(canonizeId(bridgorAddress));
    //   const testTokenId = {
    //     domain: 'rinkeby',
    //     id: '0x' + '11'.repeat(32),
    //   };

    //   const tx = await context.send(
    //     'rinkeby',
    //     'kovan',
    //     testTokenId,
    //     utils.parseUnits('0.1', 18),
    //     bridgorId,
    //   );
    //   expect(tx).to.be.undefined;
    // });
  });
});
