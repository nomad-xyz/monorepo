## Nomad Core 𓀃

Solidity implementations of the core Nomad protocol.

### Setup

- `yarn bootstrap`: `yarn clean` and `yarn build`

### Build

- `yarn build`: compile smart contracts and create definitions for the SDK

### Test

For testing, we use [Foundry](https://getfoundry.sh/).

- Run `yarn build:accumulator-cli` from the root directory of the monorepo. It will build a rust-based cli tool that creates Sparse Merkle Tree proofs for arbitrary data. It's used in our testing suite via the `--ffi` flag for Forge. The binary is built in thre `/scripts` top-level directory of the monorepo
- `yarn test` will run all tests. Note that `--ffi` is enabled by default,
- `yarn snapshot --check` will run the test suite and verify that it doesn't produce a different gas snapshot from the existing (`.gas-snapshot`)
- `yarn snapshot` will create a new `.gas-snapshot`. You can inspect the different gas usage via `git diff`
- `yarn gen-proof` will execute the `accumulator-cli` binary

### Static Analysis

The monorepo is configured to run [slither](https://github.com/crytic/slither) with every PR. We suggest all contributors to use slither while developing, to avoid common mistakes.

- Install Slither
- Run `yarn test:static-analyze`

We use a `yarn command` because we need to link the top-level `node_modules` directory in the `core-contracts` package. It's a known [issue](https://github.com/crytic/slither/issues/852) for which the workaround is to link the directory.
