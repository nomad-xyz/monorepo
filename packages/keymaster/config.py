from python_json_config import ConfigBuilder
import json 

def load_config(path: str):
    # create config parser
    builder = ConfigBuilder()

    # parse config
    try: 
        config = builder.parse_config(path)
        config.merge_with_env_variables(["KEYMASTER"])

        # TODO: Validate config 
        # networks.name.rpc must be a uri 
        # networks.name.bank must be a hexkey 
        # networks.name.threshold must be in gwei 
        # homes.name must be present in networks
        # homes.name.replicas must be present in networks
        # homes.name.addresses must be unique (?)

        return config.to_dict()
    except json.decoder.JSONDecodeError: 
        # Failed to load config 
        return False
    # merge config with environment variables
    

    