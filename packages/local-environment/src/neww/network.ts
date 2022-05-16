import { Agents } from "./agent";
import { NetworkSpecs, ContractConfig, BridgeConfiguration, Domain, CoreContracts, BridgeContracts, AgentConfig, AppConfig, NomadGasConfig } from '@nomad-xyz/configuration';
import { DockerizedActor } from "./actor";
import Dockerode from "dockerode";
import { sleep } from "../utils";
import ethers from 'ethers';
import {  } from "@nomad-xyz/configuration";

enum DockerNetworkStatus {
    Running,
    Stopped,
    Disconnected,
    Waiting, // Transition period
  }

export abstract class Network {
    agents?: Agents;

    connectedNetworks: Network[];

    name: string;
    domainNumber: number;
    chainId: number;
    deployOverrides: ethers.Overrides;

    coreContracts?: CoreContracts;
    bridgeContracts?: BridgeContracts;
    agentConfig?: AgentConfig;
    bridgeGui?: AppConfig;

    gasConfig: NomadGasConfig;

    abstract get specs(): NetworkSpecs;
    abstract get rpcs(): string[];
    abstract get config(): ContractConfig;
    abstract get bridgeConfig(): BridgeConfiguration;

    abstract up(): Promise<void>;
    abstract down(): Promise<void>;
    abstract isConnected(): Promise<boolean>;

    constructor(name: string, domainNumber: number, chainId: number) {
        this.connectedNetworks = [];
        this.name = name;
        this.domainNumber = domainNumber;
        this.chainId = chainId;

        this.deployOverrides = {};

        try {
          this.gasConfig = {
            core: {
              home: {
                update: {
                  base: 100000,
                  perMessage: 10000
                },
                improperUpdate: {
                  base: 100000,
                  perMessage: 10000
                },
                doubleUpdate: 200000
              },
              replica: {
                update: 140000,
                prove: 200000,
                process: 1700000,
                proveAndProcess: 1900000,
                doubleUpdate: 200000
              },
              connectionManager: {
                ownerUnenrollReplica: 120000,
                unenrollReplica: 120000
              }
            },
            bridge: {
              bridgeRouter: {
                send: 500000
              },
              ethHelper: {
                send: 800000,
                sendToEvmLike: 800000
              }
            }
          }
        } catch(e) {
          console.log(e)
        }

        this.gasConfig = {
          core: {
            home: {
              update: {
                base: 100000,
                perMessage: 10000
              },
              improperUpdate: {
                base: 100000,
                perMessage: 10000
              },
              doubleUpdate: 200000
            },
            replica: {
              update: 140000,
              prove: 200000,
              process: 1700000,
              proveAndProcess: 1900000,
              doubleUpdate: 200000
            },
            connectionManager: {
              ownerUnenrollReplica: 120000,
              unenrollReplica: 120000
            }
          },
          bridge: {
            bridgeRouter: {
              send: 500000
            },
            ethHelper: {
              send: 800000,
              sendToEvmLike: 800000
            }
          }
        }
        
    }

    get connections(): string[] {
        return this.connectedNetworks.map(n => n.name);
    }

    get domain(): Domain {
        return {
            name: this.name,
            domain: this.domainNumber,
            connections: this.connections,
            specs: this.specs,
            configuration: this.config,
            bridgeConfiguration: this.bridgeConfig,
        }
    }

    get isDeployed(): boolean {
      return !!this.coreContracts && !!this.bridgeContracts
    }

}

let ports = 1337;

export class DockerizedNetworkActor extends DockerizedActor {
    port: number;
    blockTime: number;

    constructor(name: string) {
        super(name, 'network');
        this.port = ports++;
        this.blockTime = 1*1000;
    }

    async createContainer(): Promise<Dockerode.Container> {
        const name = this.containerName();
    
        return this.docker.createContainer({
          Image: "hardhat",
          name,
          Env: [
            `BLOCK_TIME=${this.blockTime}`,
            // ...this.keys.map((k, i) => `PRIVATE_KEY${i + 1}=${k.toString()}`),
          ],
          ExposedPorts: {
            "8545/tcp:": {},
          },
          HostConfig: {
            PortBindings: {
              "8545/tcp": [
                {
                  HostPort: this.port.toString(),
                },
              ],
            },
            // NetworkMode: 'host',
            // AutoRemove: true,
          },
        });
      }
    
      async status(): Promise<DockerNetworkStatus> {
        if (await this.isConnected()) {
          if (await this.isRunning()) {
            return DockerNetworkStatus.Running;
          } else {
            return DockerNetworkStatus.Stopped;
          }
        } else {
          return DockerNetworkStatus.Disconnected;
        }
      }

}


export class HardhatNetwork extends Network {
    firstStart: boolean;
    blockTime: number;
    handler: DockerizedNetworkActor;

    updater: string;
    watcher: string;
    recoveryManager: string;
    weth: string;

    constructor(name: string, domain: number) {
        super(name, domain, domain);
        this.handler = new DockerizedNetworkActor(this.name+'kek');
        this.blockTime = 5;
        this.firstStart = false;

        this.updater = '0x'+'01'.repeat(20);
        this.watcher = '0x'+'01'.repeat(20);
        this.recoveryManager = '0x'+'01'.repeat(20);
        this.weth = '0x'+'01'.repeat(20);
    }

    get connections(): string[] {
        return this.connectedNetworks.map(n => n.name);
    }

    get rpcs(): string[] {
        return [`http://localhost:${this.handler.port}`];
    }

    get specs(): NetworkSpecs {
        return {
            chainId: this.chainId,
            finalizationBlocks: 2,
            blockTime: this.blockTime,
            supports1559: true,
            confirmations: 2,
            blockExplorer: '',
            indexPageSize: 2000,
          }
    }
    get config(): ContractConfig {
        return {
            optimisticSeconds: 18,
            processGas: 850000,
            reserveGas: 25000,
            maximumGas: 1000000,
            governance: {
                recoveryManager: this.recoveryManager,
                recoveryTimelock: 86400
            },
            updater: this.updater,
            watchers: [this.watcher]
          }
    }
    get bridgeConfig(): BridgeConfiguration {
        return {
            weth: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
            customs: [],
            mintGas: 200000,
            deployGas: 850000
          }
    }

    private async connect() {
        this.firstStart = await this.handler.connect();
    }

    private async disconnect() {
        await this.handler.disconnect();
    }



    private async start() {
        if ((await this.handler.status()) === DockerNetworkStatus.Running) return;
        await this.handler.start();

        if (this.firstStart) {
            await sleep(20_000);
            this.firstStart = false;
        }
    }

    private async stop() {
        await this.handler.stop();
    }

    async isConnected(): Promise<boolean> {
        return this.handler.isConnected()
    }

    async up() {
        await this.connect();
        await this.start();
    }

    async down() {
        await this.connect();

        await this.stop();
        await this.disconnect();
    }

}