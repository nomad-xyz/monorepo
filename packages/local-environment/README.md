## Adding tests

If you add tests that require a new docker image for agents, update the `AGENTS_IMAGE` env var in `local-environment/.env`

## Bootup instructions

If you want to test with mainnet forking, simply input your Alchemy API key into the `.env` file:

```sh
ALCHEMY_FORK_URL=your_api_key
```

If you have no need for mainnet forking, proceed to the next step.

Then the following commands should be ran in monorepo root.

```sh
./packages/local-environment/prepare.sh
```

The following should be done inside local-environment package root.

Create a .env file with:

```sh
PRIVATE_KEY=1337000000000000000000000000000000000000000000000000000000001337
PRIVATE_KEY_1=0x1000000000000000000000000000000000000000000000000000000000000001
PRIVATE_KEY_2=2000000000000000000000000000000000000000000000000000000000000002
PRIVATE_KEY_3=3000000000000000000000000000000000000000000000000000000000000003
PRIVATE_KEY_4=4000000000000000000000000000000000000000000000000000000000000004
PRIVATE_KEY_5=5000000000000000000000000000000000000000000000000000000000000005
```

If you want to use a custom agents image, you need to add another env variable into `.env`, like so:

```sh
AGENTS_IMAGE=your_custom_image:some_tag
```

Then, boot up docker.

For any subsequent runs, do:

```sh
yarn test:integration
```

or

```sh
yarn test:unit
```
