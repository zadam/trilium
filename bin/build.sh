#!/usr/bin/env bash

echo "Deleting existing builds"

rm -rf dist/*

SRC_DIR=dist/trilium-src

bin/copy-trilium.sh $SRC_DIR

# we'll just copy the same SRC dir to all the builds so we don't have to do npm install in each separately
cp -r $SRC_DIR ./dist/trilium-linux-x64-src
cp -r $SRC_DIR ./dist/trilium-linux-x64-server
cp -r $SRC_DIR ./dist/trilium-windows-x64-src
cp -r $SRC_DIR ./dist/trilium-mac-x64-src

bin/build-win-x64.sh DONTCOPY

bin/build-mac-x64.sh DONTCOPY

bin/build-linux-x64.sh DONTCOPY

bin/build-server.sh DONTCOPY
