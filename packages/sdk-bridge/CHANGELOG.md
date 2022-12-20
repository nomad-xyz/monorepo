# Changelog

### Unreleased

### 3.2.0-rc.0

- feat: instantiate from message hash

### 3.1.0-rc.3

- fix: release sdk package first

### 3.1.0-rc.0

- fix: remove staging env and references to staging
- fix: set `from` in call overrides in `prepareRecover`

### 3.0.0-rc.0

- dep: bump configuration to 2.0.0 and resolve type issues
- add NFT related convenience methods to `BridgeContext`
- fix: export NftInfo and AccountantAsset types

### 1.1.1

- fix: getProof error, MessageStatus enum

### 1.1.0

- (major) refactor: change message status to a tagged union instead of an enum,
  added the root to the `proven` message status
- (major) refactor: rewrite status queries, remove parameter from fromReceipt methods

### 1.1.0-rc.0

- upgrade: contracts
- fix: config fetch header override

### 1.0.0-rc.20

- docs: update readme with examples/links

### 1.0.0-rc.19

- fix: numeric fault overflow when supporting infinite token approval
- feat: try send/sendNative and process calls using callStatic

### 1.0.0-rc.18

- feat: support infinite token approval

### 1.0.0-rc.17

- chore: bump configuration to v0.1.0-rc.23

### 1.0.0-rc.16

- re-publish to npm with correct package.json

### 1.0.0-rc.15 (DEPRECATED)

### 1.0.0-rc.14

- add: prepareSend, prepareSendNative

### 1.0.0-rc.13

- fix: hard code gas limit for sendNative
- chore: bump configuration to v0.1.0-rc.18

### 1.0.0-rc.12

- fix: increase gas more

### 1.0.0-rc.11

- fix: bump gas limit by 10%

### 1.0.0-rc.10

- chore: bump configuration to v0.1.0-rc.16

### 1.0.0-rc.9

- update typescript eslint packages to fix lint script
- remove unnecessary lint:fix script
- standardize prettier
- chore: bump configuration to v0.1.0-rc.15

### 1.0.0-rc.8

- chore: bump configuration to v0.1.0-rc.12

### 1.0.0-rc.7

- chore: bump configuration to v0.1.0-rc.10

### 1.0.0-rc.6

- chore: bump sdk to v2.0.0-rc.6

### 1.0.0-rc.5

- refactor: simpler connection logic (deleting `reconnect`)
- refactor: improved generics in types using contexts
- chore: bump configuration to v0.1.0-rc.9

### 1.0.0-rc.4

- feature: Added `BridgeContracts.deployHeight` getter
