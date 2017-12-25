#!/usr/bin/env bash

VERSION=`jq -r ".version" package.json`

cd dist

echo "Packaging windows electron distribution..."
7z a trilium-windows-${VERSION}.7z trilium-win32-x64

echo "Packaging linux electron distribution..."
7z a trilium-linux-${VERSION}.7z trilium-linux-x64
