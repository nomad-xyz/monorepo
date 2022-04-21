# Nomad Deployment

This package enables complex multi-chain deployments of the Nomad smart
contracts. It extends the Nomad `MultiProvider` with a full automated deployment
process based on the Nomad configuration format.

### State & Features

This package is feature-complete and we have big plans for the future :)

- Run a fresh deploy with no networks
- Extend a current deployment with new networks or connections
- Gracefully resume partial deployments by re-running the script
- Future: automatically submit gnosis SAFE batches if configured

### Invocation

Invoke the deployer as follows:

```sh
# deploy script args are 'configuration file' 'overrides file'
$ yarn run ts-node scripts/deploy.ts path/to/config.json path/to/overrides.json
```

The deployer will output the new config file, the contract verification
information, and any governance actions that need to be taken.

If the deploy script errors during the process, the partial config 
and verification inputs will still be output, so that contracts deployed
are not lost. 

Governance transactions are idempotent;
if the state on-chain doesn't change,
the same config will deterministically produce 
the same set of governance transactions.

### Verification

Deployment will produce a verification json output. Set the `ETHERSCAN_KEY` env
var in your `.env` file, then run:

```sh
# Verify script args are 'config_json' 'verification_json'
$ yarn run ts-node ./scripts/verify path/to/config.json path/to/verification.json

# OR 'environment' 'verification_json'
# to use environments in the published configuration package
$ yarn run ts-node ./scripts/verify development path/to/verification.json
```
