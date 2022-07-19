import { NomadContext, NomadMessage } from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';
import { utils } from '@nomad-xyz/multi-provider'
import { ethers } from 'ethers';
import { Address, Domain, GovernanceConfig, Proposal, CallData } from './types';
import NomadModule from './abis/NomadModule.json';
const { abi: NomadModuleABI } = NomadModule;

export const EXEC_CALL_TYPES = ['address', 'uint256', 'bytes', 'uint8']

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
      for (const domain in govConfig.modules) {
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

  enrollGovConfig(govConfig: GovernanceConfig) {
    this.govModules = new Map();
    if (govConfig) {
      this.governorModule = govConfig.governor;
      for (const domain in govConfig.modules) {
        const domainName = this.resolveDomainName(Number.parseInt(domain));
        this.govModules.set(domainName, govConfig.modules[domain]);
      }
    }
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

  async encodeProposalData(proposal: Proposal): Promise<CallData> {
    // TODO: pass in props
    const origin = 'goerli';
    const domain = this.resolveDomain(proposal.module.domain);

    // destructure call data
    const { to, value, data, operation } = proposal.calls;
    // encode into message
    const message = ethers.utils.defaultAbiCoder.encode(
      EXEC_CALL_TYPES,
      [to, value, data, operation]
    )

    // get home contract and construct dispatch transaction
    const { home } = this.mustGetCore(origin);
    const toAddress = utils.canonizeId(proposal.module.address)
    const dispatchTx = await home.populateTransaction.dispatch(domain, toAddress, message);
    return {
      to: home, // Nomad Home contract 
      data: dispatchTx, // dispatch
      message, // encoded function data for Gnosis module
    };
  }

  async decodeProposalData(domain: Domain, tx: string): Promise<Proposal[]> {
    const messages = await NomadMessage.baseFromTransactionHash(this, domain, tx);
    let proposals: Proposal[] = []
    for (const message of messages) {
      const { dispatch } = message;
      try {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ['address', 'uint256', 'bytes', 'uint8'],
          dispatch.event.args.message
        );
        const proposal: Proposal = {
          module: {
            domain: message.origin,
            address: message.sender,
          },
          calls: {
            to: decoded[0],
            value: decoded[1].toNumber(),
            data: decoded[2],
            operation: decoded[3],
          }
        }
        proposals.push(proposal);
      } catch(e) {
        console.log(e)
      }
    }
    return proposals;
  }
}

