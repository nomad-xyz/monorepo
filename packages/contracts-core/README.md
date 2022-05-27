## Nomad Core

Solidity implementations of the core Nomad protocol.

### Setup

- See repo setup
- `brew install jq` &nbsp; OR &nbsp; `sudo apt-get install jq`
- `yarn bootstrap`

### Build

- `yarn build`

### Test

For testing, we use [Foundry](https://getfoundry.sh/). We also use the `accumulator-cli` from the `scripts` directory at the root of the repository. Before running tests in this package, you need to run `yarn build` at the top level so that it builds the `accumulator-cli`.

- `yarn test` will run all tests. Note that `--ffi` is enabled by default,
- `yarn snapshot --check` will run the test suite and verify that it doesn't produce a different gas snapshot from the existing one (`.gas-snapshot`)
