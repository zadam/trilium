#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo "Missing argument of new version"
    exit 1
fi

VERSION=$1
PKG_DIR=dist/trilium-linux-x64-server
NODE_VERSION=8.11.4

rm -r $PKG_DIR
mkdir $PKG_DIR
cd $PKG_DIR

wget https://nodejs.org/dist/latest-v8.x/node-v${NODE_VERSION}-linux-x64.tar.xz
tar xvfJ node-v${NODE_VERSION}-linux-x64.tar.xz
rm node-v${NODE_VERSION}-linux-x64.tar.xz

mv node-v${NODE_VERSION}-linux-x64 node

cp -r ../../node_modules/ ./
cp -r ../../src/ ./
cp -r ../../db/ ./
cp -r ../../package.json ./
cp -r ../../package-lock.json ./
cp -r ../../README.md ./
cp -r ../../LICENSE ./
cp -r ../../config-sample.ini ./

rm -r ./node_modules/electron*

printf "#/bin/sh\n./node/bin/node src/www" > trilium.sh
chmod 755 trilium.sh

cd ..

7z a trilium-linux-x64-server-${VERSION}.7z trilium-linux-x64-server