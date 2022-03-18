import { describe, it } from 'mocha';
import * as utils from '../src/utils';
import { hexlify } from '@ethersproject/bytes';

import { expect } from 'chai';
// import { MultiProvider, Contracts } from '@nomad-xyz/multi-provider';
// import { ethers } from 'ethers';

describe('multi-provider utils', async () => {
  const tooLong = new Uint8Array(Array(33).fill(1));
  const badLen = new Uint8Array(Array(15).fill(1));
  const address = new Uint8Array(Array(20).fill(1));
  const bytes32 = new Uint8Array(Array(32).fill(1));
  const paddedAddress = new Uint8Array([...Array(12).fill(0), ...Array(20).fill(1)]);

  it('domain for given chain ID', () => {
    const domain = utils.chainIdToDomain(1);
    expect(domain).to.equal(6648936);
    expect(() => utils.chainIdToDomain(0)).to.throw();
  });

  it('gets hex domain from string', () => {
    const ethHex = utils.getHexDomainFromString('eth');
    expect(ethHex).to.equal('0x657468');
    const moonbeamHex = utils.getHexDomainFromString('beam');
    expect(moonbeamHex).to.equal('0x6265616d');
  });

  it('converts to a 32-byte cannonized ID', () => {
    const cannonizedAddress = utils.canonizeId(address);
    expect(cannonizedAddress.toString()).to.equal(paddedAddress.toString());
    const cannonizedBytes32 = utils.canonizeId(bytes32);
    expect(cannonizedBytes32.toString()).to.equal(bytes32.toString());
    expect(() => utils.canonizeId(tooLong)).to.throw('Too long');
    expect(() => utils.canonizeId(badLen)).to.throw('bad input, expect address or bytes32');
  });

  it('converts Nomad Id to emv address', () => {
    expect(() => utils.evmId(badLen)).to.throw('Invalid id length. expected 20 or 32. Got 15');
    let evmId = utils.evmId(bytes32);
    expect(evmId).to.equal(hexlify(address));
    expect(evmId.length).to.equal(42);
    evmId = utils.evmId(paddedAddress);
    expect(evmId).to.equal(hexlify(address));
    expect(evmId.length).to.equal(42);
    evmId = utils.evmId(address);
    expect(evmId).to.equal(hexlify(address));
    expect(evmId.length).to.equal(42);
  });

  it('delays x milliseconds', async () => {
    // TODO:
  });
});
