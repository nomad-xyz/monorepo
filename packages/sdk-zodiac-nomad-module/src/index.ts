import { NomadContext } from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';
import { utils, ethers } from 'ethers'
import { Address, Domain, GovernanceConfig, Proposal } from './types'
import NomadModule from './abis/NomadModule.json';
const { abi: NomadModuleABI } = NomadModule;

// type Address = string;
// type Domain = string | number;

/**
 * The GovernanceContext manages connections to Nomad Governance contracts.
 * It inherits from the {@link MultiProvider} and {@link NomadContext} and
 * ensures that its contracts always use the latest registered providers and
 * signers.
 */
export class GovernanceContext extends NomadContext {
  // private bridges: Map<string, BridgeContracts>;
  private governorModule: Address | undefined;
  private govModules: Map<string, Address>;

  constructor(environment: string | config.NomadConfig = 'development', govConfig?: GovernanceConfig ) {
    super(environment);

    this.govModules = new Map();
    if (govConfig) {
      this.governorModule = govConfig.governor;
      for (var domain in govConfig.modules) {
        const domainName = this.resolveDomainName(domain);
        this.govModules.set(domainName, govConfig.modules[domain]);
      }
    }
  }

  static fromNomadContext(nomadContext: NomadContext, govConfig?: GovernanceConfig): GovernanceContext {
    const context = new GovernanceContext(nomadContext.conf, govConfig);

    for (const domain of context.domainNumbers) {
      const provider = context.getProvider(domain);
      if (provider) context.registerProvider(domain, provider);

      const signer = context.getSigner(domain);
      if (signer) context.registerSigner(domain, signer);
    }

    return context;
  }

  get governorMod(): Address | undefined {
    return this.governorModule;
  }

  /**
   * Get the governance module address for a given domain (or undefined)
   *
   * @param nameOrDomain A domain name or number.
   * @returns the module address (or undefined)
   */
  getGovModuleAddr(nameOrDomain: Domain): Address | undefined {
    const domain = this.resolveDomainName(nameOrDomain);
    return this.govModules.get(domain);
  }

  /**
   * Get the governance module address for a given domain (or undefined)
   *
   * @param nameOrDomain A domain name or number.
   * @returns the module address
   */
  mustGetGovModuleAddr(nameOrDomain: Domain): Address {
    const module = this.getGovModuleAddr(nameOrDomain);
    if (!module) {
      throw new Error(`Missing governance module for domain: ${nameOrDomain}`);
    }
    return module;
  }

  getGovModule(nameOrDomain: Domain): ethers.Contract {
    const addr = this.mustGetGovModuleAddr(nameOrDomain);
    return new ethers.Contract(addr, NomadModuleABI);
  }

  async encodeProposalData(proposal: Proposal): Promise<string> {
    // TODO: pass in props
    const origin = 'ethereum';
    const destination = 'moonbeam';
    const to: Address = '0x0000000000000000000000000000000000000000';
    const message = '0x1234';
    const value = 1;
    const module = this.getGovModule(destination);
    const operation = 0;
    const { home } = this.getCore(origin)!;
    const dispatchTx = await home.populateTransaction.dispatch(proposal.module.domain, proposal.module.address, message);
    const encodedDispatch = utils.serializeTransaction(dispatchTx);
    const execTx = await module.populateTransaction.exec(
      to,
      value,
      encodedDispatch,
      operation,
    );
    const encodedExec = utils.serializeTransaction(execTx);

    return encodedExec
  }

  decodeProposalData() {
    return
  }
}

