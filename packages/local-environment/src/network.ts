import Docker from "dockerode";
import { ethers } from "ethers";

import { Key } from ".";
import { sleep } from "./utils";
import { DockerizedActor } from "./actors";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Governor } from "@nomad-xyz/deploy/src/core/CoreDeploy";

export type Networkish = string | number | Network;

enum NetworkStatus {
  Running,
  Stopped,
  Disconnected,
  Waiting, // Transition period
}

interface LocalNetworkHandler {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<NetworkStatus>;
  addKeys(...ks: Key[]): void;
}

class DockerNetworkHandler
  extends DockerizedActor
  implements LocalNetworkHandler
{
  network: Network;
  keys: Key[];

  constructor(network: Network) {
    super(network.name, "net");
    this.network = network;
    this.keys = [];
  }

  addKeys(...ks: Key[]) {
    this.keys.push(...ks);
  }

  async createContainer(): Promise<Docker.Container> {
    const name = this.containerName();
    const port = this.network.location.port;

    return this.docker.createContainer({
      Image: "hardhat",
      name,
      Env: [
        "BLOCK_TIME=300",
        ...this.keys.map((k, i) => `PRIVATE_KEY${i + 1}=${k.toString()}`),
      ],
      ExposedPorts: {
        "8545/tcp:": {},
      },
      HostConfig: {
        PortBindings: {
          "8545/tcp": [
            {
              HostPort: port.toString(),
            },
          ],
        },
        // NetworkMode: 'host',
        // AutoRemove: true,
      },
    });
  }

  async status(): Promise<NetworkStatus> {
    if (await this.isConnected()) {
      if (await this.isRunning()) {
        return NetworkStatus.Running;
      } else {
        return NetworkStatus.Stopped;
      }
    } else {
      return NetworkStatus.Disconnected;
    }
  }
}

class Location {
  scheme: string;
  url: string;
  port: number;

  constructor(url: string, port?: number, scheme?: string) {
    this.url = url;
    this.port = port || 7545;
    this.scheme = scheme || "http";

    this.parseFromUrl(url);
  }

  private parseFromUrl(url: string) {
    const match = url.match(
      /(\w+):\/\/((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|localhost)\:(\d{1,5})/
    );
    if (match) {
      this.scheme = match[1];
      this.url = match[2] || match[3];
      this.port = parseInt(match[4]);
    }
  }

  isLocal(): boolean {
    return (
      this.url.includes("localhost") ||
      this.url.includes("0.0.0.0") ||
      this.url.includes("127.0.0.1")
    );
  }

  toString(): string {
    return `${this.scheme}://${this.url}:${this.port}`;
  }
}

export abstract class Network {
  name: string;
  domain: number;
  location: Location;
  governor?: Governor;

  constructor(
    name: string,
    domain: number,
    url: string,
    options?: AnyNetworkOptions
  ) {
    this.name = name;
    this.domain = domain;
    this.location = new Location(url, options?.port, options?.scheme);
  }

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;

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

  setGovernor(governor: Governor) {
    this.governor = governor;
  }

  setLocalGovernor(address: string) {
    this.setGovernor({
      address,
      domain: this.domain,
    });
  }

  isGovernor(): boolean {
    return !!this.governor;
  }

  toString(): string {
    return this.name;
  }

  isLocal(): boolean {
    return this.location.isLocal();
  }

  getJsonRpcProvider(): ethers.providers.JsonRpcProvider {
    return new ethers.providers.JsonRpcProvider(this.location.toString());
  }

  getJsonRpcSigner(
    addressOrIndex: string | number
  ): ethers.providers.JsonRpcSigner {
    const provider = this.getJsonRpcProvider();
    return provider.getSigner(addressOrIndex);
  }

  getSignerWithAddress(
    addressOrIndex: string | number
  ): Promise<SignerWithAddress> {
    const signer = this.getJsonRpcSigner(addressOrIndex);
    return SignerWithAddress.create(signer);
  }

  abstract toObject(): Object;
  // static fromObject(o: Object): Network;
}

interface AnyNetworkOptions {
  port?: number;
  scheme?: string;
  keys?: Key[];
}

interface LocalNetworkOptions extends AnyNetworkOptions {
  notFirstStart?: boolean;
  keys?: Key[];
}

export function networkFromObject(o: Object): Network {
  if (Object(o)["type"] === "local") {
    return LocalNetwork.fromObject(o);
  } else {
    return RemoteNetwork.fromObject(o);
  }
}

export class LocalNetwork extends Network {
  firstStart: boolean;
  keys: Key[];
  private handler: LocalNetworkHandler;

  constructor(
    name: string,
    domain: number,
    url: string,
    options?: LocalNetworkOptions
  ) {
    super(name, domain, url, options);
    this.firstStart = true;
    this.handler = this.obtainHandler();
    this.keys = options?.keys || [];
  }

  static fromObject(o: Object): Network {
    const name = Object(o)["name"];
    const domain = Object(o)["domain"];
    const locationStr = Object(o)["location"];
    const notFirstStart = Object(o)["notFirstStart"];
    const keys = Object(o)["keys"];

    return new LocalNetwork(name, domain, locationStr, {
      notFirstStart,
      keys,
    });
  }

  toObject(): Object {
    return {
      name: this.name,
      domain: this.domain,
      location: this.location.toString(),
      firstStart: this.firstStart,
      keys: this.keys,
      // May be keys?
    };
  }

  addKeys(...ks: Key[]) {
    this.handler.addKeys(...ks);
    this.keys.push(...ks);
  }

  private obtainHandler(): LocalNetworkHandler {
    if (this.isLocal()) {
      return new DockerNetworkHandler(this);
    } else {
      return new DockerNetworkHandler(this); // Should be remote, but is a placeholder for now
    }
  }

  async connect() {
    this.firstStart = await this.handler.connect();
  }

  async disconnect() {
    await this.handler.disconnect();
  }

  async start() {
    if ((await this.status()) === NetworkStatus.Running) return;
    await this.handler.start();

    if (this.firstStart) {
      await sleep(20_000);
      this.firstStart = false;
    }
  }

  async stop() {
    await this.handler.stop();
  }

  async status(): Promise<NetworkStatus> {
    return this.handler.status();
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

interface RemoteNetworkOptions extends AnyNetworkOptions {}

export class RemoteNetwork extends Network {
  constructor(
    name: string,
    domain: number,
    url: string,
    options?: RemoteNetworkOptions
  ) {
    super(name, domain, url, options);
  }

  static fromObject(o: Object): Network {
    const name = Object(o)["name"];
    const domain = Object(o)["domain"];
    const locationStr = Object(o)["location"];

    return new LocalNetwork(name, domain, locationStr, {});
  }

  async up(): Promise<void> {
    // TODO: need to test connection
    // and open it if needed
  }
  async down(): Promise<void> {
    // close it if needed
  }
  getJsonRpcProvider(): ethers.providers.JsonRpcProvider {
    return new ethers.providers.JsonRpcProvider(this.location.toString());
  }

  toObject(): Object {
    return {
      name: this.name,
      domain: this.domain,
      location: this.location.toString(),
    };
  }
}
