#!/usr/bin/env bash

BUILD_DIR=./dist/trilium-linux-ia32
rm -rf $BUILD_DIR

echo "Rebuilding binaries for linux-ia32"
./node_modules/.bin/electron-rebuild --arch=ia32

./node_modules/.bin/electron-packager . --out=dist --executable-name=trilium --platform=linux --arch=ia32 --overwrite

mv "./dist/Trilium Notes-linux-ia32" $BUILD_DIR

rm -r $BUILD_DIR/resources/app/bin/deps
# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

echo "Packaging linux ia32 electron distribution..."
VERSION=`jq -r ".version" package.json`
7z a $BUILD_DIR-${VERSION}.7z $BUILD_DIR