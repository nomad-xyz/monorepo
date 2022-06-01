// import { BridgeContext } from '@nomad-xyz/multi-provider';
import { NomadConfig, getBuiltin } from '@nomad-xyz/configuration';
import fs from 'fs';
import { ethers } from 'ethers';
import axios from 'axios';
import { KeymasterConfig } from './config';

export async function getConfig(
  environment: string,
): Promise<NomadConfig> {
  let config: NomadConfig;
  if (['production', 'staging', 'development'].includes(environment)) {
        config = getBuiltin(environment);
    } else if (environment.includes('https')) {
      const response = await axios.get(environment, { responseType: 'json' });
      config = response.data as NomadConfig;
    } else if (fs.existsSync(environment)) {
      let configOverride: NomadConfig | undefined = undefined;

      try {
        configOverride = JSON.parse(fs.readFileSync(environment, 'utf8'));
      } catch (e) {
        throw new Error(`Couldn't read NomadConfig's location: ${environment}`);
      }

      if (!configOverride) throw new Error(`FIX THIS LINE No config!`);

      config = configOverride;
    } else {
      throw new Error(
        `Didn't understand what environment means: ${environment}`,
      );
    }
  
  return config;
}


export class Keymaster {
  keymasterConfig: KeymasterConfig;
  nomadConfig: NomadConfig;
  providers: Map<string, ethers.providers.Provider>;

  constructor(nomadConfig: NomadConfig, keymasterConfig: KeymasterConfig) {
    this.nomadConfig = nomadConfig;
    this.keymasterConfig = keymasterConfig;
    this.providers = new Map();
  }

  static async fromEnvName(c: string, keymasterConfig: KeymasterConfig) {
    const nomadConfig = await getConfig(c);
    const context = new Keymaster(nomadConfig, keymasterConfig);
    context.init();
    return context;
  }

  init(): Keymaster {
    this.nomadConfig.networks.forEach(network => {
      const name = network.toUpperCase().replaceAll('-', '_');
      const rpcEnvKey = `${name}_RPC`;
      const rpc = process.env[rpcEnvKey] || this.keymasterConfig.networks[network].endpoint;
      if (!rpc)
        throw new Error(
          `RPC url for network ${network} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`,
        );
  
        const provider = new ethers.providers.StaticJsonRpcProvider(rpc);
        this.providers.set(network, provider);
  
    })

    return this
  }

  getUpdaterAddress(network: string): string | undefined {
    return this.nomadConfig.protocol.networks[network].configuration.updater || this.keymasterConfig.networks[network].agents.updater;
  }

  getWatcherAddresses(network: string): string[] | undefined {
    return this.nomadConfig.protocol.networks[network].configuration.watchers || this.keymasterConfig.networks[network].agents.watchers;
  }

  getRelayerAddress(network: string): string | undefined {
    return this.keymasterConfig.networks[network].agents.relayer;
  }

  getProcessorAddress(network: string): string | undefined {
    return this.keymasterConfig.networks[network].agents.relayer;
  }

  getKathyAddress(network: string): string | undefined {
    return this.keymasterConfig.networks[network].agents.relayer;
  }

  getReplicas(network: string): string[] {
    return Object.keys(this.nomadConfig.core[network].replicas) || [];
  }

  get networks(): string[] {
    return this.nomadConfig.networks;
  }

  getProvider(network: string): ethers.providers.Provider {
    return this.providers.get(network)!
  }


  getBank(network: string): ethers.Signer {
    return new ethers.Wallet(this.keymasterConfig.networks[network].bank, this.getProvider(network));
  }


  async bankBalance(network: string): Promise<ethers.BigNumber> {
    const address = await this.getBank(network).getAddress();

    return await this.getProvider(network).getBalance(address);
  }

}