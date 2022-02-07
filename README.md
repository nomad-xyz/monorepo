- [ ] write real readme
- [ ] break out governance from core?
- [ ] publishing w/ npmignore etc
- [ ] standardize on a set of standard scripts build/prettier/lint/test
- [ ] use `yarn workspace foreach`
- [ ] hardhat-packager
- [ ] use TS resolutions
- [x] fix solidity builds
- [x] proper tsconfig inheritance
- [x] typechain packaging
- [x] remove deploy dependency on contract-interfaces, replace with
      dep on `whatever-contracts`
- [x] .nvmrc

### Repo Setup

- make sure you're on yarn2!

Install workspace-tools

```
$ yarn plugin import workspace-tools
```

Install all dependencies

```
$ yarn
```

Compile the solidity and the initial typechain TS source for each solidity
package:

```
$ yarn bootstrap-ts
```

### Repo Layout

This repo is a [yarn workspace](https://yarnpkg.com/features/workspaces). All
packages are located in `packages/`. Generally, packages are intended to
contain a `src.ts/` directory, which is built to `lib/` for publishing.

The deploy package is not intended to be published.

### Publishing

Before publishing, ensure all packages are built

```
$ yarn build
```
