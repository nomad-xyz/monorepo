# Nomad

Nomad is a cross-chain communication protocol. This repo contains the following:

- Smart contracts for the core Nomad protocol
- Smart contracts for the Nomad token bridge
- SDKs for Nomad's core protocol, bridge, and governance systems
- Tooling for local environment simulation
- Smart contract deployment tooling

### Development setup

Confirm that you are using yarn2!

```
$ yarn -v
```

Should return greater than `1.x.x`. Use this [tutorial](https://yarnpkg.com/getting-started/migration) to upgrade if needed.

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
contain a `src/` directory, which is built to `dist/` See [Publishing to npm](#publishing-to-npm) for more details on publishing each package to [npm](https://www.npmjs.com/settings/nomad-xyz/packages).

Published packages:

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

- see [examples repo here](https://github.com/nomad-xyz/examples)

### Publishing to npm

Publishing a package involves first, building the package which outputs a built `dist/` folder. Once we have a `dist/` folder, we run `npm publish`. The entire package folder, including `src/` and `dist/`, is published to npm. The location of the entrypoint file (`dist/index.js`) and TypeScript types (`dist/index.d.ts`) are specified in each package's package.json.
