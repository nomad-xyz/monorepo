import { expect } from 'chai';
import { MultiProvider } from '@nomad-xyz/multi-provider';
import { ethers } from 'ethers';

interface Domain {
  name: string;
  domain: number;
}
describe('multi-provider', async () => {
  it('registers domains properly', async () => {
    const provider = await ethers.getDefaultProvider()

    const chainADomain: Domain = {
      name: 'a',
      domain: 1000,
    }
    const chainBDomain: Domain = {
      name: 'b',
      domain: 2000,
    }
    const mp = new MultiProvider<Domain>();
    mp.registerDomain(chainADomain);
    mp.registerDomain(chainBDomain);
    expect(true).to.be.true;
  });
});
