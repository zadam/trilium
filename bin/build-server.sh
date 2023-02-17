#!/usr/bin/env bash

PKG_DIR=dist/trilium-linux-x64-server
NODE_VERSION=16.19.1

if [ "$1" != "DONTCOPY" ]
then
    ./bin/copy-trilium.sh $PKG_DIR
fi

cd dist
wget https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
tar xfJ node-v${NODE_VERSION}-linux-x64.tar.xz
rm node-v${NODE_VERSION}-linux-x64.tar.xz
cd ..

mv dist/node-v${NODE_VERSION}-linux-x64 $PKG_DIR/node

rm -r $PKG_DIR/node/lib/node_modules/npm
rm -r $PKG_DIR/node/include/node

rm -r $PKG_DIR/node_modules/electron*
rm -r $PKG_DIR/webpack*
rm -r $PKG_DIR/electron.js

cp -r bin/better-sqlite3/linux-server-better_sqlite3.node $PKG_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node

printf "#!/bin/sh\n./node/bin/node src/www" > $PKG_DIR/trilium.sh
chmod 755 $PKG_DIR/trilium.sh

cp bin/tpl/anonymize-database.sql $PKG_DIR/

cp -r dump-db $PKG_DIR/
rm -rf $PKG_DIR/dump-db/node_modules

VERSION=`jq -r ".version" package.json`

cd dist

tar cJf trilium-linux-x64-server-${VERSION}.tar.xz trilium-linux-x64-server
