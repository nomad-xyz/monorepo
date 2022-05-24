#!/usr/bin/env bash

set -e

if [[ $(which cargo) == "" ]]; then
  echo "Cargo is not installed"
  echo "To build the accumulator-cli, you will need the Rust toolchain. Run the following in your terminal and then execute 'build-acli.sh' again"
  echo "curl https://sh.rustup.rs -sSf | sh -s -- -y -c cargo"
  exit 1
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
