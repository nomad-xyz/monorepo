import { expect } from 'chai';

import { assertBeaconProxy } from '../core/checks';
import { BridgeDeploy as Deploy } from './BridgeDeploy';
import TestBridgeDeploy from './TestBridgeDeploy';
import { checkVerificationInput } from '../core/checks';
import { AnyBridgeDeploy } from '.';

const emptyAddr = '0x' + '00'.repeat(32);

export async function checkBridgeDeployValues(
  deploy: Deploy | TestBridgeDeploy,
  remotes: number[],
) {
  assertBeaconProxy(deploy.contracts.bridgeToken!);
  assertBeaconProxy(deploy.contracts.bridgeRouter!);

  if (deploy.config.weth) {
    expect(deploy.contracts.ethHelper).to.not.be.undefined;
  } else {
    expect(deploy.contracts.ethHelper).to.be.undefined;
  }

  const bridgeRouter = deploy.contracts.bridgeRouter?.proxy!;
  expect(await bridgeRouter.owner()).to.equal(
    deploy.coreContractAddresses.governance.proxy,
  );

  // check verification addresses
  checkVerificationInput(
    deploy,
    'BridgeToken Implementation',
    deploy.contracts.bridgeToken?.implementation.address!,
  );
  checkVerificationInput(
    deploy,
    'BridgeToken UpgradeBeacon',
    deploy.contracts.bridgeToken?.beacon.address!,
  );
  checkVerificationInput(
    deploy,
    'BridgeToken Proxy',
    deploy.contracts.bridgeToken?.proxy.address!,
  );
  checkVerificationInput(
    deploy,
    'BridgeRouter Implementation',
    deploy.contracts.bridgeRouter?.implementation.address!,
  );
  checkVerificationInput(
    deploy,
    'BridgeRouter UpgradeBeacon',
    deploy.contracts.bridgeRouter?.beacon.address!,
  );
  checkVerificationInput(
    deploy,
    'BridgeRouter Proxy',
    deploy.contracts.bridgeRouter?.proxy.address!,
  );
  checkVerificationInput(
    deploy,
    'TokenRegistry UpgradeBeacon',
    deploy.contracts.tokenRegistry?.beacon.address!,
  );
  checkVerificationInput(
    deploy,
    'TokenRegistry Proxy',
    deploy.contracts.tokenRegistry?.proxy.address!,
  );
  if (deploy.config.weth) {
    expect(
      deploy.verificationInput.filter(
        (input) => input.address === deploy.contracts.ethHelper?.address,
      ).length,
    ).to.equal(1, 'No eth helper found');
  }
}

/// Check bridge connections for an n-to-n setup (all connected to all)
export async function checkBridgeConnections(deploys: AnyBridgeDeploy[]) {
  for (const deploy of deploys) {
    const bridgeRouter = deploy.contracts.bridgeRouter?.proxy!;
    const remotes = deploys.filter(
      (currDeploy) => deploy.chain.domain !== currDeploy.chain.domain,
    );

    remotes.forEach(async (remote) => {
      const remoteDomain = remote.chain.domain;
      const registeredRouter = await bridgeRouter.remotes(remoteDomain);
      expect(registeredRouter).to.not.equal(emptyAddr);
    });
  }
}

/// Check bridge connections for an hub and spoke setup
export async function checkHubAndSpokeBridgeConnections(
  hub: AnyBridgeDeploy,
  spokes: AnyBridgeDeploy[],
) {
  const hubRouter = hub.contracts.bridgeRouter?.proxy!;
  for (const spoke of spokes) {
    // Hub has registered spoke
    const spokeDomain = spoke.chain.domain;
    const hubRegisteredRouter = await hubRouter.remotes(spokeDomain);
    expect(hubRegisteredRouter).to.not.equal(emptyAddr);

    // Spoke has registered hub
    const hubDomain = hub.chain.domain;
    const spokeRouter = spoke.contracts.bridgeRouter?.proxy!;
    const spokeRegisteredRouter = await spokeRouter.remotes(hubDomain);
    expect(spokeRegisteredRouter).to.not.equal(emptyAddr);

    // Spokes are not registered in each other
    const otherSpokes = spokes.filter(
      (otherSpoke) => otherSpoke.chain.domain !== spoke.chain.domain,
    );
    for (const otherSpoke of otherSpokes) {
      // spoke => otherSpoke is not registered
      const otherSpokeRegisteredRemote = await spokeRouter.remotes(
        otherSpoke.chain.domain,
      );
      expect(otherSpokeRegisteredRemote).to.equal(emptyAddr);
      // otherSpoke => spoke is not registered
      const otherSpokeRouter = otherSpoke.contracts.bridgeRouter?.proxy!;
      const spokeRegisteredRemote = await otherSpokeRouter.remotes(
        spoke.chain.domain,
      );
      expect(spokeRegisteredRemote).to.equal(emptyAddr);
    }
  }
}
