# Nomad Upgrade (VERY EXPERIMENTAL)

> There is nothing permanent except change.
>
> Heraclitus

The typescript wrapper will be refactored with Oclif to improve ergonomics, and add instructions to the user.

The upgrade pipeline is roughly divided into two parts:

- ChainOps: Responsible for interacting with the chain, deploying contracts and generating the appropriate artifacts. It's `Upgrade.sol` and it's written in Solidity. It's meant to be executed via `forge script`.
- I/O operations: Responsible for reading the protocol's global config and supplying the ChainOps part of the pipeline with the required data (e.g contract addresses). It's also responsible for receiving the output from the ChainOps part and storing part of it as artifacts. It's written in Typescript and is, in essence, a CLI wrapper around `forge script`.

## Installation

- Install Foundry and update it to the latest version via `foundryup`
- Install `ts-node`

## Usage

```
ts-node ./scripts/upgrade.ts -c <path_to_config> <functionality> -d domain1 -d domain2

HELP
--config: path to config file
--domain: Domains to which the functionality will be applied, expects a domain name (e.g ethereum, evmos, etc.)
--all: Do all domains
--resume: In case upgrade has run before but it wasn't complete for some reason (e.g RPC failing), you can resume the transactions. Please make sure that the account nonce hasn't been incremented in the meantime (e.g by sending a tx)

functionality:
upgrade: Upgrade the protocol
executeCallbatch: Execute a callBatch on some domain
printGovActions: Print the bytecode calldata in hex format for executing `executeGovernanceActions()`, encoded with the correct args
```

The output is also stored raw and in artifacts in `upgrade-artifacts`

## Contribute

Please no

## License

MIT
