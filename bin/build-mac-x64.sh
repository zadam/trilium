#!/usr/bin/env bash

BUILD_DIR=./dist/trilium-mac-x64
rm -rf $BUILD_DIR

./node_modules/.bin/electron-packager . --out=dist --executable-name=trilium --platform=darwin  --arch=x64 --overwrite --icon=src/public/images/app-icons/mac/icon.icns

# Mac build has by default useless directory level
mv "./dist/Trilium Notes-darwin-x64" $BUILD_DIR

echo "Copying required mac binaries"

MAC_RES_DIR=$BUILD_DIR/Trilium\ Notes.app/Contents/Resources/app

rm -r "$MAC_RES_DIR/node_modules/sqlite3/lib/binding/*"

cp -r bin/deps/mac/sqlite/* "$MAC_RES_DIR/node_modules/sqlite3/lib/binding/"
cp bin/deps/mac/image/cjpeg "$MAC_RES_DIR/node_modules/mozjpeg/vendor/"
cp bin/deps/mac/image/pngquant "$MAC_RES_DIR/node_modules/pngquant-bin/vendor/"
cp bin/deps/mac/image/gifsicle "$MAC_RES_DIR/node_modules/giflossy/vendor/"

rm -r "$MAC_RES_DIR/bin/deps"

echo "Packaging mac x64 electron distribution..."

VERSION=`jq -r ".version" package.json`
7z a $BUILD_DIR-${VERSION}.7z $BUILD_DIR