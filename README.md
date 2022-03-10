# Nomad

## TODOs

- [ ] write real readme(s)
- [x] publishing w/ npmignore etc
- [x] standardize on a set of standard scripts build/prettier/lint/test
- [x] use `yarn workspace foreach`
- [x] hardhat-packager
- [x] use TS references
- [x] fix solidity builds
- [x] proper tsconfig inheritance
- [x] typechain packaging
- [x] remove deploy dependency on contract-interfaces, replace with
      dep on `whatever-contracts`
- [x] .nvmrc

### Repo Setup

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

### Repo Layout

This repo is a [yarn workspace](https://yarnpkg.com/features/workspaces). All
packages are located in `packages/`. Generally, packages are intended to
contain a `src/` directory, which is built to `lib/` for publishing.

The deploy package is not intended to be published.

### Publishing

Before publishing, ensure all packages are built

```
$ yarn build
```
