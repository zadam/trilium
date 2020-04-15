#!/usr/bin/env bash

SRC_DIR=./dist/trilium-mac-x64-src

if [ "$1" != "DONTCOPY" ]
then
    ./bin/copy-trilium.sh $SRC_DIR
fi

echo "Copying required mac binaries"

rm -r $SRC_DIR/node_modules/sqlite3/lib/binding/*
rm -r $SRC_DIR/node_modules/mozjpeg/vendor/*
rm -r $SRC_DIR/node_modules/pngquant-bin/vendor/*
rm -r $SRC_DIR/node_modules/giflossy/vendor/*

cp -r bin/deps/mac-x64/sqlite/* $SRC_DIR/node_modules/sqlite3/lib/binding/
cp bin/deps/mac-x64/image/cjpeg $SRC_DIR/node_modules/mozjpeg/vendor/
cp bin/deps/mac-x64/image/pngquant $SRC_DIR/node_modules/pngquant-bin/vendor/
cp bin/deps/mac-x64/image/gifsicle $SRC_DIR/node_modules/giflossy/vendor/

rm -r $SRC_DIR/src/public/app-dist/*.mobile.*

./node_modules/.bin/electron-packager $SRC_DIR --asar --out=dist --executable-name=trilium --platform=darwin --arch=x64 --overwrite --icon=images/app-icons/mac/icon.icns

BUILD_DIR=./dist/trilium-mac-x64
rm -rf $BUILD_DIR

# Mac build has by default useless directory level
mv "./dist/Trilium Notes-darwin-x64" $BUILD_DIR

echo "Zipping mac x64 electron distribution..."

VERSION=`jq -r ".version" package.json`

cd dist

rm trilium-mac-x64-${VERSION}.zip
zip -r9 --symlinks trilium-mac-x64-${VERSION}.zip trilium-mac-x64
