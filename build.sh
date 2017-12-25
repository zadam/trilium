#!/bin/bash

./set-build.sh

echo "Deleting dist"

rm -r dist/*

cp -r ../trilium-node-binaries/sqlite/* node_modules/sqlite3/lib/binding/

cp -r ../trilium-node-binaries/scrypt/* node_modules/scrypt/bin/

./node_modules/.bin/electron-rebuild

./node_modules/.bin/electron-packager . --out=dist --platform=linux,win32 --overwrite

# can't copy this before the packaging because the same file name is used for both linux and windows build
cp ../trilium-node-binaries/scrypt.node ./dist/trilium-win32-x64/resources/app/node_modules/scrypt/build/Release/

VERSION=`jq -r ".version" package.json`

echo "Packaging windows distribution..."

7z a dist/trilium-windows-${VERSION}.7z dist/trilium-win32-x64

echo "Packaging linux distribution..."
tar cfJ dist/trilium-linux-${VERSION}.tar.xz dist/trilium-linux-x64

