#!/bin/bash
echo Please wait, building packages ☕

for d in packages/*; do
 echo Building $d;
 pushd $d;
 {
    yarn build && echo Built $d
 } || {
        echo Skipped $d
    }
 popd;
done