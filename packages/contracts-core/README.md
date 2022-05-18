## Nomad Core

Solidity implementations of the core Nomad protocol.

### Setup

- See repo setup
- `brew install jq` &nbsp; OR &nbsp; `sudo apt-get install jq`
- `yarn bootstrap`

### Build

- `yarn build`

### Test

For testing, we use [Foundry](https://getfoundry.sh/).

- `yarn test`
- `yarn snapshot --check` will run the test suite and verify that it doesn't produce a different gas snapshot from the existing one (`.gas-snapshot`)
