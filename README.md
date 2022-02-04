- [ ] write real readme
- [x] fix solidity builds
- [ ] proper tsconfig inheritance
- [ ] typechain packaging
- [ ] break out governance from core?
- [ ] publishing w/ npmignore etc

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
