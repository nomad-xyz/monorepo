# Nomad Upgrade (VERY EXPERIMENTAL)

> There is nothing permanent except change.
>
> Heraclitus

## Introduction

The typescript wrapper will be refactored with Oclif to improve ergonomics, and add instructions to the user.

The upgrade pipeline is roughly divided into two parts:

- ChainOps: Responsible for interacting with the chain, deploying contracts and generating the appropriate artifacts. It's `Upgrade.sol` and it's written in Solidity. It's meant to be executed via `forge script`
- I/O operations: Responsible for reading the protocol's global config and supplying the ChainOps part of the pipeline with the required data (e.g contract addresses). It's also responsible for receiving the output from the ChainOps part and storing part of it as artifacts. It's written in Typescript and is, in essence, a CLI wrapper around `forge script`

### Future outlook

As `forge script` matures, the typescript wrapper will get thinner, as more functionality is moved into Solidity (e.g multi-chain deployments). The current biggest limitations are an easy way to input and output data from `forge script`so that the upgrade pipeline can:

- Read a config file
- Execute upgrade based on config file
- Store artifacts that are part of the output of the upgrade

Forge script is under heavy development, so I expect the typescript wrapper to be considerably thinner in the next Nomad Upgrade.

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

### Output & Artifacts

- Artifacts & raw output are placed in `upgrade-artifacts`, a directory that is created at the root of `upgrade`
- Artifacts are extracted from the raw output. The raw output contains ALL the relevant information of a Nomad Upgrade (Nomgrade)
- All the files are placed under their respective domain (e.g `upgrade-artifacts/ethereum`)
- Raw output is stored for every command that is executed
- Artifacts are placed in `artifacts.json`
  - `executeCallBatchCall`: CallData to `executeCallBatch()` on the Governance Router of a domain, after it has received the Governance Message. Abi encoded function signature and arguments
  - `callBatch`: Like `executeCallBatchCall`, but without the function signature
  - `executeGovernanceActions`: Calldata to `executeGovernanceActions()` on the Governor Chain. This must be executed by the Nomad Governance and will send the Governance Messages to all domains, that then will need to be executed via `executeCallBatch()`. Abi encoded function signature and arguments

### Upgrade Protocol

```
ts-node ./scripts/upgrade.ts -c config/staging.json upgrade -a
```

### Print Governance Actions calldata for Governor Chain (Ethereum)

```
ts-node ./scripts/upgrade.ts -c config/staging.json printGovActions -d ethereum
```

The output is also stored raw and in artifacts in `upgrade-artifacts`

## Contribute

Please no

## License

MIT
