#!/usr/bin/env bash

VERSION=`jq -r ".version" package.json`

cd dist

echo "Packaging linux x64 electron distribution..."
7z a trilium-linux-x64-${VERSION}.7z trilium-linux-x64

echo "Packaging linux ia32 electron distribution..."
7z a trilium-linux-ia32-${VERSION}.7z trilium-linux-ia32

echo "Packaging windows x64 electron distribution..."
7z a trilium-windows-x64-${VERSION}.7z trilium-win32-x64