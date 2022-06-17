# Nomad Upgrade (VERY EXPERIMENTAL)

> There is nothing permanent except change.
>
> Heraclitus

## Introduction

The typescript wrapper will be refactored with Oclif to improve ergonomics, and add instructions to the user.

The upgrade pipeline is roughly divided into two parts:

- ChainOps: Responsible for interacting with the chain, deploying contracts and generating the appropriate artifacts. It's `Upgrade.sol` and it's written in Solidity. It's meant to be executed via `forge script`
- I/O operations: Responsible for reading the protocol's global config and supplying the ChainOps part of the pipeline with the required data (e.g contract addresses). It's also responsible for receiving the output from the ChainOps part and storing part of it as artifacts. It's written in Typescript and is, in essence, a CLI wrapper around `forge script`

So, when inspecting the upgrade pipeline, the seperation of concerns is clear:

- The entire upgrade process and any on-chain actions are execute via `forge script` and the logic is written in Solidity
- The typescript wrapper is only responsible for supplying the correct data to the `forge script` and storing artifacts for posterity

### Next Steps

As `forge script` matures, the typescript wrapper will get thinner, as more functionality is moved into Solidity (e.g multi-chain deployments). The current biggest limitations are an easy way to input and output data from `forge script`so that the upgrade pipeline can:

- Read a config file
- Execute upgrade based on config file
- Store artifacts that are part of the output of the upgrade

Forge script is under heavy development, so I expect the typescript wrapper to be considerably thinner in the next Nomad Upgrade.

## Installation

- Install [Foundry](https://github.com/foundry-rs/foundry) and update it to the latest version via `foundryup`
- Install [ts-node](https://www.npmjs.com/package/ts-node)

## Usage

```
$ bin/run
Nomad Protocol Upgrade

VERSION
  nomgrade/0.0.1 darwin-arm64 node-v18.2.0

USAGE
  $ nomgrade [COMMAND]

TOPICS
  plugins  List installed plugins.

COMMANDS
  Upgrade           Upgrade the Nomad Protocol on any number of domains
  executeCallBatch  Ececute Governance messages that have arrived to a domain via 'executeCallBatch()'
  forkTest          Fork test Upgrading the Nomad Protocol on any number of domains
  help              Display help for nomgrade.
  plugins           List installed plugins.
  printGovActions
  upgrade           Upgrade the Nomad Protocol on any number of domains

```

**Note:**

Due to `oclif` bad flag parsing, when using the flag `-d`, all space-seperated strings after the flag will be parsed as flag arguments.

```bash
bin/run upgrade -d ethereum upgrade ==> domains = ['ethereum', 'upgrade']
```

For that reason, we need to use the `-d` flag at the end of the command:

```bash
bin/run printGovActions -d ethereum
```

### Output & Artifacts

- Artifacts & raw output are placed in `data` a directory that is created at the root of `upgrade`
- Artifacts are extracted from the raw output and forge artifacts. The raw output contains ALL the relevant information of a Nomad Upgrade (Nomgrade)
- All the files are placed under their respective domain (e.g `data/ethereum`)
- Raw output is stored for every command that is executed
- Artifacts are placed in `artifacts.json`
  - `callBatch`: Like `executeCallBatchCall`, but without the function signature
  - `executeGovernanceActions`: Calldata to `executeGovernanceActions()` on the Governor Chain. This must be executed by the Nomad Governance and will send the Governance Messages to all domains, that then will need to be executed via `executeCallBatch()`. Abi encoded function signature and arguments

### Upgrade Protocol

```bash
bin/run upgrade --help
Upgrade the Nomad Protocol on any number of domains

USAGE
  $ nomgrade upgrade -c <path_to_config> -k <private_key> --FLAGS

FLAGS
  -a, --all                   Run on all the domains that exist in the config file
  -c, --config=<value>        (required) Path to the config file that will be usedof the Nomad Protocol
  -d, --domains=<value>...    Run the command on specific domain(s). To pass multiple domains, simply pass them like this: -d ethereum evmos avalanche.
                              Due to a parsing bug, this flag must be passed at the end of the command. e.g 'nomgrade upgrade -d ethereum'
  -e, --etherscanKey=<value>  Etherscan API key for verifying contracts that are being deployed
  -k, --privateKey=<value>    (required) Private key to be used for issuing the upgrade transactions
  -r, --resume
  -t, --test                  Run the upgrade against local RPC nodes. It expects RPC endpoints with a port number that start ats '8545' and increments (e.g 8546, 8647, etc.)
  -w, --workingDir=<value>    [default: data] Directory for outputs and artifacts
  --help                      Show help for the command. Use --help, not -h
  --loglevel=<option>         <options: error|warn|info|debug>
  --version                   Show CLI version.

DESCRIPTION
  Upgrade the Nomad Protocol on any number of domains

ALIASES
  $ nomgrade upgrade

EXAMPLES
  $ upgrade -c <path_to_config> -k <private_key> -a -r

  $ upgrade -c <path_to_config> -k <private_key> -d ethereum evmos


```

### Print Governance Calls

```bash
bin/run printGovActions --help
USAGE
  $ nomgrade printGovActions -c <path_to_config> -d ethereum

FLAGS
  -a, --all                 Run on all the domains that exist in the config file
  -c, --config=<value>      (required) Path to the config file that will be usedof the Nomad Protocol
  -d, --domains=<value>...  Run the command on specific domain(s). To pass multiple domains, simply pass them like this: -d ethereum evmos avalanche.
                            Due to a parsing bug, this flag must be passed at the end of the command. e.g 'nomgrade upgrade -d ethereum'
  -w, --workingDir=<value>  [default: data] Directory for outputs and artifacts
  --help                    Show help for the command. Use --help, not -h
  --loglevel=<option>       <options: error|warn|info|debug>
  --version                 Show CLI version.

```

## License

MIT
