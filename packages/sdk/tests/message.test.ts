import { NomadContext, parseMessage } from '../src/index';
import * as config from '@nomad-xyz/configuration';

let conf: config.NomadConfig;
let context: NomadContext;

function to4ByteHex(num: number): string {
  const hex = num.toString(16);
  return '0'.repeat(8 - hex.length) + hex
}

describe('NomadMessage', () => {
  beforeAll(async () => {
    conf = await NomadContext.fetchConfig('staging');
    context = new NomadContext(conf);
  });

  it('parses message correctly', async () => {
    const originDomain = context.resolveDomain(conf.networks[0])
    const destinationDomain = context.resolveDomain(conf.networks[0])
    const messageBody =
      `0x${to4ByteHex(originDomain)}0000000000000000000000006d8acf60f3ddb6c49def2a2b77e56be2ff1502cf00005d65${to4ByteHex(destinationDomain)}00000000000000000000000094e10fc081653fda7fb6f3e52189fc58020359bb00000d030000000000000000000000000bb7509324ce409f7bbc4b701f932eaca9736ab7030000000000000000000000009791c9df02d34f2e7d7322d655535d9849e8da5c000000000000000000000000000000000000000000000000002386f26fc1000069144a56ecb1b88cd5fea4f45c41f8bc298716dbc612b16010ccf8d7f01ba0a3`;
    const parsed = parseMessage(messageBody);
    expect(parsed.from).toEqual(originDomain);
    expect(parsed.destination).toEqual(destinationDomain);
    // TODO: test other fields
  });
});
