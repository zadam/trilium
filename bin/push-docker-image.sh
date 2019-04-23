#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo "Missing argument of new version"
    exit 1
fi

VERSION=$1
SERIES=${VERSION:0:4}-latest

sudo docker push zadam/trilium:$VERSION
sudo docker push zadam/trilium:$SERIES

if [[ $1 != *"beta"* ]]; then
  sudo docker push zadam/trilium:latest
fi
