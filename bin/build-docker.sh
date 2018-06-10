#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo "Missing argument of new version"
    exit 1
fi

docker build -t zadam/trilium:latest -t zadam/trilium:$1 .