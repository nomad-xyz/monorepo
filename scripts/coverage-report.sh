#!/usr/bin/env bash

set -e

if [[ $(which genhtml) == "" ]]; then
  echo "You need to install lcov to generage code coverage"
  echo "See: https://command-not-found.com/genhtml"
  exit 1
fi

if [[ $(which forge) == "" ]]; then
  echo "You need to install Foundry to generage code coverage"
  echo "See: https://getfoundry.sh/"
  exit 1
fi

if [[ $1 == *"core"* ]]; then
  # Need to be to top-level directory of the monorepo
  cd $(git rev-parse --show-toplevel)
  path="coverage/contracts-core"
  FOUNDRY_PROFILE=core forge coverage --report lcov
  genhtml -o "$path" lcov.info
  echo "Report generated at $path"
  echo "Open $(readlink -f $path)/index.html"
  rm lcov.info
elif [[ $1 == *"bridge"* ]]; then
  # Need to be to top-level directory of the monorepo
  cd $(git rev-parse --show-toplevel)
  path="coverage/contracts-bridge"
  FOUNDRY_PROFILE=bridge forge coverage --report lcov
  genhtml -o "$path" lcov.info
  echo "Report generated at $path"
  echo "Open $(readlink -f $path)/index.html"
  rm lcov.info
elif [[ $1 == *"router"* ]]; then
  # Need to be to top-level directory of the monorepo
  cd $(git rev-parse --show-toplevel)
  path="coverage/contracts-router"
  FOUNDRY_PROFILE=router forge coverage --report lcov
  genhtml -o "$path" lcov.info
  echo "Report generated at $path"
  echo "Open $(readlink -f $path)/index.html"
  rm lcov.info
else
  echo "Argument not recognised: '$1'"
  echo "Supported packages: core, bridge, router"
  echo "Example: sh coverage-report.sh core"
  exit 1
fi
