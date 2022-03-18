import { describe, it } from 'mocha';

import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import * as config from '@nomad-xyz/configuration';

import { expect } from 'chai';
import { NomadContext } from '@nomad-xyz/sdk';

const ENVIRONMENTS = ['staging', 'production'];

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
});
