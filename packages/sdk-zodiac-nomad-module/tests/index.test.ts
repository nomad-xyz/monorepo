import { describe, it } from "mocha";
import { expect } from "chai";
import { GovernanceContext } from '../src/index';
import { governanceConfig, Proposal } from '../src/types';

export const initContext = async (): Promise<GovernanceContext> => {
  const context = await GovernanceContext.fetch<GovernanceContext>('development', true);
  context.enrollGovConfig(governanceConfig);
  // console.log(context);
  return context;
};

describe("sdk-govern", async () => {
  let context;
  before(async () => {
    context = await initContext();
    console.log(context)
  });

  it.skip("constructs proposal", async () => {
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
    
    const encoded = await context.encodeProposalData(proposal);
    console.log(encoded);
    expect(encoded).to.be.true;
  })
});
