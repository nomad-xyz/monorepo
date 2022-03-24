import DeployContext from '../src/DeployContext';
// import * as sdk from '@nomad-xyz/sdk';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import fs from "fs";

// docker run -d -e "BLOCK_TIME=1000" -e "PRIVATE_KEY1=1000000000000000000000000000000000000000000000000000000000000001" -e "PRIVATE_KEY2=2000000000000000000000000000000000000000000000000000000000000002" -e "PRIVATE_KEY3=3000000000000000000000000000000000000000000000000000000000000003" -e "PRIVATE_KEY4=4000000000000000000000000000000000000000000000000000000000000004" -e "PRIVATE_KEY5=5000000000000000000000000000000000000000000000000000000000000005" -e "PRIVATE_KEY6=6000000000000000000000000000000000000000000000000000000000000006" -e "PRIVATE_KEY7=7000000000000000000000000000000000000000000000000000000000000007" -e "PRIVATE_KEY8=8000000000000000000000000000000000000000000000000000000000000008" -p 8545:8545 --name tom hardhat
// docker run -d -e "BLOCK_TIME=1000" -e "PRIVATE_KEY1=1000000000000000000000000000000000000000000000000000000000000001" -e "PRIVATE_KEY2=2000000000000000000000000000000000000000000000000000000000000002" -e "PRIVATE_KEY3=3000000000000000000000000000000000000000000000000000000000000003" -e "PRIVATE_KEY4=4000000000000000000000000000000000000000000000000000000000000004" -e "PRIVATE_KEY5=5000000000000000000000000000000000000000000000000000000000000005" -e "PRIVATE_KEY6=6000000000000000000000000000000000000000000000000000000000000006" -e "PRIVATE_KEY7=7000000000000000000000000000000000000000000000000000000000000007" -e "PRIVATE_KEY8=8000000000000000000000000000000000000000000000000000000000000008" -p 8546:8545 --name jerry hardhat

(async () => {

    let tomDomain: config.Domain = {
        name: 'tom',
        domain: 1,
        connections: ['jerry'],
        configuration: {
            optimisticSeconds: 500,
            processGas: '10000000000',
            reserveGas: '10000000000',
            maximumGas: '100000000000',
            governance: {
                // governor?: NomadLocator;
                recoveryManager: '0x812c096810e8eFAA73efF841B601Ab82a7be9aB6',
                recoveryTimelock: 86400,
              },
            updater: '0x812c096810e8eFAA73efF841B601Ab82a7be9aB5',
            watchers: ['0x812c096810e8eFAA73efF841B601Ab82a7be9aB4'],
          },
        specs: {
            chainId: 1,
            finalizationBlocks: 5,
            blockTime: 5000,
            supports1559: true,
            confirmations: 5,
            blockExplorer: 'https://rinkeby.etherscan.io/',
            indexPageSize: 0,
          },
        bridgeConfiguration: {
            // weth?: 'NomadIdentifier',
            customs: [
                // {
                //     token: {
                //         domain: number;
                //         id: NomadIdentifier;
                //       },
                //     name: string,
                //     symbol: string,
                //     decimals: number,
                //   }
            ],
            mintGas: '55555555555',
            deployGas: '16500000160',
          },
      };

      let jerryDomain: config.Domain = {
        name: 'jerry',
        domain: 2,
        connections: ['tom'],
        configuration: {
            optimisticSeconds: 86400,
            processGas: '10000000000',
            reserveGas: '10000000000',
            maximumGas: '100000000000',
            governance: {
                // governor?: NomadLocator;
                recoveryManager: '0x812c096810e8eFAA73efF841B601Ab82a7be9aB3',
                recoveryTimelock: 500,
              },
            updater: '0x4177372FD9581ceb2367e0Ce84adC5DAD9DF8D55',
            watchers: ['0x812c096810e8eFAA73efF841B601Ab82a7be9aB1'],
          },
        specs: {
            chainId: 2,
            finalizationBlocks: 5,
            blockTime: 5000,
            supports1559: true,
            confirmations: 5,
            blockExplorer: 'https://rinkeby.etherscan.io/',
            indexPageSize: 2,
          },
        bridgeConfiguration: {
            // weth?: 'NomadIdentifier',
            customs: [
                // {
                //     token: {
                //         domain: number;
                //         id: NomadIdentifier;
                //       },
                //     name: string,
                //     symbol: string,
                //     decimals: number,
                //   }
            ],
            mintGas: '55555555555',
            deployGas: '2050000016',
          },
      };
    
    let config: config.NomadConfig = {
        version: 0,
        environment: "local",
        networks: ['tom', 'jerry'],
        rpcs: {
            tom: ['http://localhost:8545'],
            jerry: ['http://localhost:8546'],
        },
        protocol: {
            governor: {
                domain: 1,
                id: '0x812c096810e8eFAA73efF841B601Ab82a7be9aB0',
              },
            networks: {
                tom: tomDomain,
                jerry: jerryDomain,
            }
        },
        core: {},
        bridge: {},
        agent: {},
        bridgeGui: {},
        // bridge: Record<string, BridgeContracts>;
        // agent: Record<string, AgentConfig>;
        // bridgeGui: Record<string, AppConfig>;
      };

    // let p = new MultiProvider<config.Domain>();
    // p.registerDomain(tomDomain);
    // p.registerDomain(jerryDomain);
    // p.registerRpcProvider('tom', 'http://localhost:9545');
    // p.registerRpcProvider('jerry', 'http://localhost:9546');



    let c = new DeployContext(config);

    // c.registerWalletSigner('tom', '1000000000000000000000000000000000000000000000000000000000000001');
    // c.registerWalletSigner('jerry', '2000000000000000000000000000000000000000000000000000000000000002');
    let st = new ethers.Wallet('1000000000000000000000000000000000000000000000000000000000000001', new ethers.providers.JsonRpcProvider(c.data.rpcs['tom'][0]));
    let sj = new ethers.Wallet('2000000000000000000000000000000000000000000000000000000000000002', new ethers.providers.JsonRpcProvider(c.data.rpcs['jerry'][0]));
    c.registerSigner('tom', new NonceManager(st));
    c.registerSigner('jerry', new NonceManager(sj));
    
    // c.registerWalletSigner('tom', '1000000000000000000000000000000000000000000000000000000000000001');
    // c.registerWalletSigner('jerry', '2000000000000000000000000000000000000000000000000000000000000002');
    const overrides = {
        // gasPrice: '16500000160',
        maxFeePerGas: '121000000000',
        // maxPriorityFeePerGas: '10000000000'
    };
    c.overrides.set('tom', overrides);
    c.overrides.set('jerry', overrides);

    await c.deployAndRelinquish();
    console.log(JSON.stringify(c.data, null, 4));
    fs.writeFileSync(`./scripts/config.json`, JSON.stringify(c.data, null, 4));
})();