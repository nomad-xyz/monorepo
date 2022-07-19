import { describe, it } from "mocha";
import { expect } from "chai";
import { GovernanceContext } from '../src/index';
import { GovernanceConfig, Proposal } from '../src/types';
import { ethers } from "ethers";

// example governanceConfig
export const governanceConfig: GovernanceConfig = {
  governor: '0x' + 'aa'.repeat(20),
  modules: {
    1001: '0x' + 'bb'.repeat(20),
    3001: '0x' + 'cc'.repeat(20),
    4001: '0x' + 'dd'.repeat(20),
    5001: '0x' + 'ee'.repeat(20),
    // 6661: '0x00',
  },
};

const proposal: Proposal = {
  module: {
    domain: 1001,
    address: '0x' + '11'.repeat(20),
  },
  calls: {
    to: '0x' + '22'.repeat(20),
    value: 1,
    data: '0x' + '33'.repeat(20),
    operation: 0,
  },
};

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

  it("constructs proposal", async () => {
    const encoded = await context.encodeProposalData(proposal);
    const { message } = encoded;
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['address', 'uint256', 'bytes', 'uint8'],
      message
    );
    expect(decoded[0]).to.equal(proposal.calls.to);
    expect(decoded[1].toNumber()).to.equal(proposal.calls.value);
    expect(decoded[2]).to.equal(proposal.calls.data);
    expect(decoded[3]).to.equal(proposal.calls.operation);
  });

  it("decodes proposal data", async () => {
    const proposalTx = '0x' + '11'.repeat(32);
  })
});
