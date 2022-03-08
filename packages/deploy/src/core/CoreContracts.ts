import * as contracts from '../../../core-contracts';
import { BeaconProxy, ProxyAddresses } from '../proxyUtils';
import { Contracts } from '../contracts';
import { CoreContractAddresses } from '../chain';
import * as ethers from 'ethers';

type SignerOrProvider = ethers.ethers.providers.Provider | ethers.ethers.Signer;
export class CoreContracts extends Contracts {
  upgradeBeaconController?: contracts.UpgradeBeaconController;
  xAppConnectionManager?: contracts.XAppConnectionManager;
  updaterManager?: contracts.UpdaterManager;
  governance?: BeaconProxy<contracts.GovernanceRouter>;
  home?: BeaconProxy<contracts.Home>;
  replicas: Record<number, BeaconProxy<contracts.Replica>>;

  constructor() {
    super();
    this.replicas = {};
  }

  toObject(): CoreContractAddresses {
    const replicas: Record<string, ProxyAddresses> = {};
    Object.entries(this.replicas).forEach(([k, v]) => {
      replicas[k] = v.toObject();
    });

    return {
      upgradeBeaconController: this.upgradeBeaconController!.address,
      xAppConnectionManager: this.xAppConnectionManager!.address,
      updaterManager: this.updaterManager!.address,
      governance: this.governance!.toObject(),
      home: this.home!.toObject(),
      replicas,
    };
  }

  static fromAddresses(
    addresses: CoreContractAddresses,
    signerOrProvider: SignerOrProvider,
  ): CoreContracts {
    const core = new CoreContracts();
    core.upgradeBeaconController =
      contracts.UpgradeBeaconController__factory.connect(
        addresses.upgradeBeaconController,
        signerOrProvider,
      );
    core.xAppConnectionManager =
      contracts.XAppConnectionManager__factory.connect(
        addresses.xAppConnectionManager,
        signerOrProvider,
      );
    core.updaterManager = contracts.UpdaterManager__factory.connect(
      addresses.updaterManager,
      signerOrProvider,
    );

    // TODO: needs type magic for turning governance, home and replicas to BeaconProxy contracts
    const governanceRouterImplementation =
      contracts.GovernanceRouter__factory.connect(
        addresses.governance.implementation,
        signerOrProvider,
      );
    const governanceRouterProxy = contracts.GovernanceRouter__factory.connect(
      addresses.governance.proxy,
      signerOrProvider,
    );
    const governanceRouterUpgradeBeacon =
      contracts.UpgradeBeacon__factory.connect(
        addresses.governance.beacon,
        signerOrProvider,
      );
    core.governance = new BeaconProxy<contracts.GovernanceRouter>(
      governanceRouterImplementation,
      governanceRouterProxy,
      governanceRouterUpgradeBeacon,
    );

    const homeImplementation = contracts.Home__factory.connect(
      addresses.home.implementation,
      signerOrProvider,
    );
    const homeProxy = contracts.Home__factory.connect(
      addresses.home.proxy,
      signerOrProvider,
    );
    const homeUpgradeBeacon = contracts.UpgradeBeacon__factory.connect(
      addresses.home.beacon,
      signerOrProvider,
    );
    core.home = new BeaconProxy<contracts.Home>(
      homeImplementation,
      homeProxy,
      homeUpgradeBeacon,
    );

    for (const domain of Object.keys(addresses.replicas!)) {
      const replicaImplementation = contracts.Replica__factory.connect(
        addresses.replicas![domain].implementation,
        signerOrProvider,
      );
      const replicaProxy = contracts.Replica__factory.connect(
        addresses.replicas![domain].proxy,
        signerOrProvider,
      );
      const replicaUpgradeBeacon = contracts.UpgradeBeacon__factory.connect(
        addresses.replicas![domain].beacon,
        signerOrProvider,
      );
      core.replicas[parseInt(domain)] = new BeaconProxy<contracts.Replica>(
        replicaImplementation,
        replicaProxy,
        replicaUpgradeBeacon,
      );
    }
    return core;
  }
}
