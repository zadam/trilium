#!/usr/bin/env bash

PKG_DIR=dist/trilium-linux-x64-server
NODE_VERSION=12.6.0

rm -r $PKG_DIR
mkdir $PKG_DIR
cd $PKG_DIR

wget https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
tar xvfJ node-v${NODE_VERSION}-linux-x64.tar.xz
rm node-v${NODE_VERSION}-linux-x64.tar.xz

mv node-v${NODE_VERSION}-linux-x64 node

cp -r ../../node_modules/ ./
cp -r ../../images/ ./
cp -r ../../libraries/ ./
cp -r ../../src/ ./
cp -r ../../db/ ./
cp -r ../../package.json ./
cp -r ../../package-lock.json ./
cp -r ../../README.md ./
cp -r ../../LICENSE ./
cp -r ../../config-sample.ini ./

rm -r ./node_modules/electron*

rm -r ./node_modules/sqlite3/lib/binding/*

cp -r ../../bin/deps/linux-x64/sqlite/node* ./node_modules/sqlite3/lib/binding/

printf "#!/bin/sh\n./node/bin/node src/www" > trilium.sh
chmod 755 trilium.sh

cd ..

VERSION=`jq -r ".version" ../package.json`

tar cJf trilium-linux-x64-server-${VERSION}.tar.xz trilium-linux-x64-server
