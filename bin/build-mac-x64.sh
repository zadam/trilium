#!/usr/bin/env bash

BUILD_DIR=./dist/trilium-mac-x64
rm -rf $BUILD_DIR

echo "Copying required mac binaries"

rm -r node_modules/sqlite3/lib/binding/*
rm -r node_modules/mozjpeg/vendor/*
rm -r node_modules/pngquant-bin/vendor/*
rm -r node_modules/giflossy/vendor/*

cp -r bin/deps/mac-x64/sqlite/* node_modules/sqlite3/lib/binding/
cp bin/deps/mac-x64/image/cjpeg node_modules/mozjpeg/vendor/
cp bin/deps/mac-x64/image/pngquant node_modules/pngquant-bin/vendor/
cp bin/deps/mac-x64/image/gifsicle node_modules/giflossy/vendor/

./node_modules/.bin/electron-packager . --asar --out=dist --executable-name=trilium --platform=darwin --arch=x64 --overwrite --icon=images/app-icons/mac/icon.icns

# Mac build has by default useless directory level
mv "./dist/Trilium Notes-darwin-x64" $BUILD_DIR

./bin/reset-local.sh

echo "Zipping mac x64 electron distribution..."

VERSION=`jq -r ".version" package.json`

cd dist

rm trilium-mac-x64-${VERSION}.zip
zip -r9 --symlinks trilium-mac-x64-${VERSION}.zip trilium-mac-x64
