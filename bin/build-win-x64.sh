#!/usr/bin/env bash

BUILD_DIR=./dist/trilium-windows-x64
rm -rf $BUILD_DIR

echo "Copying required windows binaries"

rm -r node_modules/sqlite3/lib/binding/*
rm -r node_modules/mozjpeg/vendor/*
rm -r node_modules/pngquant-bin/vendor/*
rm -r node_modules/giflossy/vendor/*

cp -r bin/deps/win-x64/sqlite/* node_modules/sqlite3/lib/binding/
cp bin/deps/win-x64/image/cjpeg.exe node_modules/mozjpeg/vendor/
cp bin/deps/win-x64/image/pngquant.exe node_modules/pngquant-bin/vendor/
cp bin/deps/win-x64/image/gifsicle.exe node_modules/giflossy/vendor/

./node_modules/.bin/electron-packager . --asar --out=dist --executable-name=trilium --platform=win32  --arch=x64 --overwrite --icon=images/app-icons/win/icon.ico

mv "./dist/Trilium Notes-win32-x64" $BUILD_DIR

# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

./bin/reset-local.sh

echo "Zipping windows x64 electron distribution..."
VERSION=`jq -r ".version" package.json`

cd dist

zip -r9 trilium-windows-x64-${VERSION}.zip trilium-windows-x64
