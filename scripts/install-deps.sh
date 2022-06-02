#!/usr/bin/env bash

set -e

# Make sure that the working directory is always the directory of the script
cd "$(dirname "$0")"
echo "Installing forge deps.."
if [ -d "../lib/forge-std" ]; then
  echo "Deps already installed"
  echo "Skipping.."
else
  forge install foundry-rs/forge-std@5645100
fi
