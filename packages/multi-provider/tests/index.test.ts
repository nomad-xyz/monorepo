import { MultiProvider, Contracts } from '../src';
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
  const signerAddr = '0x0123456789012345678901234567890123456789';
  const testSigner = new ethers.VoidSigner(signerAddr);

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

  it('returns an array of domain numbers or names', () => {
    const domains = [chainADomain, chainBDomain];
    domains.forEach(d => {
      expect(mp.domainNumbers).toContainEqual(d.domain);
      expect(mp.domainNames).toContainEqual(d.name);
    });
  });

  it('mustGetProvider throws if no provider', () => {
    expect(() => mp.mustGetProvider()).toThrow();
  });

  it('getConnection returns undefined if no connection', () => {
    expect(mp.getConnection(1000)).toBeUndefined();
  });

  it('mustGetConnection throws if no signer or provider', () => {
    expect(() => mp.mustGetConnection(1000)).toThrow();

    const context = new MultiProvider<Domain>();
    context.registerDomain(chainADomain);
    const { domain } = chainADomain;
    context.registerRpcProvider(domain, 'https://test');
    const provider = context.mustGetConnection(domain);
    expect(provider).toBeDefined();
  });

  it('returns an array of missing providers', () => {
    const missing = mp.missingProviders;
    const aRegistered = mp.providers.has('a');
    const bRegistered = mp.providers.has('b');
    expect(aRegistered).toEqual(false);
    expect(bRegistered).toEqual(false);
    expect(missing).toContainEqual(chainADomain.name);
    expect(missing).toContainEqual(chainBDomain.name);
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

  it('registerSigner errors if no provider', () => {
    expect(() => mp.registerSigner('a', testSigner)).toThrow();
    try {
      mp.registerSigner('a', testSigner);
    } catch(e) {
      expect(e.message).toContain('Missing provider');
    }
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

  // unregisters B signer
  it('unregisters signer', () => {
    expect(mp.signers.has('b')).toEqual(true);
    mp.unregisterSigner('b');
    expect(mp.signers.has('b')).toEqual(false);
  });

  it('gets connection', () => {
    // get signer if provider and signer are registered
    expect(mp.signers.has('a')).toEqual(true);
    const connectionA = mp.getConnection('a');
    expect(connectionA).toBeDefined();
    expect(connectionA.address).toEqual(signerAddr);

    // gets provider if only provider is registered
    const connectionB = mp.getConnection('b');
    expect(connectionB).toBeDefined();
    expect(connectionB._isProvider).toBe(true);
  });

  it('gets signer address', async () => {
    const addressA = await mp.getAddress('a');
    const actualAddress = await testSigner.getAddress();
    expect(actualAddress).toEqual(addressA);
    expect(actualAddress).toEqual(signerAddr);
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

  it('registers Wallet Signer', () => {
    const privKey = '0x' + '11'.repeat(32);
    mp.registerWalletSigner(1000, privKey);
    expect(mp.getSigner(1000)).toBeDefined();
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

  it('resolveDomainName errors', () => {
    expect(() => mp.resolveDomainName(5000)).toThrow();
  });
});
