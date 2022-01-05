#!/bin/sh 

copy() {
    jq .abi < artifacts/contracts/"$1".sol/"$1".json > ../../rust/chains/nomad-ethereum/abis/"$1".abi.json
}

copy Replica && copy Home && copy XAppConnectionManager