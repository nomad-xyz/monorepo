import { ethers } from 'ethers';
import { Key, utils } from '../src';

import { setupTwo } from './common';
import { TokenIdentifier, FailedHomeError } from '@nomad-xyz/sdk/nomad';

async function testSdkFailedHome() {
  let success = false;

  const { tom, jerry, tomActor, jerryActor, n } = await setupTwo();
  const nomadContext = n.multiprovider!;

  try {
    const address = new Key().toAddress();

    const tomHome = n.getCore(tom).home;
    if (!tomHome) throw new Error(`no home`);

    const replica = n.getCore(jerry).getReplica(tom.domain)!;
    if (!replica) throw new Error(`no replica`);

    await (
      await tomHome.dispatch(
        jerry.domain,
        ethers.utils.hexZeroPad(address, 32),
        Buffer.from(`01234567890123456789012345678`, 'utf8'),
      )
    ).wait();

    console.log(`Dispatched test transaction to tomHome`);

    const [committedRoot] = await tomHome.suggestUpdate();

    const updater = await n.getUpdater(tom);

    const fraudRoot =
      '0x8bae0a4ab4517a16816ef67120f0e3350d595e014158ba72c3626d8c66b67e53';

    const { signature: improperSignature } = await updater.signUpdate(
      committedRoot,
      fraudRoot,
    );

    // Submit fraud to tom home
    await (
      await tomHome.update(committedRoot, fraudRoot, improperSignature)
    ).wait();

    const state = await tomHome.state();
    if (state !== 2) {
      throw new Error('Tom home not failed after improper update!');
    }

    console.log(`Submitted fraud update to tom home!`);

    const token: TokenIdentifier = {
      domain: tom.domain,
      id: '0x111111',
    };

    // Try to send token through SDK and expect error after preflight check
    try {
      await nomadContext.send(
        tom.name,
        jerry.name,
        token,
        100,
        '0x222222222',
        false,
        {
          gasLimit: 10000000,
        },
      );
    } catch (e) {
      // Expect failed home error
      if (!(e instanceof FailedHomeError)) {
        throw new Error('Error was not of type FailedHomeError');
      }

      // Expect blacklist to be populated
      if (!nomadContext.blacklist().has(tom.domain)) {
        throw new Error('SDK did not black list he failed tom home!');
      }

      success = true;
    }
  } catch (e) {
    console.error(`Test failed:`, e);
  }

  // Teardown
  await n.end();

  await Promise.all([tom.down(), jerry.down()]);

  if (!success) process.exit(1);
}

(async () => {
  await testSdkFailedHome();
})();
