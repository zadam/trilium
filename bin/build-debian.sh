#!/usr/bin/env bash

echo "Packaging debian x64 distribution..."

VERSION=`jq -r ".version" package.json`

./node_modules/.bin/electron-installer-debian --config bin/deb-options.json --options.version=${VERSION} --arch amd64


# hacky stop-gag measure to produce debian compatible XZ compressed debs until this is fixed: https://github.com/electron-userland/electron-installer-debian/issues/272
cd dist
ar x trilium_${VERSION}_amd64.deb
rm trilium_${VERSION}_amd64.deb
# recompress
< control.tar.zst zstd -d | xz > control.tar.xz
< data.tar.zst zstd -d | xz > data.tar.xz
# create deb archive (I really do not know, what argument "sdsd" is for but something is required for ar to create the archive as desired)
ar -m -c -a sdsd trilium_${VERSION}_amd64.deb debian-binary control.tar.xz data.tar.xz

rm control* data* debian-binary

echo "Converted to XZ deb"
