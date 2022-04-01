import { before, describe, it } from 'mocha';

import { expect } from 'chai';
import { MultiProvider, Contracts } from '@nomad-xyz/multi-provider';
import { ethers } from 'ethers';

interface Domain {
  name: string;
  domain: number;
}

describe('multi-provider', async () => {
  let mp;
  const chainADomain: Domain = {
    name: 'a',
    domain: 1000,
  };
  const chainBDomain: Domain = {
    name: 'b',
    domain: 2000,
  };
  const testProvider = new ethers.providers.JsonRpcProvider(
    'http://localhost:8545',
  );
  const testSigner = testProvider.getSigner();

  // register A and B domains
  before('registers domains', () => {
    mp = new MultiProvider<Domain>();
    mp.registerDomain(chainADomain);
    mp.registerDomain(chainBDomain);
  });

  it('returns an array of domains', () => {
    const values = mp.registeredDomains;
    expect(values).to.include(chainADomain);
    expect(values).to.include(chainBDomain);
  });

  it('returns array of domain numbers', () => {
    const numbers = mp.domainNumbers;
    expect(numbers).to.include(chainADomain.domain);
    expect(numbers).to.include(chainBDomain.domain);
  });

  it('returns an array of domain names', () => {
    const names = mp.domainNames;
    expect(names).to.include(chainADomain.name);
    expect(names).to.include(chainBDomain.name);
  });

  it('returns an array of missing providers', () => {
    const missing = mp.missingProviders;
    const aRegistered = mp.providers.has('a');
    const bRegistered = mp.providers.has('b');
    expect(aRegistered).to.be.false;
    expect(bRegistered).to.be.false;
    expect(missing).to.include(chainADomain.name);
    expect(missing).to.include(chainBDomain.name);
  });

  it('returns domain for given nameOrDomain', () => {
    const domainFromName = mp.resolveDomain(chainADomain.name);
    const domainFromDomain = mp.resolveDomain(chainADomain.domain);
    expect(domainFromName).to.equal(domainFromDomain).to.equal(1000);
  });

  it('returns name for given nameOrDomain', () => {
    const nameFromName = mp.resolveDomainName(chainADomain.name);
    const nameFromDomain = mp.resolveDomainName(chainADomain.domain);
    expect(nameFromName).to.equal(nameFromDomain).to.equal('a');
  });

  it('resolveDomainName errors if domain is not found', () => {
    expect(() => mp.resolveDomainName(4000)).to.throw();
    expect(() => mp.resolveDomainName('hi')).to.throw();
  })

  it('returns whether a given domain is registered', () => {
    const known = mp.knownDomain('a');
    const unknown = mp.knownDomain('c');
    expect(known).to.be.true;
    expect(unknown).to.be.false;
  });

  it('fetches a domain, given a name or domain ID', () => {
    const domainA = mp.getDomain('a');
    const domainB = mp.getDomain(2000);
    expect(domainA).to.equal(chainADomain);
    expect(domainB).to.equal(chainBDomain);
  });

  it('mustGetDomain errors if a given domain is not registered', () => {
    const domainA = mp.mustGetDomain('a');
    expect(domainA).to.equal(chainADomain);
    const domainB = mp.mustGetDomain(2000);
    expect(domainB).to.equal(chainBDomain);

    expect(() => mp.mustGetDomain('c')).to.throw();
  });

  // it('registerSigner errors if no provider', () => {
  //   const err = 'Must have a provider before registering signer';
  //   // expect(() => mp.registerSigner('a', new ethers.Signer)).to.throw(err);
  // });

  // register A and B providers
  it('registers provider', async () => {
    // provider
    expect(mp.providers.has('a')).to.be.false;
    const provider = await ethers.getDefaultProvider();
    mp.registerProvider('a', provider);
    expect(mp.providers.has('a')).to.be.true;
    // rpc provider
    expect(mp.providers.has('b')).to.be.false;
    const rpcProvider = 'http://someProvider';
    mp.registerRpcProvider('b', rpcProvider);
    expect(mp.providers.has('b')).to.be.true;
  });

  it('gets registered provider', () => {
    const providerA = mp.getProvider('a');
    const providerB = mp.getProvider(2000);
    expect(providerA).to.not.be.undefined;
    expect(providerB).to.not.be.undefined;
    try {
      mp.getProvider('c');
      expect(false, 'Error expected').to.be.true;
    } catch (_) {
      _;
    }
  });

  it('mustGetProvider errors if provider is not registered for given nameOrDomain', () => {
    const providerA = mp.mustGetProvider('a');
    const providerB = mp.mustGetProvider(2000);
    expect(providerA).to.not.be.undefined;
    expect(providerB).to.not.be.undefined;
    expect(() => mp.mustGetProvider('c')).to.throw();
  });

  // register A and B signers
  it('registers signer', () => {
    expect(mp.signers.has('a')).to.be.false;
    mp.registerSigner('a', testSigner);
    expect(mp.signers.has('a')).to.be.true;

    expect(mp.signers.has('b')).to.be.false;
    mp.registerSigner('b', testSigner);
    expect(mp.signers.has('b')).to.be.true;
  });

  it('gets signers', () => {
    const signerA = mp.getSigner('a');
    const signerB = mp.getSigner(2000);
    expect(signerA).to.not.be.undefined;
    expect(signerB).to.not.be.undefined;
    try {
      mp.getSigner('c');
      expect(false, 'Error expected').to.be.true;
    } catch (_) {
      _;
    }
  });

  it('gets connection', () => {
    const connectionA = mp.getConnection('a');
    expect(connectionA).to.equal(testSigner);
  });

  // unregisters B signer
  it('unregisters signer', () => {
    expect(mp.signers.has('b')).to.be.true;
    mp.unregisterSigner('b');
    expect(mp.signers.has('b')).to.be.false;
  });

  it('gets connection', () => {
    const connectionA = mp.getConnection('a');
    expect(connectionA).to.equal(testSigner);

    // TODO: should return provider?
    // const connectionB = mp.getConnection('b');
    // expect(connectionB).to.equal(testSigner);
  });

  it('gets signer address', async () => {
    // TODO:
    // const addressA = await mp.getAddress('a');
    // const actualAddress = await testSigner.getAddress();
    // expect(addressA).to.equal(actualAddress);
  });

  it('mustGetSigner errors if signer is not registered for given nameOrDomain', () => {
    const signerA = mp.mustGetSigner('a');
    expect(signerA).to.not.be.undefined;

    expect(() => mp.mustGetSigner('b')).to.throw();
  });

  it('clears all signers', () => {
    expect(mp.signers.size).to.be.greaterThan(0);
    mp.clearSigners();
    expect(mp.signers.size).to.equal(0);
  });

  it('registers Wallet Signer', () => {
    // TODO:
  });

  it('instantiates Contracts class with appropriate args', () => {
    class SomeContracts extends Contracts {
      readonly domain: number;
      readonly name: string;
    
      constructor(
        domain: number,
        name: string,
      ) {
        super(domain, name);
        this.domain = domain;
        this.name = name;
      }
      connect(): void {
        return
      }
    }
    const newContracts = new SomeContracts(2000, 'someChain');
    expect(newContracts.args[0]).to.equal(2000);
    expect(newContracts.args[1]).to.equal('someChain');
  });

  // it('resolveDomainName errors i')
});
