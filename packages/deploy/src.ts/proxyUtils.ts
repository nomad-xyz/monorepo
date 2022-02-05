import { BytesLike, ethers } from 'ethers';

import contracts from '@nomad-xyz/core-contracts';
import { CoreDeploy } from './core/CoreDeploy';
import { BridgeDeploy } from './bridge/BridgeDeploy';
import TestBridgeDeploy from './bridge/TestBridgeDeploy';

type Deploy = CoreDeploy | BridgeDeploy | TestBridgeDeploy;

type ProxyNames =
  | 'Home'
  | 'Replica'
  | 'Governance'
  | 'BridgeToken'
  | 'TokenRegistry'
  | 'BridgeRouter';

export class BeaconProxy<T extends ethers.Contract> {
  implementation: T;
  proxy: T;
  beacon: contracts.UpgradeBeacon;

  constructor(implementation: T, proxy: T, beacon: contracts.UpgradeBeacon) {
    this.implementation = implementation;
    this.proxy = proxy;
    this.beacon = beacon;
  }

  toObject(): ProxyAddresses {
    return {
      implementation: this.implementation.address,
      proxy: this.proxy.address,
      beacon: this.beacon.address,
    };
  }
}

export type ProxyAddresses = {
  implementation: string;
  proxy: string;
  beacon: string;
};

/**
 * Deploys the UpgradeBeacon, Implementation and Proxy for a given contract
 *
 * @param T - The contract
 */
export async function deployProxy<T extends ethers.Contract>(
  name: ProxyNames,
  deploy: Deploy,
  factory: ethers.ContractFactory,
  initData: BytesLike,
  ...deployArgs: any[]
): Promise<BeaconProxy<T>> {
  // deploy in order
  // we cast here because Factories don't have associated types
  // this is unsafe if the specified typevar doesn't match the factory output
  // :(
  const implementation = await factory.deploy(...deployArgs, deploy.overrides);
  const beacon = await _deployBeacon(deploy, implementation);
  const proxy = await _deployProxy(deploy, beacon, initData);

  // proxy wait(x) implies implementation and beacon wait(>=x)
  // due to nonce ordering
  await proxy.deployTransaction.wait(deploy.chain.confirmations);

  // add UpgradeBeacon to Etherscan verification
  deploy.verificationInput.push({
    name: `${name} Implementation`,
    address: implementation!.address,
    constructorArguments: deployArgs,
  });

  // add UpgradeBeacon to Etherscan verification
  deploy.verificationInput.push({
    name: `${name} UpgradeBeacon`,
    address: beacon!.address,
    constructorArguments: [implementation.address, deploy.ubcAddress!],
  });

  // add Proxy to Etherscan verification
  deploy.verificationInput.push({
    name: `${name} Proxy`,
    address: proxy!.address,
    constructorArguments: [beacon!.address, initData],
    isProxy: true,
  });

  return new BeaconProxy(
    implementation as T,
    factory.attach(proxy.address) as T,
    beacon,
  );
}

/**
 * Sets up a new proxy with the same beacon and implementation
 *
 * @param T - The contract
 */
export async function duplicate<T extends ethers.Contract>(
  name: ProxyNames,
  deploy: Deploy,
  prev: BeaconProxy<T>,
  initData: BytesLike,
): Promise<BeaconProxy<T>> {
  const proxy = await _deployProxy(deploy, prev.beacon, initData);
  await proxy.deployTransaction.wait(deploy.chain.confirmations);

  // add UpgradeBeacon to etherscan verification
  // add Proxy to etherscan verification
  deploy.verificationInput.push({
    name: `${name} Proxy`,
    address: proxy!.address,
    constructorArguments: [prev.beacon!.address, initData],
    isProxy: true,
  });

  return new BeaconProxy(
    prev.implementation,
    prev.proxy.attach(proxy.address).connect(deploy.deployer) as T,
    prev.beacon,
  );
}

/**
 * Returns an UNWAITED beacon
 *
 * @dev The TX to deploy may still be in-flight
 * @dev We set manual gas here to suppress ethers's preflight checks
 *
 * @param deploy - The deploy
 * @param implementation - The implementation
 */
async function _deployBeacon(
  deploy: Deploy,
  implementation: ethers.Contract,
): Promise<contracts.UpgradeBeacon> {
  const factory = new contracts.UpgradeBeacon__factory(deploy.chain.deployer);

  const beacon = factory.deploy(
    implementation.address,
    deploy.ubcAddress!,
    deploy.overrides,
  );
  return beacon;
}

/**
 * Returns an UNWAITED proxy
 *
 * @dev The TX to deploy may still be in-flight
 * @dev We set manual gas here to suppress ethers's preflight checks
 *
 * @param deploy - The deploy
 * @param beacon - The UpgradeBeacon
 * @param implementation - The implementation
 */
async function _deployProxy<T>(
  deploy: Deploy,
  beacon: contracts.UpgradeBeacon,
  initData: BytesLike,
): Promise<contracts.UpgradeBeaconProxy> {
  const factory = new contracts.UpgradeBeaconProxy__factory(
    deploy.chain.deployer,
  );

  return await factory.deploy(beacon.address, initData, deploy.overrides);
}
