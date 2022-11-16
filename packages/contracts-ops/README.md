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
- `JsonWriter.sol` utility for writing simple JSON to files
  - initialize a `Buffer` in memory
  - use `writeLine` to write lines to the buffer
  - use `writeArrayOpen` and `writeArrayClose` to start and end arrays
  - use `writeObjectOpen` and `writeObjectClose` to start and end objects
  - use `writeKv` to write object KV pairs
  - use `flushTo` to persist the contents of the buffer to a file on disk

## Scripts & Entrypoints

- `RotateUpdaters.s.sol`
  - Rotates updaters of the Home and all Replicas on a given chain
  - Uses `Config` and `CallBatch`
  - Entrypoints:
    - `createCallList(configFile, localDomain, outputFile)`
      - Outputs a list of calls, suitable for combining into a governance
        call batch
    - `createRecoveryTx(configFile, localDomain, outputFile)`
      - Outputs a built transaction, suitable for submitting to the
        governance router via the recovery manager
- `UpgradeCallBatches.s.sol`
  - Builds the calldata needed to be sent from the multi-sigs to upgrade the protocol
  - uses `CallBatch` and `Config`
  - Entrypoint:
    - `printCallBatches(string,string[],string,bool)`:
      - name of config JSON file in `./actions` folder (e.g `production.json` for `./actions/production.json`)
      - list of domains for which batches should be built (e.g `[evmos,ethereum,moonbeam]`)
      - name of the domain that should be considered as local (e.g `ethereum`)
      - `true` if scripts should run for recovery mode, `false` otherwise
  - Example:
    - `FOUNDRY_PROFILE=ops forge script UpgradeCallBatches --sig "printCallBatches(string,string[],string,bool)" "production.json" "[evmos,avalanche,xdai,milkomedaC1,moonbeam,ethereum]" "ethereum" true`
- `Reboot.s.sol`
  - Performs all steps necessary to reboot the protocol
    - Deploy fresh implementations 
    - Push calls to upgrade to fresh implementations 
    - Rotate the Updater key
    - Re-enroll the Replicas in the xAppConnectionManager
  - uses `CallBatch` and `Config`
  - Entrypoint:
    - `runReboot(string,string,string,bool)`:
      - name of config JSON file in `./actions` folder (e.g `production.json` for `./actions/production.json`)
      - domain to run the script on (e.g `ethereum`)
      - name of JSON file to output callBatch (e.g `rebootActions.json` for `./actions/rebootActions.json`)
      - `true` to overwrite existing contents of output file, `false` otherwise
  - Example:
    - `FOUNDRY_PROFILE=ops forge script Reboot --sig "runReboot(string,string,string,bool)" "production.json" "ethereum" "rebootActions.json" true`

## Usage

Scripts should be invoked via `forge`. See the [documentation](https://book.getfoundry.sh/tutorials/solidity-scripting)
