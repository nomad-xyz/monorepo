# Changelog

### Unreleased

### 3.0.0-rc.0

- dep: bump configuration to 2.0.0 and resolve type issues

### 1.1.1

- fix: getProof error, MessageStatus enum

### 1.1.0

- (major) refactor: change message status to a tagged union instead of an enum,
  added the root to the `proven` message status
- (major) refactor: rewrite status queries, remove parameter from fromReceipt methods, rename status method to batchStatus

### 1.1.0-rc.0

- upgrade: contracts
- update `executeGovernorDomain` script to throw informative errors when it cannot submit the transaction

### 1.0.0-rc.17

- chore: bump configuration to v0.1.0-rc.23

### 1.0.0-rc.16

- re-publish to npm with correct package.json

### 1.0.0-rc.15 (DEPRECATED)

### 1.0.0-rc.10

- chore: bump configuration to v0.1.0-rc.16

### 1.0.0-rc.9

- update typescript eslint packages to fix lint script
- remove unnecessary lint:fix script
- standardize prettier
- feature: upgrade functions to accept nameOrDomain (not just domain)
- fix: await batch.build in fromJSON
- domains() return _all_ domains - governor and remote
- feature: add optional transaction overrides to executeDomain function
- feature: add status function which checks batch status using call, rather than events (which are brittle for some chains)
- chore: bump configuration to v0.1.0-rc.15

### 1.0.0-rc.8

skipped to keep sdk packages on same version

### 1.0.0-rc.7

- chore: bump configuration to v0.1.0-rc.12

### 1.0.0-rc.6

- chore: bump configuration to v0.1.0-rc.10

### 1.0.0-rc.5

- chore: bump sdk to v2.0.0-rc.6

### 1.0.0-rc.4

- chore: bump configuration to v0.1.0-rc.9
