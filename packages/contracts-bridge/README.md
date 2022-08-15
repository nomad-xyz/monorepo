## Nomad Bridge

Solidity implementations of the [Nomad Bridge](https://app.nomad.xyz).

### Setup

- `yarn bootstrap`: `yarn clean` and `yarn build`

### Build

- `yarn build`: compile smart contracts and create definitions for the SDK

### Test

For testing, we use [Foundry](https://getfoundry.sh/).

- Run `yarn build:accumulator-cli` from the root directory of the monorepo. It will build a rust-based cli tool that creates Sparse Merkle Tree proofs for arbitrary data. It's used in our testing suite via the `--ffi` flag for Forge. The binary is built in there `/scripts` top-level directory of the monorepo
- `--ffi` means that Forge will run arbitrary shell commands as part of the testing suite. You should never run `forge --ffi` without knowing what exactly are the shell commands that will be executed, as the testing suite could be malicious and execute malicious commands. This is why the feature is disabled by default and must be explicitly enabled.
- `yarn test:unit` will run all unit tests. Note that `--ffi` is enabled by default,
- `yarn snapshot` will create a new `.gas-snapshot`. You can inspect the different gas usage via `git diff`
- 'yarn snapshot:check' will run the test suite and check gas consumption against the **existing** `.gas-snapshot`. It will `pass` only if there is no change in the gas consumption
- `yarn gen-proof` will execute the `accumulator-cli` binary

### Suggested workflow

- Define feature
- Write tests based on [Foundry best practices](https://book.getfoundry.sh) and the existing test structure
- Run test suite with `FOUNDRY_PROFILE=bridge forge test --ffi -vvv` and verify that your new tests `FAIL`
- Write the new feature
- Run again the test suite and verify that the tests `PASS`
- Run `yarn snapshot` to produce the new gas snapshot. You can't use `yarn snapshot:check`, since you added new tests that are not present in the current `.gas-snapshot`. Gas snapshots showcase how much gas your tests consume and are useful to serve as a benchmark for the gas consumption of your code. As you write new features and/or refactor your code, the gas snapshot can change, illustrating where your changes affected the already defined codepaths. You can read more about gas snapshots on the [Foyndry book](https://book.getfoundry.sh/forge/gas-snapshots)
- Run `yarn storage-inspect:check` to see if the storage layout of the smart contracts have changed. If it has, this could potentially create problems in the upgrade process. If the new layout is correct, run `yarn storage-inspect:generate` to create a new layout file (replacing the old one) and commit the new file. If we don't commit the new layout, the CI will fail.

**Tip**: It is advised to run the forge commands on their own and not via `yarn` or `npm` for faster development cycle. `yarn` will add a few seconds of lag, due to the fact that it has to spin up a `Node` runtime and the interpret the `yarn` source code.

### Static Analysis

We suggest all contributors to use slither while developing, to avoid common mistakes.

- Install Slither
- Run `yarn test:static-analyze`

We use a `yarn command` because we need to link the top-level `node_modules` directory in the `bridge-contracts` package. It's a known [issue](https://github.com/crytic/slither/issues/852) for which the workaround is to link the directory.
