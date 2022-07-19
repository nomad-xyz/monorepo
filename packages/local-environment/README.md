## Bootup instructions


```sh
yarn install
yarn build
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

cd into the local-environment folder and do.

```sh
yarn install
```

cd into the neww folder and do:

```sh
yarn run ts-node le.ts
```