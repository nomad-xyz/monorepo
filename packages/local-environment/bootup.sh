#!/bin/bash
pushd packages/local-environment/hardhat 
docker build -t hardhat:latest . 
popd
docker pull gcr.io/nomad-xyz/nomad-agent:prestwich-remove-deploy-gas