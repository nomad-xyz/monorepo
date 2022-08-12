# Chain Ops

Environment for executing scripts that perform on-chain operations

## Manual Processor

1) Set DEST_RPC_URL and signer PRIVATE_KEY in .env
2) Set ORIGIN, DESTINATION, ENV, and PAGE_SIZE constants in `src/manual-process.ts`
3) Run `yarn manual-process`

## Process

1) Set DEST_RPC_URL and signer PRIVATE_KEY in .env
2) Set ORIGIN, DESTINATION, ENV, and TRANSACTION constants in `src/process.ts`
3) Run `yarn process-single`
