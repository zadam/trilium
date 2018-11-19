#!/usr/bin/env bash

rm -r node_modules

npm install

echo "Deleting existing builds"

rm -r dist/*

echo "Rebuilding binaries for linux-ia32"
./node_modules/.bin/electron-rebuild --arch=ia32

./node_modules/.bin/electron-packager . --out=dist --executable-name=trilium --platform=linux --arch=ia32 --overwrite

mv "./dist/Trilium Notes-linux-ia32" ./dist/trilium-linux-ia32

./node_modules/.bin/electron-packager . --out=dist --executable-name=trilium --platform=win32  --arch=x64 --overwrite --icon=src/public/images/app-icons/win/icon.ico

mv "./dist/Trilium Notes-win32-x64" ./dist/trilium-win32-x64

# we build x64 as second so that we keep X64 binaries in node_modules for local development and server build
echo "Rebuilding binaries for linux-x64"
./node_modules/.bin/electron-rebuild --arch=x64

./node_modules/.bin/electron-packager . --out=dist --executable-name=trilium --platform=linux --arch=x64 --overwrite

mv "./dist/Trilium Notes-linux-x64" ./dist/trilium-linux-x64

echo "Copying required windows binaries"

WIN_RES_DIR=./dist/trilium-win32-x64/resources/app

cp -r bin/deps/sqlite/* $WIN_RES_DIR/node_modules/sqlite3/lib/binding/
cp bin/deps/image/cjpeg.exe $WIN_RES_DIR/node_modules/mozjpeg/vendor/
cp bin/deps/image/pngquant.exe $WIN_RES_DIR/node_modules/pngquant-bin/vendor/
cp bin/deps/image/gifsicle.exe $WIN_RES_DIR/node_modules/giflossy/vendor/

echo "Cleaning up unnecessary binaries from all builds"

rm -r ./dist/trilium-linux-ia32/resources/app/bin/deps
rm -r ./dist/trilium-linux-x64/resources/app/bin/deps
rm -r ./dist/trilium-win32-x64/resources/app/bin/deps