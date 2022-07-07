## Nomad Indexer

A tool that indexes Nomad Events from one or more blockchains.

### Requiremets

- Docker

### Project Setup

To start the app in docker:

1. From the monorepo root, run `yarn install` to install dependencies
2. In the indexer package folder, create a `.env` file and copy the contents of `.env.example` into it. Replace the rpc urls with urls that have the api keys in them.
3. From the monorepo root, run `yarn indexer docker:build` to build the docker image
4. From the monorepo root, run `yarn indexer docker:up` to start the app in docker

Head to http://localhost:8081/healthcheck. If all if good, you should see `OK!`.

### Deployment

Deployments are done via the [terraform repo](https://github.com/nomad-xyz/terraform-nomad-stack)

### Monitoring

See logs from all environments in our [Grafana Dashboard](https://nomadxyz.grafana.net/d/hxT-q6-7z/indexer-dashboard?orgId=1)
