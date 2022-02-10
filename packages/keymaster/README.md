# The Keymaster

[_I am Vinz, Vinz Clortho, Keymaster of Gozer...Volguus Zildrohoar, Lord of the Seboullia. Are you the Gatekeeper?_](https://www.youtube.com/watch?v=xSp5QwKRwqM)

![Keymaster from Ghostbusters](https://i.pinimg.com/originals/9d/5b/a0/9d5ba02875ce7921d092038d1543b1f4.jpg)

## Summary

The Keymaster is a tool that is used to manage funds for Nomad Agent Wallets. Due to the sheer number of networks Nomad supports, and the necessity for having a unique set of keys for each home, managing funds and ensuring agents can continue to function quickly becomes difficult as the network of Nomad channels grows.

Example:

For 4 homes (alfajores, kovan, rinkeby, rinkarby) with 5 addresses each (kathy, watcher, updater, processor, relayer), this means there will be 20 unique addresses and each address has to be funded on each network resulting in 20 \* 4 = 80 unique accounts across all networks which must be funded and topped up regularly.

Generalized: num_homes^2 \* num_addresses

The Keymaster stores metadata about addresses, sources of funds, network RPC endpoints, and more to facilitate solving this problem.

## Using The Keymaster

Note: Before you do _anything_, [call the Ghostbusters](https://www.youtube.com/watch?v=Fe93CLbHjxQ).

The Keymaster is a simple Python-based CLI program, the entrypoint is `keymaster.py`

Install the requirements via pip:

`pip3 install -r requirements.txt`

The Keymaster can be invoked via `python3` like so:

```
$ python3 keymaster.py --help
Usage: keymaster.py [OPTIONS] COMMAND [ARGS]...

Options:
  --debug / --no-debug
  --config-path TEXT
  --help                Show this message and exit.

Commands:
  top-up
```

Subcommands can be invoked by passing them as arguments to the CLI:

```
$ python3 keymaster.py top-up --help
Usage: keymaster.py top-up [OPTIONS]

Options:
  --help  Show this message and exit.
```

## Configuration File

The Keymaster relies on a JSON configuration file, by default located at `./keymaster.json`. You can pass a new path to the file using the `--config-path` argument.

An example can be found at `./keymaster-example.json` and its contents are repeated here for convenience:

```
{
    "networks": {
        "alfajores": {
            "endpoint": "https://alfajores-forno.celo-testnet.org",
            "bank": {
                "signer": "<hexKey>",
                "address": "<address>"
            },
            "threshold": 500000000000000000
        },
        "kovan": {
            "endpoint": "<RPCEndpoint>",
            "bank": {
                "signer": "<hexKey>",
                "address": "<address>"
            },
            "threshold": 500000000000000000
        }
    },
    "homes": {
        "alfajores": {
            "replicas": ["kovan"],
            "addresses": {
                "kathy": "<address>",
                "watcher": "<address>",
                "updater": "<address>",
                "relayer": "<address>",
                "processor": "<address>"
            }
        },
        "kovan": {
            "replicas": ["alfajores"],
            "addresses": {
                "kathy": "<address>",
                "watcher": "<address>",
                "updater": "<address>",
                "relayer": "<address>",
                "processor": "<address>"
            }
        }
    }
}
```

In the `top-up` command, The Keymaster will load the contents of this file and use it to dynamically query the configured accounts and determine if they need to be topped up.
