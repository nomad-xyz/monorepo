# Nomad Deployment

This package enables complex multi-chain deployments of the Nomad smart
contracts. It extends the Nomad `MultiProvider` with a full automated deployment
process based on the Nomad configuration format.

### State & Features

TODO: write this readme section :)

### Invocation

TODO: write this readme section :)

### Verification

Deployment will produce a verification json output. Set the `ETHERSCAN_KEY` env
var in your `.env` file, then run:

```
$ yarn run ts-node ./scripts/verify development path/to/verification.json
```
