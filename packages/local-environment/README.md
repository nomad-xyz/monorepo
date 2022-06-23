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
docker build .
```

Lastly, cd into the neww folder and do:

```sh
yarn run ts-node le.ts
```