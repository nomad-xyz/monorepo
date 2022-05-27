import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { BridgeToken__factory } from '@nomad-xyz/contract-interfaces/bridge';
import axios from 'axios';

// TODO: move to SDK
interface TokenDetails {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

async function getConfig(environment: string): Promise<any> {
  // TODO: remove fetching from github and pull from the configuration package instead
  const configUrl = `https://raw.githubusercontent.com/nomad-xyz/rust/b76315abcc5385987f3e71f75d40909dd24b95c3/configuration/configs/${environment}.json`;
  const res = await axios(configUrl);
  return await res.data;
}

// TODO: move to common file
async function getRpcProviderFromConfig(
  environment: string,
  network: string,
): Promise<ethers.providers.JsonRpcProvider> {
  const config = await getConfig(environment);
  let rpcUrl: string;
  try {
    rpcUrl = config.rpcs[network][0];
  } catch (e) {
    throw new Error(`No RPC url for network ${network}`);
  }
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}

async function getSigner(
  environment: string,
  network: string,
): Promise<ethers.Signer> {
  const privKey = process.env.SET_DETAILS_KEY!;
  const provider = await getRpcProviderFromConfig(environment, network);
  return new ethers.Wallet(privKey, provider);
}

async function getNetworkName(environment: string, domain: number) {
  const config = await getConfig(environment);
  const networkNames: number[] = config.networks;
  // TODO: improve logic here
  let lookup: {
    names: Record<string, string>;
    domains: Record<string, string>;
  } = {
    names: {},
    domains: {},
  };
  networkNames.forEach((element) => {
    const domain = config.protocol.networks[element].domain;
    lookup.names[element] = domain.toString();
    lookup.domains[domain] = element.toString();
  });
  return lookup.domains[domain];
}

async function setDetailsForToken(
  signer: ethers.Signer,
  details: TokenDetails,
) {
  const { address, name, symbol, decimals } = details;

  const token = BridgeToken__factory.connect(address, signer);

  console.log(`Calling set details on ${symbol} contract ${address}...`);
  const tx = await token.setDetails(name, symbol, decimals);

  console.log('Waiting for 3 confirmations...');
  await tx.wait(3);

  console.log('Successfully set details for token!');
  console.log(`- address: ${address}`);
  console.log(`- name: ${name}`);
  console.log(`- symbol: ${symbol}`);
  console.log(`- decimals: ${decimals}`);

  console.log(`\n Transaction hash: ${tx.hash}`);
}

/* Usage:
 * 1. set SET_DETAILS_KEY in .env file (as well as RPC urls)
 * 2. yarn run set-details <environment>
 */
(async () => {
  dotenv.config({ path: process.env.CONFIG_PATH ?? '.env' });

  const args = process.argv.slice(2);
  const environment = args[0];

  // The indexer doesn't use the same name as the environment, so we need to map to the indexer url environment string
  const envMap: Record<string, string> = {
    development: 'dev',
    staging: 'staging',
    production: 'prod',
  };

  const url = `https://bridge-indexer.${envMap[environment]}.madlads.tools/wrongReplicas`;
  const res = await axios(url);
  const wrongReplicas = res.data as any[];

  for (let replica of wrongReplicas) {
    const domain = replica.domain;
    const networkName = await getNetworkName(environment, domain);
    const signer = await getSigner(environment, networkName);
    const details = {
      address: replica.id,
      name: replica.token.name,
      symbol: replica.token.symbol,
      decimals: replica.token.decimals,
    };
    console.log(
      `Setting details for ${replica.token['name']} on ${networkName}`,
    );
    await setDetailsForToken(signer, details);
  }
})();
