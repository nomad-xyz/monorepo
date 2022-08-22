import { MultiProvider, Contracts } from '@nomad-xyz/multi-provider';
import { ethers } from 'ethers';

interface Domain {
  name: string;
  domain: number;
}

describe('multi-provider', () => {
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
  beforeAll(() => {
    mp = new MultiProvider<Domain>();
    mp.registerDomain(chainADomain);
    mp.registerDomain(chainBDomain);
  });

  it('returns an array of domains', () => {
    const values = mp.registeredDomains;
    expect(values).toContainEqual(chainADomain);
    expect(values).toContainEqual(chainBDomain);
  });

  it('returns array of domain numbers', () => {
    const numbers = mp.domainNumbers;
    expect(numbers).toContain(chainADomain.domain);
    expect(numbers).toContain(chainBDomain.domain);
  });

  it('returns an array of domain names', () => {
    const names = mp.domainNames;
    expect(names).toContain(chainADomain.name);
    expect(names).toContain(chainBDomain.name);
  });

  it('returns an array of missing providers', () => {
    const missing = mp.missingProviders;
    const aRegistered = mp.providers.has('a');
    const bRegistered = mp.providers.has('b');
    expect(aRegistered).toEqual(false);
    expect(bRegistered).toEqual(false);
    expect(missing).toContain(chainADomain.name);
    expect(missing).toContain(chainBDomain.name);
  });

  it('returns domain for given nameOrDomain', () => {
    const domainFromName = mp.resolveDomain(chainADomain.name);
    const domainFromDomain = mp.resolveDomain(chainADomain.domain);
    expect(domainFromName).toEqual(domainFromDomain);
    expect(domainFromName).toEqual(1000);
    expect(domainFromDomain).toEqual(1000);
  });

  it('returns name for given nameOrDomain', () => {
    const nameFromName = mp.resolveDomainName(chainADomain.name);
    const nameFromDomain = mp.resolveDomainName(chainADomain.domain);
    expect(nameFromName).toEqual(nameFromDomain);
    expect(nameFromName).toEqual('a');
    expect(nameFromDomain).toEqual('a');
  });

  it('resolveDomainName errors if domain is not found', () => {
    expect(() => mp.resolveDomainName(4000)).toThrow();
    expect(() => mp.resolveDomainName('hi')).toThrow();
  });

  it('returns whether a given domain is registered', () => {
    const known = mp.knownDomain('a');
    const unknown = mp.knownDomain('c');
    expect(known).toEqual(true);
    expect(unknown).toEqual(false);
  });

  it('fetches a domain, given a name or domain ID', () => {
    const domainA = mp.getDomain('a');
    const domainB = mp.getDomain(2000);
    expect(domainA).toEqual(chainADomain);
    expect(domainB).toEqual(chainBDomain);
  });

  it('mustGetDomain errors if a given domain is not registered', () => {
    const domainA = mp.mustGetDomain('a');
    expect(domainA).toEqual(chainADomain);
    const domainB = mp.mustGetDomain(2000);
    expect(domainB).toEqual(chainBDomain);

    expect(() => mp.mustGetDomain('c')).toThrow();
  });

  it.skip('registerSigner errors if no provider', () => {
    // const err = 'Must have a provider before registering signer';
    // expect(() => mp.registerSigner('a', new ethers.Signer)).to.throw(err);
  });

  // register A and B providers
  it('registers provider', async () => {
    // provider
    expect(mp.providers.has('a')).toEqual(false);
    const provider = await ethers.getDefaultProvider();
    mp.registerProvider('a', provider);
    expect(mp.providers.has('a')).toEqual(true);
    // rpc provider
    expect(mp.providers.has('b')).toEqual(false);
    const rpcProvider = 'http://someProvider';
    mp.registerRpcProvider('b', rpcProvider);
    expect(mp.providers.has('b')).toEqual(true);
  });

  it('gets registered provider', () => {
    const providerA = mp.getProvider('a');
    const providerB = mp.getProvider(2000);
    expect(providerA).toBeDefined();
    expect(providerB).toBeDefined();
    try {
      expect(mp.getProvider('c'));
    } catch (e) {
      expect(e.message).toBe(
        'Attempted to access an unknown domain: c.\nHint: have you called `context.registerDomain(...)` yet?',
      );
    }
  });

  it('mustGetProvider errors if provider is not registered for given nameOrDomain', () => {
    const providerA = mp.mustGetProvider('a');
    const providerB = mp.mustGetProvider(2000);
    expect(providerA).toBeDefined();
    expect(providerB).toBeDefined();
    try {
      expect(mp.getProvider('c'));
    } catch (e) {
      expect(e.message).toBe(
        'Attempted to access an unknown domain: c.\nHint: have you called `context.registerDomain(...)` yet?',
      );
    }
  });

  // register A and B signers
  it('registers signer', () => {
    expect(mp.signers.has('a')).toEqual(false);
    mp.registerSigner('a', testSigner);
    expect(mp.signers.has('a')).toEqual(true);

    expect(mp.signers.has('b')).toEqual(false);
    mp.registerSigner('b', testSigner);
    expect(mp.signers.has('b')).toEqual(true);
  });

  it('gets signers', () => {
    const signerA = mp.getSigner('a');
    const signerB = mp.getSigner(2000);
    expect(signerA).toBeDefined();
    expect(signerB).toBeDefined();
    try {
      expect(mp.getProvider('c'));
    } catch (e) {
      expect(e.message).toBe(
        'Attempted to access an unknown domain: c.\nHint: have you called `context.registerDomain(...)` yet?',
      );
    }
  });

  it('gets connection', () => {
    const connectionA = mp.getConnection('a');
    expect(connectionA).toEqual(testSigner);
  });

  // unregisters B signer
  it('unregisters signer', () => {
    expect(mp.signers.has('b')).toEqual(true);
    mp.unregisterSigner('b');
    expect(mp.signers.has('b')).toEqual(false);
  });

  it.skip('gets connection', () => {
    const connectionA = mp.getConnection('a');
    expect(connectionA).toEqual(testSigner);

    // TODO: should return provider?
    // const connectionB = mp.getConnection('b');
    // expect(connectionB).to.equal(testSigner);
  });

  it.skip('gets signer address', () => {
    // TODO:
    // const addressA = await mp.getAddress('a');
    // const actualAddress = await testSigner.getAddress();
    // expect(addressA).to.equal(actualAddress);
  });

  it('mustGetSigner errors if signer is not registered for given nameOrDomain', () => {
    const signerA = mp.mustGetSigner('a');
    expect(signerA).toBeDefined();

    expect(() => mp.mustGetSigner('b')).toThrow();
  });

  it('clears all signers', () => {
    expect(mp.signers.size).toBeGreaterThan(0);
    mp.clearSigners();
    expect(mp.signers.size).toEqual(0);
  });

  it.skip('registers Wallet Signer', () => {
    // TODO:
  });

  it('instantiates Contracts class with appropriate args', () => {
    class SomeContracts extends Contracts<Domain, MultiProvider<Domain>> {
      readonly name: string;

      constructor(name: string, domain: number) {
        super(new MultiProvider(), name, domain);
        this.context.registerDomain({
          name: 'someChain',
          domain: 2000,
        });
      }
    }
    const newContracts = new SomeContracts('someChain', 2000);
    expect(newContracts.domain).toEqual('someChain');
    expect(newContracts.domainNumber).toEqual(2000);
    expect(newContracts.args[0]).toEqual(2000);
  });

  it.skip('TODO: resolveDomainName errors', () => {
    // TODO
  });
});
