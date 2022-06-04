#!/usr/bin/env bash

set -e

# Make sure that the working directory is always the directory of the script
cd "$(dirname "$0")"
# If acli is already built, skip building it
if command -v ./accumulator-cli ; then
  echo "accumulator-cli is already built. Skipping build.."
  exit 0
fi
# If cargo is not installed, inform user on how to install it and then exit
if [[ $(which cargo) == "" ]]; then
  echo "Cargo is not installed"
  echo "To build the accumulator-cli, you will need the Rust toolchain. Installing Rust.."
  curl https://sh.rustup.rs -sSf | sh -s -- -y -c cargo
fi
rm -rf acli;
echo "Building accumulator-cli from source.."
git clone https://github.com/odyslam/accumulator-cli acli
cd acli
cargo build --release
echo "Accumulator-cli was built succesfuly 👍"
echo "Cleaning up.."
mv ./target/release/accumulator-cli ../accumulator-cli
cd .. && rm -rf acli
echo "built with ❤️, in bash"
