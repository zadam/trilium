#!/usr/bin/env bash

PKG_DIR=dist/trilium-linux-x64-server
NODE_VERSION=12.16.3

if [ "$1" != "DONTCOPY" ]
then
    ./bin/copy-trilium.sh $PKG_DIR
fi

cd dist
wget https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
tar xvfJ node-v${NODE_VERSION}-linux-x64.tar.xz
rm node-v${NODE_VERSION}-linux-x64.tar.xz
cd ..

mv dist/node-v${NODE_VERSION}-linux-x64 $PKG_DIR/node

rm -r $PKG_DIR/node_modules/electron*

rm -r $PKG_DIR/node_modules/sqlite3/lib/binding/*

cp -r ./bin/deps/linux-x64/sqlite/node* $PKG_DIR/node_modules/sqlite3/lib/binding/

printf "#!/bin/sh\n./node/bin/node src/www" > $PKG_DIR/trilium.sh
chmod 755 $PKG_DIR/trilium.sh

VERSION=`jq -r ".version" package.json`

cd dist

tar cJf trilium-linux-x64-server-${VERSION}.tar.xz trilium-linux-x64-server
