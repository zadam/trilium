#!/usr/bin/env bash

echo "Packaging debian x64 distribution..."

VERSION=`jq -r ".version" package.json`

./node_modules/.bin/electron-installer-debian --config bin/deb-options.json --options.version=${VERSION} --arch amd64
