## Nomad Provider

Nomad Provider is a management system for
[ethers.js](https://docs.ethers.io/v5/) providers and signers that helps
developers connect to multiple networks simultaneously. It is part
of the [Nomad](https://github.com/nomad-xyz/nomad-monorepo) project, but may
be useful to other multi-chain systems.

This package includes the `MultiProvider`, as well as an `NomadContext` for
interacting with deployed Nomad systems. The dev, staging, and mainnet Nomad
systems have pre-built objects for quick development.

## Examples

- [Counter xApp](https://github.com/nomad-xyz/nomad-monorepo/tree/main/examples/counter-xapp)
- [Bridge UI](https://github.com/nomad-xyz/nomad-monorepo/tree/main/examples/example-ui)

### Intended Usage

```ts
import * as ethers from 'ethers';

import { mainnet } from '@nomad-xyz/sdk';
import { MessageStatus } from '@nomad-xyz/sdk/nomad';

// Set up providers and signers
const someEthersProvider = ethers.providers.WsProvider('...');
const someEthersSigner = new AnySigner(...);
mainnet.registerProvider('ethereum', someEthersProvider);
mainnet.registerSigner('ethereum', someEthersSigner);

// We have shortcuts for common provider/signer types
mainnet.registerRpcProvider('moonbeam', 'https://rpc.api.moonbeam.network');
mainnet.registerWalletSigner('moonbeam', '0x1234...');

// Send 1 ETH from ethereum to moonbeam (auto-converted to WETH on transfer).
// See https://github.com/nomad-xyz/nomad-monorepo/tree/main/typescript/nomad-sdk/src/nomad/domains
// for supported dev, staging, and mainnet networks.
await mainnet.sendNative(
    'ethereum', // source network
    'moonbeam',  // destination network
    1 * ethers.constants.WeiPerEther, // amount in smallest unit (amount * 10^decimals)
    '0x1234...',  // recipient address on moonbeam
);

// Send 1 WETH back from moonbeam to ethereum. When specifying token info (3rd param),
// use the domain and address of the canonical token on the originating chain. Our 1 WETH
// is now on moonbeam but we still specify the domain 'ethereum' and the address
// of the WETH contract on Ethereum.
const transferMessage = await mainnet.send(
    'moonbeam',  // source network
    'ethereum', // destination network
    { domain: 'ethereum', id: "0xc02a..."} // canonical token info
    1 * ethers.constants.WeiPerEther, // amount
    '0x1234...'  // recipient address on ethereum
    { gasLimit: 300_000 } // standard ethers tx overrides
);

// Print tx hash of transaction that dispatched transfer on moonbeam
console.log(`Tx hash on moonbeam: ${transferMessage.transactionHash()}`);

// Track the status of your transfer from moonbeam to ethereum
const interval = 10 * 1000; // 10 second polling interval
let status = (await message.events()).status;
while (status != MessageStatus.Processed) {
    await new Promise((resolve) => setTimeout(resolve, interval)); // pause

    status = (await message.events()).status; // update status

    const statusAsString = MessageStatus[status];
    console.log(`Current status of transfer: ${statusAsString}`); // print status
}

// Print tx hash of transaction that processed transfer on ethereum
const processTxHash = transferMessage.getProcess().transactionHash();
console.log(`Success! Transfer processed on Ethereum with tx hash ${processTxHash}.`)

// so easy.
```

# Updating SDK Contracts

When we deploy a new non-prod environment, the contract addresses must be updated in `nomad-sdk/src/nomad/domains/${environment}.ts`

Here's a checklist for you when doing so:

- Update Contract Addresses
- Update Deployed Block Height
- Bump SDK Version `npm version patch`
- Release SDK `npm publish`
- Update SDK Version pin anywhere it needs to be (ex. `nomad-monitor`)

# Release Process

```
$ export $VERSION_NUMBER=$(npm version patch)
$ git commit -m sdk@$VERSION_NUMBER
$ git tag -s $VERSION_NUMBER
$ git push && git push --tags
```

Then publish on the package manager
