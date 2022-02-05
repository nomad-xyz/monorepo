- [ ] write real readme
- [x] fix solidity builds
- [x] proper tsconfig inheritance
- [x] typechain packaging
- [ ] break out governance from core?
- [ ] publishing w/ npmignore etc
- [x] remove deploy dependency on contract-interfaces, replace with
      dep on `whatever-contracts`

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

### Publishing

Before publishing, ensure all packages are built

```
$ yarn build
```
