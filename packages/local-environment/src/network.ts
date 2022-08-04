import {
  NetworkSpecs,
  ContractConfig,
  BridgeConfiguration,
  CoreContracts,
  BridgeContracts,
  AppConfig,
} from "@nomad-xyz/configuration";
import { DockerizedActor } from "./actor";
import Dockerode from "dockerode";
import { sleep } from "./utils";
import { ethers } from "ethers";
import { Key } from "./keys/key";
import {} from "@nomad-xyz/configuration";
//import { getContractAddress } from "ethers/lib/utils";

// A Network is any arbitrary blockchain, local or testnet.

enum DockerNetworkStatus {
  Running,
  Stopped,
  Disconnected,
  Waiting, // Transition period
}

export abstract class Network {
  domainNumber: number;
  name: string;
  chainId: number;
  deployOverrides: ethers.Overrides;

  coreContracts?: CoreContracts;
  bridgeContracts?: BridgeContracts;
  bridgeGui?: AppConfig;

  blockTime: number;

  updater: string;
  watcher: string;
  recoveryManager: string;
  weth: string;

  abstract get specs(): NetworkSpecs;
  abstract get rpcs(): string[];
  abstract get config(): ContractConfig;
  abstract get bridgeConfig(): BridgeConfiguration;

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
  abstract isConnected(): Promise<boolean>;
  abstract getJsonRpcSigner(
    addressOrIndex: string | number
  ): ethers.providers.JsonRpcSigner;
  abstract getJsonRpcProvider(): ethers.providers.JsonRpcProvider;

  constructor(
    name: string,
    domainNumber: number,
    chainId: number,
    blockTime = 5000
  ) {
    this.name = name;
    this.domainNumber = domainNumber;
    this.chainId = chainId;
    this.deployOverrides = { gasLimit: 30000000 };
    this.updater = "";
    this.watcher = "";
    this.recoveryManager = "";
    this.weth = "";
    this.blockTime = blockTime;
  }

  get isDeployed(): boolean {
    return !!this.coreContracts && !!this.bridgeContracts;
  }
}

let ports = 1337;

export class DockerizedNetworkActor extends DockerizedActor {
  port: number;
  blockTime: number;
  keys: Key[];

  constructor(name: string) {
    super(name, "network");
    this.port = ports++;
    this.blockTime = 1 * 1000;
    this.keys = [];
  }

  addKeys(...keys: Key[]) {
    // TODO: add a check that network hasn't started yet.
    // Keep in mind! That if the network is like a Test network which already exists,
    // we should adjust this method to create keys and fund them during the call to this method
    this.keys.push(...keys);
  }
  // docker run --name net --env RUN_ENV=main --network="host" --env BLOCK_TIME=5 hardhat
  async createContainer(): Promise<Dockerode.Container> {
    const name = this.containerName();

    return this.docker.createContainer({
      Image: "hardhat",
      name,
      Env: [
        `BLOCK_TIME=${this.blockTime}`,
        ...this.keys.map((k, i) => {
          return `PRIVATE_KEY${i + 1}=${k.toString()}`;
        }),
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

interface AnyNetworkOptions {
  port?: number;
  scheme?: string;
  keys?: Key[];
}

interface HardhatNetworkOptions extends AnyNetworkOptions {
  notFirstStart?: boolean;
  keys?: Key[];
}

// TODO: Some idea to abstract test net
//  export class TestNetwork extends Network {

//   constructor(name: string, rpc: string, bank: string|Key) {

//   }

//   addKeys(...keys) {
//     keys.map(key => {
//       this.fundKeyFromBank(key)
//     })
//   }

//   down() {
//     this.returnFundsToBank()
//   }
//  }

export class HardhatNetwork extends Network {
  firstStart: boolean;
  blockTime: number;
  keys: Key[];
  handler: DockerizedNetworkActor;

  constructor(name: string, domain: number, options?: HardhatNetworkOptions) {
    super(name, domain, domain);
    this.handler = new DockerizedNetworkActor(this.name);
    this.blockTime = 5;
    this.firstStart = false;
    this.keys = options?.keys || [];
  }

  /* TODO: reimplement abstractions for MULTIPLE hardhat networks (i.e. any Nomad domain).
    //   static fromObject(o: Object): Network {
    //     const name = Object(o)["name"];
    //     const domain = Object(o)["domain"];
    //     const locationStr = Object(o)["location"];
    //     const notFirstStart = Object(o)["notFirstStart"];
    //     const keys = Object(o)["keys"];

    //     return new LocalNetwork(name, domain, locationStr, {
    //       notFirstStart,
    //       keys,
    //     });
    //   }

    //   toObject(): Object {
    //     return {
    //       name: this.name,
    //       domain: this.domain,
    //       location: this.location.toString(),
    //       firstStart: this.firstStart,
    //       keys: this.keys,
    //       // May be keys?
    //     };
    //   }
        
    */

  addKeys(...ks: Key[]) {
    this.handler.addKeys(...ks);
    this.keys.push(...ks);
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
      blockExplorer: "",
      indexPageSize: 2000,
    };
  }

  get config(): ContractConfig {
    return {
      optimisticSeconds: 18,
      governance: {
        recoveryManager: this.recoveryManager,
        recoveryTimelock: 86400,
      },
      updater: this.updater,
      watchers: [this.watcher],
    };
  }

  async setWETH(wethAddy: Promise<string>): Promise<void> {
    this.weth = await wethAddy;
  }

  get bridgeConfig(): BridgeConfiguration {
    return {
      weth: this.weth,
      customs: [],
      // mintGas: 200000,
      // deployGas: 850000
    };
  }

  //This is used for ETHHelper. WETH will always be at 0x2Fd79405E108B80D297b6A95b715258806Cb2537 due to identical encoded data and same deployer addresses.
  async deployWETH(): Promise<string> {
    const jsonRpcProvider = new ethers.providers.JsonRpcProvider(
      `http://localhost:${this.handler.port}`
    );
    const owner = await jsonRpcProvider.getSigner();
    const wethABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"guy","type":"address"},{"name":"wad","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"src","type":"address"},{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"guy","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"}];
    const wethByteCode =
      "60606040526040805190810160405280600d81526020017f57726170706564204574686572000000000000000000000000000000000000008152506000908051906020019061004f9291906100c8565b506040805190810160405280600481526020017f57455448000000000000000000000000000000000000000000000000000000008152506001908051906020019061009b9291906100c8565b506012600260006101000a81548160ff021916908360ff16021790555034156100c357600080fd5b61016d565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061010957805160ff1916838001178555610137565b82800160010185558215610137579182015b8281111561013657825182559160200191906001019061011b565b5b5090506101449190610148565b5090565b61016a91905b8082111561016657600081600090555060010161014e565b5090565b90565b610c348061017c6000396000f3006060604052600436106100af576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806306fdde03146100b9578063095ea7b31461014757806318160ddd146101a157806323b872dd146101ca5780632e1a7d4d14610243578063313ce5671461026657806370a082311461029557806395d89b41146102e2578063a9059cbb14610370578063d0e30db0146103ca578063dd62ed3e146103d4575b6100b7610440565b005b34156100c457600080fd5b6100cc6104dd565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561010c5780820151818401526020810190506100f1565b50505050905090810190601f1680156101395780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561015257600080fd5b610187600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803590602001909190505061057b565b604051808215151515815260200191505060405180910390f35b34156101ac57600080fd5b6101b461066d565b6040518082815260200191505060405180910390f35b34156101d557600080fd5b610229600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803590602001909190505061068c565b604051808215151515815260200191505060405180910390f35b341561024e57600080fd5b61026460048080359060200190919050506109d9565b005b341561027157600080fd5b610279610b05565b604051808260ff1660ff16815260200191505060405180910390f35b34156102a057600080fd5b6102cc600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610b18565b6040518082815260200191505060405180910390f35b34156102ed57600080fd5b6102f5610b30565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561033557808201518184015260208101905061031a565b50505050905090810190601f1680156103625780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561037b57600080fd5b6103b0600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610bce565b604051808215151515815260200191505060405180910390f35b6103d2610440565b005b34156103df57600080fd5b61042a600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610be3565b6040518082815260200191505060405180910390f35b34600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055503373ffffffffffffffffffffffffffffffffffffffff167fe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c346040518082815260200191505060405180910390a2565b60008054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156105735780601f1061054857610100808354040283529160200191610573565b820191906000526020600020905b81548152906001019060200180831161055657829003601f168201915b505050505081565b600081600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040518082815260200191505060405180910390a36001905092915050565b60003073ffffffffffffffffffffffffffffffffffffffff1631905090565b600081600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054101515156106dc57600080fd5b3373ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff16141580156107b457507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205414155b156108cf5781600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020541015151561084457600080fd5b81600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055505b81600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555081600360008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190509392505050565b80600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410151515610a2757600080fd5b80600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055503373ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f193505050501515610ab457600080fd5b3373ffffffffffffffffffffffffffffffffffffffff167f7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65826040518082815260200191505060405180910390a250565b600260009054906101000a900460ff1681565b60036020528060005260406000206000915090505481565b60018054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610bc65780601f10610b9b57610100808354040283529160200191610bc6565b820191906000526020600020905b815481529060010190602001808311610ba957829003601f168201915b505050505081565b6000610bdb33848461068c565b905092915050565b60046020528160005260406000206020528060005260406000206000915091505054815600a165627a7a72305820deb4c2ccab3c2fdca32ab3f46728389c2fe2c165d5fafa07661e4e004f6c344a0029";
    const wethFactory = new ethers.ContractFactory(
      wethABI,
      wethByteCode,
      owner
    );
    const weth = await wethFactory.deploy();
    const wethAddy = await weth.address;
    return wethAddy;
  }

  async deployToken(
    contractFactory: ethers.ContractFactory,
    from: string | ethers.providers.JsonRpcSigner,
    ...args: string[]
  ): Promise<ethers.Contract> {
    let signer: ethers.providers.JsonRpcSigner;
    if (typeof from === "string") {
      signer = this.getJsonRpcSigner(from);
    } else {
      signer = from;
    }

    contractFactory = contractFactory.connect(signer);

    const contract = await contractFactory.deploy(...args);

    await contract.deployed();
    return contract;
  }

  getJsonRpcSigner(
    addressOrIndex: string | number
  ): ethers.providers.JsonRpcSigner {
    const provider = this.getJsonRpcProvider();
    return provider.getSigner(addressOrIndex);
  }

  getJsonRpcProvider(): ethers.providers.JsonRpcProvider {
    return new ethers.providers.JsonRpcProvider(
      `http://localhost:${this.handler.port}`
    );
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
    return this.handler.isConnected();
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
