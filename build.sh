#!/bin/bash

rm -r dist/*

./node_modules/.bin/electron-rebuild

./node_modules/.bin/electron-packager . --out=dist --platform=linux,win32 --overwrite

cp -r ../trilium-node-bindings/* node_modules/sqlite3/lib/binding/

tar cfJ dist/win.tar.xz dist/trilium-win32-x64