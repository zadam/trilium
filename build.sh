#!/bin/bash

rm -r dist/*

./node_modules/.bin/electron-rebuild

./node_modules/.bin/electron-packager . --out=dist --platform=linux,win32 --overwrite

#./node_modules/.bin/electron-installer-debian --src dist/trilium-linux-x64/ --dest dist/installers/ --arch amd64