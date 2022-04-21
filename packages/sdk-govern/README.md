## Nomad Govern SDK

This package includes the `CallBatch`, a management system for Nomad governance
actions. `CallBatch` allows developers to easily instruct the Nomad governance
system to interact with contracts on any network. It is intended to be used in
conjunction with a `NomadContext` object.

## Building

```
yarn build
```

### Scripts

Submit a batch of governance transactions to the `GovernanceRouter` the governing domain:

```sh
# script args are 'configuration file' 'call batch file'
$ yarn run ts-node scripts/executeGovernorDomain.ts path/to/config.json path/to/callBatch.json
```

Check whether governance batches have been delivered to remote domains:

```sh
# script args are 'configuration file' 'call batch file'
$ yarn run ts-node scripts/printStatus.ts path/to/config.json path/to/callBatch.json
```

Execute governance batches on remote domains (this process is permissionless once the batch has been delivered):

```sh
# script args are 'configuration file' 'call batch file' 'transaction overrides file'
$ yarn run ts-node scripts/executeRemoteDomains.ts path/to/config.json path/to/callBatch.json path/to/overrides.json
```
