#!/usr/bin/env bash

set -e

if [[ $(which genhtml) == "" ]]; then
  echo "To generate code coverage, you need to install lcov"
  echo "See: https://command-not-found.com/genhtml"
  exit 1
fi

if [[ $(which forge) == "" ]]; then
  echo "To generate code coverage, you need to install Foundry"
  echo "See: https://getfoundry.sh/"
  exit 1
fi

if [[ $1 == *"core"* ]]; then
  # Need to be to top-level directory of the monorepo
  cd $(git rev-parse --show-toplevel)
  path="packages/contracts-core/.coverage"
  profile=core
elif [[ $1 == *"bridge"* ]]; then
  # Need to be to top-level directory of the monorepo
  cd $(git rev-parse --show-toplevel)
  path="packages/contracts-bridge/.coverage"
  profile=bridge
elif [[ $1 == *"router"* ]]; then
  # Need to be to top-level directory of the monorepo
  cd $(git rev-parse --show-toplevel)
  path="packages/contracts-router/.coverage"
  profile=router
else
  echo "Argument not recognised: '$1'"
  echo "Supported packages: core, bridge, router"
  echo "Example: sh coverage-report.sh core"
  exit 1
fi
FOUNDRY_PROFILE=$profile forge coverage --report lcov
genhtml -o "$path" lcov.info
echo "Report generated at $path"
echo "Open $(readlink -f $path)/index.html"
rm lcov.info
