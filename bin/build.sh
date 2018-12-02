#!/usr/bin/env bash

rm -r node_modules

npm install

echo "Deleting existing builds"

rm -r dist/*

bin/build-linux-ia32.sh

bin/build-win-x64.sh

bin/build-mac-x64.sh

# building X64 linux as the last so electron-rebuild will prepare X64 binaries for local development
bin/build-linux-x64.sh

bin/build-server.sh