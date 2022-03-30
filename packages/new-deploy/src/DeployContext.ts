import * as config from '@nomad-xyz/configuration';
import { MultiProvider, utils } from '@nomad-xyz/multi-provider';
import { expect } from 'chai';
import ethers from 'ethers';

import BridgeContracts from './bridge/BridgeContracts';
import CoreContracts from './core/CoreContracts';

export interface Verification {
  name: string;
  address: string;
  constructorArguments?: ReadonlyArray<unknown>;
}

export default class DeployContext extends MultiProvider<config.Domain> {
  overrides: Map<string, ethers.Overrides>;
  protected _data: config.NomadConfig;
  protected _verification: Map<string, Array<Verification>>;

  constructor(data: config.NomadConfig) {
    super();

    this._data = data;
    this.overrides = new Map();
    this._verification = new Map();

    for (const network of this.data.networks) {
      this.registerDomain(this.data.protocol.networks[network]);
      if (this.data.rpcs[network] && this.data.rpcs[network].length > 0) {
        this.registerRpcProvider(network, this.data.rpcs[network][0]);
      }
    }
  }

  get protocol(): config.NetworkInfo | undefined {
    return this.data.protocol;
  }

  get networks(): ReadonlyArray<string> {
    return this.data.networks;
  }

  get cores(): Readonly<Record<string, config.EvmCoreContracts>> {
    return this.data.core;
  }

  get bridges(): Readonly<Record<string, config.EvmBridgeContracts>> {
    return this.data.bridge;
  }

  get data(): Readonly<config.NomadConfig> {
    return this._data;
  }

  get verification(): Readonly<Map<string, ReadonlyArray<Verification>>> {
    return this._verification;
  }

  validate(): void {
    config.validateConfig(this.data);
  }

  getDeployer(nameOrDomain: string | number): ethers.Signer {
    return this.mustGetSigner(nameOrDomain);
  }

  getDomainConfig(nameOrDomain: string | number): config.Domain | undefined {
    const name = this.resolveDomainName(nameOrDomain);
    return this.data.protocol.networks[name];
  }

  mustGetDomainConfig(nameOrDomain: string | number): config.Domain {
    const protocol = this.getDomainConfig(nameOrDomain);
    if (!protocol)
      throw new Error(`No protocol configuration for domain ${nameOrDomain}`);
    return protocol;
  }

  getCore(nameOrDomain: string | number): CoreContracts | undefined {
    const name = this.resolveDomainName(nameOrDomain);
    if (!this.data.core[name]) return undefined;
    return new CoreContracts(this, name, this.data.core[name]);
  }

  mustGetCore(nameOrDomain: string | number): CoreContracts {
    const core = this.getCore(nameOrDomain);
    if (!core) throw new Error(`No core contracts for domain ${nameOrDomain}`);
    return core;
  }

  getBridge(nameOrDomain: string | number): BridgeContracts | undefined {
    const name = this.resolveDomainName(nameOrDomain);
    if (!this.data.bridge[name]) return undefined;
    return new BridgeContracts(this, name, this.data.bridge[name]);
  }

  mustGetBridge(nameOrDomain: string | number): BridgeContracts {
    const bridge = this.getBridge(nameOrDomain);
    if (!bridge)
      throw new Error(`No bridge contracts for domain ${nameOrDomain}`);
    return bridge;
  }

  addDomain(domain: config.Domain): void {
    this._data = config.addNetwork(this.data, domain);
  }

  protected addCore(name: string, core: config.EvmCoreContracts): void {
    this._data = config.addCore(this.data, name, core);
  }

  protected addBridge(name: string, bridge: config.EvmBridgeContracts): void {
    this._data = config.addBridge(this.data, name, bridge);
  }

  pushVerification(
    nameOrDomain: string | number,
    verification: Verification,
  ): void {
    const name = this.resolveDomainName(nameOrDomain);
    if (!this.verification.has(name)) this.verification.set(name, []);

    const net = this._verification.get(name);
    if (net) net.push(verification);
  }

  mustGetVerification(nameOrDomain: string | number): readonly Verification[] {
    const domain = this.resolveDomainName(nameOrDomain);
    const verification = this.verification.get(domain);
    if (!verification)
      throw new Error(
        `Verification with name ${nameOrDomain} for domain ${domain} is not defined`,
      );

    return verification;
  }

  protected async deployCore(domain: config.Domain): Promise<void> {
    console.log("deployCore ", domain);

    this.addDomain(domain);

    const core = new CoreContracts(this, domain.name);
    await core.recordStartBlock();

    await Promise.all([
      core.deployUpgradeBeaconController(),
      core.deployUpdaterManager(),
      core.deployXAppConnectionManager(),
    ]);

    await core.deployHome();
    await core.deployGovernanceRouter();

    // all contracts deployed
    const complete = core.complete();
    this.addCore(domain.name, complete);
  }

  // post-deployment setup
  // We choose to enroll all currently known routers and watchers here,
  // event those that may not be immediately connected, so that IF they are
  // connected in the future, the routers will be properly configured.
  // Essentially we run likely future governance actions at deploy time, so
  // we will not be required to run them later.
  protected async enrollCores(): Promise<ethers.PopulatedTransaction[]> {
    console.log("enrollCores ");

    const results = await Promise.all(
      this.networks.map(async (network) => {
        // the set of domains that are not the new core
        const remoteDomains = this.data.networks.filter(
          (net) => net !== network,
        );
        const core = this.mustGetCore(network);

        return (
          await Promise.all([
            ...remoteDomains.map((remote) =>
              core.enrollGovernanceRouter(remote),
            ),
            ...remoteDomains.map((remote) => core.enrollWatchers(remote)),
          ])
        ).flat();
      }),
    );
    return results.flat();
  }

  protected async deployBridge(name: string): Promise<void> {
    this.mustGetCore(name).complete(); // assert that the core is totally deployed

    const bridge = new BridgeContracts(this, name);
    await bridge.recordStartBlock();

    await bridge.deployTokenUpgradeBeacon();
    await bridge.deployTokenRegistry();

    await Promise.all([bridge.deployBridgeRouter(), bridge.deployEthHelper()]);

    this.addBridge(name, bridge.complete());
  }

  /// Deploys all configured Cores
  async ensureCores(): Promise<ethers.PopulatedTransaction[]> {
    console.log("ensureCores ");

    const toDeploy = this.networks.filter((net) => !this.cores[net]);

    await Promise.all(
      toDeploy.map((net) => this.deployCore(this.mustGetDomainConfig(net))),
    );
    return await this.enrollCores();
  }

  // Deploys all configured connections and enrolls them if possible.
  // For any connection that cannot be enrolled, outputs the governance
  // action required to enroll them
  async ensureConnections(): Promise<ethers.PopulatedTransaction[]> {
    console.log("ensureConnections ");

    this.validate();

    const ensure = await this.ensureCores();

    const promises = this.networks.map(async (network) => {
      const core = this.mustGetCore(network);
      const name = this.resolveDomainName(network);
      const remoteDomains = this.data.protocol.networks[name]?.connections;
      if (!remoteDomains) throw new Error('unreachable');

      const txns = await Promise.all(
        remoteDomains.map((remote) => core.enrollRemote(remote)),
      );
      return txns.flat();
    });

    const txns = await Promise.all(promises);
    ensure.push.apply(txns.flat());
    return ensure;
  }

  /// Deploys all configured bridges.
  async ensureBridges(): Promise<void> {
    const toDeploy = this.networks.filter((net) => !this.bridges[net]);
    const promises = toDeploy.map((net) => this.deployBridge(net));
    await Promise.all(promises);
  }

  // Checks for connections that are configured but lack a corresponding bridge
  // connection. Attempts to enroll the bridge routers on eachother.
  // For any connection that cannot be enrolled, outputs the governance
  // action required to enroll them
  protected async ensureBridgeConnections(): Promise<
    ethers.PopulatedTransaction[]
  > {
    console.log("ensure bridge connections ");

    const connect = await this.ensureConnections();
    await this.ensureBridges();

    const promises = this.networks.map(async (network) => {
      const bridge = this.mustGetBridge(network);
      const name = this.resolveDomainName(network);
      const remoteDomains = this.data.protocol.networks[name]?.connections;
      if (!remoteDomains) throw new Error('unreachable');

      const txns = await Promise.all(
        remoteDomains.map((remote) => bridge.enrollBridgeRouter(remote)),
      );
      return txns.flat();
    });

    const bridgeEnroll = await Promise.all(promises);
    connect.push.apply(bridgeEnroll);
    return connect;
  }

  async relinquish(): Promise<void> {
    // relinquish deployer control
    await Promise.all([
      ...this.networks.map((network) => this.mustGetCore(network).relinquish()),
      ...this.networks.map((network) =>
        this.mustGetBridge(network).relinquish(),
      ),
    ]);
  }

  // Intended entrypoint.
  async deployAndRelinquish(): Promise<ethers.PopulatedTransaction[]> {
    // ensure connections ensures the presence of cores
    await this.ensureBridgeConnections();

    const txns = (
      await Promise.all([
        ...this.networks.map((network) => {
            console.log("appoint governor ");
            return this.mustGetCore(network).appointGovernor();
            }
        ),
      ])
    ).flat();

    await this.relinquish();

    await this.checkCores();
    await this.checkBridges();

    return txns;
  }

  /// Adds a connection between two known networks. Use this AHEAD OF calling
  /// `ensureConnections
  addConnection(left: string, right: string): void {
    // asserts that the domains are known
    this.mustGetDomain(left);
    this.mustGetDomain(right);

    if (this._data.protocol.networks[left].connections.indexOf(right) !== -1) {
      throw new Error(`${right} already a connection of ${left}`);
    }
    if (this._data.protocol.networks[right].connections.indexOf(left) !== -1) {
      throw new Error(`${left} already a connection of ${right}`);
    }

    this._data.protocol.networks[left].connections.push(right);
    this._data.protocol.networks[left].connections.push(left);
  }

  async checkCores(): Promise<void> {
    await Promise.all(
      this.networks.map(async (net) => {
        const coreConfig = this.data.core[net];
        if (!coreConfig)
          throw new Error(`network ${net} is missing core config`);
        const core = new CoreContracts(this, net, coreConfig);

        let remotes: string[] = [];
        // If currently working with governor network
        if (this.resolveDomain(net) === this.data.protocol.governor.domain) {
          remotes = this.networks.filter((n) => n != net);
        } else {
          remotes = [this.resolveDomainName(this.data.protocol.governor.domain)];
        }

        await core.checkDeploy(remotes, this.data.protocol.governor.domain);
      }),
    );
  }

  async checkBridges(): Promise<void> {
    await Promise.all(
      this.networks.map(async (net) => {
        const bridgeConfig = this.data.bridge[net];
        if (!bridgeConfig)
          throw new Error(`network ${net} is missing bridge config`);
        const bridge = new BridgeContracts(this, net);
        await bridge.checkDeploy();
      }),
    );
  }

  checkVerificationInput(
    nameOrDomain: string | number,
    name: string,
    addr: string,
  ): void {
    const verification = this.mustGetVerification(nameOrDomain);

    if (verification.length === 0)
      throw new Error(
        `Verification with name '${name}' for domain '${nameOrDomain}' is not defined`,
      );
    const inputAddr = verification.filter(
      (contract) => contract.name == name,
    )[0].address;
    expect(utils.equalIds(inputAddr, addr));
  }
}
