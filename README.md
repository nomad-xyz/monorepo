- [ ] write real readme
- [x] fix solidity builds
- [x] proper tsconfig inheritance
- [x] typechain packaging
- [ ] break out governance from core?
- [ ] publishing w/ npmignore etc
- [x] remove deploy dependency on contract-interfaces, replace with
      dep on `whatever-contracts`
- [ ] .nvmrc
- [ ] standardize on a set of standard scripts build/prettier/lint/test
- [ ] use `yarn workspace foreach`
- [ ] hardhat-packager

### Repo Setup

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
