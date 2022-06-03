# Nomad Upgrade

> There is nothing permanent except change.
>
>  Heraclitus

## Develop

## Usage

## Contribute

## License

# Notes

- Run UpgradeNomad.deployImplementations() for every `rpc_url` in `rpc_urls[]`
- Manually execute Governance Treansactions from Gnosis


## Upgrade Script
- Bash script with hardcoded list of rpc endpoints
- Bash script executes `forge script..` sequentially for the different endpoints.
    - I could use something like javascript to parallelize this
    - Output is piped to a file to be saved as deployment artifact
- If a deployment in some network fails, we debug and run again as appropriate
- We run the script the prints the governance transactions and pipe the output to some file for deployment artifact
- Execute the transaction payloads from the Gnosis safe

## deployImplementations()


Deploy new implementations
```
Home home = new Home();
Replica replica = new Replica();
GovernanceRouter grouter = new GovernanceRouter();
BridgeRouter brouter = new BridgeRouter();
TokenRegistry registry = new TokenRegistry();
BridgeToken token = new BridgeToken();
```

Initialize implementations
```
home.initialize();
replica.initialize();
grouter.initialize();
brouter.initialize();
token.initialize();
```

Print governance bytecode

```
bytes memory bytecode  = abi.encodeWithSignature("executeGovernanceActions()",args)
console2.log(bytes bytecode)
```

