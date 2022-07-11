import { GovernanceContext } from './index';
import { NomadContext } from '@nomad-xyz/sdk';
import { governanceConfig, Proposal } from './types';

export const initContext = async (): Promise<undefined> => {
  const nomadContext = await NomadContext.fetch('development', true);
  const context = GovernanceContext.fromNomadContext(nomadContext, governanceConfig);
  console.log(context);
  
  const proposal: Proposal = {
    module: {
      domain: 1001,
      address: '0x0000',
    },
    calls: {
      to: '0x0000',
      value: 1,
      data: '0x0000',
      operation: 0,
    },
  };
  
  const encoded = context.encodeProposalData(proposal);
  console.log(encoded);
  return;
};

initContext();
