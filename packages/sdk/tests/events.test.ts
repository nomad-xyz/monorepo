// import { before, describe, it } from 'mocha';
// import { expect } from 'chai';
// import { ethers } from 'hardhat';
// import { utils } from 'ethers';
// import { canonizeId } from '@nomad-xyz/multi-provider/dist/utils';
// import { NomadContext } from '@nomad-xyz/sdk';
// import * as config from '@nomad-xyz/configuration';

// const ENVIRONMENTS = ['test', 'development', 'staging', 'production'];

// describe('Nomad events', async () => {
//   let conf;
//   let context;

//   before(() => {
//     conf = config.getBuiltin('development');
//     context = new NomadContext(conf);

//     // Register providers
//     const domains = conf.networks;
//     for (const domain of domains) {
//       context.registerRpcProvider(domain, 'http://dummy-rpc-url');
//     }
//   });

//   it('fetches transaction details', async () => {
//     const [bridgor] = await ethers.getSigners();
//     const bridgorAddress = await bridgor.getAddress();
//     const bridgorId = utils.hexlify(canonizeId(bridgorAddress));
//     const testTokenId = {
//       domain: 2000,
//       id: '0x' + '11'.repeat(32),
//     };

//     const payload = {
//       isNative: false,
//       originNetwork: 'rinkeby',
//       destNetwork: 'kovan',
//       asset: testTokenId,
//       amnt: utils.parseUnits('0.1', 18),
//       recipient: bridgorId,
//     };
//     const tx = await context.send(payload);
//     expect(tx).to.be.undefined;
//   });
// });
