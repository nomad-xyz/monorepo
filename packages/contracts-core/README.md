## Nomad Core 𓀃

Solidity implementations of the core Nomad protocol.

### Setup

- `yarn bootstrap`: `yarn clean` and `yarn build`

### Build

- `yarn build`: compile smart contracts and create definitions for the SDK

### Test

For testing, we use [Foundry](https://getfoundry.sh/).

- Run `yarn build:accumulator-cli` from the root directory of the monorepo. It will build a rust-based cli tool that creates Sparse Merkle Tree proofs for arbitrary data. It's used in our testing suite via the `--ffi` flag for Forge. The binary is built in there `/scripts` top-level directory of the monorepo
- `--ffi` means that Forge will run arbitrary shell commands as part of the testing suite. You should never run `forge --ffi` without knowing what exactly are the shell commands that will be executed, as the testing suite could be malicious and execute malicious commands. This is why the feature is disabled by default and must be explicitly enabled.
- `yarn test` will run all tests. Note that `--ffi` is enabled by default,
- `yarn snapshot --check` will run the test suite and verify that it doesn't produce a different gas snapshot from the existing (`.gas-snapshot`)
- `yarn snapshot` will create a new `.gas-snapshot`. You can inspect the different gas usage via `git diff`
- 'yarn snapshot:check' will run the test suite and check gas consumption against the **existing** `.gas-snapshot`. It will `pass` only if there is no change in the gas consumption
- `yarn gen-proof` will execute the `accumulator-cli` binary

### Suggested workflow

- Define feature
- Write tests based on [Foundry best practices](https://book.getfoundry.sh) and the existing test structure
- Run test suite with `FOUNDRY_PROFILE=core forge test --ffi -vvv` and verify that your new tests `FAIL`
- Write the new feature
- Run again the test suite and verify that the tests `PASS`
- Run `FOUNDRY_PROFILE=core forge snapshot` to produce the new snapshot. You can't use `forge snapshot --check`, since you added new tests that are not present in the current `.gas-snapshot`
- Using `git diff .gas-snapshot`, you can easily verify if some change you made resulted to a gas consumption change for the tests that already existed

**Tip**: It is advised to run the forge commands on their own and not via `yarn` or `npm` for faster development cycle. `yarn` will add a few seconds of lag, due to the fact that it has to spin up a `Node` runtime and the interpret the `yarn` source code.

### Static Analysis

The monorepo is configured to run [slither](https://github.com/crytic/slither) with every PR. We suggest all contributors to use slither while developing, to avoid common mistakes.

- Install Slither
- Run `yarn test:static-analyze`

We use a `yarn command` because we need to link the top-level `node_modules` directory in the `core-contracts` package. It's a known [issue](https://github.com/crytic/slither/issues/852) for which the workaround is to link the directory.
