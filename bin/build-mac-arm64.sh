#!/usr/bin/env bash

SRC_DIR=./dist/trilium-mac-arm64-src

if [ "\$1" != "DONTCOPY" ]
then
    ./bin/copy-trilium.sh $SRC_DIR
fi

echo "Copying required mac binaries"

cp -r bin/better-sqlite3/better_sqlite3.node $SRC_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node

rm -r $SRC_DIR/src/public/app-dist/*.mobile.*

echo "Packaging mac arm64 electron build"

./node_modules/.bin/electron-packager $SRC_DIR --asar --out=dist --executable-name=trilium --platform=darwin --arch=arm64 --overwrite --icon=images/app-icons/mac/icon.icns

BUILD_DIR=./dist/trilium-mac-arm64
rm -rf $BUILD_DIR

# Mac build has by default useless directory level
mv "./dist/Trilium Notes-darwin-arm64" $BUILD_DIR

cp bin/tpl/anonymize-database.sql $BUILD_DIR/

cp -r dump-db $BUILD_DIR/
rm -rf $BUILD_DIR/dump-db/node_modules

echo "Zipping mac arm64 electron distribution..."

VERSION="0.63.5"

cd dist

rm trilium-mac-arm64-${VERSION}.zip
zip -r9 --symlinks trilium-mac-arm64-${VERSION}.zip trilium-mac-arm64