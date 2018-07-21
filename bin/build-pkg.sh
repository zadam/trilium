#!/usr/bin/env bash

PKG_DIR=dist/trilium-linux-x64-server

mkdir $PKG_DIR

pkg . --targets node8-linux-x64 --output ${PKG_DIR}/trilium

chmod +x ${PKG_DIR}/trilium

cp node_modules/sqlite3/lib/binding/node-v57-linux-x64/node_sqlite3.node ${PKG_DIR}/
cp node_modules/scrypt/build/Release/scrypt.node ${PKG_DIR}/

cd dist

7z a trilium-linux-x64-server.7z trilium-linux-x64-server