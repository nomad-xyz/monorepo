import { BridgeContext } from '../src';
import * as config from '@nomad-xyz/configuration';

import { NomadContext } from '@nomad-xyz/sdk';

const ENVIRONMENTS = ['development', 'production'];

describe('sdk-bridge', () => {
  describe('BridgeContext', () => {
    it('Is properly instantiated from a NomadConfig and then NomadContext', () => {
      for (const env of ENVIRONMENTS) {
        const conf = config.getBuiltin(env);
        const nomadContext = new NomadContext(conf);
        const context = BridgeContext.fromNomadContext(nomadContext);
        const domains = conf.networks;

        // Register providers and test bridgeRouter, tokenRegistry and ethHelper
        for (const domain of domains) {
          context.registerRpcProvider(domain, 'http://dummy-rpc-url');

          const bridge = context.getBridge(domain);
          const confBridge = conf.bridge[
            domain
          ] as config.EthereumBridgeDeploymentInfo;

          expect(bridge).toBeDefined();

          expect(bridge?.bridgeRouter.address).toEqual(
            confBridge.bridgeRouter.proxy,
          );
          expect(bridge?.tokenRegistry.address).toEqual(
            confBridge.tokenRegistry.proxy,
          );

          expect(bridge?.ethHelper).toBeDefined();
          expect(bridge?.ethHelper?.address).toEqual(confBridge.ethHelper);
        }
      }
    });
  });

  describe('Nomad events', () => {
    let conf;
    let context;

    beforeAll(() => {
      conf = config.getBuiltin('development');
      context = new BridgeContext(conf);

      // Register providers
      const domains = conf.networks;
      for (const domain of domains) {
        context.registerRpcProvider(domain, 'http://dummy-rpc-url');
      }
    });

    // TODO:
    it.skip('sends bridge transaction', () => {
      // const [bridgor] = await ethers.getSigners();
      // const bridgorAddress = await bridgor.getAddress();
      // const bridgorId = utils.hexlify(canonizeId(bridgorAddress));
      // const testTokenId = {
      //   domain: 'rinkeby',
      //   id: '0x' + '11'.repeat(32),
      // };
      // const tx = await context.send(
      //   'rinkeby',
      //   'kovan',
      //   testTokenId,
      //   utils.parseUnits('0.1', 18),
      //   bridgorId,
      // );
      // expect(tx).to.be.undefined;
    });
  });
});
