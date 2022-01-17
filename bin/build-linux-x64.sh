#!/usr/bin/env bash

SRC_DIR=./dist/trilium-linux-x64-src

if [ "$1" != "DONTCOPY" ]
then
    ./bin/copy-trilium.sh $SRC_DIR
fi

rm -r $SRC_DIR/src/public/app-dist/*.mobile.*

echo "Copying required linux-x64 binaries"

cp -r bin/better-sqlite3/linux-desktop-better_sqlite3.node $SRC_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node

echo "Packaging linux x64 electron build"

./node_modules/.bin/electron-packager $SRC_DIR --asar --out=dist --executable-name=trilium --platform=linux --arch=x64 --overwrite

BUILD_DIR=./dist/trilium-linux-x64
rm -rf $BUILD_DIR

mv "./dist/Trilium Notes-linux-x64" $BUILD_DIR

cp images/app-icons/png/128x128.png $BUILD_DIR/icon.png

# removing software WebGL binaries because they are pretty huge and not necessary
rm -r $BUILD_DIR/swiftshader

cp bin/tpl/anonymize-database.sql $BUILD_DIR/

cp bin/tpl/trilium-portable.sh $BUILD_DIR/
chmod 755 $BUILD_DIR/trilium-portable.sh

cp bin/tpl/trilium-safe-mode.sh $BUILD_DIR/
chmod 755 $BUILD_DIR/trilium-safe-mode.sh

cp bin/tpl/trilium-no-cert-check.sh $BUILD_DIR/
chmod 755 $BUILD_DIR/trilium-no-cert-check.sh

echo "Packaging linux x64 electron distribution..."
VERSION=`jq -r ".version" package.json`

cd dist

tar cJf trilium-linux-x64-${VERSION}.tar.xz trilium-linux-x64

cd ..

bin/build-debian.sh
