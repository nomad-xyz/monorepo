import { verifyProxy } from './verifyProxy';

import {
  getPathToDeployConfig,
  getPathToBridgeConfig,
  getVerificationInputFromDeploy,
} from './readDeployOutput';

const envError = (network: string) =>
  `pass --network tag to hardhat task (current network=${network})`;

// list of networks supported by Etherscan
const etherscanNetworks = [
  'mainnet',
  'ethereum',
  'kovan',
  'goerli',
  'ropsten',
  'rinkeby',
  'polygon',
];

/*
 * Generate link to Etherscan for an address on the given network
 * */
function etherscanLink(network: string, address: string) {
  if (network === 'polygon') {
    return `https://polygonscan.com/address/${address}`;
  }

  const prefix =
    network === 'mainnet' || network === 'ethereum' ? '' : `${network}.`;

  return `https://${prefix}etherscan.io/address/${address}`;
}

/*
 * Parse the contract verification inputs
 * that were output by the latest contract deploy
 * for the network that hardhat is configured to
 * and attempt to verify those contracts' source code on Etherscan
 * */
export async function verifyBridgeDeploy(
  hre: any,
  etherscanKey: string,
  environment: string,
) {
  const path = getPathToBridgeConfig(environment);
  return verifyDeploy(path, etherscanKey, hre);
}

/*
 * Parse the contract verification inputs
 * that were output by the latest contract deploy
 * for the network that hardhat is configured to
 * and attempt to verify those contracts' source code on Etherscan
 * */
export async function verifyCoreDeploy(
  hre: any,
  etherscanKey: string,
  environment: string,
) {
  const path = getPathToDeployConfig(environment);
  return verifyDeploy(path, etherscanKey, hre);
}

/*
 * Parse the contract verification inputs
 * that were output by the given contract deploy
 * for the network that hardhat is configured to
 * and attempt to verify those contracts' source code on Etherscan
 * */
async function verifyDeploy(path: string, etherscanKey: string, hre: any) {
  let network = hre.network.name;

  if (network === 'mainnet') {
    network = 'ethereum';
  }

  // assert that network from .env is supported by Etherscan
  if (!etherscanNetworks.includes(network)) {
    throw new Error(`Network not supported by Etherscan; ${envError(network)}`);
  }
  console.log(`VERIFY ${network}`);

  // get the JSON verification inputs for the given network
  // from the latest contract deploy; throw if not found
  const verificationInputs = getVerificationInputFromDeploy(path, network);

  // loop through each verification input for each contract in the file
  for (const verificationInput of verificationInputs) {
    // attempt to verify contract on etherscan
    // (await one-by-one so that Etherscan doesn't rate limit)
    await verifySingleDeploy(network, etherscanKey, verificationInput, hre);
  }
}

/*
 * Given one contract verification input,
 * attempt to verify the contracts' source code on Etherscan
 * */
async function verifySingleDeploy(
  network: string,
  etherscanKey: string,
  verificationInput: any,
  hre: any,
) {
  const { name, address, constructorArguments, isProxy } = verificationInput;
  try {
    console.log(
      `   Attempt to verify ${name}   -  ${etherscanLink(network, address)}`,
    );
    await hre.run('verify:verify', {
      network,
      address,
      constructorArguments,
    });
    console.log(`   SUCCESS verifying ${name}`);

    if (isProxy) {
      console.log(`   Attempt to verify as proxy`);
      await verifyProxy(network, address, etherscanKey);
      console.log(`   SUCCESS submitting proxy verification`);
    }
  } catch (e) {
    console.log(`   ERROR verifying ${name}`);
    console.error(e);
  }
  console.log('\n\n'); // add space after each attempt
}
