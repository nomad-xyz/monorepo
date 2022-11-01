# Contracts Ops

Contains forge scripts for Nomad system maintenance

## Building Blocks

- `Config.sol` utilities for loading and parsing Nomad Config JSON
  - initalize the config with the path to a JSON config
- `CallBatch.sol` utility for aggregating calls into a callbatch, and
  outputting the batch to JSON
  - initialize a callbatch with the local domain name and an output path
  - output paths will be prepended with `./actions/`
  - call `push(to, data)` to add a call to the batch
  - call `finish()` to output the list of calls
  - call `build()` to output the built call to `executeGovernanceActions()`

## Scripts & Entrypoints

- `RotateUpdaters.sol`
  - Rotates updaters of all
  - Uses `Config` and `CallBatch`
  - Entrypoints:
    - `createCallList(configFile, localDomain, outputFile)`
      - Outputs a list of calls, suitable for combining into a governance
        call batch
    - `createRecoveryTx(configFile, localDomain, outputFile)`
      - Outputs a built transaction, suitable for submitting to the
        governance router via the recovery manager

## Usage

Scripts should be invoked via `forge`. See the [documentation](https://book.getfoundry.sh/tutorials/solidity-scripting)
