# Changelog

### Unreleased

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
