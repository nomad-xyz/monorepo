## Bootup instructions

The following commands should be ran in monorepo root.

```sh
foundryup
yarn install
yarn build
#Just to make sure build isn't stuck in some sort of weird state...
yarn deploy build
```

The following should be done inside local-environment package root.

Create a .env file with:

```markdown
PRIVATE_KEY=1337000000000000000000000000000000000000000000000000000000001337
PRIVATE_KEY_1=0x1000000000000000000000000000000000000000000000000000000000000001
PRIVATE_KEY_2=2000000000000000000000000000000000000000000000000000000000000002
PRIVATE_KEY_3=3000000000000000000000000000000000000000000000000000000000000003
PRIVATE_KEY_4=4000000000000000000000000000000000000000000000000000000000000004
PRIVATE_KEY_5=5000000000000000000000000000000000000000000000000000000000000005
```

Then, boot up docker.

Run the following inside /packages/local-environment if this is your first time booting up.

```sh
yarn bootup
```

For any subsequent runs, do:

```sh
yarn start
```