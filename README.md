# Nomad

Nomad is cross-chain communication protocol. This repo contains the following:

- Smart contracts for the core Nomad protocol
- Smart contracts for the Nomad token bridge
- SDKs for Nomad's core protocol, bridge, and governance systems
- Tooling for local environment simulation
- Smart contract deployment tooling

### Development setup

- make sure you're on yarn2!

Install all dependencies

```
$ yarn
```

Compile the solidity and the initial typechain TS source for each solidity
package:

```
$ yarn bootstrap
```

Build all workspace packages

```
$ yarn build
```

### Repo Layout

This repo is a [yarn workspace](https://yarnpkg.com/features/workspaces). All
packages are located in `packages/`. Generally, packages are intended to
contain a `src/` directory, which is built to `dist/` for publishing.

Packages for publishing:

- `@nomad-xyz/contracts-core`
- `@nomad-xyz/contracts-router`
- `@nomad-xyz/contracts-bridge`
- `@nomad-xyz/sdk`
- `@nomad-xyz/sdk-bridge`
- `@nomad-xyz/sdk-govern`

Tooling and other unpublished packages:

- `keymaster`
- `local-enviroment`
- `deploy`
- `monitor`

Examples:

- `@nomad-xyz/example-xapps`
