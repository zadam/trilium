#!/usr/bin/env bash

BUILD_DIR=./dist/trilium-windows-x64
rm -rf $BUILD_DIR

./node_modules/.bin/electron-packager . --out=dist --executable-name=trilium --platform=win32  --arch=x64 --overwrite --icon=src/public/images/app-icons/win/icon.ico

mv "./dist/Trilium Notes-win32-x64" $BUILD_DIR

echo "Copying required windows binaries"

WIN_RES_DIR=$BUILD_DIR/resources/app

cp -r bin/deps/win/sqlite/* $WIN_RES_DIR/node_modules/sqlite3/lib/binding/
cp bin/deps/win/image/cjpeg.exe $WIN_RES_DIR/node_modules/mozjpeg/vendor/
cp bin/deps/win/image/pngquant.exe $WIN_RES_DIR/node_modules/pngquant-bin/vendor/
cp bin/deps/win/image/gifsicle.exe $WIN_RES_DIR/node_modules/giflossy/vendor/

rm -r $WIN_RES_DIR/bin/deps
# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

echo "Packaging windows x64 electron distribution..."
VERSION=`jq -r ".version" package.json`
7z a $BUILD_DIR-${VERSION}.7z $BUILD_DIR
