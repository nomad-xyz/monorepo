pushd hardhat 
docker build -t hardhat:latest . 
popd
docker pull gcr.io/nomad-xyz/nomad-agent:prestwich-remove-deploy-gas
mkdir output
touch output/test_config.json
yarn start