#!/usr/bin/env bash

echo "Deleting dist"

rm -r dist/*

cp -r ../trilium-node-binaries/sqlite/* node_modules/sqlite3/lib/binding/

cp -r ../trilium-node-binaries/scrypt/* node_modules/scrypt/bin/

./node_modules/.bin/electron-rebuild --arch=ia32

./node_modules/.bin/electron-packager . --out=dist --platform=linux --arch=ia32 --overwrite

./node_modules/.bin/electron-rebuild --arch=x64

./node_modules/.bin/electron-packager . --out=dist --platform=linux --arch=x64 --overwrite

./node_modules/.bin/electron-packager . --out=dist --platform=win32 --arch=x64 --overwrite

# can't copy this before the packaging because the same file name is used for both linux and windows build
cp ../trilium-node-binaries/scrypt.node ./dist/trilium-win32-x64/resources/app/node_modules/scrypt/build/Release/
