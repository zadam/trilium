#!/usr/bin/env bash

SRC_DIR=./dist/trilium-linux-x64-src

if [ "$1" != "DONTCOPY" ]
then
    ./bin/copy-trilium.sh $SRC_DIR
fi

echo "Copying required linux-x64 binaries"

rm -r $SRC_DIR/node_modules/sqlite3/lib/binding/*
rm -r $SRC_DIR/node_modules/pngquant-bin/vendor/*

rm -r $SRC_DIR/src/public/app-dist/*.mobile.*

cp -r bin/deps/linux-x64/sqlite/* $SRC_DIR/node_modules/sqlite3/lib/binding/
cp bin/deps/linux-x64/image/pngquant $SRC_DIR/node_modules/pngquant-bin/vendor/

./node_modules/.bin/electron-packager $SRC_DIR --asar --out=dist --executable-name=trilium --platform=linux --arch=x64 --overwrite

BUILD_DIR=./dist/trilium-linux-x64
rm -rf $BUILD_DIR

mv "./dist/Trilium Notes-linux-x64" $BUILD_DIR

cp images/app-icons/png/128x128.png $BUILD_DIR/icon.png

# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

cp bin/tpl/portable-trilium.sh $BUILD_DIR/
chmod 755 $BUILD_DIR/portable-trilium.sh

echo "Packaging linux x64 electron distribution..."
VERSION=`jq -r ".version" package.json`

cd dist

tar cJf trilium-linux-x64-${VERSION}.tar.xz trilium-linux-x64

cd ..

bin/build-debian.sh