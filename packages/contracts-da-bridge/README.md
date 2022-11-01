## Nomad DA Bridge

Solidity implementation of the Nomad Avail Data Attestation Bridge. This application receive data roots from the Avail chain and stores them in a mapping of block numbers to data roots.

### Setup

- `yarn bootstrap`: `yarn clean` and `yarn build`

### Build

- `yarn build`: compile smart contracts and create definitions for the SDK

### Test

For testing, we use [Foundry](https://getfoundry.sh/).

- `yarn test:unit` will run all unit tests. Note that `--ffi` is enabled by default

## Deploying Contracts for Demo

- In the `packages/contracts-da-bridge` directory, populate your `.env` file according the `.env.example` file
- In the `packages/contracts-da-bridge` directory, run the following command `export $(grep -v '^#' .env | xargs); forge script contracts/script/DeployDemo.s.sol --rpc-url $GOERLI_RPC_URL --etherscan-api-key $ETHERSCAN_API_KEY --broadcast -vvvv --private-key $PRIVATE_KEY --slow`
- Find the newly deployed contract addresses in the monorepo root `broadcast` folder

### Suggested workflow

- Define feature
- Write tests based on [Foundry best practices](https://book.getfoundry.sh) and the existing test structure
- Run test suite with `FOUNDRY_PROFILE=da-bridge forge test --ffi -vvv` and verify that your new tests `FAIL`
- Write the new feature
- Run again the test suite and verify that the tests `PASS`
- Run `yarn storage-inspect:check` to see if the storage layout of the smart contracts have changed. If it has, this could potentially create problems in the upgrade process. If the new layout is correct, run `yarn storage-inspect:generate` to create a new layout file (replacing the old one) and commit the new file. If we don't commit the new layout, the CI will fail.

**Tip**: It is advised to run the forge commands on their own and not via `yarn` or `npm` for faster development cycle. `yarn` will add a few seconds of lag, due to the fact that it has to spin up a `Node` runtime and the interpret the `yarn` source code.

### Static Analysis

We suggest all contributors to use slither while developing, to avoid common mistakes.

- Install Slither
- Run `yarn test:static-analyze`

We use a `yarn command` because we need to link the top-level `node_modules` directory in the `core-contracts` package. It's a known [issue](https://github.com/crytic/slither/issues/852) for which the workaround is to link the directory.
