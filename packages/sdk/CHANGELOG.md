# Changelog

### Unreleased

### 3.2.0-rc.0

- feat: instantiate from message hash

### 3.1.0-rc.3

- fix: release sdk package first

### 3.1.0-rc.0

- remove staging

### 3.0.0-rc.0

- dep: bump configuration to 2.0.0 and resolve type issues

### 2.1.1

- fix: getProof error, MessageStatus enum

### 2.1.0

- (major) refactor: change message status to a tagged union instead of an enum,
  added the root to the `proven` message status
- fix: checkHomes async handling in for loop
- (major) refactor: rewrite status event queries, remove parameter from `fromReceipt` methods
- fix: import `fetch` from cross-fetch, remove `axios`

### 2.1.0-rc.0

- upgrade: contracts
- fix: config fetch header override

### 2.0.0-rc.20

- docs: update readme with examples/links
- fix: `NomadContext.fetch` warns on failure
- fix: request browser not to cache fetched config files
- fix: update replica message status getter for new replica mapping

### 2.0.0-rc.17

- chore: bump configuration to v0.1.0-rc.23

### 2.0.0-rc.16

- re-publish to npm with correct package.json

### 2.0.0-rc.15 (DEPRECATED)

- feat: add config fetching
- add s3 name and URI getters
- add getProof async method for retrieving proofs from s3

### 2.0.0-rc.13

- fix: make paginated event querying use the new config layout
- chore: bump configuration to v0.1.0-rc.18

### 2.0.0-rc.10

- feature: process function for NomadContext/NomadMessage
- chore: bump configuration to v0.1.0-rc.16

### 2.0.0-rc.9

- update typescript eslint packages to fix lint script
- remove unnecessary lint:fix script
- standardize prettier
- register RPC providers from config in NomadContext constructor
- chore: bump configuration to v0.1.0-rc.15

### 2.0.0-rc.8

- chore: bump configuration to v0.1.0-rc.12

### 2.0.0-rc.7

- chore: bump configuration to v0.1.0-rc.10

### 2.0.0-rc.6

- chore: bump multi-provider to v1.0.0-rc.4

### 2.0.0-rc.5

- refactor: simpler connection logic (deleting `reconnect`)
- refactor: improved generics in types using contexts
- bug: getReplica only accepts domain number
- chore: bump configuration to v0.1.0-rc.9

### 2.0.0-rc.4

- feature: Added `CoreContracts.deployHeight` getter
