# Changelog

### Unreleased

- update typescript eslint packages to fix lint script
- remove unnecessary lint:fix script
- standardize prettier

### 1.0.0-rc.4

- refactor: additional functionality on the `Contracts` type
- fix: multi-provider methods that return `Domains` now return the
  `T extends Domain` type associated with the multi-provider
