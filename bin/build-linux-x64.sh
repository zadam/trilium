#!/usr/bin/env bash

BUILD_DIR=./dist/trilium-linux-x64
rm -rf $BUILD_DIR

rm -r node_modules/sqlite3/lib/binding/*

cp -r bin/deps/linux-x64/sqlite/* node_modules/sqlite3/lib/binding/

./node_modules/.bin/electron-packager . --asar --out=dist --executable-name=trilium --platform=linux --arch=x64 --overwrite

mv "./dist/Trilium Notes-linux-x64" $BUILD_DIR

# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

echo "Packaging linux x64 electron distribution..."
VERSION=`jq -r ".version" package.json`

cd dist

tar cJf trilium-linux-x64-${VERSION}.tar.xz trilium-linux-x64
