#!/usr/bin/env bash

set -e

# Make sure that the working directory is always the directory of the script
cd "$(dirname "$0")"
echo "Installing forge deps.."
if [ -d "../lib/forge-std" ]; then
  if [ "$(ls -A ../lib/forge-std)" ]; then
    echo "Deps already installed"
    echo "Skipping.."
    exit 0
  else
    echo "Dep directory found, but it's empty"
    echo "Cleaning up and installing deps.."
    rm -rf ../lib/forge-std
  fi
fi
forge install foundry-rs/forge-std@33d4895 --no-git
