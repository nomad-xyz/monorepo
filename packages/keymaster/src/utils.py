from eth_account.account import Account
from web3 import Web3
import backoff 
import logging
import sys 

# Takes a hexKey as input
# returns the public key
def hexkey_info(hex_key:str):
    account = Account.from_key(hex_key)
    return account.address

# Checks if an address is below the threshold
# returns difference in wei if true
# returns False if not
def is_wallet_below_threshold(address:str, lower_bound:int, upper_bound:int, endpoint:str):
    w3 = Web3(Web3.HTTPProvider(endpoint))
    address = Web3.toChecksumAddress(address)
    # get balance
    wallet_wei = get_balance(address, endpoint)
    # if balance below lower bound
    if wallet_wei < lower_bound:
        # return the amount we have to top up
        # to reach upper bound 
        return upper_bound - wallet_wei
    else: 
        return False

# creates a transaction for a sender and recipient
# given a network RPC endpoint
# returns tuple (tx_params, signed_tx) for debugging
def create_transaction(sender_key:str, recipient_address:int, amount:int, nonce:int, endpoint:str):
    # Set up w3 provider with network endpoint
    w3 = Web3(Web3.HTTPProvider(endpoint))
    recipient_address = Web3.toChecksumAddress(recipient_address)
    chain_id = w3.eth.chain_id
    gas = 100000 * 100 if "arb-rinkeby" in endpoint else 100000 
    # sign transaction 
    tx_params = dict(
        nonce=nonce,
        gasPrice= 500 * 10 ** 9,
        gas=gas,
        to=recipient_address,
        value=amount,
        data=b'',
        chainId=chain_id,
    )
    signed_txn = w3.eth.account.sign_transaction(tx_params,sender_key)
    return (tx_params, signed_txn)


# gets the current nonce for an address 
@backoff.on_exception(backoff.expo,
                      ValueError,
                      max_tries=18)
def get_nonce(address:str, endpoint:str):
    w3 = Web3(Web3.HTTPProvider(endpoint))
    address = Web3.toChecksumAddress(address)
    nonce = w3.eth.get_transaction_count(address)
    return nonce

# gets the current nonce for an address 
@backoff.on_exception(backoff.expo,
                      ValueError,
                      max_tries=8)
def get_block_height(endpoint:str):
    w3 = Web3(Web3.HTTPProvider(endpoint))
    block_height = w3.eth.get_block_number()
    return block_height

@backoff.on_exception(backoff.expo,
                      ValueError,
                      max_tries=8)
def get_balance(address:str, endpoint:str):
    w3 = Web3(Web3.HTTPProvider(endpoint))
    address = Web3.toChecksumAddress(address)
    wallet_wei = w3.eth.get_balance(address)
    return wallet_wei
    
# dispatches a signed transaction from create_transaction
@backoff.on_exception(backoff.expo,
                      ValueError,
                      max_tries=3)
def dispatch_signed_transaction(signed_transaction, endpoint:str):
    # Set up w3 provider with network endpoint
    w3 = Web3(Web3.HTTPProvider(endpoint))
    hash = w3.eth.send_raw_transaction(signed_transaction.rawTransaction)  
    return hash


def check_account(home_network: str, target_network: str, role: str, address: str, endpoint: str, threshold: int=150000000000000000, logger=logging.basicConfig(stream=sys.stdout, level=logging.INFO)):
    should_top_up = False
    top_up_amount = 0
    logger.debug(f"Fetching metrics for {home_network} {role} ({address}) on {target_network}")
    # fetch balance
    wallet_wei = get_balance(address, endpoint)
    # Only top-up when an agent wallet is at 25% of the threshold
    logger.info(f"{wallet_wei} is less then {int(threshold / 4)}: {wallet_wei < int(threshold / 4)}")
    if role != "bank" and wallet_wei < (threshold / 4): 
        logger.debug(f"Balance is low for {home_network} {role} ({address}) on {target_network} - {wallet_wei * 10**-18 } < {threshold * 10**-18 / 4}")
        should_top_up = True
        top_up_amount = threshold - wallet_wei
    # Warn when the bank is ~4 top-ups from being empty
    if role == "bank" and wallet_wei < threshold * 4:
        logger.warning(f"Bank balance is low for {home_network} ({address}) - {wallet_wei * 10**-18} < {threshold * 4 * 10**-18}")
        should_top_up = True
    # fetch tx count
    tx_count = get_nonce(address, endpoint)
    status = {
        "role": role,
        "address": address,
        "home": home_network,
        "top_up_amount": top_up_amount,
        "target_network": target_network,
        "wallet_balance": wallet_wei,
        "should_top_up": should_top_up,
        "transaction_count": tx_count
    }
    logger.info(status)
    return status