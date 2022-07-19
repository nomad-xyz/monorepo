## Nomad Govern SDK

This package includes the `CallBatch`, a management system for Nomad governance
actions. `CallBatch` allows developers to easily instruct the Nomad governance
system to interact with contracts on any network. It is intended to be used in
conjunction with a `NomadContext` object.

## Building

```
yarn build
```

### Submit Transactions

Before submitting transactions on the governor domain,
or executing transactions on remote domains,
set the `SIGNER_KEY` env var in your `.env` file.
Supply a private key for an account funded with
sufficient gas tokens on the domain(s) where 
transactions will be submitted.

Submit a batch of governance transactions on the governing domain:

```sh
# script args are 'configuration file' 'call batch file'
$ yarn run ts-node scripts/executeGovernorDomain.ts path/to/config.json path/to/callBatch.json
```

This will execute transactions on the governing domain immediately,
and initiate the process of bridging transactions to all other chains.

### Execute Remote Domains

Once a governance batch has been submitted,
the remote batches must be relayed to their respective domains.
Once it has been relayed, 
the batch can be executed permissionlessly.

Execute governance batches on remote domains:

```sh
# script args are 'configuration file' 'call batch file' 'transaction overrides file'
$ yarn run ts-node scripts/executeRemoteDomains.ts path/to/config.json path/to/callBatch.json path/to/overrides.json
```

### Check Status on Remote Domains

Check whether governance batches have been delivered to remote domains:

```sh
# script args are 'configuration file' 'call batch file'
$ yarn run ts-node scripts/printStatus.ts path/to/config.json path/to/callBatch.json
```

Once batches have been delivered, they can be executed permissionlessly.
