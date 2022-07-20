## Bootup instructions

```sh
foundryup
yarn install
yarn build
#Just to make sure build isn't stuck in some sort of weird state...
yarn deploy build
```

Create a .env file with:

```markdown
DEPLOYER_PRIVATE_KEY=0x1000000000000000000000000000000000000000000000000000000000000001
```

Then, boot up docker.

Run the following inside /packages/local-environment

```sh
yarn bootup
```