# Nomad Deployment

This package enables complex multi-chain deployments of the Nomad smart
contracts. It extends the Nomad `MultiProvider` with a full automated deployment
process based on the Nomad configuration format.

### State & Features

This package is feature-complete and we have big plans for the future :)

- Run a fresh deploy with no networks
- Extend a current deployment
- Future: gracefully resume partial deployments
- Future: automatically submit gnosis SAFE batches if configured

### Invocation

Invoke the deployer as follows:

```sh
# deploy script args are 'configuration file' 'overrides file'
$ yarn run ts-node scripts/deploy.ts path/to/config.json path/to/overrides.json
```

The deployer will output the new config file, the contract verification
information, and any governance actions that need to be taken

### Verification

Deployment will produce a verification json output. Set the `ETHERSCAN_KEY` env
var in your `.env` file, then run:

```sh
# Verify script args are 'environment' 'verification_json'
$ yarn run ts-node ./scripts/verify development path/to/verification.json
```
