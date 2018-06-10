#!/usr/bin/env bash

if [[ $# -eq 0 ]] ; then
    echo "Missing argument of new version"
    exit 1
fi

docker push zadam/trilium:latest
docker push zadam/trilium:$1