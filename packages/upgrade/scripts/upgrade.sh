#!/usr/bin/env bash

set -e

PRODUCTION_RPC_ENDPOINTS=(
https://api.avax.network/ext/bc/C/rpc
https://main-light.eth.linkpool.io/
https://eth.bd.evmos.org:8545
https://rpc.c1.milkomeda.com:8545
https://moonriver.api.onfinality.io/public
https://dai.poa.network/
)

(cd "$(dirname "$0")"
for rpc_endpoint in ${PRODUCTION_RPC_ENDPOINTS[*]}
  do
    export NOMAD_ACTIVE_RPC_ENDPOINT=${rpc_endpoint}
    forge script ./upgrade.sol:UpgradeNomad --sig "upgrade()"
done

