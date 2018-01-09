#!/usr/bin/env bash

echo "Deleting dist"

rm -r dist/*

cp -r bin/deps/sqlite/* node_modules/sqlite3/lib/binding/
cp -r bin/deps/image/cjpeg.exe node_modules/mozjpeg/vendor/
cp -r bin/deps/image/pngquant.exe node_modules/pngquant-bin/vendor/
cp -r bin/deps/image/gifsicle.exe node_modules/giflossy/vendor/

./node_modules/.bin/electron-rebuild --arch=ia32

./node_modules/.bin/electron-packager . --out=dist --platform=linux --arch=ia32 --overwrite

./node_modules/.bin/electron-rebuild --arch=x64

./node_modules/.bin/electron-packager . --out=dist --platform=linux --arch=x64 --overwrite

./node_modules/.bin/electron-packager . --out=dist --platform=win32 --arch=x64 --overwrite

# can't copy this before the packaging because the same file name is used for both linux and windows build
cp bin/deps/scrypt.node ./dist/trilium-win32-x64/resources/app/node_modules/scrypt/build/Release/
