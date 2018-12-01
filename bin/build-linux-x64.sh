#!/usr/bin/env bash

BUILD_DIR=./dist/trilium-linux-x64
rm -rf $BUILD_DIR

# we build x64 as second so that we keep X64 binaries in node_modules for local development and server build
echo "Rebuilding binaries for linux-x64"
./node_modules/.bin/electron-rebuild --arch=x64

./node_modules/.bin/electron-packager . --out=dist --executable-name=trilium --platform=linux --arch=x64 --overwrite

mv "./dist/Trilium Notes-linux-x64" $BUILD_DIR

rm -r $BUILD_DIR/resources/app/bin/deps
# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

echo "Packaging linux x64 electron distribution..."
VERSION=`jq -r ".version" package.json`
7z a $BUILD_DIR-${VERSION}.7z $BUILD_DIR