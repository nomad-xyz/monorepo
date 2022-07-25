#!/usr/bin/env bash

set -e

generate() {
  file=$1
  profile=$2
  if [[ $func == "generate" ]]; then
    echo "Creating storage layout diagrams for the following contracts: $contracts"
    echo "..."
  fi

  echo "=======================" > $file
  echo "👁👁 STORAGE LAYOUT snapshot 👁👁" >$file
  echo "=======================" >> $file

  for contract in ${contracts[@]}
  do
    echo -e "\n=======================" >> $file
    echo "➡ $contract">> $file
    echo -e "=======================\n" >> $file
    FOUNDRY_PROFILE=$profile forge inspect --pretty $contract storage-layout >> $file
  done
  if [[ $func == "generate" ]]; then
    echo "Storage layout snapshot stored at $file"
  fi
}

if ! command -v forge &> /dev/null
then
    echo "forge could not be found. Please install forge by running:"
    echo "curl -L https://foundry.paradigm.xyz | bash"
    exit
fi

contracts="${@:2}"
dir=$(dirname "$0")
func=$1
filename=.storage-layout
profile=""

if [[ $(pwd) == *"bridge"* ]]; then
  profile=bridge
elif [[ $(pwd) == *"core"* ]]; then
  profile=core
else
  echo "Can't find a Foundry profile for the directory $(pwd)"
  echo "Aborting.."
  exit 1
fi


if [[ $func == "check" ]]; then
  new_filename=.storage-layout.temp
  generate $new_filename $profile
  if ! cmp -s .storage-layout $new_filename ; then
    echo "storage-layout test: fails ❌"
    echo "The following lines are different:"
    diff -a --suppress-common-lines $filename $new_filename
    rm $new_filename
    exit 1
  else
    echo "storage-layout test: passes ✅"
    rm $new_filename
    exit 0
  fi
elif [[ $func == "generate" ]]; then
  generate $filename $profile
else
  echo "unknown command. Use 'generate' or 'check' as the first argument."
  exit 1
fi
