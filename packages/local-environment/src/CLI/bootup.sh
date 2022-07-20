pushd hardhat 
docker build -t hardhat . 
popd
docker pull gcr.io/nomad-xyz/nomad-agent:prestwich-remove-deploy-gas
npx ts-node src/le.ts