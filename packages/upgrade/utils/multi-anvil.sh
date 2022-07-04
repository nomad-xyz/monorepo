#!/usr/bin/env bash

source $(dirname "$0")/terminal-helpers.sh

count=$1
counter=0
announce "Welcome to Multi Anvil"
message "Mullti Anvil will generate ${count} anvil instances"
anvils=""
for i in $(seq $(($count - 1))); do
  port=$(( 8545 + counter ))
  anvils="${anvils} anvil -p ${port} &"
  message "Anvil instance live at port: ${port}"
  counter=$((counter + 1))
done
port=$(( 8545 + counter ))
anvils="${anvils} anvil -p ${port}"
message "Anvil instance live at port: ${port}"
(trap 'kill 0' SIGINT; eval "${anvils}")
