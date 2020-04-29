#!/usr/bin/env bash

SRC_DIR=./dist/trilium-windows-x64-src

if [ "$1" != "DONTCOPY" ]
then
    ./bin/copy-trilium.sh $SRC_DIR
fi

echo "Copying required windows binaries"

rm -r $SRC_DIR/node_modules/sqlite3/lib/binding/*
rm -r $SRC_DIR/node_modules/mozjpeg/vendor/*
rm -r $SRC_DIR/node_modules/pngquant-bin/vendor/*
rm -r $SRC_DIR/node_modules/giflossy/vendor/*

cp -r bin/deps/win-x64/sqlite/* $SRC_DIR/node_modules/sqlite3/lib/binding/
cp bin/deps/win-x64/image/cjpeg.exe $SRC_DIR/node_modules/mozjpeg/vendor/
cp bin/deps/win-x64/image/pngquant.exe $SRC_DIR/node_modules/pngquant-bin/vendor/
cp bin/deps/win-x64/image/gifsicle.exe $SRC_DIR/node_modules/giflossy/vendor/

rm -r $SRC_DIR/src/public/app-dist/*.mobile.*

./node_modules/.bin/electron-packager $SRC_DIR --asar --out=dist --executable-name=trilium --platform=win32  --arch=x64 --overwrite --icon=images/app-icons/win/icon.ico

BUILD_DIR=./dist/trilium-windows-x64
rm -rf $BUILD_DIR

mv "./dist/Trilium Notes-win32-x64" $BUILD_DIR

# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

cp bin/tpl/portable-trilium.bat $BUILD_DIR/

echo "Zipping windows x64 electron distribution..."
VERSION=`jq -r ".version" package.json`

cd dist

zip -r9 trilium-windows-x64-${VERSION}.zip trilium-windows-x64
