## Nomad SDK

This package includes the `NomadContext`, a management system for Nomad core
contracts, which inherits from the [`MultiProvider`](https://www.npmjs.com/package/@nomad-xyz/multi-provider). `NomadContext` allows
developers to easily interact with the Nomad system on any number of networks.

-------------------------

### Documentation
 - [Multi Provider](https://docs.nomad.xyz/multi-provider/)
 - [Nomad SDK](https://docs.nomad.xyz/sdk/)
 - Example: [SDK Quick Start](https://github.com/nomad-xyz/examples/tree/main/packages/sdk-quickstart)

-------------------------

### Intended Usage

Instantiate a [NomadContext](https://docs.nomad.xyz/sdk/classes/nomadcontext):

```ts
// sdk includes a wasm module, so must await the import
const { NomadContext } = await import('@nomad-xyz/sdk')

type Env = 'production' | 'staging' | 'development'
// staging is the recommended testnet environment
const environment: Env = 'staging'
// instantiate a preconfigured NomadContext
const nomadContext = await NomadContext.fetch(environment)
```

Commonly used methods:

```ts
// register custom rpc provider
nomadContext.registerRpcProvider('ethereum', 'https://...')
// register signer
nomadContext.registerSigner('ethereum', someSigner)

// convert domain name to domain ID
nomadContext.resolveDomain('ethereum') // nomad domain ID: 6648936
// convert domain ID to domain name
nomadContext.resolveDomainName(6648936) // nomad domain name: ethereum

// get the core nomad contracts for a given domain
nomadContext.getCore('ethereum')
// get the replica contract for ethereum on moonbeam
nomadContext.mustGetReplicaFor('moonbeam', 'ethereum')

// check liveness
nomadContext.checkHomes(['ethereum', 'moonbeam'])
nomadContext.blacklist() // returns set of down networks, if any
```

Fetch a [NomadMessage](https://docs.nomad.xyz/sdk/classes/nomadmessage)

```ts
import { NomadMessage } from '@nomad-xyz/sdk'
const message = await NomadMessage.baseSingleFromTransactionHash(nomadContext, 'ethereum', '0x1234...')
// get the status of a message (NOT RECOMMENDED FOR EXTENSIVE USAGE)
// 1 = dispatched
// 2 = included
// 3 = relayed
// 4 = processed
const { status } = await message.events()
// get a timestamp (in seconds) when a message will be ready to process
// on the destination
const confirmAt = await message.confirmAt()
// manually claim on destination after latency period
// Ethereum destination only
const receipt = await message.process()
```

-------------------------

### Building

```
yarn build
```
