import * as config from "@nomad-xyz/configuration";
import { NomadContext } from "@nomad-xyz/sdk";
import { equalIds } from "@nomad-xyz/multi-provider/dist/utils";
import fs from "fs";

interface Implementations {
  home: string;
  replica: string;
  governanceRouter: string;

  tokenRegistry: string;

  bridgeRouter: string;
  bridgeToken: string;
}

function getConfig(path: string): config.NomadConfig {
  return getFromPath(path) as any as config.NomadConfig;
}

function getPathFromArgv(argIndex: number) {
  const args = process.argv.slice(2);
  const path = args[argIndex];
  return path;
}

function getFromPath(path: string) {
  try {
    return JSON.parse(fs.readFileSync(path).toString());
  } catch (e) {
    throw e;
  }
}

function storeConfig(config: config.NomadConfig, fileName: string) {
  fileName = fileName.replace(".json", "-new.json");
  fs.writeFileSync(fileName, JSON.stringify(config));
  console.log(`new config is saved at ${fileName}`);
}

function loadImplementations(domain: number): Implementations {
  return getFromPath(`./output/implementations-${domain}.json`);
}

async function run() {
  const path: string = getPathFromArgv(0);
  const config: config.NomadConfig = getConfig(path);
  for (let domainName of config.networks) {
    try {
      const domain = config.protocol.networks[domainName].domain;
      const newImpl: Implementations = loadImplementations(domain);
      config.core[domainName].home.implementation = newImpl.home;
      for (let replicaDomain of config.networks) {
        if (replicaDomain != domainName) {
          config.core[domainName].replicas[replicaDomain].implementation =
            newImpl.replica;
        }
      }
      config.core[domainName].governanceRouter.implementation =
        newImpl.governanceRouter;
      config.bridge[domainName].bridgeRouter.implementation =
        newImpl.bridgeRouter;
      config.bridge[domainName].tokenRegistry.implementation =
        newImpl.tokenRegistry;
      config.bridge[domainName].bridgeToken.implementation =
        newImpl.bridgeToken;
      storeConfig(config, path);
    } catch (error) {
      console.log(
        `updateConfig.ts encountered an error while updating domain: ${domainName}`
      );
      console.error(error);
    }
  }
}

run();
