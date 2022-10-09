#!/bin/bash
export $(cat ./.env | xargs)
pushd ./hardhat
docker build -t hardhat:latest .
popd
docker pull "$AGENTS_IMAGE"
