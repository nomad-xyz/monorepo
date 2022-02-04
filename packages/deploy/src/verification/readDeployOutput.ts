import fs from 'fs';
import { ContractVerificationName } from '../deploy';

export const VALID_ENVIRONMENTS = ['dev', 'staging', 'prod'];

type ContractInput = {
  name: ContractVerificationName;
  address: string;
  constructorArguments: any[];
  isProxy?: boolean;
};
type VerificationInput = ContractInput[];

/*
 * @notice Get the list of networks included in the contract deploy at path
 * @param path relative path to core system deploy
 * @return list of networks deployed as strings
 * */
export function getNetworksFromDeploy(path: string): string[] {
  const targetFileSuffix = `_contracts.json`;

  const deployOutputFileNames = fs
    .readdirSync(path, { withFileTypes: true })
    .map((dirEntry: fs.Dirent) => dirEntry.name)
    .filter((fileName: string) => fileName.includes(targetFileSuffix));

  const chainNames: string[] = [];
  for (const deployOutputFileName of deployOutputFileNames) {
    const tokens: string[] = deployOutputFileName.split('_');
    const chainName: string = tokens[0];
    chainNames.push(chainName);
  }
  return chainNames;
}

/*
 * Get path to bridge config folder
 * based on environment
 * */
export function getPathToBridgeConfig(environment: string) {
  const configPath = getPathToDeployConfig(environment);
  return getPathToBridgeConfigFromCore(configPath);
}

/*
 * Get path to bridge config folder
 * based on core deploy path
 * */
export function getPathToBridgeConfigFromCore(coreConfigPath: string) {
  return `${coreConfigPath}/bridge`;
}

/*
 * Get path to *most recent* config folder
 * of Nomad core system deploys
 * */
export function getPathToDeployConfig(environment: string) {
  if (!isValidEnvironment) {
    throw new Error(
      `${environment} is not a valid environment. Please choose from ${JSON.stringify(
        VALID_ENVIRONMENTS,
        null,
        2,
      )}`,
    );
  }
  let folder;
  if (environment == 'staging') {
    folder = 'staging';
  } else if (environment == 'prod') {
    folder = 'mainnet';
  } else {
    folder = 'development';
  }
  return `../../rust/config/${folder}`;
}

export function isValidEnvironment(environment: string) {
  return VALID_ENVIRONMENTS.includes(environment);
}

/*
 * @notice
 * Given a path to a contract deploy config,
 * get the verification input file from that deploy
 * for the given network
 * Parse contents of file as JSON & return them
 * Throw if the file is not found
 * @param path relative path to deploy config folder ("../../rust/config/1625570709419")
 * @param network target network to parse ("alfajores", "kovan")
 * */
export function getVerificationInputFromDeploy(
  path: any,
  network: any,
): VerificationInput {
  return parseFileFromDeploy(path, network, 'verification');
}

/*
 * @notice Return the JSON-parsed file specified
 * for the contract deploy at path
 * for the network & filetype
 * Throw if the file is not found
 * @param path relative path to core system deploy
 * @param network target network to parse ("alfajores", "kovan"")
 * @param fileSuffix target file suffix to parse ("config", "contracts", "verification")
 * */
export function parseFileFromDeploy(
  path: string,
  network: string,
  fileSuffix: string,
): any {
  const targetFileName = `${network}_${fileSuffix}.json`;

  const file = fs
    .readdirSync(path, { withFileTypes: true })
    .find((dirEntry: fs.Dirent) => dirEntry.name == targetFileName);

  if (!file) {
    throw new Error(
      `No ${fileSuffix} files found for ${network} at ${path}/${targetFileName}`,
    );
  }

  const fileString: string = fs
    .readFileSync(`${path}/${targetFileName}`)
    .toString();

  return JSON.parse(fileString);
}
