#!/usr/bin/python3
# keymaster.py
# Used to perform agent wallet maintenance like: 
# top-up - ensures configured addresses have sufficient funds

from utils import dispatch_signed_transaction, hexkey_info
from web3 import Web3
from prometheus_client import start_http_server, Counter, Gauge
from config import load_config
from utils import create_transaction, is_wallet_below_threshold, get_nonce, get_balance, get_block_height

import click
import logging
import json 
import sys 
import time

# Set up prometheus metrics 
metrics = {
    "wallet_balance": Gauge("ethereum_wallet_balance", "ETH Wallet Balance", ["role", "home", "address", "network"]),
    "transaction_count": Gauge("ethereum_transaction_count", "ETH Wallet Balance", ["role", "home", "address", "network"]),
    "block_number": Gauge("ethereum_block_height", "Block Height", ["network"]),
    "failed_tx_count": Counter("keymaster_failed_tx_count", "Number of Failed Keymaster Top-Ups", ["network", "to", "error"])
}

@click.group()
@click.option('--debug/--no-debug', default=False)
@click.option('--config-path', default="./config/keymaster.json")
@click.pass_context
def cli(ctx, debug, config_path):
    ctx.ensure_object(dict)
    ctx.obj['DEBUG'] = debug

    conf = load_config(config_path)

    if conf:
        ctx.obj['CONFIG'] = conf
    else: 
        # Failed to load config, barf 
        click.echo(f"Failed to load config from {config_path}, check the file and try again.")
        sys.exit(1)

    
    # Set up logging
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)

    if debug:
        click.echo(f"Loaded config from {config_path}")
        click.echo(json.dumps(ctx.obj['CONFIG'], indent=2))

@cli.command()
@click.pass_context
@click.option('--metrics-port', default=9090, help="Port to bind metrics server to.")
@click.option('--pause-duration', default=30, help="Number of seconds to sleep between polling.")
def monitor(ctx, metrics_port, pause_duration):
    """Simple program that polls one or more ethereum accounts and reports metrics on them."""
    # Get config
    config = ctx.obj["CONFIG"]

    # Set up logging
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)

    # run metrics endpoint
    start_http_server(metrics_port)
    logging.info(f"Running Prometheus endpoint on port {metrics_port}")

    logging.info("Executing event loop, Ctrl+C to exit.")
    # main event loop
    while True:
        # top-up if we see a low balance
        should_top_up = False
        threshold = 150000000000000000
        # for each rpc
        for name, network in config["networks"].items():
            endpoint = network["endpoint"]

            # Fetch block height
            try:
                block_height = get_block_height(endpoint)
                metrics["block_number"].labels(network=name).set(block_height)
            except ValueError:
                continue
            
            # fetch bank balance
            account = network["bank"]["address"]
            logging.info(f"Fetching metrics for {account} via {endpoint}")
            wallet_wei = get_balance(account, endpoint)
            logging.info(f"Wallet Balance: {wallet_wei * 10**-18}")
            # fetch tx count
            tx_count = get_nonce(account, endpoint)
            logging.info(f"Transaction Count: {tx_count}")
            # report metrics 
            metrics["wallet_balance"].labels(role="bank", home=name, address=account, network=name).set(wallet_wei)
            metrics["transaction_count"].labels(role="bank", home=name, address=account, network=name).set(tx_count)


            # for each account
            for home_name, home in config["homes"].items():
                # Skip processing on networks where there is no replica
                if name not in home["replicas"]: 
                    continue
                
                for role, account in home["addresses"].items():
                    # Don't send funds to agents that don't need to make TXs on this Domain
                    # If we're processing a local agent on a remote domain
                    if name != home_name and role in ["kathy", "updater", "watcher"]: 
                        logging.info(f"Not processing {home_name} {role} on {name}")
                        continue 
                    logging.info(f"Fetching metrics for {home_name} {role} ({account}) on {name} via {endpoint}")
                    # fetch balance
                    wallet_wei = get_balance(account, endpoint)
                    logging.info(f"Wallet Balance: {wallet_wei * 10**-18}")
                    if wallet_wei < threshold: 
                        logging.warning(f"BALANCE IS LOW, MARKING FOR TOP-UP {wallet_wei} < {threshold}")
                        should_top_up = True
                    # fetch tx count
                    tx_count = get_nonce(account, endpoint)
                    logging.info(f"Transaction Count: {tx_count}")
                    # report metrics 
                    metrics["wallet_balance"].labels(role=role, home=home_name, address=account, network=name).set(wallet_wei)
                    metrics["transaction_count"].labels(role=role, home=home_name, address=account, network=name).set(tx_count)
        
        if should_top_up:
            _top_up(ctx, auto_approve=True)
        
        logging.info(f"Sleeping for {pause_duration} seconds.")
        time.sleep(pause_duration)

@cli.command()
@click.pass_context
@click.argument('hex-key')
def hex_key(ctx, hex_key):
    address = hexkey_info(hex_key)
    logging.info(f"Address: {address}")

@cli.command()
@click.pass_context
def top_up(ctx):
    _top_up(ctx)

def _top_up(ctx, auto_approve=False):
    click.echo(f"Debug is {'on' if ctx.obj['DEBUG'] else 'off'}")
    config = ctx.obj["CONFIG"]
    transaction_queue = {}
    # Init transaction queue for each network
    for network in config["networks"]:
        transaction_queue[network] = []

    for home in config["homes"]:
        
        for role, address in config["homes"][home]["addresses"].items():
            logging.info(f"Processing {role}-{address} on {home}")    
            # fetch config params 
            home_upper_bound = config["networks"][home]["threshold"]
            # don't top up until balance has gone beneath lower bound
            home_lower_bound = 150000000000000000
            home_endpoint = config["networks"][home]["endpoint"]
            home_bank_signer = config["networks"][home]["bank"]["signer"]
            home_bank_address = config["networks"][home]["bank"]["address"]
            
            # check if balance is below threshold at home
            threshold_difference = is_wallet_below_threshold(address, home_lower_bound, home_upper_bound, home_endpoint)
            # get nonce
            home_bank_nonce = get_nonce(home_bank_address, home_endpoint)
            
            if threshold_difference:
                logging.info(f"Threshold difference is {threshold_difference} for {role}-{address} on {home}, enqueueing transaction.")
                # if so, enqueue top up with (threshold - balance) ether
                transaction = create_transaction(home_bank_signer, address, threshold_difference, home_bank_nonce + len(transaction_queue[home]), home_endpoint)
                transaction_queue[home].append(transaction)
            else: 
                logging.info(f"Threshold difference is satisfactory for {role}-{address} on {home}, no action.")

            for replica in config["homes"][home]["replicas"]:
                 # fetch config params 
                replica_upper_bound = config["networks"][replica]["threshold"] 
                # don't top up until balance has gone beneath lower bound
                replica_lower_bound = 150000000000000000
                replica_endpoint = config["networks"][replica]["endpoint"]
                replica_bank_signer = config["networks"][replica]["bank"]["signer"]
                replica_bank_address = config["networks"][replica]["bank"]["address"]
                # check if balance is below threshold at replica
                threshold_difference = is_wallet_below_threshold(address, replica_lower_bound, replica_upper_bound, replica_endpoint)
                # get nonce
                replica_bank_nonce = get_nonce(replica_bank_address, replica_endpoint)
                # if so, enqueue top up with (threshold - balance) ether
                if threshold_difference:
                    logging.info(f"Threshold difference is {threshold_difference} for {role}-{address} on {replica}, enqueueing transaction.")
                    transaction = create_transaction(replica_bank_signer, address, threshold_difference, replica_bank_nonce + len(transaction_queue[replica]), replica_endpoint)
                    transaction_queue[replica].append(transaction)
                else: 
                    logging.info(f"Threshold difference is satisfactory for {role}-{address} on {replica}, no action.")
    
    # compute analytics about enqueued transactions 
    click.echo("\n Transaction Stats:")
    for network in transaction_queue:
        if len(transaction_queue[network]) > 0:
            amount_sum = sum(tx[0]["value"] for tx in transaction_queue[network])
            bank_balance = get_balance(config["networks"][network]["bank"]["address"], config["networks"][network]["endpoint"])
            click.echo(f"\t {network} Bank has {Web3.fromWei(bank_balance, 'ether')} ETH")
            click.echo(f"\t About to send {len(transaction_queue[network])} transactions on {network} - Total of {Web3.fromWei(amount_sum, 'ether')} ETH \n")

            if not auto_approve:
                click.confirm("Would you like to proceed with dispatching these transactions?", abort=True)
            else: 
                # Send it!!
                click.echo("Auto-Approved. Dispatching.")

            # Process enqueued transactions 
            click.echo(f"Processing transactions for {network}")
            for transaction_tuple in transaction_queue[network]:
                click.echo(f"Attempting to send transaction: {json.dumps(transaction_tuple[0], indent=2, default=str)}")
                try: 
                    hash = dispatch_signed_transaction(transaction_tuple[1], config["networks"][network]["endpoint"])
                    click.echo(f"Dispatched Transaction: {hash}")
                    time.sleep(3)
                # Catch ValueError when the transaction fails for some reason
                except ValueError as e:
                    metrics["failed_tx_count"].labels(network=network, to=transaction_tuple[0]["to"], error=str(e)).inc()
                    pass
                     
                
        else: 
            click.echo(f"\t No transactions to process for {network}, continuing...")

    

if __name__ == '__main__':
    cli(obj={})