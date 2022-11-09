import { NomadContext, parseMessage } from '../src/index';
import * as config from '@nomad-xyz/configuration';

let conf: config.NomadConfig;
let context: NomadContext;

function to4ByteHex(num: number): string {
  const hex = num.toString(16);
  return '0'.repeat(8 - hex.length) + hex;
}

function toBytes32(address: string): string {
  return '0'.repeat(24) + address;
}

describe('NomadMessage', () => {
  beforeAll(async () => {
    conf = await NomadContext.fetchConfig('staging');
    context = new NomadContext(conf);
  });

  it('parses message correctly', async () => {
    // origin domain: 4 bytes
    // sender: 32 bytes
    // nonce: 4 bytes
    // destination domain: 4 bytes
    // recipient: 32 bytes
    // body: x bytes
    const originDomain = context.resolveDomain(conf.networks[0]);
    const destinationDomain = context.resolveDomain(conf.networks[0]);
    const sender = '11'.repeat(20);
    const nonce = '0'.repeat(7) + 1;
    const recipient = '22'.repeat(20);
    const body = '33'.repeat(4);
    const messageBody =
      `0x${to4ByteHex(originDomain)}${toBytes32(sender)}${nonce}${to4ByteHex(destinationDomain)}${toBytes32(recipient)}${body}`;
    const parsed = parseMessage(messageBody);
    expect(parsed.from).toEqual(originDomain);
    expect(parsed.destination).toEqual(destinationDomain);
    expect(parsed.sender).toEqual(`0x${toBytes32(sender)}`);
    expect(parsed.nonce).toEqual(1);
    expect(parsed.recipient).toEqual(`0x${toBytes32(recipient)}`);
    expect(parsed.body).toEqual(`0x${body}`);
  });
});
