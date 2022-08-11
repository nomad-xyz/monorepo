// import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { NomadContext, parseMessage } from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';

let conf: config.NomadConfig;
let context: NomadContext;

describe('NomadMessage', () => {
  before(async () => {
    conf = await NomadContext.fetchConfig('staging');
    context = new NomadContext(conf);
  });
  it('parses message correctly', async () => {
    const messageBody =
      '0x00000d030000000000000000000000006d8acf60f3ddb6c49def2a2b77e56be2ff1502cf00005d650000045700000000000000000000000094e10fc081653fda7fb6f3e52189fc58020359bb00000d030000000000000000000000000bb7509324ce409f7bbc4b701f932eaca9736ab7030000000000000000000000009791c9df02d34f2e7d7322d655535d9849e8da5c000000000000000000000000000000000000000000000000002386f26fc1000069144a56ecb1b88cd5fea4f45c41f8bc298716dbc612b16010ccf8d7f01ba0a3';
    const parsed = parseMessage(messageBody);
    expect(parsed.from).to.equal(context.resolveDomain('goerli'));
    expect(parsed.destination).to.equal(context.resolveDomain('rinkeby'));
    // TODO: test other fields
  });
});
