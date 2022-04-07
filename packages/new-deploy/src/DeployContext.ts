import * as config from '@nomad-xyz/configuration';
import { MultiProvider, utils } from '@nomad-xyz/multi-provider';
import { NomadContext } from '@nomad-xyz/sdk';
import { CallBatch } from '@nomad-xyz/sdk-govern';
import { expect } from 'chai';
import ethers from 'ethers';

import BridgeContracts from './bridge/BridgeContracts';
import CoreContracts from './core/CoreContracts';

export interface Verification {
  name: string;
  address: string;
  constructorArguments?: ReadonlyArray<unknown>;
}

export class DeployContext extends MultiProvider<config.Domain> {
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

  get asNomadContext(): NomadContext {
    const ctx = new NomadContext(this.data);

    for (const [domain, provider] of this.providers.entries()) {
      ctx.registerProvider(domain, provider);
    }
    return ctx;
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

  protected async deployBridge(name: string): Promise<void> {
    this.mustGetCore(name).complete(); // assert that the core is totally deployed

    const bridge = new BridgeContracts(this, name);
    await bridge.recordStartBlock();

    await bridge.deployTokenUpgradeBeacon();
    await bridge.deployTokenRegistry();
    await bridge.deployBridgeRouter();
    await bridge.deployEthHelper();

    this.addBridge(name, bridge.complete());
  }

  /// Deploys all configured Cores
  async ensureCores(): Promise<void> {
    const networksToDeploy = this.networks.filter((net) => !this.cores[net]);
    await Promise.all(
      networksToDeploy.map((net) =>
        this.deployCore(this.mustGetDomainConfig(net)),
      ),
    );
  }

  // Deploys all configured connections and enrolls them if possible.
  // For any connection that cannot be enrolled, outputs the governance
  // action required to enroll them
  async ensureCoreConnections(): Promise<CallBatch | undefined> {
    // ensure all core contracts are deployed
    await this.ensureCores();
    // ensure all core contracts are enrolled in each other
    const batches = await Promise.all(
      this.networks.map(async (network): Promise<CallBatch | undefined> => {
        const core = this.mustGetCore(network);
        const name = this.resolveDomainName(network);
        const remoteDomains = this.data.protocol.networks[name]?.connections;
        // the following "unreachable" error performs type-narrowing for the compiler
        if (!remoteDomains) throw new utils.UnreachableError();
        if (remoteDomains.length == 0) return;

        const [firstDomain, ...restDomains] = remoteDomains;
        // wait on the first replica deploy to ensure that the implementation and beacon are deployed

        const firstReplicaTxns = await core.enrollRemote(firstDomain);
        // perform subsequent replica deploys concurrently (will use same implementation and beacon)
        const batches = await Promise.all(
          restDomains.map((remote) => core.enrollRemote(remote)),
        );

        return CallBatch.flatten(this.asNomadContext, [
          firstReplicaTxns,
          ...batches,
        ]);
      }),
    );

    return CallBatch.flatten(this.asNomadContext, batches);
  }

  /// Deploys all configured bridges.
  async ensureBridges(): Promise<void> {
    const toDeploy = this.networks.filter((net) => !this.bridges[net]);
    await Promise.all(toDeploy.map((net) => this.deployBridge(net)));
  }

  async ensureBridgeConnections(): Promise<CallBatch | undefined> {
    // first, ensure all bridge contracts are deployed
    await this.ensureBridges();
    // next, ensure all bridge contracts are enrolled in each other
    // and all custom tokens are also enrolled
    const batches = await Promise.all(
      this.networks.map(async (network): Promise<CallBatch> => {
        const bridge = this.mustGetBridge(network);
        const name = this.resolveDomainName(network);
        const remoteDomains = this.data.protocol.networks[name]?.connections;
        // the following "unreachable" error performs type-narrowing for the compiler
        if (!remoteDomains) throw new utils.UnreachableError();
        const batches = await Promise.all(
          remoteDomains.map((remote) => bridge.enrollBridgeRouter(remote)),
        );

        // deploy and enroll custom tokens
        const customs = await bridge.deployCustomTokens();

        const batch = CallBatch.flatten(this.asNomadContext, batches);
        if (customs) batch.append(customs);
        return batch;
      }),
    );

    return CallBatch.flatten(this.asNomadContext, batches);
  }

  async relinquishOwnership(): Promise<void> {
    // relinquish deployer control
    await Promise.all([
      ...this.networks.map((network) => this.mustGetCore(network).relinquish()),
      ...this.networks.map((network) =>
        this.mustGetBridge(network).relinquish(),
      ),
    ]);
  }

  // Intended entrypoint.
  async deployAndRelinquish(): Promise<CallBatch | undefined> {
    // validate the config input
    this.validate();

    // ensure the presence of all core + bridge contracts, and enroll all core + bridge contracts with each other
    const batch = await this.ensureCoreAndBridgeConnections();

    // relinquish control of all other contracts from deployer to governance
    await this.relinquishOwnership();

    // appoint governor on all networks
    await Promise.all(
      this.networks.map((network) =>
        this.mustGetCore(network).appointGovernor(),
      ),
    );

    return batch;
  }

  // Checks for connections that are configured but lack a corresponding bridge
  // connection. Attempts to enroll the bridge routers on eachother.
  // For any connection that cannot be enrolled, outputs the governance
  // action required to enroll them
  protected async ensureCoreAndBridgeConnections(): Promise<
    CallBatch | undefined
  > {
    const coreBatch = await this.ensureCoreConnections();
    const bridgeBatch = await this.ensureBridgeConnections();
    // short circuit if no core txns
    if (!coreBatch) return bridgeBatch;
    // combine if there are some of each
    if (bridgeBatch) coreBatch.append(bridgeBatch);
    return coreBatch;
  }

  // perform validation checks on core and bridges
  async checkDeployment(): Promise<void> {
    await this.checkCores();
    await this.checkBridges();
  }

  async checkCores(): Promise<void> {
    await Promise.all(
      this.networks.map(async (net) => {
        const coreConfig = this.data.core[net];
        if (!coreConfig)
          throw new Error(`network ${net} is missing core config`);
        const core = new CoreContracts(this, net, coreConfig);

        const domainConfig = this.mustGetDomainConfig(net);

        await core.checkDeploy(
          domainConfig.connections,
          this.data.protocol.governor.domain,
        );
      }),
    );
  }

  async checkBridges(): Promise<void> {
    await Promise.all(
      this.networks.map(async (net) => {
        const bridgeConfig = this.data.bridge[net];
        if (!bridgeConfig)
          throw new Error(`network ${net} is missing bridge config`);
        const bridge = new BridgeContracts(this, net, bridgeConfig);
        await bridge.checkDeploy(this.data.protocol.networks[net].connections);
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
