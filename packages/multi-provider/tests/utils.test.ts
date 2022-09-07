import * as utils from '../src/utils';
import { hexlify } from '@ethersproject/bytes';
import { MultiProvider } from '../src/provider';

describe('multi-provider utils', () => {
  const tooLong = new Uint8Array(Array(33).fill(1));
  const badLen = new Uint8Array(Array(15).fill(1));
  const address = new Uint8Array(Array(20).fill(1));
  const bytes32 = new Uint8Array(Array(32).fill(1));
  const paddedAddress = new Uint8Array([
    ...Array(12).fill(0),
    ...Array(20).fill(1),
  ]);

  it('domain for given chain ID', () => {
    const domain = utils.chainIdToDomain(1);
    expect(domain).toEqual(6648936);
    expect(() => utils.chainIdToDomain(0)).toThrow();
  });

  it('gets hex domain from string', () => {
    const ethHex = utils.getHexDomainFromString('eth');
    expect(ethHex).toEqual('0x657468');
    const moonbeamHex = utils.getHexDomainFromString('beam');
    expect(moonbeamHex).toEqual('0x6265616d');
  });

  it('converts to a 32-byte cannonized ID', () => {
    const cannonizedAddress = utils.canonizeId(address);
    expect(cannonizedAddress.toString()).toEqual(paddedAddress.toString());
    const cannonizedBytes32 = utils.canonizeId(bytes32);
    expect(cannonizedBytes32.toString()).toEqual(bytes32.toString());
    expect(() => utils.canonizeId(tooLong)).toThrow('Too long');
    expect(() => utils.canonizeId(badLen)).toThrow(
      'bad input, expect address or bytes32',
    );
  });

  it('converts Nomad Id to evm address', () => {
    expect(() => utils.evmId(badLen)).toThrow(
      'Invalid id length. expected 20 or 32. Got 15',
    );
    let evmId = utils.evmId(bytes32);
    expect(evmId).toEqual(hexlify(address));
    expect(evmId.length).toEqual(42);
    evmId = utils.evmId(paddedAddress);
    expect(evmId).toEqual(hexlify(address));
    expect(evmId.length).toEqual(42);
    evmId = utils.evmId(address);
    expect(evmId).toEqual(hexlify(address));
    expect(evmId.length).toEqual(42);
  });

  it('parses integer from decimal, string or hex', () => {
    const decimal = 5;
    const str = '5';
    const hex = '0x05';
    expect(utils.parseInt(decimal)).toEqual(5);
    expect(utils.parseInt(str)).toEqual(5);
    expect(utils.parseInt(hex)).toEqual(5);
  });

  it('throws Unreachable error', () => {
    function throwUnreachable() {
      throw new utils.UnreachableError('some error');
    }
    try {
      throwUnreachable();
    } catch(e) {
      expect(e.message).toContain('some error');
    }
  });

  it('throws NoProvider error', () => {
    const context = new MultiProvider();
    const name = 'rinkeby';
    const domain = 1000;
    context.registerDomain({ name, domain });
    function throwNoProvider(domain: string | number) {
      throw new utils.NoProviderError(context, domain);
    }
    try {
      throwNoProvider(name);
    } catch(e) {
      expect(e.message).toContain('Missing provider');
      expect(e.message).toContain(`${domain}`);
      expect(e.message).toContain(`${name}`);
    }
    try {
      throwNoProvider(domain);
    } catch(e) {
      expect(e.message).toContain('Missing provider');
      expect(e.message).toContain(`${domain}`);
      expect(e.message).toContain(`${name}`);
    }
  });

  it('compares ids accurately', () => {
    const padded = '0x' + '00'.repeat(12) + '11'.repeat(20);
    const non = '0x' + '11'.repeat(20);
    const notEqual = '0x' + '11'.repeat(19) + '01';
    expect(utils.equalIds(padded, non)).toBe(true);
    expect(utils.equalIds(padded, padded)).toBe(true);
    expect(utils.equalIds(non, non)).toBe(true);
    expect(utils.equalIds(non, notEqual)).toBe(false);
  });

  it('delays x milliseconds', async () => {
    const ms = 10;
    let task = false;
    utils.delay(ms).then(() => {
      task = true;
    });
    expect(task).toBe(false);
    setTimeout(() => {
      expect(task).toBe(true);
    }, ms);
  });
});
