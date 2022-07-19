## Bootup instructions


```sh
foundryup
yarn install
yarn build
yarn deploy build
```

Create a .env file in neww with:

```markdown
DEPLOYER_PRIVATE_KEY=   
ETHERSCAN_KEY=
```

Then, boot up docker.

Run the following

```sh
cd hardhat
docker build . -t hardhat:latest
```

Finally, go into local-environment/src and do
```
docker pull gcr.io/nomad-xyz/nomad-agent:prestwich-remove-deploy-gas
```

cd into the neww folder and do:

```sh
yarn run ts-node le.ts
```