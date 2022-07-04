import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import { NomadConfig } from '@nomad-xyz/configuration';
import fs from 'fs';
import { ethers } from 'ethers';
import axios from 'axios';

export async function getSdk(
  environment: string | NomadConfig,
): Promise<BridgeContext> {
  let sdk: BridgeContext;
  if (typeof environment === 'string') {
    if (['production', 'staging', 'development'].includes(environment)) {
      sdk = new BridgeContext(environment);
    } else if (environment.includes('https')) {
      const response = await axios.get(environment, { responseType: 'json' });
      const config = response.data as NomadConfig;
      sdk = new BridgeContext(config);
    } else if (fs.existsSync(environment)) {
      let configOverride: NomadConfig | undefined = undefined;

      try {
        configOverride = JSON.parse(fs.readFileSync(environment, 'utf8'));
      } catch (e) {
        throw new Error(`Couldn't read NomadConfig's location: ${environment}`);
      }

      sdk = new BridgeContext(configOverride);
    } else {
      throw new Error(
        `Didn't understand what environment means: ${environment}`,
      );
    }
  } else {
    sdk = new BridgeContext(environment);
  }

  sdk.domainNumbers.forEach((domain: number) => {
    const name = sdk
      .mustGetDomain(domain)
      .name.toUpperCase()
      .replaceAll('-', '_');
    const rpcEnvKey = `${name}_RPC`;
    const defaultRPC = sdk.conf.rpcs[name]?.[0];
    const rpc = process.env[rpcEnvKey] || defaultRPC;

    if (!rpc)
      throw new Error(
        `RPC url for domain ${domain} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`,
      );

    if (rpc.includes(',')) {
      const rpcs = rpc.split(',');
      const providers = rpcs.map(
        (rpc) => new ethers.providers.StaticJsonRpcProvider(rpc),
      );
      const provider = new ethers.providers.FallbackProvider(providers, 1);
      sdk.registerProvider(domain, provider);
    } else {
      sdk.registerRpcProvider(domain, rpc);
    }
  });

  return sdk;
}
